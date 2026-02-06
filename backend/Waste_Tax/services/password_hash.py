from passlib.context import CryptContext
from services.db_service import db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


users_collection = db["users"]

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_next_collector_id(location: str) -> str:

    regex_pattern = f"^Collector_{location}_\\d+$"

    cursor = users_collection.find({"username": {"$regex": regex_pattern}})
    users = await cursor.to_list(length=1000)

    if not users:
        return "01"

    max_num = 0
    for user in users:
        try:

            parts = user["username"].split("_")

            num_part = int(parts[-1])
            if num_part > max_num:
                max_num = num_part
        except (ValueError, IndexError):
            continue

    return f"{max_num + 1:02d}"