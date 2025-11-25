from fastapi import APIRouter, HTTPException
import requests
import logging
import os
from services.classifier import WasteClassifier
from core.constants import FitStatus
from schemas.dispose_schemas import DistanceRequest, DistanceResponse

router = APIRouter()
logger = logging.getLogger(__name__)

# Get ESP32 IP from environment variable or use default
ESP32_IP = os.getenv("ESP32_IP", "192.168.43.168")
ESP32_URL = f"http://{ESP32_IP}/distance"
REQUEST_TIMEOUT = int(os.getenv("ESP32_TIMEOUT", "5"))  # Default 5 seconds

@router.post("/check-distance", response_model=DistanceResponse)
async def check_distance(request: DistanceRequest):
    """
    Check distance from ESP32 sensor.
    """
    try:
        # Get distance from ESP32 sensor
        r = requests.get(ESP32_URL, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        height = data.get("distance_cm")
        
        if height is None:
            raise HTTPException(status_code=502, detail="Invalid response from ESP32 sensor")
        
        # Calculate bin volume from distance
        bin_volume = await WasteClassifier().volume_from_distance(height)
        
        # Get waste volume from frontend
        waste_volume = request.volume
        
        if waste_volume <= bin_volume:
            fit_status = FitStatus.FITS
            message = f"Waste item fits in bin. Available space: {round(bin_volume - waste_volume, 2)} ml"
        elif waste_volume <= bin_volume * 1.1:  
            fit_status = FitStatus.PARTIAL_FIT
            message = f"Waste item may fit with some compression. Space needed: {round(waste_volume - bin_volume, 2)} ml"
        else:
            fit_status = FitStatus.DOES_NOT_FIT
            message = f"Waste item does not fit. Space needed: {round(waste_volume - bin_volume, 2)} ml"
        
        return DistanceResponse(
            status="ok",
            distance_cm=round(height, 2),
            bin_volume_ml=round(bin_volume, 2),
            bin_volume_liters=round(bin_volume / 1000, 2),
            waste_volume_ml=round(waste_volume, 2),
            fit_status=fit_status,
            message=message
        )
    except requests.exceptions.Timeout:
        logger.error(f"ESP32 connection timeout: {ESP32_IP}")
        raise HTTPException(
            status_code=504, 
            detail=f"ESP32 connection timeout. Check if device is online at {ESP32_IP}"
        )
    except requests.exceptions.ConnectionError as e:
        logger.error(f"ESP32 connection error: {ESP32_IP} - {str(e)}")
        raise HTTPException(
            status_code=503, 
            detail=f"Cannot connect to ESP32 at {ESP32_IP}. Check network connection and IP address."
        )
    except requests.exceptions.HTTPError as e:
        logger.error(f"ESP32 HTTP error: {str(e)}")
        raise HTTPException(status_code=502, detail=f"ESP32 HTTP error: {e}")
    except Exception as e:
        logger.error(f"ESP32 error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"ESP32 error: {e}")


