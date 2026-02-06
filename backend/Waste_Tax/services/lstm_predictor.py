import numpy as np
import joblib
from pathlib import Path
from tensorflow.keras.models import load_model


MODELS_DIR = Path("models_waste_prediction")


WASTE_CATEGORIES = ["organic", "recyclable", "inorganic"]


lstm_models = {}
scalers_x = {}
scalers_y = {}

print("Loading models and scalers...")
try:
    for cat in WASTE_CATEGORIES:

        model_path = MODELS_DIR / f"{cat}_lstm_model.keras"
        sx_path = MODELS_DIR / f"{cat}_scaler_x.pkl"
        sy_path = MODELS_DIR / f"{cat}_scaler_y.pkl"

        if not model_path.exists():
            print(f"Warning: Model not found for {cat} at {model_path}")
            continue

        lstm_models[cat] = load_model(model_path)
        scalers_x[cat] = joblib.load(sx_path)
        scalers_y[cat] = joblib.load(sy_path)
    print("All artifacts loaded successfully.")

except Exception as e:
    print(f"Critical Error loading models: {e}")


def predict_weight(waste_type: str, features: np.ndarray) -> float:

    waste_type = waste_type.lower()

    if waste_type not in lstm_models:
        raise ValueError(f"Unknown waste type: {waste_type}. Available: {list(lstm_models.keys())}")

    model = lstm_models[waste_type]
    scaler_x = scalers_x[waste_type]
    scaler_y = scalers_y[waste_type]

    expected_shape = (12, 7)
    if features.shape != expected_shape:
        raise ValueError(f"Input features must be shape {expected_shape} (12 weeks, 7 features). Got {features.shape}")

    X_scaled = scaler_x.transform(features)

    X_input = X_scaled.reshape(1, 12, 7)


    pred_scaled = model.predict(X_input, verbose=0)


    pred_kg = scaler_y.inverse_transform(pred_scaled)


    return float(pred_kg[0][0])


if __name__ == "__main__":

    dummy_input = np.random.rand(12, 7)

    try:
        # Test Organic
        prediction = predict_weight("organic", dummy_input)
        print(f"\nPrediction for Organic: {prediction:.2f} kg")

        # Test Recyclable
        prediction = predict_weight("recyclable", dummy_input)
        print(f"Prediction for Recyclable: {prediction:.2f} kg")

    except Exception as e:
        print(f"\nPrediction failed: {e}")