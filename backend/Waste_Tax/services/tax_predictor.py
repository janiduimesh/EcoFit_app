import pandas as pd
import joblib
from pathlib import Path

MODEL_PATH = Path("./models_waste_prediction/tax_rate_predictor_v1.pkl")
model = joblib.load(MODEL_PATH)

def calculate_tax(input_dict: dict) -> dict:
    df = pd.DataFrame([input_dict])
    prediction = model.predict(df)
    pred_multiplier, pred_discount = prediction[0]
    final_bill = (input_dict['weight_kg'] * input_dict['base_unit_price'] * pred_multiplier) * (1 - pred_discount)
    return {
        "pred_multiplier": float(pred_multiplier),
        "pred_discount": float(pred_discount),
        "final_bill": float(final_bill)
    }
