from fastapi import APIRouter, UploadFile, File
from services.rag.english.ingestion import update_rag_index

router = APIRouter(prefix="/english_docs", tags=["English_documents"])

@router.post("/upload")
async def upload_english_doc(file: UploadFile = File(...)):
    result = await update_rag_index(file)
    return {
        "message": "Document added successfully", 
        "details": result
    }