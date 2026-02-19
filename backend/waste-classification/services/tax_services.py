import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from pathlib import Path
from typing import List, Optional, Dict, Any
from tensorflow.keras.models import load_model
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from fastapi import HTTPException


# ==========================================
# 1. DATABASE & CONFIGURATION (db_service.py)
# ==========================================
from core.database import get_database

db = get_database()


# ==========================================
# 2. UTILITIES & BEHAVIOUR (behaviour.py, update_week_history.py)
# ==========================================
def classify_behaviour(waste_type: str, weight: float) -> str:
    if waste_type == "Organic":
        thresholds = [0.5, 2.0, 5.0]
    elif waste_type == "Inorganic":
        thresholds = [1.0, 4.0, 8.0]
    elif waste_type == "Recyclable":
        thresholds = [0.1, 0.8, 2.5]
    else:
        return "Unknown"

    if weight <= thresholds[0]:
        return "Zero"
    elif weight <= thresholds[1]:
        return "Low"
    elif weight <= thresholds[2]:
        return "Normal"
    else:
        return "High"


def update_week_history(prev_12_weeks: List[float], new_weight: float) -> List[float]:
    prev_12_weeks = prev_12_weeks[-11:]
    prev_12_weeks.append(new_weight)
    return prev_12_weeks


# ==========================================
# 3. SECURITY & AUTH (password_hash.py)
# ==========================================
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")




def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


async def get_next_collector_id(location: str) -> str:
    # Get the database instance locally inside the function
    db = get_database()

    # Safety check to ensure the DB is connected
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection not initialized")

    users_collection = db["users"]
    regex_pattern = f"^Collector_{location}_\\d+$"
    cursor = users_collection.find({"username": {"$regex": regex_pattern}})

    users = await cursor.to_list(length=1000)
    if not users:
        return "01"

    max_num = 0
    for user in users:
        try:
            parts = user["username"].split("_")
            num_part = int(parts[-1])
            if num_part > max_num:
                max_num = num_part
        except (ValueError, IndexError):
            continue

    return f"{max_num + 1:02d}"


# ==========================================
# 4. PRICE & AGGREGATION SERVICES (prices_service.py, aggregation_service.py)
# ==========================================
async def set_base_price(waste_type: str, price: float, collector_id: str):
    await db.waste_prices.update_one(
        {"waste_type": waste_type},
        {"$set": {"base_price": price, "updated_by": collector_id, "last_updated": pd.Timestamp.now()}},
        upsert=True
    )


async def get_base_price(waste_type: str) -> float:
    record = await db.waste_prices.find_one({"waste_type": waste_type})
    return record["base_price"] if record else 0.0


async def generate_monthly_bills(year: int, month: int):
    records = db.weekly_waste.find({"year": year, "month": month, "status": "verified"})
    df = pd.DataFrame(await records.to_list(length=None))
    if df.empty: return {"status": "empty", "message": "No verified records"}

    monthly = df.groupby("household_id").apply(lambda x: x['final_bill'].sum()).reset_index().rename(
        columns={0: 'total_tax'})
    for _, row in monthly.iterrows():
        await db.monthly_bill.update_one(
            {"household_id": row['household_id'], "year": year, "month": month},
            {"$set": {"total_tax": row['total_tax'], "status": "generated"}},
            upsert=True
        )
    return {"status": "success", "generated_bills": len(monthly)}


# ==========================================
# 5. ML PREDICTORS (lstm_predictor.py, tax_predictor.py)
# ==========================================
MODELS_DIR_WASTE = Path("model/weight_model")
WASTE_CATEGORIES = ["organic", "recyclable", "inorganic"]
lstm_models, scalers_x, scalers_y = {}, {}, {}

try:
    for cat in WASTE_CATEGORIES:
        model_path = MODELS_DIR_WASTE / f"{cat}_lstm_model.keras"
        if model_path.exists():
            lstm_models[cat] = load_model(model_path)
            scalers_x[cat] = joblib.load(MODELS_DIR_WASTE / f"{cat}_scaler_x.pkl")
            scalers_y[cat] = joblib.load(MODELS_DIR_WASTE / f"{cat}_scaler_y.pkl")
except Exception as e:
    print(f"Error loading LSTM models: {e}")


def predict_weight(waste_type: str, features: np.ndarray) -> float:
    waste_type = waste_type.lower()
    model, s_x, s_y = lstm_models[waste_type], scalers_x[waste_type], scalers_y[waste_type]
    X_scaled = s_x.transform(features)
    pred_scaled = model.predict(X_scaled.reshape(1, 12, 7), verbose=0)
    return float(s_y.inverse_transform(pred_scaled)[0][0])


# Tax Predictor Logic (tax_predictor.py)
TAX_MODEL_PATH = Path("./model/tax_model/tax_rate_predictor_v1.pkl")

try:
    tax_predictor_model = joblib.load(TAX_MODEL_PATH)
except:
    tax_predictor_model = None


def calculate_tax_simple(input_dict: dict) -> dict:
    df = pd.DataFrame([input_dict])
    prediction = tax_predictor_model.predict(df)
    pred_mult, pred_disc = prediction[0]
    final = (input_dict['weight_kg'] * input_dict['base_unit_price'] * pred_mult) * (1 - pred_disc)
    return {"pred_multiplier": float(pred_mult), "pred_discount": float(pred_disc), "final_bill": float(final)}


# ==========================================
# 6. TAX ENGINES (tax_engine.py, Tax_Invoice.py)
# ==========================================
MODEL_DIR_TAX = Path("./model/tax_model")


class TaxEngine:
    def __init__(self):
        self.encoders = None
        self.m_excess = None
        self.m_discount = None
        self.load_models()

    def load_models(self):
        try:
            self.encoders = joblib.load(MODEL_DIR_TAX / "encoders.pkl")
            self.m_excess = xgb.XGBClassifier()
            self.m_excess.load_model(MODEL_DIR_TAX / "xgb_excess.json")
            self.m_discount = xgb.XGBRegressor()
            self.m_discount.load_model(MODEL_DIR_TAX / "xgb_discount.json")
        except Exception as e:
            print(f"Tax Model Load Error: {e}")

    def calculate_bill(self, weight, category, r4, r12, lag1, rate):
        if not self.encoders: return {"error": "Models not loaded"}
        cat_encoder = self.encoders['main_waste_category']
        valid_cat = next((c for c in cat_encoder.classes_ if c.lower() == category.lower()), category)
        cat_encoded = cat_encoder.transform([valid_cat])[0]

        util_ratio = weight / (r4 + 0.001)
        input_df = pd.DataFrame({'weight_kg': [weight], 'roll_4w': [r4], 'roll_12w': [r12], 'lag_1w': [lag1],
                                 'main_waste_category': [cat_encoded], 'base_tax_rate': [rate],
                                 'utilization_ratio': [util_ratio]})

        is_excess = self.m_excess.predict(input_df)[0]
        disc_rate = np.clip(self.m_discount.predict(input_df)[0], 0.0, 1.0)

        base_cost = weight * rate
        status = "PENALTY" if is_excess == 1 else "Normal"
        cost_after_penalty = base_cost * (1.5 if is_excess == 1 else 1.0)

        return {
            "status": status, "base_cost": round(base_cost, 2),
            "penalty_amount": round(cost_after_penalty - base_cost, 2),
            "discount_percent": round(float(disc_rate) * 100, 1),
            "discount_amount": round(cost_after_penalty * disc_rate, 2),
            "final_bill": round(cost_after_penalty * (1 - disc_rate), 2), "utilization_ratio": round(util_ratio, 2)
        }


tax_engine = TaxEngine()


# Invoice Generator Logic (Tax_Invoice.py)
def generate_invoice(weight, category, income, r4, r12, rate, scenario_name="User Input"):
    # Reuses TaxEngine logic or similar internal model loading
    try:
        encoders = joblib.load(MODEL_DIR_TAX / "encoders.pkl")
        m_tax = xgb.XGBRegressor()
        m_tax.load_model(MODEL_DIR_TAX / "xgb_tax.json")

        cat_encoded = encoders['main_waste_category'].transform([category])[0]
        inc_encoded = encoders['income_tier'].transform([income])[0]

        input_df = pd.DataFrame({'weight_kg': [weight], 'roll_4w': [r4], 'roll_12w': [r12],
                                 'main_waste_category': [cat_encoded], 'income_tier': [inc_encoded],
                                 'base_tax_rate': [rate]})

        final_bill = max(0.0, m_tax.predict(input_df)[0])
        print(f"\n--- INVOICE: {scenario_name} ---")
        print(f"Weight: {weight}kg | Category: {category} | Final Bill: Rs {final_bill:.2f}")
    except Exception as e:
        print(f"Invoice Error: {e}")


# ==========================================
# 7. EXECUTION (Main Block)
# ==========================================
if __name__ == "__main__":
    print("System initialized.")
    # Example Weight Prediction
    dummy_input = np.random.rand(12, 7)
    try:
        res = predict_weight("organic", dummy_input)
        print(f"LSTM Prediction (Organic): {res:.2f} kg")
    except:
        pass

    # Example Tax Calculation
    bill = tax_engine.calculate_bill(20.5, "Inorganic", 2.1, 2.4, 2.0, 15.0)
    print(f"Tax Engine Bill Status: {bill.get('status')} | Final: {bill.get('final_bill')}")

    # Example Invoice
    generate_invoice(20.5, "Inorganic", "low", 2.1, 2.4, 15.0, "Massive Spike Test")