from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    app_name: str = "EcoFit Waste Classification API"
    debug: bool = False
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    GROQ_API_KEY: str
    RAG_DIR: str = "rag_data/"  
    
    # Model settings
    model_path: Optional[str] = None
    confidence_threshold: float = 0.5
    
    # CORS settings
    allowed_origins: list = ["*"]
    
    class Config:
        env_file = ".env"

settings = Settings()

def get_settings():
    return Settings()
