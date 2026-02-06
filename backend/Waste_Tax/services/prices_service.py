from services.db_service import db
import pandas as pd

async def set_base_price(waste_type: str, price: float, collector_id: str):
    await db.waste_prices.update_one(
        {"waste_type": waste_type},
        {"$set": {"base_price": price, "updated_by": collector_id, "last_updated": pd.Timestamp.now()}},
        upsert=True
    )

async def get_base_price(waste_type: str) -> float:
    record = await db.waste_prices.find_one({"waste_type": waste_type})
    return record["base_price"] if record else 0.0
