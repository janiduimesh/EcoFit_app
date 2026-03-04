import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
import joblib
from motor.motor_asyncio import AsyncIOMotorClient

# Configure logging
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'retraining.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
MODEL_DIR = Path(__file__).parent.parent / "model" / "overflow"
MODEL_PREFIX = "lag_model_random"
MIN_SAMPLES_FOR_TRAINING = 14
DATA_LOOKBACK_DAYS = 60


async def get_settings():
    """Load settings from config"""
    from core.config import get_settings as _get_settings
    return _get_settings()


async def fetch_training_data(settings, bin_id: str) -> list:
    """Fetch bin volume data from MongoDB for the given bin_id (uses collection bin_volumes_{bin_id})."""
    from core.constants import overflow_collection
    logger.info("[Data] Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]
    coll_name = overflow_collection(bin_id)
    cutoff_date = datetime.utcnow() - timedelta(days=DATA_LOOKBACK_DAYS)
    cursor = db[coll_name].find(
        {"recorded_at": {"$gte": cutoff_date}}
    ).sort("recorded_at", 1)
    data = await cursor.to_list(length=None)
    client.close()
    logger.info(f"Fetched {len(data)} records for {bin_id} from last {DATA_LOOKBACK_DAYS} days")
    return data

def prepare_features(data: list) -> pd.DataFrame:
    df = pd.DataFrame(data)
    if df.empty or 'distance_cm' not in df.columns:
        raise ValueError("No distance_cm data available")

    df['recorded_at'] = pd.to_datetime(df['recorded_at'])
    df = df.set_index('recorded_at').sort_index()

    df = df[['distance_cm']].astype(float).resample('D').mean()
    df['distance_cm'] = df['distance_cm'].interpolate(limit_direction='both')

    df['dow'] = df.index.dayofweek

    for lag in [1, 2, 3, 7, 14]:
        df[f'distance_cm_lag_{lag}'] = df['distance_cm'].shift(lag)

    for w in [3, 7, 14]:
        df[f'distance_cm_roll_mean_{w}'] = df['distance_cm'].rolling(w, min_periods=1).mean().shift(1)
        df[f'distance_cm_roll_std_{w}']  = df['distance_cm'].rolling(w, min_periods=2).std().shift(1)

    need = [f'distance_cm_lag_{lag}' for lag in [1,2,3,7,14]]
    df = df.dropna(subset=need)

    df = df.ffill().fillna(0)

    # ✅ next-day target
    df["target_next_distance"] = df["distance_cm"].shift(-1)
    df = df.dropna(subset=["target_next_distance"])

    return df


# def prepare_features(data: list) -> pd.DataFrame:
#     """Build features for training: distance_cm lags, rolling mean/std, dow (matches overflow_predictor)."""
#     logger.info("[Features] Preparing features...")
    
#     df = pd.DataFrame(data)
    
#     if df.empty:
#         raise ValueError("No data available for training")
    
#     if 'distance_cm' not in df.columns:
#         raise ValueError("Training data must include 'distance_cm' (e.g. from organic bin collection)")
    
#     df['recorded_at'] = pd.to_datetime(df['recorded_at'])
#     df = df.set_index('recorded_at')
#     df = df.sort_index()
    
#     # Day of week (same as predictor's 'dow')
#     df['dow'] = df.index.dayofweek
    
#     # Distance lags: preceding 1, 2, 3, 7, 14 days
#     for lag in [1, 2, 3, 7, 14]:
#         df[f'distance_cm_lag_{lag}'] = df['distance_cm'].shift(lag)
    
#     # Rolling mean and std over 3, 7, 14 days (same names as trained model)
#     df['distance_cm_roll_mean_3'] = df['distance_cm'].rolling(3, min_periods=1).mean()
#     df['distance_cm_roll_std_3'] = df['distance_cm'].rolling(3, min_periods=1).std()
#     df['distance_cm_roll_mean_7'] = df['distance_cm'].rolling(7, min_periods=1).mean()
#     df['distance_cm_roll_std_7'] = df['distance_cm'].rolling(7, min_periods=1).std()
#     df['distance_cm_roll_mean_14'] = df['distance_cm'].rolling(14, min_periods=1).mean()
#     df['distance_cm_roll_std_14'] = df['distance_cm'].rolling(14, min_periods=1).std()
    
#     # Fill NaN from lags/rolling (std is NaN for single value)
#     df = df.fillna(method='bfill').fillna(0)
#     df = df.dropna()
    
#     logger.info(f"   Prepared {len(df)} samples with {len(df.columns)} features")
#     return df


def get_feature_columns() -> list:
    """Feature columns used for training (must match overflow_predictor and trained model)."""
    return [
        'distance_cm_lag_1', 'distance_cm_lag_2', 'distance_cm_lag_3',
        'distance_cm_lag_7', 'distance_cm_lag_14',
        'distance_cm_roll_mean_3', 'distance_cm_roll_std_3',
        'distance_cm_roll_mean_7', 'distance_cm_roll_std_7',
        'distance_cm_roll_mean_14', 'distance_cm_roll_std_14',
        'dow'
    ]


def train_model(df: pd.DataFrame):
    """Train time series forecasting model using Random Forest regression"""
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    
    logger.info("[Training] Training model...")
    
    feature_cols = get_feature_columns()
    
    # Filter to only available columns
    available_cols = [col for col in feature_cols if col in df.columns]
    
    X = df[available_cols]
    y = df['target_next_distance']
    
    logger.info(f"   Using {len(available_cols)} features: {available_cols}")
    logger.info(f"   Training samples: {len(X)}")
    
    # Time series cross-validation
    n_splits = min(3, len(X) // 10)  # At least 10 samples per fold
    if n_splits < 2:
        n_splits = 2
    
    tscv = TimeSeriesSplit(n_splits=n_splits)
    
    model = RandomForestRegressor(
        n_estimators=500,
        max_depth=14,
        random_state=42,
        n_jobs=-1
    )
    
    # Evaluate with cross-validation
    mae_scores = []
    rmse_scores = []
    r2_scores = []
    
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
        
        model.fit(X_train, y_train)
        y_pred = model.predict(X_val)
        
        mae = mean_absolute_error(y_val, y_pred)
        rmse = np.sqrt(mean_squared_error(y_val, y_pred))
        r2 = r2_score(y_val, y_pred)
        
        mae_scores.append(mae)
        rmse_scores.append(rmse)
        r2_scores.append(r2)
        
        logger.info(f"   Fold {fold + 1}: MAE={mae:.2f}, RMSE={rmse:.2f}, R²={r2:.3f}")
    
    logger.info(f"   Cross-validation results:")
    logger.info(f"   - MAE: {np.mean(mae_scores):.2f} ± {np.std(mae_scores):.2f}")
    logger.info(f"   - RMSE: {np.mean(rmse_scores):.2f} ± {np.std(rmse_scores):.2f}")
    logger.info(f"   - R²: {np.mean(r2_scores):.3f} ± {np.std(r2_scores):.3f}")
    
    # Final training on all data
    model.fit(X, y)
    
    # Feature importance
    importance = pd.DataFrame({
        'feature': available_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    logger.info(f"   Top 5 important features:")
    for _, row in importance.head(5).iterrows():
        logger.info(f"     - {row['feature']}: {row['importance']:.3f}")
    
    return model, available_cols, {
        'mae': np.mean(mae_scores),
        'rmse': np.mean(rmse_scores),
        'r2': np.mean(r2_scores)
    }


def save_model(model, feature_cols: list, metrics: dict, samples_used: int, bin_id: str):
    """Save trained model and metadata for the given bin_id; remove older models for that bin only."""
    MODEL_DIR.mkdir(exist_ok=True)
    model_data = {
        'model': model,
        'feature_cols': feature_cols,
        'trained_at': datetime.utcnow(),
        'samples_used': samples_used,
        'metrics': metrics,
        'version': '1.0.0'
    }
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    path = MODEL_DIR / f"{MODEL_PREFIX}_{bin_id}_{timestamp}.pkl"
    joblib.dump(model_data, path)
    logger.info(f"[Save] Model saved to {path}")
    for old in MODEL_DIR.glob(f"{MODEL_PREFIX}_{bin_id}_*.pkl"):
        if old != path:
            try:
                old.unlink()
                logger.info(f"[Save] Removed previous model {old.name}")
            except OSError as e:
                logger.warning(f"[Save] Could not remove {old}: {e}")


async def train_one_bin(settings, bin_id: str) -> bool:
    """Train and save model for one bin. Returns True if successful."""
    data = await fetch_training_data(settings, bin_id)
    if len(data) < MIN_SAMPLES_FOR_TRAINING:
        logger.warning(
            f"[Warning] Not enough data for {bin_id}. Need {MIN_SAMPLES_FOR_TRAINING}, got {len(data)}. Skipping."
        )
        return False
    df = prepare_features(data)
    if len(df) < MIN_SAMPLES_FOR_TRAINING:
        logger.warning(
            f"[Warning] Not enough samples after feature engineering for {bin_id}. Skipping."
        )
        return False
    model, feature_cols, metrics = train_model(df)
    save_model(model, feature_cols, metrics, len(df), bin_id)
    return True


async def main():
    """Main retraining pipeline: train one model per bin (5 bins)."""
    from core.constants import OVERFLOW_BIN_IDS
    start_time = datetime.utcnow()
    logger.info("=" * 60)
    logger.info("[Start] Starting Bin Overflow Prediction Model Retraining (all bins)")
    logger.info(f"   Bins: {OVERFLOW_BIN_IDS}")
    logger.info(f"   Time: {start_time.isoformat()}")
    logger.info("=" * 60)
    try:
        settings = await get_settings()
        trained = 0
        for bin_id in OVERFLOW_BIN_IDS:
            logger.info(f"--- Training bin_id={bin_id} ---")
            if await train_one_bin(settings, bin_id):
                trained += 1
        duration = (datetime.utcnow() - start_time).total_seconds()
        logger.info("=" * 60)
        logger.info(f"[OK] Retraining completed. Trained {trained}/{len(OVERFLOW_BIN_IDS)} bins in {duration:.1f}s")
        logger.info("=" * 60)
    except Exception as e:
        logger.error(f"[Error] Retraining failed: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())

