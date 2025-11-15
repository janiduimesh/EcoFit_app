from fastapi import Depends
from core.config import get_settings

settings = get_settings()

def get_api_settings():
    return settings
