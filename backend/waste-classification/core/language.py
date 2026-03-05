# from langdetect import detect

# def detect_language(text: str) -> str:
#     try:
#         lang = detect(text)
#         if lang == "si":
#             return "sinhala"
#         return "english"
#     except:
#         return "english"
import re

def detect_language(text: str) -> str:
    sinhala_count = len(re.findall(r'[\u0D80-\u0DFF]', text))
    english_count = len(re.findall(r'[a-zA-Z]', text))

    if sinhala_count > english_count:
        return "sinhala"

    return "english"