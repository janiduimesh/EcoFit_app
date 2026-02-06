from services.db_service import db
import pandas as pd

async def generate_monthly_bills(year: int, month: int):
    records = db.weekly_waste.find({"year": year, "month": month, "status": "verified"})
    df = pd.DataFrame(await records.to_list(length=None))
    if df.empty:
        return {"status": "empty", "message": "No verified records"}

    monthly = df.groupby("household_id").apply(lambda x: x['final_bill'].sum()).reset_index().rename(columns={0: 'total_tax'})
    for _, row in monthly.iterrows():
        await db.monthly_bill.update_one(
            {"household_id": row['household_id'], "year": year, "month": month},
            {"$set": {"total_tax": row['total_tax'], "status": "generated"}},
            upsert=True
        )
    return {"status": "success", "generated_bills": len(monthly)}
