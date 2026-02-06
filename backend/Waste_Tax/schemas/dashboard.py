from pydantic import BaseModel
from typing import List, Optional


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