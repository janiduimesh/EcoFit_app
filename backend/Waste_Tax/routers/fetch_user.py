from fastapi import APIRouter, HTTPException
from services.db_service import db

router = APIRouter()
WASTE_TYPES = ["Organic", "Recyclable", "Sanitary Waste", "General_Waste"]


@router.get("/get_weeks/{household_id}")
async def get_weeks(household_id: str):
    result = {}

    for wtype in WASTE_TYPES:
        record = await db.history_col.find_one({
            "household_id": household_id,
            "waste_type": wtype
        })
        if record:

            result[wtype] = record.get("weeks", [])
        else:
            result[wtype] = []

    if not any(result.values()):
        raise HTTPException(404, f"No waste data found for household {household_id}")


    household = await db.households_col.find_one({"_id": household_id})
    income_tier = household["income_tier"] if household else None

    return {
        "household_id": household_id,
        "income_tier": income_tier,
        "waste_data": result
    }
