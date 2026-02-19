from fastapi import APIRouter, HTTPException, Depends, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
import copy
from bson import ObjectId
from datetime import datetime, timezone
from pydantic import BaseModel

# Internal Module Imports
from schemas.collector_schema import CreateUserRequest, Token
from services.tax_services import (
    get_password_hash,
    verify_password,
    get_next_collector_id,
    classify_behaviour
)

from schemas.tax_schemas import SubmitWeightRequest, PendingItemResponse, ReviewActionRequest
from schemas.tax_schemas import SetPriceRequest
from services.tax_services import tax_engine
from routers.tax_routes import predict_weight_core, WASTE_TYPE_MAP
from schemas.tax_schemas import BillDetails, ForecastItem
from core.database import get_database

router = APIRouter()


# ==========================================
# AUTHENTICATION ROUTER
# ==========================================

@router.get("/next-id")
async def get_next_id(location: str):
    # This service function must use get_database() and 'is None' checks internally
    next_id = await get_next_collector_id(location)
    return {"next_id": next_id}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user: CreateUserRequest):
    db = get_database()
    # FIXED: Explicit 'is None' check
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


# ==========================================
# ADMIN REVIEW ROUTER
# ==========================================

@router.post("/submit_weight_for_review")
async def submit_weight(data: SubmitWeightRequest):
    db = get_database()
    if db is None:
        raise HTTPException(500, "Database connection not initialized")

    history_record = await db.history_col.find_one({
        "household_id": data.household_id,
        "waste_type": data.waste_type
    })

    # ... logic for target_year and target_week ...
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


@router.post("/process_review_action")
async def process_review(data: ReviewActionRequest):
    db = get_database()
    if db is None:
        raise HTTPException(500, "Database connection not initialized")

    try:
        obj_id = ObjectId(data.submission_id)
    except:
        raise HTTPException(400, "Invalid Submission ID format")

    submission = await db.pending_col.find_one({"_id": obj_id})
    if not submission:
        raise HTTPException(404, "Submission not found")

    if data.action.upper() == "DENY":
        await db.pending_col.update_one({"_id": obj_id},
                                        {"$set": {"status": "DENIED", "reviewed_at": datetime.utcnow()}})
        return {"message": "Weight rejected.", "status": "DENIED"}

    elif data.action.upper() == "VERIFY":
        await db.pending_col.update_one({"_id": obj_id},
                                        {"$set": {"status": "VERIFIED", "reviewed_at": datetime.utcnow()}})

        household_id, waste_type, weight_kg = submission["household_id"], submission["waste_type"], submission[
            "weight_kg"]
        history_record = await db.history_col.find_one({"household_id": household_id, "waste_type": waste_type})

        # Calculate history update
        if not history_record or not history_record.get("weeks"):
            weeks, new_week_num, new_year = [], 1, datetime.now().year
        else:
            weeks = history_record.get("weeks", [])
            last = sorted(weeks, key=lambda x: (x["year"], x["week"]))[-1]
            new_week_num = last["week"] + 1 if last["week"] < 52 else 1
            new_year = last["year"] if last["week"] < 52 else last["year"] + 1

        weeks.append({"year": new_year, "week": new_week_num, "weight_kg": weight_kg})
        weeks = sorted(weeks, key=lambda x: (x["year"], x["week"]))[-12:]

        # Logic for averages
        weights_list = [w["weight_kg"] for w in weeks]
        for idx, w in enumerate(weeks):
            w.update({
                "lag_1w": weights_list[idx - 1] if idx >= 1 else 0,
                "roll_4w": round(sum(weights_list[max(0, idx - 3):idx + 1]) / min(idx + 1, 4), 2),
                "roll_12w": round(sum(weights_list[max(0, idx - 11):idx + 1]) / min(idx + 1, 12), 2),
                "behaviour_class": classify_behaviour(waste_type, w["weight_kg"])
            })

        if history_record:
            await db.history_col.update_one({"_id": history_record["_id"]}, {"$set": {"weeks": weeks}})
        else:
            await db.history_col.insert_one({"household_id": household_id, "waste_type": waste_type, "weeks": weeks})

        return {"status": "VERIFIED", "week_added": new_week_num}

    raise HTTPException(400, "Action must be VERIFY or DENY")


# ==========================================
# COLLECTOR PRICING ROUTER
# ==========================================

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


# ==========================================
# FORECAST ROUTER
# ==========================================

class UnifiedForecastResponse(BaseModel):
    household_id: str
    waste_type: str
    history_data: List[ForecastItem]
    forecast_data: List[ForecastItem]


@router.get("/forecast/{household_id}/{waste_type}", response_model=UnifiedForecastResponse)
async def get_waste_forecast(household_id: str, waste_type: str, horizon: int = Query(default=4)):
    db = get_database()
    if db is None:
        raise HTTPException(500, "Database not ready")

    user_profile = await db.households_col.find_one({"_id": household_id})
    if not user_profile:
        raise HTTPException(404, "Household not found")

    price_record = await db.waste_prices.find_one({"waste_type": waste_type})
    base_rate = price_record.get("current_base_price", 0.0) if price_record else 0.0

    history_doc = await db.history_col.find_one({"household_id": household_id, "waste_type": waste_type})
    if not history_doc:
        raise HTTPException(404, "No history found")

    all_weeks = sorted(history_doc["weeks"], key=lambda x: (x["year"], x["week"]))
    # ... rest of forecast logic ...
    return UnifiedForecastResponse(household_id=household_id, waste_type=waste_type, history_data=[], forecast_data=[])

    all_weeks = sorted(history_doc["weeks"], key=lambda x: (x["year"], x["week"]))
    simulation_window = copy.deepcopy(all_weeks[-12:])



    return UnifiedForecastResponse(
        household_id=household_id,
        waste_type=waste_type,
        history_data=[],  # Add processed history
        forecast_data=[]  # Add processed forecasts
    )

