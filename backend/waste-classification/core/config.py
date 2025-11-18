from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path
import os

# Get the root directory and load .env
ROOT_DIR = Path(__file__).parent.parent.parent.parent
class Settings(BaseSettings):
    app_name: str = "EcoFit Waste Classification API"
    debug: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # Model settings
    model_path: Optional[str] = None
    confidence_threshold: float = 0.5
    
    mongodb_url: str
    mongodb_db_name: str
    
    class Config:
        env_file = str(ROOT_DIR / ".env")  # Points to root .env file
        env_file_encoding = 'utf-8'
        protected_namespaces = ('settings_',)  
    

def get_settings():
    return Settings()
