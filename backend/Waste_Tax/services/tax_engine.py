import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
from pathlib import Path

MODEL_DIR = Path("models_tax_system")


class TaxEngine:
    def __init__(self):
        self.encoders = None
        self.m_excess = None
        self.m_discount = None
        self.load_models()

    def load_models(self):
        try:
            print("Loading Tax Models...")
            self.encoders = joblib.load(MODEL_DIR / "encoders.pkl")

            self.m_excess = xgb.XGBClassifier()
            self.m_excess.load_model(MODEL_DIR / "xgb_excess.json")

            self.m_discount = xgb.XGBRegressor()
            self.m_discount.load_model(MODEL_DIR / "xgb_discount.json")

            print("Tax Models Loaded")
        except Exception as e:
            print(f"Error loading Tax models: {e}")

    def calculate_bill(self, weight, category, r4, r12, lag1, rate):

        if not self.encoders:
            return {"error": "Models not loaded"}


        cat_encoder = self.encoders['main_waste_category']


        valid_cat_match = next(
            (c for c in cat_encoder.classes_ if c.lower() == category.lower()),
            category
        )

        try:
            cat_encoded = cat_encoder.transform([valid_cat_match])[0]
        except Exception as e:
            print(f"Encoding Error: {e} (Input: {category})")
            return {"error": f"Invalid Category '{category}'"}


        util_ratio = weight / (r4 + 0.001)


        input_df = pd.DataFrame({
            'weight_kg': [weight],
            'roll_4w': [r4],
            'roll_12w': [r12],
            'lag_1w': [lag1],
            'main_waste_category': [cat_encoded],
            'base_tax_rate': [rate],
            'utilization_ratio': [util_ratio]
        })

        is_excess = self.m_excess.predict(input_df)[0]

        disc_rate = np.clip(self.m_discount.predict(input_df)[0], 0.0, 1.0)


        base_cost = weight * rate

        if is_excess == 1:
            penalty_multiplier = 1.5
            status = "PENALTY"
        else:
            penalty_multiplier = 1.0
            status = "Normal"


        cost_after_penalty = base_cost * penalty_multiplier


        penalty_amount = cost_after_penalty - base_cost


        discount_amount = cost_after_penalty * disc_rate
        final_bill = cost_after_penalty - discount_amount

        return {
            "status": status,
            "base_cost": round(base_cost, 2),
            "penalty_amount": round(penalty_amount, 2),
            "discount_percent": round(float(disc_rate) * 100, 1),
            "discount_amount": round(discount_amount, 2),
            "final_bill": round(final_bill, 2),
            "utilization_ratio": round(util_ratio, 2)
        }


tax_engine = TaxEngine()