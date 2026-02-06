from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, timedelta
import logging

from core.database import get_database
from services.overflow_predictor import get_overflow_predictor
from jobs.retraining_scheduler import trigger_model_retraining, run_retraining_sync
from schemas.dispose_schemas import OverflowPredictionRequest,OverflowPredictionResponse,WeeklyForecastResponse,ModelInfoResponse,RetrainResponse

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_historical_data(days: int = 30) -> List[dict]:
    db = get_database()
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    cursor = db.bin_volumes.find(
        {"recorded_at": {"$gte": cutoff_date}}
    ).sort("recorded_at", 1)
    
    data = await cursor.to_list(length=None)
    return data


@router.get("/predict", response_model=OverflowPredictionResponse)
async def predict_overflow(
    target_date: Optional[str] = Query(None, description="Target date (YYYY-MM-DD)")
):
    try:
        predictor = get_overflow_predictor()
        
        if not predictor.is_model_loaded():
            return OverflowPredictionResponse(
                success=False,
                message="Prediction model not available. Please wait for model training."
            )
        
        # Parse target date or use tomorrow
        if target_date:
            try:
                target = datetime.fromisoformat(target_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        else:
            target = datetime.utcnow() + timedelta(days=1)
        
        # Get historical data
        historical_data = await get_historical_data()
        
        if len(historical_data) < 7:
            return OverflowPredictionResponse(
                success=False,
                message=f"Insufficient data for prediction. Need at least 7 days, have {len(historical_data)}."
            )
        
        # Make prediction (distance only)
        result = predictor.predict_overflow_probability(historical_data, target)
        
        return OverflowPredictionResponse(**result)
        
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast", response_model=WeeklyForecastResponse)
async def get_weekly_forecast():
    try:
        predictor = get_overflow_predictor()
        
        if not predictor.is_model_loaded():
            return WeeklyForecastResponse(
                success=False,
                forecasts=[],
                message="Prediction model not available. Please wait for model training."
            )
        
        # Get historical data
        historical_data = await get_historical_data()
        
        if len(historical_data) < 7:
            return WeeklyForecastResponse(
                success=False,
                forecasts=[],
                message=f"Insufficient data for forecast. Need at least 7 days, have {len(historical_data)}."
            )
        
        # Generate forecast (distance only)
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
            # Synchronous retraining
            success = await run_retraining_sync()
            if success:
                # Reload the new model
                predictor = get_overflow_predictor()
                predictor.reload_model()
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
async def get_data_stats():
    """
    Get statistics about collected bin volume data.
    
    Useful for understanding data availability for predictions.
    """
    try:
        db = get_database()
        
        # Get total count
        total_count = await db.bin_volumes.count_documents({})
        
        # Get date range
        first_record = await db.bin_volumes.find_one(
            {}, sort=[("recorded_at", 1)]
        )
        last_record = await db.bin_volumes.find_one(
            {}, sort=[("recorded_at", -1)]
        )
        
        # Get recent stats
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_count = await db.bin_volumes.count_documents(
            {"recorded_at": {"$gte": week_ago}}
        )
        
        # Helper function to format date (handles both datetime and string)
        def format_date(date_value):
            if date_value is None:
                return None
            if isinstance(date_value, datetime):
                return date_value.isoformat()
            return str(date_value)  # Already a string
        
        return {
            "total_records": total_count,
            "records_last_7_days": recent_count,
            "first_record_date": format_date(first_record["recorded_at"]) if first_record else None,
            "last_record_date": format_date(last_record["recorded_at"]) if last_record else None,
            "data_sufficient_for_training": total_count >= 14,
            "data_sufficient_for_prediction": total_count >= 7
        }
        
    except Exception as e:
        logger.error(f"Data stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

