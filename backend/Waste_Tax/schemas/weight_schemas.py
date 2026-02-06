from pydantic import BaseModel, Field
from typing import List, Literal


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