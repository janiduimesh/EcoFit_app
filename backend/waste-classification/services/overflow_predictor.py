"""
Bin Overflow Predictor Service

Uses the trained time series model to predict future bin fill levels.
"""
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any
import numpy as np
import pandas as pd
import joblib

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).parent.parent / "model" / "overflow"
MODEL_PREFIX = "lag_model_random"
MIN_DISTANCE_CM = 5.0
MAX_DISTANCE_CM = 111.0
OVERFLOW_DISTANCE_CM = 30.0


def _get_latest_model_path(bin_id: str) -> Optional[Path]:
    """Return path to the latest timestamped model file for the given bin_id, or None."""
    if not MODEL_DIR.exists():
        return None
    pattern = f"{MODEL_PREFIX}_{bin_id}_*.pkl"
    candidates = list(MODEL_DIR.glob(pattern))
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


class BinOverflowPredictor:
    """Predicts bin overflow based on historical data for a single bin."""

    def __init__(self, bin_id: str):
        self.bin_id = bin_id
        self.model = None
        self.feature_cols = None
        self.model_metadata = None
        self._load_model()
    
    def _get_distance_feature_columns(self) -> list:
        """Feature columns for trained model: distance lags, rolling mean/std, day of week."""
        return [
            'distance_cm_lag_1', 'distance_cm_lag_2', 'distance_cm_lag_3',
            'distance_cm_lag_7', 'distance_cm_lag_14',
            'distance_cm_rolling_mean_3d', 'distance_cm_rolling_mean_7d', 'distance_cm_rolling_mean_14d',
            'distance_cm_rolling_std_3d', 'distance_cm_rolling_std_7d', 'distance_cm_rolling_std_14d',
            'dow'
        ]
    
    def _load_model(self) -> bool:
        """Load the trained model from disk for this bin_id."""
        try:
            model_path = _get_latest_model_path(self.bin_id)
            if model_path is None or not model_path.exists():
                logger.warning("No model file found for bin_id=%s in %s (%s)", self.bin_id, MODEL_DIR, f"{MODEL_PREFIX}_{self.bin_id}_*.pkl")
                return False

            model_data = joblib.load(model_path)

            # Support: 1) dict from save_model (model + feature_cols), 2) raw model object
            if isinstance(model_data, dict):
                self.model = model_data.get('model')
                self.feature_cols = model_data.get('feature_cols')
                self.model_metadata = {
                    'trained_at': model_data.get('trained_at'),
                    'samples_used': model_data.get('samples_used'),
                    'metrics': model_data.get('metrics', {}),
                    'version': model_data.get('version', 'unknown')
                }
            else:
                self.model = model_data
                if hasattr(self.model, 'feature_names_in_'):
                    self.feature_cols = list(self.model.feature_names_in_)
                    logger.info(f"   Using feature names from model: {self.feature_cols}")
                else:
                    self.feature_cols = self._get_distance_feature_columns()
                    logger.info("   Using distance feature columns")
                self.model_metadata = {
                    'trained_at': None,
                    'samples_used': None,
                    'metrics': {},
                    'version': 'unknown'
                }

            if self.feature_cols is None:
                self.feature_cols = self._get_distance_feature_columns()
                logger.info("   Feature columns from metadata missing, using distance feature columns")

            if self.model is None:
                raise ValueError("Model object is None")
            if self.feature_cols is None:
                raise ValueError("Feature columns could not be determined")

            logger.info("✅ Loaded model successfully")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to load model: {str(e)}", exc_info=True)
            return False
    
    def reload_model(self) -> bool:
        """Reload model from disk (after retraining)"""
        return self._load_model()
    
    def is_model_loaded(self) -> bool:
        """Check if model is loaded and ready"""
        return self.model is not None and self.feature_cols is not None
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model"""
        if not self.is_model_loaded():
            return {"status": "not_loaded", "message": "Model not available"}
        
        return {
            "status": "loaded",
            "trained_at": str(self.model_metadata['trained_at']) if self.model_metadata.get('trained_at') else None,
            "samples_used": self.model_metadata['samples_used'],
            "metrics": self.model_metadata['metrics'],
            "version": self.model_metadata['version'],
            "features": self.feature_cols
        }
    
    def _prepare_prediction_features(
        self, 
        historical_data: List[Dict], 
        target_date: datetime
    ) -> Optional[pd.DataFrame]:
        """Prepare features for prediction: distance lags, rolling mean/std, day of week (dow)."""
        try:
            if not historical_data:
                return None
            
            df = pd.DataFrame(historical_data)
            df['recorded_at'] = pd.to_datetime(df['recorded_at'])
            df = df.set_index('recorded_at').sort_index()
            
            features = {}
            
            # Day of week for the target date (0=Monday, 6=Sunday)
            features['dow'] = target_date.weekday()
            
            if 'distance_cm' not in df.columns:
                logger.warning("distance_cm column not found in historical data")
            else:
                distances = df['distance_cm'].values
                
                # Lags: preceding 1, 2, 3, 7, 14 days
                if len(distances) >= 1:
                    features['distance_cm_lag_1'] = distances[-1]
                if len(distances) >= 2:
                    features['distance_cm_lag_2'] = distances[-2]
                if len(distances) >= 3:
                    features['distance_cm_lag_3'] = distances[-3]
                if len(distances) >= 7:
                    features['distance_cm_lag_7'] = distances[-7]
                if len(distances) >= 14:
                    features['distance_cm_lag_14'] = distances[-14]
                
                # Rolling mean and std over preceding 3, 7, 14 days
                w3 = distances[-3:] if len(distances) >= 3 else distances
                w7 = distances[-7:] if len(distances) >= 7 else distances
                w14 = distances[-14:] if len(distances) >= 14 else distances
                mean3, mean7, mean14 = float(np.mean(w3)), float(np.mean(w7)), float(np.mean(w14))
                std3 = float(np.std(w3)) if len(w3) > 1 else 0.0
                std7 = float(np.std(w7)) if len(w7) > 1 else 0.0
                std14 = float(np.std(w14)) if len(w14) > 1 else 0.0
                # Our default names
                features['distance_cm_rolling_mean_3d'] = mean3
                features['distance_cm_rolling_mean_7d'] = mean7
                features['distance_cm_rolling_mean_14d'] = mean14
                features['distance_cm_rolling_std_3d'] = std3
                features['distance_cm_rolling_std_7d'] = std7
                features['distance_cm_rolling_std_14d'] = std14
                # Model-trained names (distance_cm_roll_mean_3, etc.)
                features['distance_cm_roll_mean_3'] = mean3
                features['distance_cm_roll_std_3'] = std3
                features['distance_cm_roll_mean_7'] = mean7
                features['distance_cm_roll_std_7'] = std7
                features['distance_cm_roll_mean_14'] = mean14
                features['distance_cm_roll_std_14'] = std14
            
            # Fill any missing features expected by the model with 0
            for col in self.feature_cols:
                if col not in features:
                    features[col] = 0
            
            return pd.DataFrame([features])[self.feature_cols]
            
        except Exception as e:
            logger.error(f"Error preparing features: {str(e)}")
            return None
    
    def predict_distance(
        self, 
        historical_data: List[Dict], 
        target_date: datetime
    ) -> Optional[float]:
        """
        Predict distance_cm for a target date.
        
        Args:
            historical_data: List of historical bin distance records
            target_date: Date to predict for
            
        Returns:
            Predicted distance_cm, or None if prediction fails
        """
        if not self.is_model_loaded():
            logger.warning("Model not loaded, cannot predict")
            return None
        
        try:
            features = self._prepare_prediction_features(historical_data, target_date)
            if features is None:
                return None
            
            prediction = self.model.predict(features)[0]
            
            # Ensure prediction is positive
            return max(0, prediction)
            
        except Exception as e:
            logger.error(f"Prediction error: {str(e)}")
            return None
    
    def recursive_forecast_distance(
        self,
        historical_data: List[Dict],
        horizon_days: int = 60,
        start_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Multi-step forecast: each day's prediction is fed back as the next day's input.
        If start_date is provided, the first forecast day is start_date (or the day after
        last historical date if start_date is before that). Otherwise forecasting starts
        at last_date + 1. This keeps overflow_date aligned with the requested target_date.
        Returns a list of {"date": datetime, "pred_distance_cm": float} for each day.
        """
        if not self.is_model_loaded():
            logger.warning("Model not loaded, cannot forecast")
            return []
        
        if not historical_data or 'distance_cm' not in (historical_data[0] or {}):
            logger.warning("Historical data missing or no distance_cm")
            return []
        
        # Working history: list of dicts with recorded_at and distance_cm
        hist = []
        for r in historical_data:
            recorded_at = r.get('recorded_at')
            if recorded_at is None:
                continue
            if hasattr(recorded_at, 'isoformat'):
                dt = recorded_at
            else:
                try:
                    dt = pd.to_datetime(recorded_at).to_pydatetime()
                except Exception:
                    continue
            val = r.get('distance_cm')
            try:
                distance_cm = float(val)
            except (TypeError, ValueError):
                continue
            hist.append({"recorded_at": dt, "distance_cm": distance_cm})
        
        if not hist:
            return []
        
        hist = sorted(hist, key=lambda x: x["recorded_at"])
        future_rows = []
        last_date = hist[-1]["recorded_at"]
        if isinstance(last_date, pd.Timestamp):
            last_date = last_date.to_pydatetime()
        # First forecast date: use start_date if provided and valid, else last_date + 1
        next_date_first = None
        if start_date is not None:
            d = start_date.date() if hasattr(start_date, "date") else start_date
            next_date_first = datetime(d.year, d.month, d.day)
            if next_date_first <= last_date:
                next_date_first = last_date + timedelta(days=1)
        
        for step in range(horizon_days):
            if step == 0 and next_date_first is not None:
                next_date = next_date_first
            else:
                last_in_hist = hist[-1]["recorded_at"]
                if isinstance(last_in_hist, pd.Timestamp):
                    last_in_hist = last_in_hist.to_pydatetime()
                next_date = last_in_hist + timedelta(days=1)
            
            features_df = self._prepare_prediction_features(hist, next_date)
            if features_df is None or len(features_df) == 0:
                break
            
            try:
                raw = self.model.predict(features_df)[0]
                pred_next = float(raw) if raw is not None else 0.0
            except Exception as e:
                logger.warning(f"Recursive forecast step {step} failed: {e}")
                break
            last_distance = float(hist[-1]["distance_cm"])

            # valid range
            pred_next = max(MIN_DISTANCE_CM, min(pred_next, MAX_DISTANCE_CM))

            # Do not allow the bin to become emptier unless you model collection
            if pred_next > last_distance:
                pred_next = last_distance

            # If model gets stuck predicting the same value, force small filling progress
            min_daily_drop = 3.8  # tune for green organic (0.8–2.0)
            if abs(pred_next - last_distance) < 0.2:
                pred_next = max(MIN_DISTANCE_CM, last_distance - min_daily_drop)
            
            # if pred_next != pred_next:  # NaN check
            #     pred_next = 0.0
            # last_distance = hist[-1]["distance_cm"]
            # pred_next = min(pred_next, last_distance)
            # if pred_next==last_distance:
            #     pred_next = MAX_DISTANCE_CM      
            # pred_next = max(pred_next, MIN_DISTANCE_CM)    # no impossible values
            # pred_next = min(pred_next, MAX_DISTANCE_CM)

            hist.append({"recorded_at": next_date, "distance_cm": pred_next})
            future_rows.append({
                "date": next_date,
                "pred_distance_cm": round(pred_next, 2)
            })
        
        return future_rows
    
    def predict_overflow_probability(
        self,
        historical_data: List[Dict],
        target_date: datetime,
    ) -> Dict[str, Any]:
        """
        Predict bin overflow for a target date (distance-based only).
        
        Args:
            historical_data: Historical bin distance data
            target_date: Date to predict for
            
        Returns:
            Dict with prediction details (distance only)
        """
        predicted_distance = self.predict_distance(historical_data, target_date)
        
        if predicted_distance is None:
            return {
                "success": False,
                "message": "Could not make prediction",
                "predicted_distance_cm": None,
                "overflow_risk": None,
                "overflow_date": None,
            }
        
        # Risk level from distance only (lower distance = fuller bin = higher risk)
        if predicted_distance <= OVERFLOW_DISTANCE_CM:
            overflow_risk = "high"
            risk_message = "Bin at or past overflow level. Schedule collection soon."
        elif predicted_distance <= 40:
            overflow_risk = "medium"
            risk_message = "Bin filling up. Consider scheduling collection."
        elif predicted_distance <= 50:
            overflow_risk = "low"
            risk_message = "Bin has adequate space."
        else:
            overflow_risk = "minimal"
            risk_message = "Bin has plenty of space."

        # Predict overflow date: first day when pred_distance_cm <= OVERFLOW_DISTANCE_CM
        future_pred = self.recursive_forecast_distance(
            historical_data, horizon_days=60, start_date=target_date
        )
        overflow_date = None
        for row in future_pred:
            if row["pred_distance_cm"] <= OVERFLOW_DISTANCE_CM:
                d = row["date"]
                overflow_date = d.date() if hasattr(d, "date") else d
                break
        overflow_date_str = overflow_date.isoformat() if overflow_date else None

        return {
            "success": True,
            "target_date": target_date.isoformat(),
            "predicted_distance_cm": round(predicted_distance, 2),
            "overflow_risk": overflow_risk,
            "message": risk_message,
            "overflow_date": overflow_date_str,
        }
    
    def forecast_week(
        self,
        historical_data: List[Dict],
        start_date: Optional[datetime] = None,
        use_recursive: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Generate 7-day forecast (distance-based only).
        
        If use_recursive=True (default), uses recursive forecast: each day's prediction
        is fed back as input for the next day.
        If use_recursive=False, predicts each day independently (same history, different dow).
        
        Args:
            historical_data: Historical bin distance data
            start_date: Ignored when use_recursive=True; used as first target when False
            use_recursive: If True, use recursive multi-step forecast
            
        Returns:
            List of daily predictions: target_date, predicted_distance_cm, overflow_risk, message
        """
        if use_recursive:
            future = self.recursive_forecast_distance(
                historical_data, horizon_days=7, start_date=start_date
            )
            forecasts = []
            for row in future:
                target_date = row["date"]
                pred_distance = row["pred_distance_cm"]
                if pred_distance <= OVERFLOW_DISTANCE_CM:
                    overflow_risk, risk_message = "high", "Bin at or past overflow level. Schedule collection soon."
                elif pred_distance <= 40:
                    overflow_risk, risk_message = "medium", "Bin filling up. Consider scheduling collection."
                elif pred_distance <= 50:
                    overflow_risk, risk_message = "low", "Bin has adequate space."
                else:
                    overflow_risk, risk_message = "minimal", "Bin has plenty of space."
                d = target_date
                target_iso = d.date().isoformat() if hasattr(d, "date") else (d.isoformat() if hasattr(d, "isoformat") else str(d))
                forecasts.append({
                    "target_date": target_iso,
                    "predicted_distance_cm": round(pred_distance, 2),
                    "overflow_risk": overflow_risk,
                    "message": risk_message,
                })
            return forecasts
        
        if start_date is None:
            start_date = datetime.utcnow() + timedelta(days=1)
        forecasts = []
        for day_offset in range(7):
            target_date = start_date + timedelta(days=day_offset)
            prediction = self.predict_overflow_probability(historical_data, target_date)
            forecasts.append({
                "target_date": prediction["target_date"],
                "predicted_distance_cm": prediction["predicted_distance_cm"],
                "overflow_risk": prediction["overflow_risk"],
                "message": prediction["message"],
            })
        return forecasts


# Cache one predictor per bin_id
_predictor_cache: Dict[str, BinOverflowPredictor] = {}


def get_overflow_predictor(bin_id: str) -> BinOverflowPredictor:
    """Get predictor instance for the given bin_id (cached per bin)."""
    global _predictor_cache
    if bin_id not in _predictor_cache:
        _predictor_cache[bin_id] = BinOverflowPredictor(bin_id)
    return _predictor_cache[bin_id]


def clear_predictor_cache() -> None:
    """Clear cached predictors (e.g. after retraining so new models are loaded)."""
    global _predictor_cache
    _predictor_cache.clear()
