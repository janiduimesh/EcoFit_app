from groq import Groq
from core.config import settings

client = Groq(api_key=settings.GROQ_API_KEY)