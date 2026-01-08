import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
from services.classifier import WasteClassifier
from core.database import get_database

logger = logging.getLogger(__name__)


async def save_bin_volume():
    """Fetch bin volume from sensor and store in database"""
    classifier = WasteClassifier()
    bin_volume, distance_cm = await classifier.get_bin_volume_from_sensor()
    
    db = get_database()
    record = {
        "bin_volume": bin_volume,
        "distance_cm": distance_cm,
        "recorded_at": datetime.utcnow()
    }
    
    await db.bin_volumes.insert_one(record)
    logger.info(f"Saved bin volume: {bin_volume}, distance: {distance_cm}")


async def setup_schedular():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        save_bin_volume,
        CronTrigger(hour="18", minute="17", second="0"),
        id="get_bin_volume_from_sensor",
        name="Get bin volume from sensor",
        replace_existing=True,
    )
    scheduler.start()
    return scheduler