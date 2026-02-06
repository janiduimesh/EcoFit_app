from fastapi import APIRouter, HTTPException
from services.db_service import db
from schemas.pricing import SetPriceRequest
from datetime import datetime, timezone

router = APIRouter(prefix="/pricing", tags=["Collector Pricing Portal"])


@router.get("/get_price/{waste_type}")
async def get_price_details(waste_type: str):

    doc = await db.waste_prices.find_one({"waste_type": waste_type})

    if not doc:
        return {
            "waste_type": waste_type,
            "current_base_price": 0.0,
            "history": [],
            "message": "No price history found for this type"
        }

    return {
        "waste_type": doc["waste_type"],
        # Provide fallback if field is missing
        "current_base_price": doc.get("current_base_price", doc.get("base_price", 0.0)),
        "history": doc.get("history", []),
        "last_updated": doc.get("last_updated")
    }


@router.post("/set_price")
async def set_price(data: SetPriceRequest):
    iso_year, iso_week, _ = data.effective_date.isocalendar()

    existing_doc = await db.waste_prices.find_one({"waste_type": data.waste_type})

    if not existing_doc:
        # Create new document
        price_entry = {
            "year": iso_year,
            "week": iso_week,
            "price": data.price,
            "updated_by": data.collector_id,
            "set_at": datetime.now(timezone.utc)
        }

        await db.waste_prices.insert_one({
            "waste_type": data.waste_type,
            "current_base_price": data.price,
            "history": [price_entry],
            "last_updated": datetime.now(timezone.utc)
        })
        status = "Created new price history"

    else:
        # Update existing document
        history = existing_doc.get("history", [])
        found = False


        for entry in history:
            if entry["year"] == iso_year and entry["week"] == iso_week:
                entry["price"] = data.price
                entry["updated_by"] = data.collector_id
                entry["set_at"] = datetime.now(timezone.utc)
                found = True
                status = f"Updated price for Week {iso_week}, {iso_year}"
                break


        if not found:
            history.append({
                "year": iso_year,
                "week": iso_week,
                "price": data.price,
                "updated_by": data.collector_id,
                "set_at": datetime.now(timezone.utc)
            })
            status = f"Set new price for Week {iso_week}, {iso_year}"


        history.sort(key=lambda x: (x["year"], x["week"]))

        latest_price = history[-1]["price"]

        await db.waste_prices.update_one(
            {"waste_type": data.waste_type},
            {
                "$set": {
                    "history": history,
                    "current_base_price": latest_price,
                    "base_price": latest_price,
                    "last_updated": datetime.now(timezone.utc)
                }
            }
        )

    return {
        "message": status,
        "waste_type": data.waste_type,
        "effective_week": iso_week,
        "effective_year": iso_year,
        "price": data.price
    }