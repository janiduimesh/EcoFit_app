from fastapi import APIRouter, UploadFile, File
import os
import json
from services.rag.english.ingestion import update_rag_index
from services.rag.english.delete_document import delete_document

router = APIRouter(prefix="/english_docs", tags=["English_documents"])

RAG_DATA = "rag_data"
DOCS_PATH = os.path.join(RAG_DATA, "documents.json")

@router.post("/upload")
async def upload_english_doc(file: UploadFile = File(...)):
    result = await update_rag_index(file)
    return {
        "message": "Document added successfully", 
        "details": result
    }

@router.get("/documents")
async def list_documents():

    with open(DOCS_PATH) as f:
        documents = json.load(f)

    return {
        "total_documents": len(documents),
        "documents": documents
    }

@router.delete("/documents/{doc_id}")
async def delete_doc(doc_id: str):

    result = delete_document(doc_id)

    return result