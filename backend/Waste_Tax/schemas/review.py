from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SubmitWeightRequest(BaseModel):
    household_id: str
    waste_type: str
    weight_kg: float


class ReviewActionRequest(BaseModel):
    submission_id: str
    action: str


class PendingItemResponse(BaseModel):
    submission_id: str
    household_id: str
    waste_type: str
    weight_kg: float
    status: str
    submitted_at: datetime