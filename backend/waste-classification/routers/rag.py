from fastapi import APIRouter
from services.rag.pipeline import rag_answer
from schemas.rag_schemas import RAGQuery

import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["RAG Chatbot"])

@router.post("/ask")
def ask_rag(data: RAGQuery):
    logger.info(f"Data: {data}")

    return rag_answer(data.query)
