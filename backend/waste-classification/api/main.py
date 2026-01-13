from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import dispose, health, distance, rag, User_routers
from core.database import connect_to_mongo, close_mongo_connection
from jobs.schedular import setup_schedular

app = FastAPI(
    title="EcoFit Waste Classification API",
    description="API for waste classification and disposal guidance",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    import logging
    logger = logging.getLogger(__name__)
    logger.info("Starting database connection...")
    print("🔄 Starting database connection...")
    await connect_to_mongo()
    
    # Start the scheduler
    print("🔄 Starting scheduler...")
    await setup_schedular()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

@app.get("/ping")
def ping():
    return {"status": "ok"}

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(dispose.router, prefix="/api/v1", tags=["dispose"])
app.include_router(distance.router, prefix="/api/v1", tags=["distance"])
app.include_router(rag.router, prefix="/api/v1", tags=["rag"])
app.include_router(User_routers.router, prefix="/api/v1/user", tags=["user"])

@app.get("/")
async def root():
    return {"message": "EcoFit Waste Classification API", "version": "1.0.0"}
