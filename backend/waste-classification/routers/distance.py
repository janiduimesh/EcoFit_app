from fastapi import APIRouter, HTTPException
import requests
import logging
import os

router = APIRouter()
logger = logging.getLogger(__name__)

# Get ESP32 IP from environment variable or use default
ESP32_IP = os.getenv("ESP32_IP", "192.168.43.168")
ESP32_URL = f"http://{ESP32_IP}/distance"
REQUEST_TIMEOUT = int(os.getenv("ESP32_TIMEOUT", "5"))  # Default 5 seconds

@router.get("/check-distance")
def check_distance():
    """
    Check distance from ESP32 sensor.
    """
    try:
        r = requests.get(ESP32_URL, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        data = r.json()  # expects { "distance_cm": ... }
        return {"status": "ok", "distance_cm": data.get("distance_cm")}
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

