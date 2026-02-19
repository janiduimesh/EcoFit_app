# schemas/user.py
from pydantic import BaseModel
from typing import Optional

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