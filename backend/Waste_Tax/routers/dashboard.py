from fastapi import APIRouter, HTTPException
from services.db_service import db
from services.tax_engine import tax_engine
from schemas.weight_schemas import PredictNextRequest
from schemas.dashboard import DashboardResponse, BillDetails, HistoryTaxResponse, HistoricalBillItem

# Import your LSTM prediction function
from routers.weight import predict_weight_core, WASTE_TYPE_MAP

router = APIRouter()


@router.post("/process_weekly_waste", response_model=DashboardResponse)
async def process_weekly_waste(data: PredictNextRequest):
    # 1. Fetch User (Income tier logic removed from calculation, but kept here if needed for logging)
    user_profile = await db.households_col.find_one({"_id": data.household_id})
    if not user_profile:
        raise HTTPException(404, "Household not found")

    # 2. Fetch Price
    price_record = await db.waste_prices.find_one({"waste_type": data.waste_type})
    base_rate = 0.0
    if price_record:
        base_rate = price_record.get("base_price", price_record.get("current_base_price", 0.0))

    # 3. Fetch History
    history = await db.history_col.find_one({
        "household_id": data.household_id,
        "waste_type": data.waste_type
    })

    if not history:
        return await handle_cold_start(data, base_rate)

    # 4. Prepare Data Window
    raw_weeks = sorted(history["weeks"], key=lambda x: (x["year"], x["week"]))

    last_entry = raw_weeks[-1]
    curr_week_num = last_entry["week"] + 1 if last_entry["week"] < 52 else 1
    curr_year = last_entry["year"] if last_entry["week"] < 52 else last_entry["year"] + 1

    # Grab last 11 weeks + current new entry
    working_window = raw_weeks[-11:]

    current_entry = {
        "year": curr_year,
        "week": curr_week_num,
        "weight_kg": data.current_weight_kg,
        "roll_4w": 0, "roll_12w": 0, "lag_1w": 0, "lag_2w": 0, "lag_4w": 0
    }
    working_window.append(current_entry)

    # 5. Calculate Features (Lags & Rolling)
    weights = [w["weight_kg"] for w in working_window]

    for i, w in enumerate(working_window):
        # Lags
        w["lag_1w"] = weights[i - 1] if i >= 1 else 0
        w["lag_2w"] = weights[i - 2] if i >= 2 else 0
        w["lag_4w"] = weights[i - 4] if i >= 4 else 0

        # Rolling
        w["roll_4w"] = sum(weights[max(0, i - 3):i + 1]) / min(i + 1, 4)
        w["roll_12w"] = sum(weights[max(0, i - 11):i + 1]) / min(i + 1, 12)

    # Extract features for CURRENT calculation
    curr_r4 = working_window[-1]["roll_4w"]
    curr_r12 = working_window[-1]["roll_12w"]
    curr_lag1 = working_window[-1]["lag_1w"]

    # 6. Calculate Current Bill
    current_bill_data = tax_engine.calculate_bill(
        weight=data.current_weight_kg,
        category=data.waste_type,
        r4=curr_r4,
        r12=curr_r12,
        lag1=curr_lag1,  # Added lag1
        rate=base_rate
    )

    # 7. Predict Future Weight
    model_key = WASTE_TYPE_MAP.get(data.waste_type)
    predicted_kg = 0.0

    try:
        # predict_weight_core usually expects the window *before* the target,
        # or handles the logic internally. Assuming it works with the current window:
        predicted_kg = predict_weight_core(model_key, working_window)
        predicted_kg = round(max(0.0, predicted_kg), 2)
    except Exception as e:
        print(f"LSTM Error: {e}")
        predicted_kg = curr_r4

    # 8. Calculate Future Features
    # The 'current' weight becomes the 'lag1' for the future prediction
    future_lag1 = data.current_weight_kg

    future_weights_list = weights + [predicted_kg]
    fut_idx = len(future_weights_list) - 1

    future_r4 = sum(future_weights_list[max(0, fut_idx - 3):fut_idx + 1]) / 4
    future_r12 = sum(future_weights_list[max(0, fut_idx - 11):fut_idx + 1]) / 12

    # 9. Calculate Predicted Bill
    future_bill_data = tax_engine.calculate_bill(
        weight=predicted_kg,
        category=data.waste_type,
        r4=future_r4,
        r12=future_r12,
        lag1=future_lag1,  # Current weight is the lag for next week
        rate=base_rate
    )

    return DashboardResponse(
        household_id=data.household_id,
        waste_type=data.waste_type,
        current_week_number=curr_week_num,
        current_bill=BillDetails(
            weight_kg=data.current_weight_kg,
            status=current_bill_data["status"],
            base_cost=current_bill_data["base_cost"],
            discount_amount=current_bill_data["discount_amount"],
            penalty_amount=current_bill_data["penalty_amount"],
            final_bill=current_bill_data["final_bill"]
        ),
        next_week_number=curr_week_num + 1,
        predicted_bill=BillDetails(
            weight_kg=predicted_kg,
            status=future_bill_data["status"],
            base_cost=future_bill_data["base_cost"],
            discount_amount=future_bill_data["discount_amount"],
            penalty_amount=future_bill_data["penalty_amount"],
            final_bill=future_bill_data["final_bill"]
        )
    )


async def handle_cold_start(data, base_rate):
    # For cold start, lag1 is 0
    bill = tax_engine.calculate_bill(
        weight=data.current_weight_kg,
        category=data.waste_type,
        r4=data.current_weight_kg,  # Approximate roll with current
        r12=data.current_weight_kg,
        lag1=0.0,
        rate=base_rate
    )

    return DashboardResponse(
        household_id=data.household_id,
        waste_type=data.waste_type,
        current_week_number=1,
        current_bill=BillDetails(weight_kg=data.current_weight_kg, **bill),
        next_week_number=2,
        predicted_bill=BillDetails(weight_kg=0.0, status="Unknown", base_cost=0, discount_amount=0, penalty_amount=0,
                                   final_bill=0)
    )


def get_price_for_week(price_doc, target_year, target_week):
    if not price_doc or "history" not in price_doc:
        return 0.0
    for entry in reversed(price_doc["history"]):
        if (entry["year"] < target_year) or (entry["year"] == target_year and entry["week"] <= target_week):
            return entry["price"]
    return price_doc["history"][0]["price"] if price_doc["history"] else 0.0


@router.get("/history_statement/{household_id}/{waste_type}", response_model=HistoryTaxResponse)
async def get_tax_history(household_id: str, waste_type: str):
    # 1. Fetch Price Info
    price_record = await db.waste_prices.find_one({"waste_type": waste_type})
    base_rate = 0.0
    if price_record:
        base_rate = price_record.get("base_price", price_record.get("current_base_price", 0.0))

    # 2. Fetch History Record
    record = await db.history_col.find_one({"household_id": household_id, "waste_type": waste_type})
    if not record or "weeks" not in record:
        raise HTTPException(404, "No history found")

    weeks = sorted(record["weeks"], key=lambda x: (x["year"], x["week"]))
    report_items = []

    # Track previous weight to determine Lag1 dynamically
    prev_weight = 0.0

    for i, w in enumerate(weeks):
        historical_rate = get_price_for_week(price_record, w["year"], w["week"])
        if historical_rate == 0.0: historical_rate = base_rate

        # Determine Lag1: use previous week's weight if available
        lag1 = prev_weight if i > 0 else 0.0

        # Calculate Bill
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

        # Update prev_weight for next iteration
        prev_weight = w["weight_kg"]

    return HistoryTaxResponse(
        household_id=household_id,
        waste_type=waste_type,
        base_rate_used=base_rate,
        history=report_items
    )