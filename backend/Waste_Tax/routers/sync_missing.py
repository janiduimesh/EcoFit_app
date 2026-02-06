from fastapi import APIRouter, HTTPException
from services.db_service import db
from tensorflow.keras.models import load_model
import numpy as np
import joblib
from pathlib import Path
from datetime import datetime

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


try:
    for display_name in WASTE_TYPES:
        key = WASTE_TYPE_MAP[display_name]
        model_path = MODELS_DIR / f"{key}_lstm_model.keras"
        sx_path = MODELS_DIR / f"{key}_scaler_x.pkl"
        sy_path = MODELS_DIR / f"{key}_scaler_y.pkl"

        if model_path.exists():
            lstm_models[key] = load_model(model_path)
            scalers_x[key] = joblib.load(sx_path)
            scalers_y[key] = joblib.load(sy_path)

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

    if len(data_matrix) < SEQ_LEN:
        return 0.0

    X = np.array(data_matrix)
    X_scaled = scaler_x.transform(X)
    X_input = X_scaled.reshape(1, SEQ_LEN, len(FEATURE_KEYS))
    pred_scaled = model.predict(X_input, verbose=0)
    pred_kg = scaler_y.inverse_transform(pred_scaled)

    return float(pred_kg[0][0])


@router.post("/sync_missing_weeks/{household_id}")
async def sync_missing_weeks(household_id: str):

    today = datetime.now()
    current_year, current_week, _ = today.isocalendar()

    actions_log = []

    for wtype in WASTE_TYPES:
        model_key = WASTE_TYPE_MAP[wtype]


        history = await db.history_col.find_one({
            "household_id": household_id,
            "waste_type": wtype
        })


        if history and "weeks" in history and len(history["weeks"]) > 0:
            sorted_weeks = sorted(history["weeks"], key=lambda x: (x["year"], x["week"]))
            last_entry = sorted_weeks[-1]
            last_year = last_entry["year"]
            last_week = last_entry["week"]


            prediction_input_sequence = sorted_weeks[-SEQ_LEN:]
        else:

            continue


        if last_year == current_year:

            check_week = last_week + 1

            while check_week < current_week:


                existing_pending = await db.pending_col.find_one({
                    "household_id": household_id,
                    "waste_type": wtype,
                    "year": current_year,
                    "week": check_week
                })

                if not existing_pending:

                    if len(prediction_input_sequence) >= SEQ_LEN:
                        predicted_val = predict_weight_core(model_key, prediction_input_sequence)
                        predicted_val = round(max(0.0, predicted_val), 2)


                        new_submission = {
                            "household_id": household_id,
                            "waste_type": wtype,
                            "weight_kg": predicted_val,
                            "year": current_year,
                            "week": check_week,
                            "status": "REVIEW",
                            "is_auto_filled": True,
                            "submitted_at": datetime.utcnow()
                        }

                        await db.pending_col.insert_one(new_submission)
                        actions_log.append(f"Auto-submitted {wtype} Week {check_week} ({predicted_val}kg)")

                check_week += 1

    return {
        "status": "sync_complete",
        "current_week": current_week,
        "actions": actions_log
    }


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

        if record and "weeks" in record:
            weeks_data = record["weeks"]
            if len(weeks_data) >= SEQ_LEN:
                input_sequence = weeks_data[-SEQ_LEN:]
                try:
                    raw_pred = predict_weight_core(model_key, input_sequence)
                    prediction_val = round(max(0.0, raw_pred), 2)
                except Exception:
                    prediction_val = 0.0

        predictions[wtype] = {
            "predicted_next_week_kg": prediction_val
        }

    return {
        "household_id": household_id,
        "waste_data": predictions
    }