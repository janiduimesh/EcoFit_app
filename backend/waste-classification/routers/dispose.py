from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from schemas.dispose_schemas import (
    DisposeRequest, DisposeResponse, ErrorResponse,
    TipsRequest, TipsResponse, TipsFeedbackRequest, TipsFeedbackResponse
)
from services.classifier import WasteClassifier
from core.constants import WasteType, BinCategory, FitStatus, WASTE_TO_BIN_MAPPING, VOLUME_THRESHOLDS
from core.database import get_database
from pymongo import ReturnDocument
import logging
import base64

router = APIRouter()
logger = logging.getLogger(__name__)

classifier = WasteClassifier()

async def get_next_tip_id() -> str:
    """Generate next sequential tip ID like TIP_0001"""
    db = get_database()
    counters = db["counters"]
    
    result = await counters.find_one_and_update(
        {"_id": "tip_id"},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    
    sequence = result.get("sequence_value", 1) if result else 1
    return f"TIP_{sequence:04d}"


@router.post("/dispose", response_model=DisposeResponse)
async def classify_waste(request: DisposeRequest):
    """
    Classify waste based on image or description and return disposal guidance.
    """
    try:
        if request.input_method == "image" and not request.image_data:
            raise HTTPException(status_code=400, detail="Image data required for image input method")
        
        if request.input_method == "description" and not request.description:
            raise HTTPException(status_code=400, detail="Description required for description input method")
        
        if request.input_method == "image":
            waste_type, confidence = await classifier.classify_from_image(request.image_data)
        else:
            waste_type, confidence = await classifier.classify_from_text(request.description)
        

        bin_volume, distance_cm = await classifier.get_bin_volume_from_sensor()

        waste_volume = request.volume if request.volume is not None else 0

        if bin_volume is None:
            bin_volume = 5000  
            logger.warning("Using default bin volume due to sensor unavailability")

        if request.volume is not None:
            fit_status = await classifier.check_bin_fit(waste_volume, bin_volume)
        else:
            fit_status = FitStatus.UNKNOWN 


        bin_type = WASTE_TO_BIN_MAPPING.get(waste_type, BinCategory.GENERAL)
                
        return DisposeResponse(
            waste_type=waste_type,
            bin_type=bin_type,
            fit_status=fit_status,
            bin_volume_ml=round(bin_volume, 2),
            bin_volume_liters=round(bin_volume / 1000, 2),
            distance_cm=distance_cm,
            confidence=confidence,
            message=f"Waste classified as {waste_type.value}"
        )
        
    except Exception as e:
        logger.error(f"Error classifying waste: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during classification")

@router.post("/dispose/tips", response_model=TipsResponse)
async def generate_tips(request: TipsRequest):
    """
    Get personalized disposal tips based on waste type and user profile.
    """
    try:
        # Convert string to WasteType enum
        try:
            waste_type_enum = WasteType(request.waste_type.lower())
        except ValueError:
            waste_type_enum = WasteType.OTHER
        
        # Generate tips using classifier
        tips = await classifier.generate_tips(waste_type_enum, request.user_id)
        
        # Generate tip ID
        tip_id = await get_next_tip_id()
        
        return TipsResponse(
            tip_id=tip_id,
            tips=tips if tips else [],
        )
        
    except Exception as e:
        logger.error(f"Error generating tips: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during tips generation")


@router.post("/dispose/tips/feedback", response_model=TipsFeedbackResponse)
async def submit_feedback(request: TipsFeedbackRequest):
    """
    Submit feedback (like/dislike) for a tip recommendation.
    """
    try:
        if request.feedback not in ["like", "dislike"]:
            raise HTTPException(status_code=400, detail="Feedback must be 'like' or 'dislike'")
        
        logger.info(f"Feedback received - Tip: {request.tip_id}, User: {request.user_id}, Feedback: {request.feedback}")
        
        return TipsFeedbackResponse(
            success=True,
            message="Thank you for your feedback!"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during feedback submission")


@router.post("/dispose/upload", response_model=DisposeResponse)
async def classify_waste_upload(
    file: UploadFile = File(...),
    # volume: int = Form(...),
    input_method: str = Form("image")
):
    """
    Classify waste from uploaded image file.
    Accepts multipart/form-data with image file upload.
    """
    try:
        if input_method != "image":
            raise HTTPException(status_code=400, detail="This endpoint only accepts image files. Use input_method='image'")
        
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image (jpg, png, etc.)")
        
        # Read file content
        file_content = await file.read()
        
        # Convert to base64 for the classifier
        image_base64 = base64.b64encode(file_content).decode('utf-8')
        
        # Classify waste
        waste_type, confidence = await classifier.classify_from_image(image_base64)
        
               
        return DisposeResponse(
            waste_type=waste_type,
            confidence=confidence,
            message=f"Waste classified as {waste_type.value}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error classifying waste from upload: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during classification")


