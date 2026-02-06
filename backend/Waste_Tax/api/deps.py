# api/deps.py
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional, List

class Settings(BaseSettings):
    # App settings
    app_name: str = "EcoFit Waste Classification API"
    debug: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Model settings
    model_path: Optional[str] = Field(default=None)
    confidence_threshold: float = 0.5

    # Database settings
    mongodb_url: Optional[str] = Field(default=None)
    mongodb_db_name: Optional[str] = Field(default=None)

    # CORS settings
    allowed_origins: List[str] = ["*"]

    model_config = {
        "env_file": "../.env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore"
    }

def get_settings() -> Settings:
    return Settings()