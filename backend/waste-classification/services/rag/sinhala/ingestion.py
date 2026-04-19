import os
import requests
from tempfile import NamedTemporaryFile

COLAB_API_URL = "https://inky-inordinately-myrtie.ngrok-free.dev/generate"

async def upload_sinhala_doc(upload_file):

    #Save temp file
    with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await upload_file.read()
        tmp.write(content)
        temp_path = tmp.name

    try:
        with open(temp_path, "rb") as f:
            files = {"file": (upload_file.filename, f, "application/pdf")}

            response = requests.post(COLAB_API_URL, files=files)

        if response.status_code == 200:
            return {
                "message": "Sinhala document sent for embedding",
                "filename": upload_file.filename,
                "colab_response": response.json()
            }
        else:
            return {
                "error": "Failed to process document in embedding server",
                "status_code": response.status_code
            }

    finally:
        os.remove(temp_path)