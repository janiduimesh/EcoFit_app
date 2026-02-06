# core/config.py
from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    # App settings
    app_name: str = "EcoFit Waste Classification API"
    debug: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Model settings
    model_path: Optional[str] = None
    confidence_threshold: float = 0.5

    # Database settings
    mongodb_url: Optional[str] = None
    mongodb_db_name: Optional[str] = None

    # CORS settings
    allowed_origins: List[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        env_names = {
            "mongodb_url": "MONGODB_URI",
            "mongodb_db_name": "MONGODB_DB"
        }

def get_settings() -> Settings:
    return Settings()
