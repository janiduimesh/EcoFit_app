import bcrypt
from schemas.User_schema import (
    UserRegisterRequest, 
    UserRegisterResponse, 
    UserLoginRequest, 
    UserLoginResponse,
    UserProfileUpdateRequest,
    UserProfileUpdateResponse
)
from typing import Optional
import logging
from datetime import datetime
from bson import ObjectId
from core.database import get_database

logger = logging.getLogger(__name__)

def hash_password(password: str) -> str:
    """Hash a password using bcrypt. Bcrypt has a 72-byte limit."""
    password = password.strip() if password else ""
    
    if not password:
        raise ValueError("Password cannot be empty")
    
    password_bytes = password.encode('utf-8')
    
    if len(password_bytes) > 72:
        logger.warning(f"Password exceeds 72 bytes ({len(password_bytes)}), truncating to 72 bytes")
        password_bytes = password_bytes[:72]
    
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash using bcrypt."""
    try:
        # Convert to bytes
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        
        # Ensure password is within 72 bytes
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        # Verify using bcrypt
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        logger.error(f"Password verification error: {str(e)}")
        return False

async def register_user(user_data: UserRegisterRequest) -> UserRegisterResponse:

    db = get_database()
    users_collection = db["users"]
    
    # Check if user already exists
    email_lower = user_data.email.lower()
    existing_user = await users_collection.find_one({"email": email_lower})
    
    if existing_user:
        raise ValueError("Email already registered")
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user record
    user_record = {
        "name": user_data.name,
        "email": email_lower, 
        "hashed_password": hashed_password,
        "address": user_data.address,
        "created_at": datetime.utcnow()
    }
    
    # Insert user into MongoDB
    result = await users_collection.insert_one(user_record)
    user_id = str(result.inserted_id)
    
    logger.info(f"User registered successfully: {user_data.email} (ID: {user_id})")
    
    return UserRegisterResponse(
        message="User registered successfully",
        user_id=user_id,
        email=user_data.email
    )

async def get_user_by_email(email: str) -> Optional[dict]:
    """Get user by email from MongoDB."""
    db = get_database()
    users_collection = db["users"]
    
    email_lower = email.lower()
    user = await users_collection.find_one({"email": email_lower})
    
    if user:
        # Convert ObjectId to string for JSON serialization
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        # Don't return hashed_password in normal queries
        user.pop("hashed_password", None)
    
    return user

async def get_user_by_id(user_id: str) -> Optional[dict]:
    """Get user by ID from MongoDB."""
    db = get_database()
    users_collection = db["users"]
    
    try:
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if user:
            user["id"] = str(user["_id"])
            user.pop("_id", None)
            # Don't return hashed_password in normal queries
            user.pop("hashed_password", None)
        return user
    except Exception as e:
        logger.error(f"Error getting user by ID: {str(e)}")
        return None

async def login_user(user_data: UserLoginRequest) -> UserLoginResponse:
  
    
    db = get_database()
    users_collection = db["users"]
    
    email_lower = user_data.email.lower()
    user = await users_collection.find_one({"email": email_lower})
    
    if not user:
        logger.warning(f"Login attempt with non-existent email: {email_lower}")
        raise ValueError("Invalid email or password")
    
    if not verify_password(user_data.password, user["hashed_password"]):
        logger.warning(f"Login attempt with incorrect password for email: {email_lower}")
        raise ValueError("Invalid email or password")
    
    user_id = str(user["_id"])
    
    logger.info(f"User logged in successfully: {user_data.email} (ID: {user_id})")
    
    return UserLoginResponse(
        message="Login successful",
        user_id=user_id,
        token=None  # Can be implemented later with JWT
    )

async def update_user_profile(user_id: str, profile_data: UserProfileUpdateRequest) -> UserProfileUpdateResponse:
    """Update user profile information."""
    db = get_database()
    users_collection = db["users"]
    
    try:
        # Validate user_id format
        try:
            object_id = ObjectId(user_id)
        except Exception:
            raise ValueError("Invalid user ID format")
        
        # Check if user exists
        user = await users_collection.find_one({"_id": object_id})
        if not user:
            raise ValueError("User not found")
        
        # Prepare update data, excluding None values
        update_data = {}
        if profile_data.waste_amount is not None:
            update_data["waste_amount"] = profile_data.waste_amount
        if profile_data.has_recycling_bin is not None:
            update_data["has_recycling_bin"] = profile_data.has_recycling_bin
        if profile_data.has_compost_bin is not None:
            update_data["has_compost_bin"] = profile_data.has_compost_bin
        if profile_data.has_weekly_collection is not None:
            update_data["has_weekly_collection"] = profile_data.has_weekly_collection
        if profile_data.residence_type is not None:
            update_data["residence_type"] = profile_data.residence_type
        if profile_data.household_size is not None:
            update_data["household_size"] = profile_data.household_size
        if profile_data.onboarding_completed is not None:
            update_data["onboarding_completed"] = profile_data.onboarding_completed
        
        # Add updated timestamp
        update_data["updated_at"] = datetime.utcnow()
        
        # Update user in MongoDB
        result = await users_collection.update_one(
            {"_id": object_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise ValueError("User not found")
        
        logger.info(f"User profile updated successfully: {user_id}")
        
        return UserProfileUpdateResponse(
            message="Profile updated successfully",
            success=True
        )
    except ValueError as e:
        logger.warning(f"Profile update failed: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        raise ValueError("Internal server error during profile update")