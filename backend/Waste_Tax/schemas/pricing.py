from pydantic import BaseModel, Field, field_validator
from typing import Literal
from datetime import date


class SetPriceRequest(BaseModel):
    waste_type: Literal["Organic", "Inorganic", "Recyclable"]
    price: float = Field(..., gt=0, description="Base price per Kg in Rs")
    collector_id: str


    effective_date: date = Field(..., description="The date this price takes effect")

    @field_validator('effective_date')
    def date_must_be_future_or_today(cls, v):

        return v