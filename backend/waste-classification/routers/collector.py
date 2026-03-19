from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from typing import List, Optional
import copy
import asyncio
from bson import ObjectId
from pydantic import BaseModel
import re
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from schemas.collector_schema import (
    CreateUserRequest, Token, UnifiedForecastResponse,
    LeaderboardEntry, CardCreateRequest,
    CardResponse, AdjustmentRequest,
    RewardDistributionRequest, RewardSettingsRequest )

from services.tax_services import (
    get_password_hash,
    verify_password,
    get_next_collector_id,
    classify_behaviour
)
from schemas.tax_schemas import SubmitWeightRequest, ReviewActionRequest, SetPriceRequest
from services.tax_services import tax_engine
from routers.tax_routes import predict_weight_core, WASTE_TYPE_MAP
from schemas.tax_schemas import BillDetails, ForecastItem
from core.database import get_database

router = APIRouter()

@router.get("/next-id")
async def get_next_id(location: str):

    next_id = await get_next_collector_id(location)
    return {"next_id": next_id}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user: CreateUserRequest):
    db = get_database()

    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not initialized")

    users_collection = db["users"]
    existing_user = await users_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already exists. Please refresh to generate a new ID."
        )
    hashed_password = get_password_hash(user.password)
    user_doc = {
        "username": user.username,
        "location": user.location,
        "role": user.role,
        "hashed_password": hashed_password
    }
    await users_collection.insert_one(user_doc)
    return {"message": "User registered successfully", "username": user.username}


@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not initialized")

    users_collection = db["users"]
    user = await users_collection.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = f"jwt-token-for-{user['username']}"
    return {"access_token": access_token, "token_type": "bearer"}



@router.post("/submit_weight_for_review")
async def submit_weight(data: SubmitWeightRequest):
    db = get_database()
    if db is None:
        raise HTTPException(500, "Database connection not initialized")

    history_record = await db.history_col.find_one({
        "household_id": data.household_id,
        "waste_type": data.waste_type
    })


    if not history_record or not history_record.get("weeks"):
        target_year, target_week = datetime.now().year, 1
    else:
        weeks = history_record["weeks"]
        last_entry = sorted(weeks, key=lambda x: (x["year"], x["week"]))[-1]
        if last_entry["week"] < 52:
            target_week, target_year = last_entry["week"] + 1, last_entry["year"]
        else:
            target_week, target_year = 1, last_entry["year"] + 1

    existing_pending = await db.pending_col.find_one({
        "household_id": data.household_id,
        "waste_type": data.waste_type,
        "year": target_year,
        "week": target_week,
        "status": "REVIEW"
    })

    if existing_pending:
        await db.pending_col.update_one(
            {"_id": existing_pending["_id"]},
            {"$set": {"weight_kg": data.weight_kg, "submitted_at": datetime.utcnow()}}
        )
        action, submission_id = "Updated", str(existing_pending["_id"])
    else:
        new_submission = {
            "household_id": data.household_id, "waste_type": data.waste_type,
            "weight_kg": data.weight_kg, "year": target_year, "week": target_week,
            "status": "REVIEW", "submitted_at": datetime.utcnow()
        }
        result = await db.pending_col.insert_one(new_submission)
        action, submission_id = "Created", str(result.inserted_id)

    return {"message": f"Submission {action} successfully.", "submission_id": submission_id, "week": target_week,
            "year": target_year, "status": "REVIEW"}


@router.get("/get_price/{waste_type}")
async def get_price_details(waste_type: str):
    db = get_database()
    if db is None:
        raise HTTPException(500, "Database connection not initialized")
    doc = await db.waste_prices.find_one({"waste_type": waste_type})
    if not doc:
        return {"waste_type": waste_type, "current_base_price": 0.0, "message": "No price history found"}
    return {
        "waste_type": doc["waste_type"],
        "current_base_price": doc.get("current_base_price", doc.get("base_price", 0.0)),
        "history": doc.get("history", [])
    }


@router.post("/set_price")
async def set_price(data: SetPriceRequest):
    db = get_database()
    if db is None:
        raise HTTPException(500, "Database connection not initialized")
    iso_year, iso_week, _ = data.effective_date.isocalendar()
    existing_doc = await db.waste_prices.find_one({"waste_type": data.waste_type})

    new_entry = {
        "year": iso_year, "week": iso_week, "price": data.price,
        "updated_by": data.collector_id, "set_at": datetime.now(timezone.utc)
    }

    if not existing_doc:
        await db.waste_prices.insert_one({
            "waste_type": data.waste_type, "current_base_price": data.price,
            "history": [new_entry], "last_updated": datetime.now(timezone.utc)
        })
    else:
        history = existing_doc.get("history", [])
        history = [h for h in history if not (h["year"] == iso_year and h["week"] == iso_week)]
        history.append(new_entry)
        history.sort(key=lambda x: (x["year"], x["week"]))
        await db.waste_prices.update_one(
            {"waste_type": data.waste_type},
            {"$set": {"history": history, "current_base_price": history[-1]["price"],
                      "last_updated": datetime.now(timezone.utc)}}
        )
    return {"message": "Price updated successfully", "price": data.price}




def get_next_date(year, week):
    if week >= 52:
        return year + 1, 1
    return year, week + 1

@router.get("/forecast/{household_id}/{waste_type}", response_model=UnifiedForecastResponse)

async def get_waste_forecast(
        household_id: str,
        waste_type: str,
        horizon: int = Query(default=4)
):
    db = get_database()
    if db is None:
        raise HTTPException(500, "Database connection not initialized")

    user_profile = await db.households_col.find_one({"_id": household_id})
    if not user_profile:
        raise HTTPException(404, "Household not found")


    price_record = await db.waste_prices.find_one({"waste_type": waste_type})
    base_rate = price_record.get("current_base_price", 0.0) if price_record else 0.0


    history_doc = await db.history_col.find_one({
        "household_id": household_id,
        "waste_type": waste_type
    })

    if not history_doc or "weeks" not in history_doc:
        raise HTTPException(404, "No history found")

    all_weeks = sorted(history_doc["weeks"], key=lambda x: (x["year"], x["week"]))

    simulation_window = copy.deepcopy(all_weeks[-12:])

    history_results = []


    for i, entry in enumerate(simulation_window):
        actual_weight = entry.get("weight_kg", 0.0)


        r4 = entry.get("roll_4w", actual_weight)
        r12 = entry.get("roll_12w", actual_weight)


        lag1 = simulation_window[i - 1]["weight_kg"] if i > 0 else 0.0

        bill_data = tax_engine.calculate_bill(
            weight=actual_weight,
            category=waste_type,
            r4=r4,
            r12=r12,
            lag1=lag1,
            rate=base_rate
        )


        bill_data["weight_kg"] = actual_weight



        history_results.append(ForecastItem(
            week_offset=- (len(simulation_window) - i),
            year=entry["year"],
            week=entry["week"],
            predicted_weight_kg=actual_weight,
            estimated_bill=BillDetails(**bill_data)
        ))


    forecast_results = []
    model_key = WASTE_TYPE_MAP.get(waste_type)

    curr_year = simulation_window[-1]["year"]
    curr_week = simulation_window[-1]["week"]

    for i in range(1, horizon + 1):

        vals = [x["weight_kg"] for x in simulation_window]
        for idx, w in enumerate(simulation_window):
            w["lag_1w"] = vals[idx - 1] if idx >= 1 else 0
            w["lag_2w"] = vals[idx - 2] if idx >= 2 else 0
            w["lag_4w"] = vals[idx - 4] if idx >= 4 else 0


        try:
            predicted_val = predict_weight_core(model_key, simulation_window)
            predicted_val = max(0.0, round(predicted_val, 2))
        except:
            predicted_val = 0.0


        future_vals = [w["weight_kg"] for w in simulation_window] + [predicted_val]
        r4 = sum(future_vals[-4:]) / 4
        r12 = sum(future_vals[-12:]) / 12


        lag1_for_calc = simulation_window[-1]["weight_kg"]


        bill_data = tax_engine.calculate_bill(
            weight=predicted_val,
            category=waste_type,
            r4=r4,
            r12=r12,
            lag1=lag1_for_calc,
            rate=base_rate
        )
        bill_data["weight_kg"] = predicted_val


        curr_year, curr_week = get_next_date(curr_year, curr_week)

        forecast_results.append(ForecastItem(
            week_offset=i,
            year=curr_year,
            week=curr_week,
            predicted_weight_kg=predicted_val,
            estimated_bill=BillDetails(**bill_data)
        ))


        simulation_window.append({
            "year": curr_year,
            "week": curr_week,
            "weight_kg": predicted_val
        })
        if len(simulation_window) > 12:
            simulation_window.pop(0)

    return UnifiedForecastResponse(
        household_id=household_id,
        waste_type=waste_type,
        history_data=history_results,
        forecast_data=forecast_results
    )



@router.post("/process_review_action")
async def process_review(data: ReviewActionRequest):

    db = get_database()
    if db is None:
        raise HTTPException(500, "Database connection failed")

    try:
        obj_id = ObjectId(data.submission_id)
    except:
        raise HTTPException(400, "Invalid Submission ID format")


    submission = await db.pending_col.find_one({"_id": obj_id})
    if not submission:
        raise HTTPException(404, "Submission not found")


    if data.action.upper() == "DENY":
        await db.pending_col.update_one(
            {"_id": obj_id},
            {"$set": {"status": "DENIED", "reviewed_at": datetime.now(timezone.utc)}}
        )
        return {"message": "Weight rejected.", "status": "DENIED"}


    elif data.action.upper() == "VERIFY":
        household_id = submission["household_id"]
        waste_type = submission["waste_type"]
        weight_kg = submission["weight_kg"]


        normalized_type = waste_type.strip().capitalize()
        price_doc = await db.waste_prices.find_one({"waste_type": normalized_type})
        base_rate = price_doc.get("current_base_price", 0.0) if price_doc else 0.0


        history_record = await db.history_col.find_one({
            "household_id": household_id,
            "waste_type": waste_type
        })
        weeks = history_record.get("weeks", []) if history_record else []
        lag1 = weeks[-1]["weight_kg"] if weeks else 0.0

        all_weights = [w["weight_kg"] for w in weeks] + [weight_kg]
        r4 = sum(all_weights[-4:]) / min(len(all_weights), 4)
        r12 = sum(all_weights[-12:]) / min(len(all_weights), 12)

        bill_calculation = tax_engine.calculate_bill(
            weight=weight_kg,
            category=waste_type,
            r4=r4,
            r12=r12,
            lag1=lag1,
            rate=base_rate
        )


        reward_credit = 0.0

        reward = await db.rewards.find_one({
            "household_id": household_id,
            "status": "AVAILABLE"
        })

        if reward:
            reward_credit = float(reward.get("amount", 0.0))

            await db.rewards.update_one(
                {"_id": reward["_id"]},
                {"$set": {"status": "USED", "applied_to_bill": obj_id}}
            )


        base_cost = float(bill_calculation.get("base_cost", 0.0))
        penalty_amount = float(bill_calculation.get("penalty_amount", 0.0))
        discount_amount = float(bill_calculation.get("discount_amount", 0.0))
        subtotal = float(bill_calculation.get("final_bill", 0.0))


        final_amount = max(0.0, round(subtotal - reward_credit, 2))


        new_entry = {
            "year": int(submission.get("year", datetime.now().year)),
            "week": int(submission.get("week", 1)),
            "weight_kg": float(weight_kg),
            "lag_1w": float(lag1),
            "roll_4w": float(round(r4, 2)),
            "roll_12w": float(round(r12, 2)),
            "behaviour_class": classify_behaviour(waste_type, weight_kg)
        }
        await db.history_col.update_one(
            {"household_id": household_id, "waste_type": waste_type},
            {"$push": {"weeks": {"$each": [new_entry], "$slice": -12}}},
            upsert=True
        )


        bill_doc = {
            "household_id": household_id,
            "submission_id": obj_id,
            "waste_type": waste_type,
            "weight_kg": float(weight_kg),
            "year": int(new_entry["year"]),
            "week": int(new_entry["week"]),
            "base_cost": base_cost,
            "penalty_amount": penalty_amount,
            "discount_amount": discount_amount,
            "reward_deduction": float(reward_credit),
            "final_bill": float(final_amount),
            "status": "UNPAID",
            "created_at": datetime.now(timezone.utc)
        }
        bill_result = await db.bills.insert_one(bill_doc)


        await db.pending_col.update_one(
            {"_id": obj_id},
            {"$set": {"status": "VERIFIED", "reviewed_at": datetime.now(timezone.utc)}}
        )

        return {
            "status": "VERIFIED",
            "bill_id": str(bill_result.inserted_id),
            "subtotal": subtotal,
            "reward_applied": reward_credit,
            "final_bill": final_amount
        }

    raise HTTPException(400, "Invalid Action")



@router.post("/pay-bill/{bill_id}")
async def pay_bill(bill_id: str):
    db = get_database()
    try:
        obj_id = ObjectId(bill_id)
    except:
        raise HTTPException(400, "Invalid Bill ID")


    result = await db.bills.update_one(
        {"_id": obj_id},
        {"$set": {"status": "PAID", "paid_at": datetime.now(timezone.utc)}}
    )

    if result.matched_count == 0:
        raise HTTPException(404, "Bill record not found")

    return {"message": "Payment successful", "status": "PAID"}



@router.get("/my-bills/{household_id}")
async def get_user_bills(household_id: str):
    db = get_database()
    cursor = db.bills.find({"household_id": household_id}).sort("created_at", -1)
    bills = await cursor.to_list(length=50)

    for b in bills:
        b["_id"] = str(b["_id"])
        b["submission_id"] = str(b["submission_id"])

    return bills


@router.post("/pay-multiple-bills")
async def pay_multiple_bills(data: dict):
    db = get_database()
    bill_ids = data.get("bill_ids", [])

    if not bill_ids:
        raise HTTPException(400, "No bills selected for payment")

    try:

        obj_ids = [ObjectId(bid) for bid in bill_ids]


        result = await db.bills.update_many(
            {"_id": {"$in": obj_ids}},
            {"$set": {
                "status": "PAID",
                "paid_at": datetime.now(timezone.utc),
                "payment_method": "Visa Simulation"
            }}
        )

        return {
            "message": f"Successfully paid {result.modified_count} bills",
            "status": "PAID"
        }
    except Exception as e:
        raise HTTPException(500, detail=str(e))




@router.get("/leaderboard/weekly")
async def get_weekly_leaderboard(year: int = Query(...), week: int = Query(...)):
    db = get_database()
    pipeline = [
        {"$match": {"status": "PAID", "year": year, "week": week}},
        {
            "$group": {
                "_id": "$household_id",
                "paid_types": {"$addToSet": "$waste_type"},
                "total_paid": {"$sum": "$final_bill"},
                "total_weight": {"$sum": "$weight_kg"},
                "base_cost": {"$sum": "$base_cost"},
                "penalty": {"$sum": "$penalty_amount"},
                "discount": {"$sum": "$discount_amount"}
            }
        },
        {"$match": {"$expr": {"$eq": [{"$size": "$paid_types"}, 3]}}},
        {"$lookup": {"from": "households_col", "localField": "_id", "foreignField": "_id", "as": "profile"}},
        {"$unwind": "$profile"},
        {"$sort": {"total_paid": 1}},
        {
            "$project": {
                "household_id": "$_id",
                "household_name": "$profile.name",
                "total_paid": {"$round": ["$total_paid", 2]},
                "total_weight": {"$round": ["$total_weight", 2]},
                "base_cost": {"$round": ["$base_cost", 2]},
                "penalty_amount": {"$round": ["$penalty", 2]},
                "discount_amount": {"$round": ["$discount", 2]},
                "consistency": {"$literal": "3/3 Types"}
            }
        }
    ]
    results = await db.bills.aggregate(pipeline).to_list(length=50)
    return [{"rank": i + 1, **item} for i, item in enumerate(results)]


from datetime import datetime, timedelta

def get_weeks_for_month(year: int, month: int):

    first_day = datetime(year, month, 1)
    if month == 12:
        last_day = datetime(year + 1, 1, 1) - timedelta(days=1)
    else:
        last_day = datetime(year, month + 1, 1) - timedelta(days=1)

    start_week = first_day.isocalendar()[1]
    end_week = last_day.isocalendar()[1]

    if end_week < start_week:
        return list(range(start_week, 53)) + list(range(1, end_week + 1))

    return list(range(start_week, end_week + 1))

@router.get("/leaderboard/monthly")
async def get_monthly_leaderboard(year: int, month: int):
    db = get_database()

    target_weeks = get_weeks_for_month(year, month)
    required_count = len(target_weeks) * 3

    pipeline = [
        {
            "$match": {
                "status": "PAID",
                "year": year,
                "week": {"$in": target_weeks}
            }
        },
        {
            "$group": {
                "_id": "$household_id",
                "unique_activities": {
                    "$addToSet": {
                        "$concat": [{"$toString": "$week"}, "-", "$waste_type"]
                    }
                },
                "total_paid": {"$sum": "$final_bill"},
                "total_weight": {"$sum": "$weight_kg"},
                "base_cost": {"$sum": "$base_cost"},
                "penalty_amount": {"$sum": "$penalty_amount"},
                "discount_amount": {"$sum": "$discount_amount"}
            }
        },
        {
            "$addFields": {
                "activity_count": {"$size": "$unique_activities"}
            }
        },
        {"$match": {"activity_count": {"$gte": required_count}}},
        {"$lookup": {
            "from": "households_col",
            "localField": "_id",
            "foreignField": "_id",
            "as": "profile"
        }},
        {"$unwind": "$profile"},
        {"$sort": {"total_paid": 1}},
        {"$project": {
            "household_id": "$_id",
            "household_name": "$profile.name",
            "total_paid": {"$round": ["$total_paid", 2]},
            "total_weight": {"$round": ["$total_weight", 2]},
            "base_cost": {"$round": ["$base_cost", 2]},
            "penalty_amount": {"$round": ["$penalty_amount", 2]},
            "discount_amount": {"$round": ["$discount_amount", 2]},
            "consistency": {"$concat": [
                {"$toString": "$activity_count"}, "/", str(required_count), " Collections"
            ]}
        }}
    ]
    results = await db.bills.aggregate(pipeline).to_list(length=50)
    return [{"rank": i + 1, **item} for i, item in enumerate(results)]


@router.post("/cards", status_code=201)
async def add_payment_card(card: CardCreateRequest):
    db = get_database()

    if len(card.card_number) < 16:
        raise HTTPException(400, "Invalid card number length")

    new_card = {
        "household_id": card.household_id,
        "card_holder": card.card_holder,
        "last4": card.card_number[-4:],
        "expiry": card.expiry,
        "card_type": card.card_type,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.payment_methods.insert_one(new_card)
    return {"message": "Card added", "card_id": str(result.inserted_id)}


@router.get("/cards/{household_id}", response_model=List[CardResponse])
async def get_cards(household_id: str):
    db = get_database()
    cursor = db.payment_methods.find({"household_id": household_id})
    cards = await cursor.to_list(length=10)
    return [
        CardResponse(
            card_id=str(c["_id"]),
            card_holder=c["card_holder"],
            last4=c["last4"],
            expiry=c["expiry"],
            card_type=c["card_type"]
        ) for c in cards
    ]


@router.delete("/cards/{card_id}")
async def delete_card(card_id: str):
    db = get_database()
    try:
        result = await db.payment_methods.delete_one({"_id": ObjectId(card_id)})
        if result.deleted_count == 0:
            raise HTTPException(404, "Card not found")
        return {"message": "Card deleted"}
    except Exception:
        raise HTTPException(400, "Invalid Card ID format")


@router.get("/regional_unpaid_bills/{collector_name}")
async def get_regional_unpaid_bills(collector_name: str):
    db = get_database()
    if db is None:
        raise HTTPException(500, "Database connection failed")


    try:
        parts = collector_name.split('_')
        location = parts[1] if len(parts) > 1 else ""
    except Exception:
        raise HTTPException(400, "Invalid collector name format")

    if not location:
        raise HTTPException(400, "Could not determine area from collector name")


    location_pattern = re.compile(f".*{location}.*", re.IGNORECASE)

    cursor = db.bills.find({
        "household_id": {"$regex": location_pattern},
        "status": "UNPAID"
    }).sort("created_at", -1)

    bills = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["submission_id"] = str(doc["submission_id"])

        if "created_at" in doc and isinstance(doc["created_at"], datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        bills.append(doc)

    return bills

@router.post("/pay-single-bill/{bill_id}")
async def pay_single_bill(bill_id: str):
    db = get_database()
    if db is None:
        raise HTTPException(500, "Database connection failed")

    try:
        obj_id = ObjectId(bill_id)
    except Exception:
        raise HTTPException(400, "Invalid Bill ID format")


    result = await db.bills.update_one(
        {"_id": obj_id, "status": "UNPAID"},
        {"$set": {
            "status": "PAID",
            "paid_at": datetime.now(timezone.utc),
            "payment_method": "Visa Simulation"
        }}
    )

    if result.modified_count == 0:
        raise HTTPException(404, "Bill not found or already paid")

    return {
        "message": "Payment successful",
        "bill_id": bill_id,
        "status": "PAID"
    }


@router.patch("/admin/reward-settings")
async def update_reward_settings(settings: RewardSettingsRequest):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection failed")

    await db.settings.update_one(
        {"type": "global_rewards"},
        {"$set": {
            "rank1_pct": settings.rank1_pct,
            "rank2_pct": settings.rank2_pct,
            "rank3_pct": settings.rank3_pct,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )

    return {
        "message": "Reward policy updated successfully",
        "applied_rates": {
            "rank1_pct": settings.rank1_pct,
            "rank2_pct": settings.rank2_pct,
            "rank3_pct": settings.rank3_pct
        }
    }
@router.post("/admin/distribute-rewards")
async def distribute_rewards(req: RewardDistributionRequest):
    db = get_database()

    winners = await db.bills.aggregate([
        {"$match": {"year": req.year, "month": req.month, "status": "PAID"}},
        {"$group": {"_id": "$household_id", "monthly_total": {"$sum": "$final_bill"}}},
        {"$sort": {"monthly_total": 1}},
        {"$limit": 3}
    ]).to_list(length=3)

    issued = 0
    pacts = [req.rank1_pct/100, req.rank2_pct/100, req.rank3_pct/100]

    for i, winner in enumerate(winners):
        amt = round(winner["monthly_total"] * pacts[i], 2)
        exists = await db.rewards.find_one({"household_id": winner["_id"], "year": req.year, "month": req.month})
        if not exists and amt > 0:
            await db.rewards.insert_one({
                "household_id": winner["_id"], "amount": amt, "status": "AVAILABLE",
                "year": req.year, "month": req.month, "created_at": datetime.now(timezone.utc)
            })
            issued += 1
    return {"issued": issued}

@router.get("/admin/reward-settings")
async def get_reward_settings():
    db = get_database()
    if db is None:
        raise HTTPException(500, "Database connection failed")


    settings = await db.settings.find_one({"type": "global_rewards"})

    if not settings:

        return {"rank1_pct": 12.0, "rank2_pct": 10.0, "rank3_pct": 8.0}


    return {
        "rank1_pct": settings.get("rank1_pct", 12.0),
        "rank2_pct": settings.get("rank2_pct", 10.0),
        "rank3_pct": settings.get("rank3_pct", 8.0)
    }


@router.patch("/adjust-bill/{bill_id}")
async def adjust_bill(bill_id: str, adj: AdjustmentRequest):
    db = get_database()
    try:
        obj_id = ObjectId(bill_id)
        bill = await db.bills.find_one({"_id": obj_id})

        current_deduction = bill.get("reward_deduction", 0.0)
        original_price = bill["final_bill"] + current_deduction
        new_final = max(0, original_price - adj.amount)

        await db.bills.update_one(
            {"_id": obj_id},
            {"$set": {
                "reward_deduction": adj.amount,
                "final_bill": new_final,
                "adjustment_reason": adj.reason
            }}
        )
        return {"status": "UPDATED", "new_total": new_final}
    except:
        raise HTTPException(400, "Update failed")

async def automated_distribution_task():

    db = get_database()
    today = datetime.now(timezone.utc)
    target = (today.replace(day=1) - timedelta(days=1))

    settings = await db.settings.find_one({"type": "global_rewards"})
    rates = settings if settings else {"rank1_pct": 12.0, "rank2_pct": 10.0, "rank3_pct": 8.0}

    req = RewardDistributionRequest(year=target.year, month=target.month, **rates)
    await distribute_rewards(req)

def run_monthly_reward_automation():

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(automated_distribution_task())
    finally:
        loop.close()

scheduler = BackgroundScheduler()
scheduler.add_job(run_monthly_reward_automation, 'cron', day=1, hour=0, minute=1)
scheduler.start()

