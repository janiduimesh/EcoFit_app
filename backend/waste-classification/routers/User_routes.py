from fastapi import APIRouter, HTTPException
from schemas.User_schema import (
    UserRegisterRequest, 
    UserRegisterResponse,
    UserLoginRequest,
    UserLoginResponse
)
from services.User_service import register_user, login_user
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/register", response_model=UserRegisterResponse, status_code=201)
async def register(request: UserRegisterRequest):

    try:
        result = await register_user(request)  
        return result
    except ValueError as e:
        logger.warning(f"Registration failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error during registration: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during registration")

@router.post("/login", response_model=UserLoginResponse, status_code=200)
async def login(request: UserLoginRequest):
    try:
        result = await login_user(request)
        return result
    except ValueError as e:
        logger.warning(f"Login failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error during login: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during login")
    
# @router.post("/logout", response_model=UserLogoutResponse, status_code=200)
# async def logout(request: UserLogoutRequest):
#     try:
#         result = await logout_user(request)
#         return result
#     except ValueError as e:
#         logger.warning(f"Logout failed: {str(e)}")
#         raise HTTPException(status_code=400, detail=str(e))
#     except Exception as e:
#         logger.error(f"Error during logout: {str(e)}")
#         raise HTTPException(status_code=500, detail="Internal server error during logout")
