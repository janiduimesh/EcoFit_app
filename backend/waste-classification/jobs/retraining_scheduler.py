import logging
import subprocess
import sys
import os
from datetime import datetime
from pathlib import Path
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

RETRAIN_SCRIPT = Path(__file__).parent / "retrain_model.py"
PROJECT_ROOT = Path(__file__).parent.parent


async def trigger_model_retraining():
    
    try:
        logger.info(f"🔄 Triggering model retraining at {datetime.utcnow().isoformat()}")
        
        process = subprocess.Popen(
            [sys.executable, str(RETRAIN_SCRIPT)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(PROJECT_ROOT),
            env={**os.environ}  
        )
        
        logger.info(f"   Retraining process started with PID: {process.pid}")
        logger.info(f"   Script: {RETRAIN_SCRIPT}")
        
        
    except FileNotFoundError as e:
        logger.error(f"❌ Retraining script not found: {RETRAIN_SCRIPT}")
        logger.error(f"   Error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Failed to start retraining process: {str(e)}")


async def run_retraining_sync():
    try:
        logger.info(f"🔄 Running retraining synchronously at {datetime.utcnow().isoformat()}")
        
        process = subprocess.Popen(
            [sys.executable, str(RETRAIN_SCRIPT)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(PROJECT_ROOT),
            env={**os.environ}
        )
        
        logger.info(f"   Waiting for retraining to complete (PID: {process.pid})...")
        
        # Wait for completion with timeout (1 hour max)
        stdout, stderr = process.communicate(timeout=3600)
        
        if process.returncode == 0:
            logger.info("✅ Retraining completed successfully")
            if stdout:
                logger.debug(f"   stdout: {stdout.decode()}")
        else:
            logger.error(f"❌ Retraining failed with code {process.returncode}")
            if stderr:
                logger.error(f"   stderr: {stderr.decode()}")
                
        return process.returncode == 0
        
    except subprocess.TimeoutExpired:
        logger.error("❌ Retraining timed out after 1 hour")
        process.kill()
        return False
    except Exception as e:
        logger.error(f"❌ Retraining error: {str(e)}")
        return False


def setup_retraining_scheduler(scheduler: AsyncIOScheduler):
    """
    Add model retraining job to the scheduler.
    
    Default schedule: Every Sunday at 2:00 AM
    This allows a full week of data collection before retraining.
    """
    scheduler.add_job(
        trigger_model_retraining,
        CronTrigger(
            day_of_week="sun",  # Every Sunday
            hour="2",           # At 2:00 AM
            minute="0",
            second="0"
        ),
        id="retrain_bin_overflow_model",
        name="Retrain bin overflow prediction model",
        replace_existing=True,
    )
    
    logger.info("📅 Model retraining scheduled:")
    logger.info("   - Schedule: Every Sunday at 2:00 AM")
    logger.info(f"   - Script: {RETRAIN_SCRIPT}")


def get_next_retraining_time(scheduler: AsyncIOScheduler) -> datetime:
    """Get the next scheduled retraining time"""
    job = scheduler.get_job("retrain_bin_overflow_model")
    if job:
        return job.next_run_time
    return None

