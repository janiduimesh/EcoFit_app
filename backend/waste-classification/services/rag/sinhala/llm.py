import requests

#Replace with ngrok URL
COLAB_LLM_URL = "https://inky-inordinately-myrtie.ngrok-free.dev/generate"

def generate_sinhala_answer(query: str, user_area: str):
    response = requests.post(
        COLAB_LLM_URL,
        json={
            "query": query, 
            "user_area": user_area
            },
        timeout=120
    )
    response.raise_for_status() 

    return response.json()