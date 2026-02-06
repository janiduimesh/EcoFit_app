from fastapi import APIRouter, HTTPException
from services.db_service import db
from services.behaviour import classify_behaviour
from schemas.create_user import CreateUserRequest
from datetime import datetime

router = APIRouter()

WASTE_TYPES = ["Organic", "Inorganic", "Recyclable"]
SEQ_LEN = 12


@router.get("/household/check_by_email/{email}")
async def check_household_by_email(email: str):
    # 1. Sanitize input
    clean_email = email.strip().lower()

    # 2. Find the household
    household = await db.households_col.find_one({"linked_email": clean_email})

    if household:
        # IMPORTANT: You must return the household_id so the frontend can use it!
        return {
            "exists": True,
            "household_id": household["_id"],  # This was missing
            "email": clean_email
        }

    return {"exists": False, "email": clean_email}


@router.post("/create_user")
async def create_user(user: CreateUserRequest):
    # Sanitize email before checking or saving
    user_email = user.email.strip().lower()

    # Check if household ID already exists
    existing_id = await db.households_col.find_one({"_id": user.household_id})
    if existing_id:
        raise HTTPException(status_code=400, detail="Household ID already exists")

    # Check if a household is already linked to this email (sanitized check)
    existing_user = await db.households_col.find_one({"linked_email": user_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already has a household linked.")

    # Insert the new household with sanitized email
    await db.households_col.insert_one({
        "_id": user.household_id,
        "linked_email": user_email,  # Save as lowercase
        "income_tier": user.income_tier,
        "qr_code": user.qr_code,
        "created_at": datetime.utcnow()
    })

    # Validate and insert 12-week waste history
    for wtype in WASTE_TYPES:
        if wtype not in user.waste_data or len(user.waste_data[wtype]) < SEQ_LEN:
            # Rollback if data is insufficient
            await db.households_col.delete_one({"_id": user.household_id})
            raise HTTPException(
                status_code=400,
                detail=f"Missing or insufficient (must be >= {SEQ_LEN}) 12-week history for {wtype}"
            )

        week_list = sorted(user.waste_data[wtype], key=lambda x: (x.year, x.week))
        weights = [w.weight_kg for w in week_list]
        rows = []

        for idx, w in enumerate(week_list):
            lag_1w = weights[idx - 1] if idx >= 1 else 0
            lag_2w = weights[idx - 2] if idx >= 2 else 0
            lag_4w = weights[idx - 4] if idx >= 4 else 0
            roll_4w = sum(weights[max(0, idx - 3):idx + 1]) / min(idx + 1, 4)
            roll_8w = sum(weights[max(0, idx - 7):idx + 1]) / min(idx + 1, 8)
            roll_12w = sum(weights[max(0, idx - 11):idx + 1]) / min(idx + 1, 12)

            behaviour = classify_behaviour(wtype, w.weight_kg)

            rows.append({
                "year": w.year,
                "week": w.week,
                "weight_kg": w.weight_kg,
                "lag_1w": lag_1w,
                "lag_2w": lag_2w,
                "lag_4w": lag_4w,
                "roll_4w": round(roll_4w, 2),
                "roll_8w": round(roll_8w, 2),
                "roll_12w": round(roll_12w, 2),
                "behaviour_class": behaviour
            })

        await db.history_col.insert_one({
            "household_id": user.household_id,
            "waste_type": wtype,
            "weeks": rows
        })

    return {"message": "User created with 12-week history for all waste types"}



@router.get("/get_next_id")
async def get_next_id(location: str):
    pattern = f"^HH-{location}-"

    cursor = db.households_col.find({"_id": {"$regex": pattern}}, {"_id": 1})
    existing_ids = await cursor.to_list(length=10000)

    if not existing_ids:
        return {"next_id": f"HH-{location}-01"}

    max_seq = 0
    for doc in existing_ids:
        try:
            parts = doc["_id"].split("-")
            seq_num = int(parts[-1])
            if seq_num > max_seq:
                max_seq = seq_num
        except (ValueError, IndexError):
            continue

    next_seq = max_seq + 1
    formatted_id = f"HH-{location}-{next_seq:02d}"

    return {"next_id": formatted_id}


@router.get("/households")
async def get_all_households():
    cursor = db.households_col.find({}, {"_id": 1})
    households = await cursor.to_list(length=10000)
    return households