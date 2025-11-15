from fastapi import APIRouter, HTTPException
from schemas.dispose_schemas import DisposeRequest, DisposeResponse, ErrorResponse
from services.classifier import WasteClassifier
from core.constants import WasteType, BinCategory, FitStatus, WASTE_TO_BIN_MAPPING, VOLUME_THRESHOLDS
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize classifier (placeholder for now)
classifier = WasteClassifier()

@router.post("/dispose", response_model=DisposeResponse)
async def classify_waste(request: DisposeRequest):
    """
    Classify waste based on image or description and return disposal guidance.
    """
    try:
        # Validate input
        if request.input_method == "image" and not request.image_data:
            raise HTTPException(status_code=400, detail="Image data required for image input method")
        
        if request.input_method == "description" and not request.description:
            raise HTTPException(status_code=400, detail="Description required for description input method")
        
        # Classify waste
        if request.input_method == "image":
            waste_type, confidence = await classifier.classify_from_image(request.image_data)
        else:
            waste_type, confidence = await classifier.classify_from_text(request.description)
        
        # Determine bin type
        bin_type = WASTE_TO_BIN_MAPPING.get(waste_type, BinCategory.GENERAL)
        
        # Check if waste fits in bin
        volume_threshold = VOLUME_THRESHOLDS.get(bin_type, 1000)
        if request.volume <= volume_threshold:
            fit_status = FitStatus.FITS
        elif request.volume <= volume_threshold * 1.5:
            fit_status = FitStatus.PARTIAL_FIT
        else:
            fit_status = FitStatus.DOES_NOT_FIT
        
        # Generate tips
        tips = generate_tips(waste_type, bin_type, fit_status, request.volume)
        
        return DisposeResponse(
            waste_type=waste_type,
            bin_type=bin_type,
            fit_status=fit_status,
            confidence=confidence,
            tips=tips,
            message=f"Waste classified as {waste_type.value}"
        )
        
    except Exception as e:
        logger.error(f"Error classifying waste: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during classification")

def generate_tips(waste_type: WasteType, bin_type: BinCategory, fit_status: FitStatus, volume: int) -> list:
    """Generate disposal tips based on classification results."""
    tips = []
    
    # General tips based on waste type
    if waste_type == WasteType.PLASTIC:
        tips.extend([
            "Remove any labels or caps before recycling",
            "Rinse clean before disposal",
            "Check if it's recyclable in your area"
        ])
    elif waste_type == WasteType.PAPER:
        tips.extend([
            "Remove any plastic or metal components",
            "Keep dry to prevent contamination",
            "Shred sensitive documents before recycling"
        ])
    elif waste_type == WasteType.GLASS:
        tips.extend([
            "Remove metal caps and labels",
            "Rinse clean before recycling",
            "Don't mix different colored glass"
        ])
    elif waste_type == WasteType.ORGANIC:
        tips.extend([
            "Compost if possible",
            "Remove any non-organic materials",
            "Keep in sealed container to prevent odors"
        ])
    
    # Tips based on fit status
    if fit_status == FitStatus.DOES_NOT_FIT:
        tips.append("Consider breaking down into smaller pieces")
        tips.append("Look for larger disposal bins in your area")
    elif fit_status == FitStatus.PARTIAL_FIT:
        tips.append("This item is quite large - ensure it fits properly")
    
    # Volume-based tips
    if volume > 2000:
        tips.append("Large item - consider scheduling a pickup")
    
    return tips
