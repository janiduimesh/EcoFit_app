from fastapi import APIRouter, HTTPException
from services.db_service import db
from tensorflow.keras.models import load_model
import numpy as np
import joblib
from pathlib import Path

router = APIRouter()


MODELS_DIR = Path("models_waste_prediction")


WASTE_TYPES = ["Organic", "Recyclable", "Inorganic"]


WASTE_TYPE_MAP = {
    "Organic": "organic",
    "Recyclable": "recyclable",
    "Inorganic": "inorganic"
}

FEATURE_KEYS = [
    'lag_1w', 'lag_2w', 'lag_4w',
    'roll_4w', 'roll_8w', 'roll_12w',
    'week'
]


SEQ_LEN = 12


lstm_models = {}
scalers_x = {}
scalers_y = {}


try:
    for display_name in WASTE_TYPES:
        key = WASTE_TYPE_MAP[display_name]

        model_path = MODELS_DIR / f"{key}_lstm_model.keras"
        sx_path = MODELS_DIR / f"{key}_scaler_x.pkl"
        sy_path = MODELS_DIR / f"{key}_scaler_y.pkl"

        if model_path.exists() and sx_path.exists() and sy_path.exists():
            lstm_models[key] = load_model(model_path)
            scalers_x[key] = joblib.load(sx_path)
            scalers_y[key] = joblib.load(sy_path)

        else:
            print(f"Missing artifacts for {display_name} at {model_path}")

except Exception as e:
    print(f"Critical Error loading models: {e}")


def predict_weight_core(waste_key: str, features_sequence: list) -> float:

    if waste_key not in lstm_models:
        return None

    model = lstm_models[waste_key]
    scaler_x = scalers_x[waste_key]
    scaler_y = scalers_y[waste_key]


    data_matrix = []
    for week_data in features_sequence:

        row = [float(week_data.get(k, 0)) for k in FEATURE_KEYS]
        data_matrix.append(row)

    X = np.array(data_matrix)


    X_scaled = scaler_x.transform(X)


    X_input = X_scaled.reshape(1, SEQ_LEN, len(FEATURE_KEYS))


    pred_scaled = model.predict(X_input, verbose=0)


    pred_kg = scaler_y.inverse_transform(pred_scaled)

    return float(pred_kg[0][0])


@router.get("/predict_next_week/{household_id}")
async def predict_next_week(household_id: str):

    household = await db.households_col.find_one({"_id": household_id})
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")

    predictions = {}

    for wtype in WASTE_TYPES:
        model_key = WASTE_TYPE_MAP[wtype]


        record = await db.history_col.find_one({
            "household_id": household_id,
            "waste_type": wtype
        })

        prediction_val = None
        last_week_info = None

        if record and "weeks" in record:
            weeks_data = record["weeks"]


            if len(weeks_data) >= SEQ_LEN:

                input_sequence = weeks_data[-SEQ_LEN:]
                last_week_info = weeks_data[-1]

                try:
                    raw_pred = predict_weight_core(model_key, input_sequence)
                    if raw_pred is not None:

                        prediction_val = round(max(0.0, raw_pred), 2)
                except Exception as e:
                    print(f"Error predicting {wtype} for {household_id}: {e}")
            elif len(weeks_data) > 0:

                last_week_info = weeks_data[-1]

        predictions[wtype] = {
            "last_recorded_week": last_week_info,
            "predicted_next_week_kg": prediction_val,
            "status": "success" if prediction_val is not None else "insufficient_data"
        }

    return {
        "household_id": household_id,
        "income_tier": household.get("income_tier", "Unknown"),
        "waste_data": predictions
    }