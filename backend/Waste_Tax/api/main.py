# api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .deps import get_settings
from core.database import connect_to_mongo, close_mongo_connection
from jobs.schedular import setup_schedular

# Import routers
from routers import weight, tax, collector, monthly, create_user, update_week, fetch_user, collector, dashboard, forecast, admin_review, sync_missing, admin_login, User_routes

# Load settings
settings = get_settings()

# Initialize FastAPI
app = FastAPI(
    title=settings.app_name,
    description="API for Weight Prediction & Tax Calculation",
    version="1.0.0",
    debug=settings.debug
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_db_client():
    import logging
    logger = logging.getLogger(__name__)
    print("🔄 Starting database connection...")
    await connect_to_mongo()

    # Start the scheduler
    print("🔄 Starting scheduler...")
    await setup_schedular()


@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()


# Include routers
app.include_router(weight.router, prefix="/api/v2", tags=["weight"])
app.include_router(tax.router, prefix="/api/v2", tags=["tax"])
app.include_router(collector.router, prefix="/api/v2", tags=["collector"])
app.include_router(monthly.router, prefix="/api/v2", tags=["monthly"])
app.include_router(create_user.router, prefix="/api/v2", tags=["create_user"])
app.include_router(update_week.router, prefix="/api/v2", tags=["update_week"])
app.include_router(fetch_user.router, prefix="/api/v2", tags=["fetch_user"])
app.include_router(collector.router, prefix="/api/v2", tags=["collector"])
app.include_router(dashboard.router, prefix="/api/v2", tags=["dashboard"])
app.include_router(forecast.router, prefix="/api/v2", tags=["forecast"])
app.include_router(admin_review.router, prefix="/api/v2", tags=["admin_review"])
app.include_router(sync_missing.router, prefix="/api/v2", tags=["sync"])
app.include_router(admin_login.router, prefix="/api/v2", tags=["admin_login"])
app.include_router(User_routes.router, prefix="/api/v2/user", tags=["User_routes"])

@app.get("/")
async def root():
    return {"message": settings.app_name, "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}