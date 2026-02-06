from fastapi import APIRouter, HTTPException
from services.db_service import db
from services.behaviour import classify_behaviour
from schemas.create_user import AddWeekRequest

router = APIRouter()

@router.post("/add_week")
async def add_week(data: AddWeekRequest):


    record = await db.history_col.find_one({
        "household_id": data.household_id,
        "waste_type": data.waste_type
    })
    if not record:
        raise HTTPException(404, "Household/waste type not found")

    weeks = record.get("weeks", [])


    weeks.append({
        "year": data.year,
        "week": data.week,
        "weight_kg": data.weight_kg
    })


    weeks = sorted(weeks, key=lambda x: (x["year"], x["week"]))[-12:]


    weights = [w["weight_kg"] for w in weeks]
    for idx, w in enumerate(weeks):
        w["lag_1w"] = weights[idx-1] if idx >= 1 else 0
        w["lag_2w"] = weights[idx-2] if idx >= 2 else 0
        w["lag_4w"] = weights[idx-4] if idx >= 4 else 0
        w["roll_4w"] = sum(weights[max(0, idx-3):idx+1]) / min(idx+1, 4)
        w["roll_8w"] = sum(weights[max(0, idx-7):idx+1]) / min(idx+1, 8)
        w["roll_12w"] = sum(weights[max(0, idx-11):idx+1]) / min(idx+1, 12)
        w["behaviour_class"] = classify_behaviour(data.waste_type, w["weight_kg"])


    await db.history_col.update_one(
        {"_id": record["_id"]},
        {"$set": {"weeks": weeks}}
    )

    return {"message": "Week added & behaviour updated", "latest_behaviour": weeks[-1]["behaviour_class"]}
