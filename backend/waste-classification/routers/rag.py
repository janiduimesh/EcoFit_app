from fastapi import APIRouter, HTTPException
from services.rag.English.pipeline import rag_answer
from services.User_service import get_user_area
from schemas.rag_schemas import RAGQuery
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

    return rag_answer(data.query, area)
