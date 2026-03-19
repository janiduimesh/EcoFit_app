import numpy as np
from sentence_transformers import SentenceTransformer, CrossEncoder
from services.rag.english.loader import chunked_docs, metadata, embeddings, index
from core.config import settings

EMBED_MODEL = "BAAI/bge-small-en-v1.5"
RERANK_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

embedding_model = SentenceTransformer(EMBED_MODEL)
reranker = CrossEncoder(RERANK_MODEL)


def count_tokens(text, avg_chars_per_token=3.8):
    return len(text) / avg_chars_per_token


def retrieve_chunks(query, top_k=20, rerank_top_k=10, final_k=5):
    q_emb = embedding_model.encode(
        [query], convert_to_numpy=True, normalize_embeddings=True
    )

    scores, indices = index.search(q_emb, top_k)

    candidates = []
    for rank, idx in enumerate(indices[0]):
        candidates.append({
            "chunk_id": int(idx),
            "text": chunked_docs[idx],
            "score": float(scores[0][rank]),
            "meta": metadata[idx]
        })

    rerank_set = candidates[:rerank_top_k]
    pairs = [[query, c["text"]] for c in rerank_set]
    rerank_scores = reranker.predict(pairs)

    for c, rs in zip(rerank_set, rerank_scores):
        c["rerank_score"] = float(rs)

    rerank_set.sort(key=lambda x: x["rerank_score"], reverse=True)
    return rerank_set[:final_k]

def build_context(chunks, max_tokens=6500):
    merged = []
    used_chunks = []
    total_tokens = 0

    for c in chunks:
        tagged = f"{c['text']}\n"
        tok = count_tokens(tagged)

        if total_tokens + tok > max_tokens:
            continue

        merged.append(tagged)
        used_chunks.append(c)
        total_tokens += tok

    return "\n".join(merged), used_chunks

