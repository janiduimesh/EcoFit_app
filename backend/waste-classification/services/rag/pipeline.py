from services.rag.retrieval import retrieve_chunks, build_context
from services.rag.llm import client

GROQ_MODEL = "llama-3.1-8b-instant"


def rag_answer(query: str, user_area: str):
    print(f"[RAG QUERY] {query} | AREA: {user_area}")

    #Area-aware query
    augmented_query = f"""
User area: {user_area}
Question: {query}
"""
    chunks = retrieve_chunks(augmented_query)
    context, used_chunks = build_context(chunks)

    prompt = f"""
You are a RAG-based assistant.

Rules:
1. Use ONLY the information inside CONTEXT.
2. If the answer is not in CONTEXT, say: "I don't know based on the provided documents."
3. Assume the user's area is correct. DO NOT question it.

### CONTEXT:
{context}

### QUESTION:
{query}

(User is from: {user_area})

### FORMAT:
Answer: <your answer>
"""

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        temperature=0.0,
        messages=[
            {"role": "system", "content": "You are a RAG assistant."},
            {"role": "user",  "content": prompt}
        ]
    )

    # Extract document names from metadata
    sources = list({
        c["meta"]["source"] for c in used_chunks
    })

    return {
        "answer": response.choices[0].message.content,
        "sources": sources
    }
