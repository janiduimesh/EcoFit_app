from fastapi import APIRouter, HTTPException
from services.rag.english.pipeline import rag_answer as english_rag
from services.rag.sinhala.pipeline import rag_answer as sinhala_rag
from services.User_service import get_user_area
from schemas.rag_schemas import RAGQuery
from core.language import detect_language
import logging

router = APIRouter(prefix="/rag", tags=["RAG Chatbot"])

@router.post("/ask")
async def ask_rag(data: RAGQuery):
    #Get user's area from DB
    area = await get_user_area(data.user_id)

    if not area:
        raise HTTPException(
            status_code=400,
            detail="User area not found"
        )

    #Detect language
    language = detect_language(data.query)

    logging.info(f"[RAG] User query detected as '{language}' | User area: {area}")

    if language == "sinhala":
        return sinhala_rag(data.query, area)

    return english_rag(data.query, area)


