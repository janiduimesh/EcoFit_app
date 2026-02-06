from motor.motor_asyncio import AsyncIOMotorClient
from core.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class Database:
    client: AsyncIOMotorClient = None
    database = None


db = Database()


async def connect_to_mongo():
    """Create database connection"""
    try:
        logger.info(f"Attempting to connect to MongoDB at: {settings.mongodb_url}")
        db.client = AsyncIOMotorClient(settings.mongodb_url)
        db.database = db.client[settings.mongodb_db_name]

        # Verify connection
        await db.client.admin.command('ping')
        logger.info("✅ Connected to MongoDB successfully")
    except Exception as e:
        logger.error(f"❌ Error connecting to MongoDB: {str(e)}")
        raise


async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        logger.info("Disconnected from MongoDB")


def get_database():
    """Get database instance with safety check"""
    if db.database is None:
        logger.error("Database accessed before initialization!")
        return None
    return db.database