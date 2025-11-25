from pydantic import BaseModel, Field
from typing import Optional, List
from core.constants import WasteType, BinCategory, FitStatus

class DisposeRequest(BaseModel):
    image_data: Optional[str] = Field(None, description="Base64 encoded image data")
    description: Optional[str] = Field(None, description="Text description of the waste")
    volume: int = Field(..., description="Volume in milliliters", gt=0)
    input_method: str = Field(..., description="Input method: 'image' or 'description'")

class DisposeResponse(BaseModel):
    waste_type: WasteType
    # bin_type: BinCategory
    fit_status: FitStatus
    confidence: float = Field(..., ge=0.0, le=1.0)
    # tips: List[str] = Field(default_factory=list)
    message: Optional[str] = None

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
