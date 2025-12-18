from pydantic import BaseModel, Field
from typing import Optional, List
from core.constants import WasteType, BinCategory, FitStatus

class DisposeRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="User ID for personalized tips")
    image_data: Optional[str] = Field(None, description="Base64 encoded image data")
    description: Optional[str] = Field(None, description="Text description of the waste")
    volume: Optional[int] = Field(None, description="Volume in milliliters", gt=0)
    input_method: str = Field(..., description="Input method: 'image' or 'description'")

class DisposeResponse(BaseModel):
    waste_type: WasteType
    bin_type: BinCategory
    fit_status: FitStatus
    confidence: float = Field(..., ge=0.0, le=1.0)
    message: Optional[str] = None
    bin_volume_ml: Optional[float] = None
    bin_volume_liters: Optional[float] = None
    distance_cm: Optional[float] = None

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

class DistanceRequest(BaseModel):
    volume: float = Field(..., gt=0, description="Volume of waste item in ml")

class DistanceResponse(BaseModel):
    status: str
    distance_cm: Optional[float] = None
    bin_volume_ml: Optional[float] = None
    bin_volume_liters: Optional[float] = None
    waste_volume_ml: float
    fit_status: FitStatus
    message: Optional[str] = None    

# Tips Schemas
class TipsRequest(BaseModel):
    user_id: str = Field(..., description="User ID for personalized tips")
    waste_type: str = Field(..., description="Classified waste type")

class TipsResponse(BaseModel):
    tip_id: str = Field(..., description="Unique tip ID (e.g., TIP_0001)")
    tips: List[str] = Field(default_factory=list, description="List of disposal tips")
    message: Optional[str] = None

class TipsFeedbackRequest(BaseModel):
    tip_id: str = Field(..., description="Tip ID to provide feedback for")
    user_id: str = Field(..., description="User ID providing feedback")
    feedback: str = Field(..., description="Feedback: 'like' or 'dislike'")

class TipsFeedbackResponse(BaseModel):
    success: bool
    message: str
