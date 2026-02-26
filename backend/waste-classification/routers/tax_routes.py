from services.tax_services import classify_behaviour
from services.tax_services import tax_engine
from schemas.tax_schemas import CreateUserRequest, AddWeekRequest
from schemas.tax_schemas import PredictNextRequest, WeightOutput
from schemas.tax_schemas import DashboardResponse, BillDetails, HistoryTaxResponse, HistoricalBillItem
from schemas.tax_schemas import GenerateMonthlyBillResponse, EmptyMonthlyBillResponse
from schemas.tax_schemas import TaxInput, TaxOutput
from schemas.tax_schemas import SubmitWeightRequest, PendingItemResponse, ReviewActionRequest
from datetime import datetime
from tensorflow.keras.models import load_model
from pathlib import Path
import numpy as np
import joblib
import pandas as pd
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Query
from core.database import get_database

router = APIRouter()

MODELS_DIR = Path("model/weight_model")
TAX_MODEL_PATH = Path("./model/tax_model/tax_rate_predictor_v1.pkl")
WASTE_TYPES_LIST = ["Organic", "Recyclable", "Inorganic"]
SEQ_LEN = 12

WASTE_TYPE_MAP = {
    "Organic": "organic",
    "Recyclable": "recyclable",
    "Inorganic": "inorganic"
}

FEATURE_KEYS = [
    'lag_1w', 'lag_2w', 'lag_4w',
    'roll_4w', 'roll_8w', 'roll_12w',
    'week'
]

WASTE_TYPES = ["Organic", "Recyclable", "Inorganic"]

lstm_models = {}
scalers_x = {}
scalers_y = {}
tax_model = None

try:

    for display_name in WASTE_TYPES_LIST:
        key = WASTE_TYPE_MAP[display_name]
        model_path = MODELS_DIR / f"{key}_lstm_model.keras"
        sx_path = MODELS_DIR / f"{key}_scaler_x.pkl"
        sy_path = MODELS_DIR / f"{key}_scaler_y.pkl"

        if model_path.exists() and sx_path.exists() and sy_path.exists():
            lstm_models[key] = load_model(model_path)
            scalers_x[key] = joblib.load(sx_path)
            scalers_y[key] = joblib.load(sy_path)


    if TAX_MODEL_PATH.exists():
        tax_model = joblib.load(TAX_MODEL_PATH)
except Exception as e:
    print(f"Critical Error loading models: {e}")


def predict_weight_core(waste_key: str, features_sequence: list) -> float:
    if waste_key not in lstm_models:
        return 0.0
    model = lstm_models[waste_key]
    scaler_x = scalers_x[waste_key]
    scaler_y = scalers_y[waste_key]
    data_matrix = [[float(week_data.get(k, 0)) for k in FEATURE_KEYS] for week_data in features_sequence]
    if len(data_matrix) < SEQ_LEN:
        return 0.0
    X = np.array(data_matrix)
    X_scaled = scaler_x.transform(X)
    X_input = X_scaled.reshape(1, SEQ_LEN, len(FEATURE_KEYS))
    pred_scaled = model.predict(X_input, verbose=0)
    pred_kg = scaler_y.inverse_transform(pred_scaled)
    return float(max(0.0, pred_kg[0][0]))


def get_price_for_week(price_doc, target_year, target_week, base_rate):
    if not price_doc or "history" not in price_doc:
        return base_rate
    for entry in reversed(price_doc["history"]):
        if (entry["year"] < target_year) or (entry["year"] == target_year and entry["week"] <= target_week):
            return entry["price"]
    return price_doc["history"][0]["price"] if price_doc["history"] else base_rate


async def handle_cold_start(data, base_rate):
    bill = tax_engine.calculate_bill(
        weight=data.current_weight_kg, category=data.waste_type,
        r4=data.current_weight_kg, r12=data.current_weight_kg,
        lag1=0.0, rate=base_rate
    )
    return DashboardResponse(
        household_id=data.household_id, waste_type=data.waste_type,
        current_week_number=1, current_bill=BillDetails(weight_kg=data.current_weight_kg, **bill),
        next_week_number=2,
        predicted_bill=BillDetails(weight_kg=0.0, status="Unknown", base_cost=0, discount_amount=0, penalty_amount=0,
                                   final_bill=0)
    )



@router.get("/household/check_by_email/{email}")
async def check_household_by_email(email: str):
    db = get_database()
    if db is None: raise HTTPException(500, "Database connection not ready")

    clean_email = email.strip().lower()
    household = await db.households_col.find_one({"linked_email": clean_email})
    if household:
        return {"exists": True, "household_id": household["_id"], "email": clean_email}
    return {"exists": False, "email": clean_email}


@router.post("/create_user")
async def create_user(user: CreateUserRequest):
    db = get_database()
    if db is None: raise HTTPException(500, "Database connection not ready")

    user_email = user.email.strip().lower()
    if await db.households_col.find_one({"_id": user.household_id}):
        raise HTTPException(status_code=400, detail="Household ID already exists")
    if await db.households_col.find_one({"linked_email": user_email}):
        raise HTTPException(status_code=400, detail="User already has a household linked.")

    await db.households_col.insert_one({
        "_id": user.household_id, "linked_email": user_email,
        "income_tier": user.income_tier, "qr_code": user.qr_code, "created_at": datetime.utcnow()
    })

    for wtype in WASTE_TYPES_LIST:
        if wtype not in user.waste_data or len(user.waste_data[wtype]) < SEQ_LEN:
            await db.households_col.delete_one({"_id": user.household_id})
            raise HTTPException(status_code=400, detail=f"Missing or insufficient history for {wtype}")

        week_list = sorted(user.waste_data[wtype], key=lambda x: (x.year, x.week))
        weights = [w.weight_kg for w in week_list]
        rows = []
        for idx, w in enumerate(week_list):
            row = {
                "year": w.year, "week": w.week, "weight_kg": w.weight_kg,
                "lag_1w": weights[idx - 1] if idx >= 1 else 0,
                "lag_2w": weights[idx - 2] if idx >= 2 else 0,
                "lag_4w": weights[idx - 4] if idx >= 4 else 0,
                "roll_4w": round(sum(weights[max(0, idx - 3):idx + 1]) / min(idx + 1, 4), 2),
                "roll_8w": round(sum(weights[max(0, idx - 7):idx + 1]) / min(idx + 1, 8), 2),
                "roll_12w": round(sum(weights[max(0, idx - 11):idx + 1]) / min(idx + 1, 12), 2),
                "behaviour_class": classify_behaviour(wtype, w.weight_kg)
            }
            rows.append(row)
        await db.history_col.insert_one({"household_id": user.household_id, "waste_type": wtype, "weeks": rows})
    return {"message": "User created with 12-week history"}


@router.get("/get_next_id")
async def get_next_id(location: str):
    db = get_database()
    if db is None: raise HTTPException(500, "Database connection not ready")

    pattern = f"^HH-{location}-"
    cursor = db.households_col.find({"_id": {"$regex": pattern}}, {"_id": 1})
    existing_ids = await cursor.to_list(length=10000)
    max_seq = 0
    for doc in existing_ids:
        try:
            max_seq = max(max_seq, int(doc["_id"].split("-")[-1]))
        except:
            continue
    return {"next_id": f"HH-{location}-{max_seq + 1:02d}"}


@router.get("/get_weeks/{household_id}")
async def get_weeks(household_id: str):
    db = get_database()
    if db is None: raise HTTPException(500, "Database connection not ready")

    result = {}
    for wtype in ["Organic", "Recyclable", "Sanitary Waste", "General_Waste"]:
        record = await db.history_col.find_one({"household_id": household_id, "waste_type": wtype})
        result[wtype] = record.get("weeks", []) if record else []
    household = await db.households_col.find_one({"_id": household_id})
    return {"household_id": household_id, "income_tier": household["income_tier"] if household else None,
            "waste_data": result}



@router.post("/process_weekly_waste", response_model=DashboardResponse)
async def process_weekly_waste(data: PredictNextRequest):
    db = get_database()
    if db is None: raise HTTPException(500, "Database connection not ready")

    user_profile = await db.households_col.find_one({"_id": data.household_id})
    if not user_profile: raise HTTPException(404, "Household not found")

    price_record = await db.waste_prices.find_one({"waste_type": data.waste_type})
    base_rate = price_record.get("base_price", price_record.get("current_base_price", 0.0)) if price_record else 0.0

    history = await db.history_col.find_one({"household_id": data.household_id, "waste_type": data.waste_type})
    if not history: return await handle_cold_start(data, base_rate)

    raw_weeks = sorted(history["weeks"], key=lambda x: (x["year"], x["week"]))
    last_entry = raw_weeks[-1]
    curr_week_num = last_entry["week"] + 1 if last_entry["week"] < 52 else 1
    curr_year = last_entry["year"] if last_entry["week"] < 52 else last_entry["year"] + 1

    working_window = raw_weeks[-11:] + [{
        "year": curr_year, "week": curr_week_num, "weight_kg": data.current_weight_kg,
        "roll_4w": 0, "roll_12w": 0, "lag_1w": 0, "lag_2w": 0, "lag_4w": 0
    }]

    weights = [w["weight_kg"] for w in working_window]
    for i, w in enumerate(working_window):
        w["lag_1w"] = weights[i - 1] if i >= 1 else 0
        w["roll_4w"] = sum(weights[max(0, i - 3):i + 1]) / min(i + 1, 4)
        w["roll_12w"] = sum(weights[max(0, i - 11):i + 1]) / min(i + 1, 12)

    cur = working_window[-1]
    current_bill_data = tax_engine.calculate_bill(data.current_weight_kg, data.waste_type, cur["roll_4w"],
                                                  cur["roll_12w"], cur["lag_1w"], base_rate)

    predicted_kg = round(predict_weight_core(WASTE_TYPE_MAP.get(data.waste_type), working_window), 2)

    future_weights = weights + [predicted_kg]
    f_idx = len(future_weights) - 1
    future_bill_data = tax_engine.calculate_bill(
        predicted_kg, data.waste_type,
        sum(future_weights[max(0, f_idx - 3):f_idx + 1]) / 4,
        sum(future_weights[max(0, f_idx - 11):f_idx + 1]) / 12,
        data.current_weight_kg, base_rate
    )

    return DashboardResponse(
        household_id=data.household_id, waste_type=data.waste_type, current_week_number=curr_week_num,
        current_bill=BillDetails(weight_kg=data.current_weight_kg, **current_bill_data),
        next_week_number=curr_week_num + 1,
        predicted_bill=BillDetails(weight_kg=predicted_kg, **future_bill_data)
    )


@router.post("/sync_missing_weeks/{household_id}")
async def sync_missing_weeks(household_id: str):
    db = get_database()
    if db is None: raise HTTPException(500, "Database connection not ready")

    current_year, current_week, _ = datetime.now().isocalendar()
    actions_log = []
    for wtype in WASTE_TYPES_LIST:
        history = await db.history_col.find_one({"household_id": household_id, "waste_type": wtype})
        if not (history and "weeks" in history): continue

        sorted_weeks = sorted(history["weeks"], key=lambda x: (x["year"], x["week"]))
        check_week = sorted_weeks[-1]["week"] + 1

        while check_week < current_week:
            if not await db.pending_col.find_one(
                    {"household_id": household_id, "waste_type": wtype, "year": current_year, "week": check_week}):
                predicted_val = round(predict_weight_core(WASTE_TYPE_MAP[wtype], sorted_weeks[-SEQ_LEN:]), 2)
                await db.pending_col.insert_one({
                    "household_id": household_id, "waste_type": wtype, "weight_kg": predicted_val,
                    "year": current_year, "week": check_week, "status": "REVIEW", "is_auto_filled": True,
                    "submitted_at": datetime.utcnow()
                })
                actions_log.append(f"Auto-filled {wtype} Wk {check_week}")
            check_week += 1
    return {"status": "sync_complete", "actions": actions_log}



@router.get("/generate_monthly/{year}/{month}", response_model=GenerateMonthlyBillResponse)
async def generate_monthly_bill(year: int, month: int):
    db = get_database()
    if db is None: raise HTTPException(500, "Database connection not ready")

    records = await db.weekly_waste.find({"year": year, "month": month, "status": "verified"}).to_list(length=None)
    if not records: return EmptyMonthlyBillResponse(status="empty", message="No records")
    df = pd.DataFrame(records)
    monthly = df.groupby("household_id")['final_bill'].sum().reset_index()
    for _, row in monthly.iterrows():
        await db.monthly_bill.update_one(
            {"household_id": row['household_id'], "year": year, "month": month},
            {"$set": {"total_tax": row['final_bill'], "status": "generated"}}, upsert=True
        )
    return GenerateMonthlyBillResponse(status="success", month=month, year=year, generated_bills=len(monthly))


@router.post("/calculate_tax", response_model=TaxOutput)
def calculate_tax(input: TaxInput):
    if not tax_model: raise HTTPException(500, "Tax model not loaded")
    prediction = tax_model.predict(pd.DataFrame([input.dict()]))[0]
    final_bill = (input.weight_kg * input.base_unit_price * prediction[0]) * (1 - prediction[1])
    return TaxOutput(pred_multiplier=float(prediction[0]), pred_discount=float(prediction[1]),
                     final_bill=float(final_bill))


@router.post("/add_week")
async def add_week(data: AddWeekRequest):
    db = get_database()
    if db is None: raise HTTPException(500, "Database connection not ready")

    record = await db.history_col.find_one({"household_id": data.household_id, "waste_type": data.waste_type})
    if not record: raise HTTPException(404, "Not found")

    weeks = record.get("weeks", []) + [{"year": data.year, "week": data.week, "weight_kg": data.weight_kg}]
    weeks = sorted(weeks, key=lambda x: (x["year"], x["week"]))[-12:]

    weights = [w["weight_kg"] for w in weeks]
    for idx, w in enumerate(weeks):
        w.update({
            "lag_1w": weights[idx - 1] if idx >= 1 else 0,
            "roll_4w": round(sum(weights[max(0, idx - 3):idx + 1]) / min(idx + 1, 4), 2),
            "roll_12w": round(sum(weights[max(0, idx - 11):idx + 1]) / min(idx + 1, 12), 2),
            "behaviour_class": classify_behaviour(data.waste_type, w["weight_kg"])
        })
    await db.history_col.update_one({"_id": record["_id"]}, {"$set": {"weeks": weeks}})
    return {"message": "Week added", "latest_behaviour": weeks[-1]["behaviour_class"]}


@router.get("/households")
async def get_all_households():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not ready")

    cursor = db.households_col.find({}, {"_id": 1})
    households = await cursor.to_list(length=10000)
    return households


@router.get("/all_pending_reviews")
async def get_all_pending_reviews(location: Optional[str] = Query(None)):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not ready")

    query = {"status": "REVIEW"}

    if location:

        query["household_id"] = {"$regex": location, "$options": "i"}

    cursor = db.pending_col.find(query).sort("submitted_at", 1)

    results = []
    async for doc in cursor:
        results.append({
            "submission_id": str(doc["_id"]),
            "household_id": doc["household_id"],
            "waste_type": doc["waste_type"],
            "weight_kg": doc["weight_kg"],
            "week": doc.get("week", "N/A"),
            "status": doc["status"],
            "submitted_at": doc["submitted_at"]
        })
    return results


@router.post("/predict_next_week", response_model=WeightOutput)
async def predict_next_week(data: PredictNextRequest):

    db = get_database()

    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not ready")

    model_key = WASTE_TYPE_MAP.get(data.waste_type)
    if not model_key:
        raise HTTPException(400, "Invalid waste type")


    record = await db.history_col.find_one({
        "household_id": data.household_id,
        "waste_type": data.waste_type
    })

    if not record or "weeks" not in record:
        raise HTTPException(404, "No history found.")

    weeks = record.get("weeks", [])
    weeks = sorted(weeks, key=lambda x: (x["year"], x["week"]))

    last_entry = weeks[-1]
    current_year = last_entry["year"]
    current_week = last_entry["week"]

    if current_week >= 52:
        new_year = current_year + 1
        new_week = 1
    else:
        new_year = current_year
        new_week = current_week + 1

    weeks.append({
        "year": new_year,
        "week": new_week,
        "weight_kg": data.current_weight_kg
    })

    updated_window = weeks[-12:]
    window_weights = [w["weight_kg"] for w in updated_window]

    for idx, w in enumerate(updated_window):
        w["roll_4w"] = round(sum(window_weights[max(0, idx - 3):idx + 1]) / min(idx + 1, 4), 2)
        w["roll_8w"] = round(sum(window_weights[max(0, idx - 7):idx + 1]) / min(idx + 1, 8), 2)
        w["roll_12w"] = round(sum(window_weights[max(0, idx - 11):idx + 1]) / min(idx + 1, 12), 2)

        w["lag_1w"] = window_weights[idx - 1] if idx >= 1 else 0.0
        w["lag_2w"] = window_weights[idx - 2] if idx >= 2 else 0.0
        w["lag_4w"] = window_weights[idx - 4] if idx >= 4 else 0.0

        w["behaviour_class"] = classify_behaviour(data.waste_type, w["weight_kg"])

    try:
        predicted_kg = predict_weight_core(model_key, updated_window)
    except Exception as e:
        print(f"Prediction Error: {e}")
        predicted_kg = 0.0

    await db.history_col.update_one(
        {"_id": record["_id"]},
        {"$set": {"weeks": updated_window}}
    )

    return WeightOutput(predicted_weight_kg=round(predicted_kg, 2))


@router.get("/history_statement/{household_id}/{waste_type}", response_model=HistoryTaxResponse)
async def get_tax_history(household_id: str, waste_type: str):

    db = get_database()

    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not ready")

    price_record = await db.waste_prices.find_one({"waste_type": waste_type})
    base_rate = 0.0
    if price_record:
        base_rate = price_record.get("base_price", price_record.get("current_base_price", 0.0))

    record = await db.history_col.find_one({"household_id": household_id, "waste_type": waste_type})
    if not record or "weeks" not in record:
        raise HTTPException(404, "No history found")

    weeks = sorted(record["weeks"], key=lambda x: (x["year"], x["week"]))
    report_items = []

    prev_weight = 0.0

    for i, w in enumerate(weeks):

        historical_rate = get_price_for_week(price_record, w["year"], w["week"], base_rate)
        if historical_rate == 0.0: historical_rate = base_rate


        lag1 = prev_weight if i > 0 else 0.0

        bill_data = tax_engine.calculate_bill(
            weight=w["weight_kg"],
            category=waste_type,
            r4=w.get("roll_4w", 0),
            r12=w.get("roll_12w", 0),
            lag1=lag1,
            rate=historical_rate
        )

        report_items.append(HistoricalBillItem(
            year=w["year"],
            week=w["week"],
            weight_kg=w["weight_kg"],
            status=bill_data["status"],
            base_cost=bill_data["base_cost"],
            discount_amount=bill_data["discount_amount"],
            penalty_amount=bill_data["penalty_amount"],
            final_bill=bill_data["final_bill"]
        ))


        prev_weight = w["weight_kg"]

    return HistoryTaxResponse(
        household_id=household_id,
        waste_type=waste_type,
        base_rate_used=base_rate,
        history=report_items
    )

@router.get("/my_submissions/{household_id}/{waste_type}")
async def get_my_submissions(household_id: str, waste_type: str):

    db = get_database()


    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not ready")


    cursor = db.pending_col.find({
        "household_id": household_id,
        "waste_type": waste_type,
        "status": {"$in": ["REVIEW", "DENIED"]}
    }).sort("submitted_at", -1)

    results = []
    async for doc in cursor:
        results.append({
            "submission_id": str(doc["_id"]),
            "year": doc.get("year"),
            "week": doc.get("week"),
            "weight_kg": doc["weight_kg"],
            "status": doc["status"],
            "submitted_at": doc["submitted_at"]
        })
    return results


@router.get("/pending_reviews", response_model=List[PendingItemResponse])
async def get_pending_reviews():

    db = get_database()


    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not ready")


    cursor = db.pending_col.find({"status": "REVIEW"})

    results = []
    async for doc in cursor:
        results.append(PendingItemResponse(
            submission_id=str(doc["_id"]),
            household_id=doc["household_id"],
            waste_type=doc["waste_type"],
            weight_kg=doc["weight_kg"],
            status=doc["status"],
            submitted_at=doc["submitted_at"],
            week=doc.get("week", 0)
        ))
    return results



@router.get("/pending_reviews/{household_id}", response_model=List[PendingItemResponse])
async def get_household_pending_reviews(household_id: str, location: Optional[str] = Query(None)):
    db = get_database() #
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not ready") #


    query = {"household_id": household_id, "status": "REVIEW"} #


    if location:

        query["household_id"] = {"$regex": f".*{location}.*", "$options": "i"} #

    cursor = db.pending_col.find(query) #
    results = []
    async for doc in cursor:
        results.append(PendingItemResponse(
            submission_id=str(doc["_id"]),
            household_id=doc["household_id"],
            waste_type=doc["waste_type"],
            weight_kg=doc["weight_kg"],
            status=doc["status"],
            submitted_at=doc["submitted_at"],
            week=doc.get("week", 0)
        ))
    return results

@router.get("/predict_next_week/{household_id}")
async def predict_next_week(household_id: str):

    db = get_database()


    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not ready")


    household = await db.households_col.find_one({"_id": household_id})
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")

    predictions = {}

    for wtype in WASTE_TYPES:
        model_key = WASTE_TYPE_MAP[wtype]

        record = await db.history_col.find_one({
            "household_id": household_id,
            "waste_type": wtype
        })

        prediction_val = None

        if record and "weeks" in record:
            weeks_data = record["weeks"]
            if len(weeks_data) >= SEQ_LEN:
                input_sequence = weeks_data[-SEQ_LEN:]
                try:
                    raw_pred = predict_weight_core(model_key, input_sequence)
                    prediction_val = round(max(0.0, raw_pred), 2)
                except Exception:
                    prediction_val = 0.0

        predictions[wtype] = {
            "predicted_next_week_kg": prediction_val
        }

    return {
        "household_id": household_id,
        "waste_data": predictions
    }


@router.get("/household/profile/{household_id}")
async def get_household_profile(household_id: str):

    db = get_database()  #

    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not ready")

    household = await db.households_col.find_one({"_id": household_id})

    if not household:
        raise HTTPException(status_code=404, detail="Household profile not found")

    return {
        "household_id": household.get("_id"),
        "linked_email": household.get("linked_email", "N/A"),
        "income_tier": household.get("income_tier", "Unknown"),
        "qr_code": household.get("qr_code", ""),
        "created_at": {
            "$date": household.get("created_at", datetime.utcnow())
        }
    }
