from motor.motor_asyncio import AsyncIOMotorClient
from core.config import get_settings


settings = get_settings()


client = AsyncIOMotorClient(settings.mongodb_url)
db = client[settings.mongodb_db_name]


async def check_connection() -> bool:
    try:
        await client.server_info()
        return True
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return False
