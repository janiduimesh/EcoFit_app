# schemas/user.py
from pydantic import BaseModel
from typing import List, Optional
from schemas.tax_schemas import ForecastItem

class UserBase(BaseModel):
    location: str
    role: str = "admin"

class CreateUserRequest(UserBase):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str


class UnifiedForecastResponse(BaseModel):
    household_id: str
    waste_type: str
    history_data: List[ForecastItem]
    forecast_data: List[ForecastItem]


class LeaderboardEntry(BaseModel):
    rank: int
    household_id: str
    household_name: Optional[str] = "Unknown"
    location: Optional[str] = "N/A"
    total_paid: float
    total_weight: float


class CardCreateRequest(BaseModel):
    household_id: str
    card_holder: str
    card_number: str
    expiry: str
    cvv: str
    card_type: str = "Visa"


class CardResponse(BaseModel):
    card_id: str
    card_holder: str
    last4: str
    expiry: str
    card_type: str


class AdjustmentRequest(BaseModel):
    amount: float
    reason: str


class RewardDistributionRequest(BaseModel):
    year: int
    month: int
    rank1_pct: float = 12.0
    rank2_pct: float = 10.0
    rank3_pct: float = 8.0

class RewardSettingsRequest(BaseModel):
    rank1_pct: float
    rank2_pct: float
    rank3_pct: float
