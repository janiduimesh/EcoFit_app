from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional, Literal
from datetime import date, datetime

# --- From create_user.py ---
class WeekData(BaseModel):
    year: int
    week: int
    weight_kg: float

class CreateUserRequest(BaseModel):
    email: str
    household_id: str
    income_tier: str
    qr_code: str
    waste_data: Dict[str, List[WeekData]]

class AddWeekRequest(BaseModel):
    household_id: str
    waste_type: str
    year: int
    week: int
    weight_kg: float

# --- From dashboard.py ---
class BillDetails(BaseModel):
    weight_kg: float
    status: str
    base_cost: float
    discount_amount: float
    penalty_amount: float
    final_bill: float

class DashboardResponse(BaseModel):
    household_id: str
    waste_type: str
    current_week_number: int
    current_bill: BillDetails
    next_week_number: int
    predicted_bill: BillDetails

class HistoricalBillItem(BaseModel):
    year: int
    week: int
    weight_kg: float
    status: str
    base_cost: float
    discount_amount: float
    penalty_amount: float
    final_bill: float

class HistoryTaxResponse(BaseModel):
    household_id: str
    waste_type: str
    base_rate_used: float
    history: List[HistoricalBillItem]

class ForecastItem(BaseModel):
    week_offset: int
    year: int
    week: int
    predicted_weight_kg: float
    estimated_bill: BillDetails

class ForecastResponse(BaseModel):
    household_id: str
    waste_type: str
    forecast_horizon: int
    forecast_data: List[ForecastItem]

class UnifiedForecastResponse(BaseModel):
    household_id: str
    waste_type: str
    history_data: List[ForecastItem]
    forecast_data: List[ForecastItem]

# --- From monthly_schemas.py ---
class GenerateMonthlyBillResponse(BaseModel):
    status: str
    month: int
    year: int
    generated_bills: int

class EmptyMonthlyBillResponse(BaseModel):
    status: str
    message: str

# --- From pricing.py ---
class SetPriceRequest(BaseModel):
    waste_type: Literal["Organic", "Inorganic", "Recyclable"]
    price: float = Field(..., gt=0, description="Base price per Kg in Rs")
    collector_id: str
    effective_date: date = Field(..., description="The date this price takes effect")

    @field_validator('effective_date')
    def date_must_be_future_or_today(cls, v):
        return v

# --- From review.py ---
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

# --- From tax_schemas.py ---
class TaxInput(BaseModel):
    income_tier: str
    behaviour_class: str
    waste_type: str
    weight_kg: float
    base_unit_price: float
    lag_1w: float

class TaxOutput(BaseModel):
    pred_multiplier: float
    pred_discount: float
    final_bill: float

# --- From weight_schemas.py ---
class PredictNextRequest(BaseModel):
    household_id: str
    waste_type: Literal["Organic", "Recyclable", "Inorganic"]
    current_weight_kg: float = Field(..., gt=0, description="The actual weight for the current week")

class WeeklyFeature(BaseModel):
    lag_1w: float
    lag_2w: float
    lag_4w: float
    roll_4w: float
    roll_8w: float
    roll_12w: float
    year: int
    week: int

class WeightInput(BaseModel):
    household_id: str
    waste_type: Literal["Organic", "Recyclable", "Inorganic"]
    features: List[WeeklyFeature]

class WeightOutput(BaseModel):
    predicted_weight_kg: float