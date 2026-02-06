from fastapi import APIRouter
from schemas.tax_schemas import TaxInput, TaxOutput
import pandas as pd
import joblib
from pathlib import Path

router = APIRouter()
MODEL_PATH = Path("./models/tax_rate_predictor_v1.pkl")
model = joblib.load(MODEL_PATH)

@router.post("/calculate", response_model=TaxOutput)
def calculate_tax(input: TaxInput):
    df = pd.DataFrame([input.dict()])
    prediction = model.predict(df)
    pred_multiplier, pred_discount = prediction[0]
    final_bill = (input.weight_kg * input.base_unit_price * pred_multiplier) * (1 - pred_discount)
    return TaxOutput(
        pred_multiplier=float(pred_multiplier),
        pred_discount=float(pred_discount),
        final_bill=float(final_bill)
    )
