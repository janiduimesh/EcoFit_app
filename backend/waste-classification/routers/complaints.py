from fastapi import APIRouter, HTTPException, Query
from core.database import get_database
from pymongo import ReturnDocument
from datetime import datetime, timedelta
from typing import Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_next_complaint_id() -> str:
    """
    Generate next sequential complaint ID like CMP_000001    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    counters = db["counters"]
    result = await counters.find_one_and_update(
        {"_id": "complaint_id"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )

    seq = result.get("sequence_value", 1) if result else 1
    return f"CMP_{seq:06d}"


@router.post("/complaints")
async def create_complaint(payload: dict):
    """
    Create complaint from mobile app.
    Expected payload (minimum):
      lat, lng
    Optional:
      wardId, category, description, priority, userId, contact
    """
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=500, detail="Database not connected")

        # Validate
        if payload.get("lat") is None or payload.get("lng") is None:
            raise HTTPException(status_code=400, detail="lat and lng are required")

        complaint_id = await get_next_complaint_id()

        doc = {
            "complaintId": complaint_id,
            "wardId": payload.get("wardId"),
            "category": payload.get("category", "general"),
            "description": payload.get("description", ""),
            "priority": payload.get("priority", "medium"),
            "status": payload.get("status", "open"),
            "createdAt": datetime.utcnow(),

            # Match your dataset style (GeoJSON)
            "location": {
                "type": "Point",
                "coordinates": [payload.get("lng"), payload.get("lat")]
            },

            # Optional extras
            "userId": payload.get("userId"),
            "contact": payload.get("contact")
        }

        res = await db["complaints"].insert_one(doc)
        doc["_id"] = str(res.inserted_id)

        return {
            "success": True,
            "message": "Complaint created successfully",
            "data": doc
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating complaint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during complaint creation")


@router.get("/complaints/live")
async def get_live_complaints(
    hours: int = Query(24, ge=1, le=168),
    wardId: Optional[str] = None,
    limit: int = Query(2000, ge=1, le=20000)
):
    """
    Get complaints from last X hours (for map pins).
    """
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=500, detail="Database not connected")

        since = datetime.utcnow() - timedelta(hours=hours)

        query = {"createdAt": {"$gte": since}}
        if wardId:
            query["wardId"] = wardId

        cursor = db["complaints"].find(query).sort("createdAt", -1).limit(limit)

        data = []
        async for c in cursor:
            c["_id"] = str(c["_id"])
            data.append(c)

        return {
            "success": True,
            "count": len(data),
            "data": data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching live complaints: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during fetching complaints")
