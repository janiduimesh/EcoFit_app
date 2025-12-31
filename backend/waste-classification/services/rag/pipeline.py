from services.rag.retrieval import retrieve_chunks, build_context
from services.rag.llm import client

GROQ_MODEL = "llama-3.1-8b-instant"


def rag_answer(query):
    print(f"[RAG QUERY] {query}")
    chunks = retrieve_chunks(query)
    context, used_ids = build_context(chunks)

    prompt = f"""
You are a helpful RAG-based assistant.

Rules:
1. Use ONLY the information inside CONTEXT.
2. If the answer is not in CONTEXT, say: "I don't know based on the provided documents."
3. Cite ONLY the CHUNK IDs appearing in the context.

### CONTEXT:
{context}

### QUESTION:
{query}

### FORMAT:
Answer: <your answer>

Sources:
- CHUNK <id>
"""

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": "You are a RAG assistant."},
            {"role": "user",  "content": prompt}
        ]
    )

    return {
        "answer": response.choices[0].message.content,
        "sources": used_ids
    }
