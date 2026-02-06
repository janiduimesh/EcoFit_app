from pydantic import BaseModel
from typing import List, Dict

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