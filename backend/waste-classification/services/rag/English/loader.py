import json
import numpy as np
import faiss
from core.config import settings


def load_rag_files():
    RAG_DIR = settings.RAG_DIR

    with open(RAG_DIR + "chunks.json", "r") as f:
        chunked_docs = json.load(f)

    with open(RAG_DIR + "metadata.json", "r") as f:
        metadata = json.load(f)

    embeddings = np.load(RAG_DIR + "embeddings.npy")
    index = faiss.read_index(RAG_DIR + "RAG_index.faiss")

    return chunked_docs, metadata, embeddings, index


chunked_docs, metadata, embeddings, index = load_rag_files()
