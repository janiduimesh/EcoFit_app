import json
import os
import faiss
from sentence_transformers import SentenceTransformer

RAG_DATA = "rag_data"

INDEX_PATH = os.path.join(RAG_DATA, "RAG_index.faiss")
CHUNKS_PATH = os.path.join(RAG_DATA, "chunks.json")
METADATA_PATH = os.path.join(RAG_DATA, "metadata.json")
DOCS_PATH = os.path.join(RAG_DATA, "documents.json")

model = SentenceTransformer("BAAI/bge-small-en-v1.5")


def delete_document(doc_id):

    with open(CHUNKS_PATH) as f:
        chunks = json.load(f)

    with open(METADATA_PATH) as f:
        metadata = json.load(f)

    with open(DOCS_PATH) as f:
        documents = json.load(f)

    #Find indices to keep
    keep_indices = []

    for i, m in enumerate(metadata):
        if m.get("doc_id") == doc_id:
            continue

        keep_indices.append(i)

    if len(keep_indices) == len(metadata):
        return {"error": "Document not found"}

    #Filter chunks and metadata
    new_chunks = [chunks[i] for i in keep_indices]
    new_metadata = [metadata[i] for i in keep_indices]

    if len(new_chunks) > 0:

        embeddings = model.encode(
            new_chunks,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

        dimension = embeddings.shape[1]
        new_index = faiss.IndexFlatIP(dimension)

        new_index.add(embeddings)

    else:
        #Create empty index safely
        dimension = 384 
        new_index = faiss.IndexFlatIP(dimension)

    #Remove document entry
    documents = [d for d in documents if d["doc_id"] != doc_id]

    print("DEBUG: Deleting document:", doc_id)
    print("DEBUG: Remaining chunks:", len(new_chunks))

    #Save updated data
    faiss.write_index(new_index, INDEX_PATH)

    with open(CHUNKS_PATH, "w") as f:
        json.dump(new_chunks, f)

    with open(METADATA_PATH, "w") as f:
        json.dump(new_metadata, f)

    with open(DOCS_PATH, "w") as f:
        json.dump(documents, f)

    return {
        "message": "Document deleted successfully",
        "remaining_chunks": len(new_chunks)
    }