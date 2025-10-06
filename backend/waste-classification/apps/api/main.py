from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import dispose, health

app = FastAPI(
    title="EcoFit Waste Classification API",
    description="API for waste classification and disposal guidance",
    version="1.0.0"
)

# CORS middleware for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify  mobile app's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(dispose.router, prefix="/api/v1", tags=["dispose"])

@app.get("/")
async def root():
    return {"message": "EcoFit Waste Classification API", "version": "1.0.0"}
