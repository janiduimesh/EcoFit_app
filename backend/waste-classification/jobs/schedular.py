import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
from services.classifier import WasteClassifier
from core.database import get_database
from core.constants import OVERFLOW_BIN_IDS, overflow_collection

logger = logging.getLogger(__name__)


async def save_bin_volume(bin_id: str):
    """Fetch bin volume/distance from sensor and store in this bin's collection (bin_volumes_{bin_id})."""
    classifier = WasteClassifier()
    bin_volume, distance_cm = await classifier.get_bin_volume_from_sensor()
    db = get_database()
    coll_name = overflow_collection(bin_id)
    record = {
        "bin_volume": bin_volume,
        "distance_cm": distance_cm,
        "recorded_at": datetime.utcnow()
    }
    await db[coll_name].insert_one(record)
    logger.info(f"Saved bin volume for {bin_id}: {bin_volume}, distance: {distance_cm}")


async def setup_schedular():
    scheduler = AsyncIOScheduler()
    for bin_id in OVERFLOW_BIN_IDS:
        scheduler.add_job(
            save_bin_volume,
            CronTrigger(hour="18", minute="17", second="0"),
            args=[bin_id],
            id=f"get_bin_volume_{bin_id}",
            name=f"Get bin volume for {bin_id}",
            replace_existing=True,
        )
    scheduler.start()
    return scheduler