import os
import json
import faiss
import fitz
from sentence_transformers import SentenceTransformer
from tempfile import NamedTemporaryFile

RAG_DATA = "rag_data"

INDEX_PATH = os.path.join(RAG_DATA, "RAG_index.faiss")
CHUNKS_PATH = os.path.join(RAG_DATA, "chunks.json")
METADATA_PATH = os.path.join(RAG_DATA, "metadata.json")
DOCS_PATH = os.path.join(RAG_DATA, "documents.json")

model = SentenceTransformer("BAAI/bge-small-en-v1.5")

def extract_text_from_pdf(file_path):
    pages = []

    with fitz.open(file_path) as doc:
        for page_num, page in enumerate(doc):
            text = page.get_text()
            pages.append((page_num + 1, text))

    return pages

def chunk_text(text, max_tokens=200, min_tokens=60):
    if isinstance(text, list):
        text = " ".join(text)
        
    words = text.split()
    chunks = []

    i = 0
    while i < len(words):
        chunk = words[i:i+max_tokens]
        if len(chunk) >= 20:
            chunks.append(" ".join(chunk))
        i += max_tokens

    return chunks

async def update_rag_index(upload_file):

    #Save uploaded file temporarily
    with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await upload_file.read()
        tmp.write(content)
        temp_path = tmp.name

    try: 
        #Load existing data
        with open(CHUNKS_PATH) as f:
            chunks = json.load(f)

        with open(METADATA_PATH) as f:
            metadata = json.load(f)

        with open(DOCS_PATH) as f:
            documents = json.load(f)

        print("DEBUG: Existing chunks:", len(chunks))
        # print("DEBUG: Existing metadata:", len(metadata))
        print("DEBUG: Existing documents:", len(documents))

        #Duplicate document check
        existing_sources = {d["source"] for d in documents}

        if upload_file.filename in existing_sources:
            return {
                "message": "Document already exists",
                "filename": upload_file.filename
            }
        
        doc_id = f"doc_{len(documents)+1}"

        documents.append({
            "doc_id": doc_id,
            "source": upload_file.filename
        })

        index = faiss.read_index(INDEX_PATH)

        #Extract text by pages
        pages = extract_text_from_pdf(temp_path)

        print("DEBUG: Total pages extracted:", len(pages))

        # for p in pages[:2]:  # show first 2 pages
        #     print("DEBUG: Page", p[0], "text length:", len(p[1]))

        new_chunks = []
        new_metadata = []

        chunk_id = len(chunks)

        for page_num, page_text in pages:

            page_chunks = chunk_text(page_text)
            print(f"DEBUG: Page {page_num} produced {len(page_chunks)} chunks")

            for c in page_chunks:

                new_chunks.append(c)

                new_metadata.append({
                    "chunk_id": chunk_id,
                    "doc_id": doc_id,
                    "source": upload_file.filename,
                    "page": page_num
                })

                chunk_id += 1
        
        print("DEBUG: Total new chunks:", len(new_chunks))
        # print("DEBUG: Sample chunk:", new_chunks[0][:200])

        #Generate embeddings
        embeddings = model.encode(
            new_chunks,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        # print("DEBUG: Embeddings shape:", embeddings.shape)

        #Add to FAISS
        index.add(embeddings)
        # print("DEBUG: FAISS index size:", index.ntotal)

        #Update local storage
        chunks.extend(new_chunks)
        metadata.extend(new_metadata)

        #Save updated files
        faiss.write_index(index, INDEX_PATH)

        with open(CHUNKS_PATH, "w") as f:
            json.dump(chunks, f)

        with open(METADATA_PATH, "w") as f:
            json.dump(metadata, f)

        with open(DOCS_PATH, "w") as f:
            json.dump(documents, f)

        return {
            "message": "Document added successfully",
            "filename": upload_file.filename,
            "doc_id": doc_id,
            "new_chunks": len(new_chunks),
            "total_chunks": len(chunks)
        }

    finally:
        #Clean up temporary file
        os.remove(temp_path)