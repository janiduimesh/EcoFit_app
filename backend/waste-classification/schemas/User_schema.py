from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, description="User's full name")
    email: EmailStr = Field(..., description="User's email address")
    password: str = Field(..., min_length=6, max_length=72, description="User's password (6-72 characters, bcrypt limit)")
    address: Optional[str] = Field(None, description="User's full address")

class UserRegisterResponse(BaseModel):
    message: str
    user_id: Optional[str] = None
    email: str

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=72, description="Password (max 72 characters, bcrypt limit)")

class UserLoginResponse(BaseModel):
    message: str
    token: Optional[str] = None
    user_id: Optional[str] = None

