from fastapi import APIRouter
from services.rag.pipeline import rag_answer
from schemas.rag_schemas import RAGQuery

router = APIRouter(prefix="/rag", tags=["RAG Chatbot"])

@router.post("/ask")
def ask_rag(data: RAGQuery):
    return rag_answer(data.query)
