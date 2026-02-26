from langdetect import detect

def detect_language(text: str) -> str:
    try:
        lang = detect(text)
        if lang == "si":
            return "sinhala"
        return "english"
    except:
        return "english"