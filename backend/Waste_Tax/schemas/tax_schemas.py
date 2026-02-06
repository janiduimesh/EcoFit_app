from pydantic import BaseModel

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
