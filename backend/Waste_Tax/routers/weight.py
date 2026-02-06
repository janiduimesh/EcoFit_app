from fastapi import APIRouter, HTTPException
from tensorflow.keras.models import load_model
from services.db_service import db
from schemas.weight_schemas import PredictNextRequest, WeightOutput
from services.behaviour import classify_behaviour
import joblib
import numpy as np  # <--- WAS MISSING
from pathlib import Path

router = APIRouter()

MODELS_DIR = Path("models_waste_prediction")

WASTE_TYPES = ["Organic", "Recyclable", "Inorganic"]

WASTE_TYPE_MAP = {
    "Organic": "organic",
    "Recyclable": "recyclable",
    "Inorganic": "inorganic"
}

FEATURE_KEYS = ['lag_1w', 'lag_2w', 'lag_4w', 'roll_4w', 'roll_8w', 'roll_12w', 'week']
SEQ_LEN = 12

lstm_models = {}
scalers_x = {}
scalers_y = {}

print("Loading Waste Prediction Models...")

try:
    for display_name in WASTE_TYPES:
        key = WASTE_TYPE_MAP[display_name]

        # Paths
        model_path = MODELS_DIR / f"{key}_lstm_model.keras"
        sx_path = MODELS_DIR / f"{key}_scaler_x.pkl"
        sy_path = MODELS_DIR / f"{key}_scaler_y.pkl"

        if model_path.exists() and sx_path.exists() and sy_path.exists():
            lstm_models[key] = load_model(model_path)
            scalers_x[key] = joblib.load(sx_path)
            scalers_y[key] = joblib.load(sy_path)
            print(f"Loaded {display_name}")
        else:
            print(f"Missing artifacts for {display_name}")

except Exception as e:
    print(f"Critical Error loading models: {e}")


def predict_weight_core(waste_key: str, features_sequence: list) -> float:

    if waste_key not in lstm_models:
        return 0.0

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

    return float(max(0.0, pred_kg[0][0]))


@router.post("/predict_next_week", response_model=WeightOutput)
async def predict_next_week(data: PredictNextRequest):

    model_key = WASTE_TYPE_MAP.get(data.waste_type)
    if not model_key:
        raise HTTPException(400, "Invalid waste type")

    record = await db.history_col.find_one({
        "household_id": data.household_id,
        "waste_type": data.waste_type
    })

    if not record or "weeks" not in record:
        raise HTTPException(404, "No history found.")

    weeks = record.get("weeks", [])
    weeks = sorted(weeks, key=lambda x: (x["year"], x["week"]))


    last_entry = weeks[-1]
    current_year = last_entry["year"]
    current_week = last_entry["week"]

    if current_week >= 52:
        new_year = current_year + 1
        new_week = 1
    else:
        new_year = current_year
        new_week = current_week + 1

    weeks.append({
        "year": new_year,
        "week": new_week,
        "weight_kg": data.current_weight_kg
    })


    updated_window = weeks[-12:]


    window_weights = [w["weight_kg"] for w in updated_window]

    for idx, w in enumerate(updated_window):

        w["roll_4w"] = round(sum(window_weights[max(0, idx - 3):idx + 1]) / min(idx + 1, 4), 2)
        w["roll_8w"] = round(sum(window_weights[max(0, idx - 7):idx + 1]) / min(idx + 1, 8), 2)
        w["roll_12w"] = round(sum(window_weights[max(0, idx - 11):idx + 1]) / min(idx + 1, 12), 2)


        w["lag_1w"] = window_weights[idx - 1] if idx >= 1 else 0.0
        w["lag_2w"] = window_weights[idx - 2] if idx >= 2 else 0.0
        w["lag_4w"] = window_weights[idx - 4] if idx >= 4 else 0.0


        w["behaviour_class"] = classify_behaviour(data.waste_type, w["weight_kg"])


    try:

        predicted_kg = predict_weight_core(model_key, updated_window)
    except Exception as e:
        print(f"Prediction Error: {e}")
        predicted_kg = 0.0


    await db.history_col.update_one(
        {"_id": record["_id"]},
        {"$set": {"weeks": updated_window}}
    )

    return WeightOutput(predicted_weight_kg=round(predicted_kg, 2))