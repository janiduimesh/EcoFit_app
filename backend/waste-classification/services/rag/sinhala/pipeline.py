from .llm import generate_sinhala_answer

def rag_answer(query: str, user_area: str):
  
    result = generate_sinhala_answer(query, user_area)
    return result