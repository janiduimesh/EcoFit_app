from pydantic import BaseModel

class RAGQuery(BaseModel):
    query: str
    user_id: str