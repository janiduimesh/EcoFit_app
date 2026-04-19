from fastapi import APIRouter, HTTPException, Query
from core.database import get_database
from pymongo import ReturnDocument
from datetime import datetime, timedelta
from typing import Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# -----------------------------
# 47 wards
# -----------------------------
WARD_NAME_TO_ID = {
    "Fort": "W01",
    "Slave Island": "W02",
    "Kochchikade North": "W03",
    "Pettah": "W04",
    "Suduwella": "W05",
    "Kochchikade South": "W06",
    "St. Pauls": "W07",
    "Kotahena East": "W08",
    "Kotahena West": "W09",
    "Maradana": "W10",
    "New Bazaar": "W11",
    "Bloemendhal": "W12",
    "Wanathamulla": "W13",
    "Narahenpita": "W14",
    "Kirula": "W15",
    "Pamankada East": "W16",
    "Cinnamon Gardens": "W17",
    "Borella North": "W18",
    "Borella South": "W19",
    "Dematagoda": "W20",
    "Grandpass North": "W21",
    "Grandpass South": "W22",
    "Aluthkade East": "W23",
    "Aluthkade West": "W24",
    "Mutwal": "W25",
    "Mattakkuliya": "W26",
    "Modara": "W27",
    "Madampitiya": "W28",
    "Mahawatta": "W29",
    "Kuppiyawatta West": "W30",
    "Kuppiyawatta East": "W31",
    "Keselwatta": "W32",
    "Maligawatta East": "W33",
    "Maligawatta West": "W34",
    "Thimbirigasyaya": "W35",
    "Havelock Town": "W36",
    "Kirulapone": "W37",
    "Pamankada West": "W38",
    "Wellawatta North": "W39",
    "Wellawatta South": "W40",
    "Bambalapitiya": "W41",
    "Kollupitiya": "W42",
    "Kurunduwatta": "W43",
    "Hunupitiya": "W44",
    "Ginthupitiya": "W45",
    "Khettarama": "W46",
    "Maha Watta": "W47",
}

WARD_ID_TO_NAME = {v: k for k, v in WARD_NAME_TO_ID.items()}


def normalize_ward_id(payload: dict) -> Optional[str]:
    """
    Keep DB structure unchanged:
    always store wardId if possible.
    Accepts either wardId or wardName.
    """
    ward_id = payload.get("wardId")
    ward_name = payload.get("wardName")

    if ward_id:
        return str(ward_id).strip()

    if ward_name:
        ward_name = str(ward_name).strip()
        return WARD_NAME_TO_ID.get(ward_name)

    return None


async def get_next_complaint_id() -> str:
    """
    Generate next sequential complaint ID like CMP_000001
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    counters = db["counters"]
    result = await counters.find_one_and_update(
        {"_id": "complaint_id"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    seq = result.get("sequence_value", 1) if result else 1
    return f"CMP_{seq:06d}"


@router.post("/complaints")
async def create_complaint(payload: dict):
    """
    Create complaint from mobile app.

    Accepts:
      wardId OR wardName
      category, description, priority, userId, contact
      lat, lng optional

    Keeps DB structure same:
      stores wardId
      stores location as GeoJSON if lat/lng provided
    """
    try:
        db = get_database()
        if db is None:
            raise HTTPException(status_code=500, detail="Database not connected")

        description = str(payload.get("description", "")).strip()
        category = str(payload.get("category", "")).strip()
        priority = str(payload.get("priority", "")).strip().lower()
        contact = str(payload.get("contact", "")).strip()

        if not description:
            raise HTTPException(status_code=400, detail="description is required")

        if not category:
            raise HTTPException(status_code=400, detail="category is required")

        if priority not in {"low", "medium", "high"}:
            raise HTTPException(
                status_code=400,
                detail="priority must be low, medium, or high"
            )

        if not contact:
            raise HTTPException(status_code=400, detail="contact is required")

        ward_id = normalize_ward_id(payload)
        if not ward_id:
            raise HTTPException(
                status_code=400,
                detail="Valid wardId or wardName is required"
            )

        complaint_id = await get_next_complaint_id()

        lat = payload.get("lat")
        lng = payload.get("lng")

        doc = {
            "complaintId": complaint_id,
            "wardId": ward_id,
            "category": category,
            "description": description,
            "priority": priority,
            "status": payload.get("status", "open"),
            "createdAt": datetime.utcnow(),
            "userId": payload.get("userId"),
            "contact": contact,
        }

        # optional extra field
        if ward_id in WARD_ID_TO_NAME:
            doc["wardName"] = WARD_ID_TO_NAME[ward_id]

        # optional nested ward object
        if payload.get("ward"):
            doc["ward"] = payload.get("ward")

        # optional location
        if lat is not None and lng is not None:
            doc["location"] = {
                "type": "Point",
                "coordinates": [lng, lat]
            }

        res = await db["complaints"].insert_one(doc)
        doc["_id"] = str(res.inserted_id)

        return {
            "success": True,
            "message": "Complaint created successfully",
            "data": doc,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating complaint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during complaint creation"
        )


@router.get("/complaints/live")
async def get_live_complaints(
    hours: int = Query(24, ge=1, le=168),
    wardId: Optional[str] = None,
    limit: int = Query(2000, ge=1, le=20000),
):
    """
    Get complaints from last X hours.
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
            "data": data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching live complaints: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during fetching complaints"
        )