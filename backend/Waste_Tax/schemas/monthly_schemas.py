from pydantic import BaseModel

class GenerateMonthlyBillResponse(BaseModel):
    status: str
    month: int
    year: int
    generated_bills: int

class EmptyMonthlyBillResponse(BaseModel):
    status: str
    message: str
