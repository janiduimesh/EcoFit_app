from fastapi import APIRouter, HTTPException
from services.rag.pipeline import rag_answer
from services.User_service import get_user_area
from schemas.rag_schemas import RAGQuery

import logging

# Configure logging
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
# )
# logger = logging.getLogger(__name__)

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
    
    # logger.info(f"Data: {data}")

    return rag_answer(data.query, area)
