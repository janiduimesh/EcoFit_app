from fastapi import APIRouter, HTTPException
from core.database import db, get_database
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {"status": "healthy", "service": "waste-classification"}

@router.get("/health/db")
async def database_health_check():
    """
    Check MongoDB database connection status.
    Returns connection status and database info.
    """
    try:
        # Check if database client exists
        if db.client is None or db.database is None:
            raise HTTPException(
                status_code=503,
                detail="Database not connected"
            )
        
        # Test connection with ping
        await db.client.admin.command('ping')
        
        # Get database name
        database = get_database()
        db_name = database.name
        
        # Get server info
        server_info = await db.client.server_info()
        
        return {
            "status": "connected",
            "database": db_name,
            "mongodb_version": server_info.get("version", "unknown"),
            "message": "MongoDB connection is healthy"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed: {str(e)}"
        )
