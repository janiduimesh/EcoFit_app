from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, timedelta
import logging

from core.database import get_database
from core.constants import OVERFLOW_BIN_IDS, overflow_collection
from services.overflow_predictor import get_overflow_predictor
from jobs.retraining_scheduler import trigger_model_retraining, run_retraining_sync
from schemas.dispose_schemas import OverflowPredictionRequest,OverflowPredictionResponse,WeeklyForecastResponse,ModelInfoResponse,RetrainResponse

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_historical_data(days: int = 30, bin_id: str = None) -> List[dict]:
    db = get_database()
    coll_name = overflow_collection(bin_id) if bin_id else "bin_volumes"
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    cursor = db[coll_name].find(
        {"recorded_at": {"$gte": cutoff_date}}
    ).sort("recorded_at", 1)
    data = await cursor.to_list(length=None)
    return data


@router.get("/predict", response_model=OverflowPredictionResponse)
async def predict_overflow(
    bin_id: str = Query(..., description="Bin id (e.g. blue_bin, green_bin)"),
    target_date: Optional[str] = Query(None, description="Target date (YYYY-MM-DD)")
):
    if bin_id not in OVERFLOW_BIN_IDS:
        raise HTTPException(status_code=400, detail=f"Invalid bin_id. Use one of: {OVERFLOW_BIN_IDS}")
    try:
        predictor = get_overflow_predictor(bin_id)
        if not predictor.is_model_loaded():
            return OverflowPredictionResponse(
                success=False,
                message=f"Prediction model not available for {bin_id}. Please wait for model training."
            )
        if target_date:
            try:
                target = datetime.fromisoformat(target_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        else:
            target = datetime.utcnow() + timedelta(days=1)
        historical_data = await get_historical_data(bin_id=bin_id)
        if len(historical_data) < 7:
            return OverflowPredictionResponse(
                success=False,
                message=f"Insufficient data for prediction. Need at least 7 days, have {len(historical_data)}."
            )
        result = predictor.predict_overflow_probability(historical_data, target)
        return OverflowPredictionResponse(**result)
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast", response_model=WeeklyForecastResponse)
async def get_weekly_forecast(
    bin_id: str = Query(..., description="Bin id (e.g. blue_bin, green_bin)")
):
    if bin_id not in OVERFLOW_BIN_IDS:
        raise HTTPException(status_code=400, detail=f"Invalid bin_id. Use one of: {OVERFLOW_BIN_IDS}")
    try:
        predictor = get_overflow_predictor(bin_id)
        if not predictor.is_model_loaded():
            return WeeklyForecastResponse(
                success=False,
                forecasts=[],
                message=f"Prediction model not available for {bin_id}. Please wait for model training."
            )
        historical_data = await get_historical_data(bin_id=bin_id)
        if len(historical_data) < 7:
            return WeeklyForecastResponse(
                success=False,
                forecasts=[],
                message=f"Insufficient data for forecast. Need at least 7 days, have {len(historical_data)}."
            )
        forecasts = predictor.forecast_week(historical_data)
        return WeeklyForecastResponse(
            success=True,
            forecasts=forecasts,
            message="7-day forecast generated successfully"
        )
    except Exception as e:
        logger.error(f"Forecast error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/model/retrain", response_model=RetrainResponse)
async def trigger_retrain(
    wait: bool = Query(False, description="Wait for retraining to complete")
):
    """
    Manually trigger model retraining.
    
    - **wait=false**: Starts retraining in background (default)
    - **wait=true**: Waits for retraining to complete (may take a few minutes)
    """
    try:
        if wait:
            success = await run_retraining_sync()
            if success:
                from services.overflow_predictor import clear_predictor_cache
                clear_predictor_cache()
            return RetrainResponse(
                success=success,
                message="Retraining completed" if success else "Retraining failed"
            )
        else:
            # Async retraining (background)
            await trigger_model_retraining()
            return RetrainResponse(
                success=True,
                message="Retraining started in background. Check logs for progress."
            )
    except Exception as e:
        logger.error(f"Retrain trigger error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data/stats")
async def get_data_stats(
    bin_id: Optional[str] = Query(None, description="Bin id; if omitted, returns stats for all bins")
):
    """
    Get statistics about collected bin volume data (per bin or all bins).
    """
    try:
        db = get_database()

        def format_date(date_value):
            if date_value is None:
                return None
            if isinstance(date_value, datetime):
                return date_value.isoformat()
            return str(date_value)

        bin_ids = [bin_id] if bin_id else OVERFLOW_BIN_IDS
        if bin_id and bin_id not in OVERFLOW_BIN_IDS:
            raise HTTPException(status_code=400, detail=f"Invalid bin_id. Use one of: {OVERFLOW_BIN_IDS}")

        result = {"bins": {}}
        week_ago = datetime.utcnow() - timedelta(days=7)

        for bid in bin_ids:
            coll = db[overflow_collection(bid)]
            total_count = await coll.count_documents({})
            first_record = await coll.find_one({}, sort=[("recorded_at", 1)])
            last_record = await coll.find_one({}, sort=[("recorded_at", -1)])
            recent_count = await coll.count_documents({"recorded_at": {"$gte": week_ago}})
            result["bins"][bid] = {
                "total_records": total_count,
                "records_last_7_days": recent_count,
                "first_record_date": format_date(first_record["recorded_at"]) if first_record else None,
                "last_record_date": format_date(last_record["recorded_at"]) if last_record else None,
                "data_sufficient_for_training": total_count >= 14,
                "data_sufficient_for_prediction": total_count >= 7,
            }

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Data stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

