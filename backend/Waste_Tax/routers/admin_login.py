
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from schemas.admin_login import CreateUserRequest, Token
from services.password_hash import (
    get_password_hash,
    verify_password,
    get_next_collector_id,
    users_collection
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/next-id")
async def get_next_id(location: str):

    next_id = await get_next_collector_id(location)
    return {"next_id": next_id}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(user: CreateUserRequest):

    existing_user = await users_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already exists. Please refresh to generate a new ID."
        )


    hashed_password = get_password_hash(user.password)


    user_doc = {
        "username": user.username,
        "location": user.location,
        "role": user.role,
        "hashed_password": hashed_password
    }

    await users_collection.insert_one(user_doc)

    return {"message": "User registered successfully", "username": user.username}


@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):

    user = await users_collection.find_one({"username": form_data.username})


    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )


    access_token = f"jwt-token-for-{user['username']}"

    return {"access_token": access_token, "token_type": "bearer"}