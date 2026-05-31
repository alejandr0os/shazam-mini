import re
import json
from difflib import SequenceMatcher

_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    return _whisper_model

def transcribe_audio(file_path):
    model = get_whisper_model()
    segments, info = model.transcribe(file_path, language="es", beam_size=5)
    text = " ".join(seg.text for seg in segments).strip()
    return text

def _tokenize(text):
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    return set(text.split())

def _normalize(text):
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    return text.strip()

def search_lyrics(query_text, db, top_n=5):
    if not query_text or len(query_text.strip()) < 2:
        return []

    query_tokens = _tokenize(query_text)
    query_norm = _normalize(query_text)

    if not query_tokens:
        return []

    with db.cursor() as cursor:
        cursor.execute("SELECT id, title, artist, lyrics, thumbnail FROM songs WHERE lyrics IS NOT NULL AND lyrics != ''")
        rows = cursor.fetchall()

    results = []

    for row in rows:
        song_id, title, artist, lyrics_raw, thumbnail = row

        full_text = ""
        try:
            parsed = json.loads(lyrics_raw)
            if isinstance(parsed, list):
                full_text = " ".join(line.get("text", "") for line in parsed)
            else:
                full_text = str(parsed)
        except (json.JSONDecodeError, ValueError, TypeError):
            full_text = str(lyrics_raw)

        lyrics_norm = _normalize(full_text)
        lyrics_tokens = _tokenize(full_text)

        if not lyrics_tokens:
            continue

        overlap = len(query_tokens & lyrics_tokens)
        token_score = overlap / len(query_tokens) if query_tokens else 0

        best_ratio = 0
        if token_score > 0:
            words = query_norm.split()
            for i in range(len(words)):
                for j in range(i + 1, min(i + 8, len(words) + 1)):
                    phrase = " ".join(words[i:j])
                    ratio = SequenceMatcher(None, phrase, lyrics_norm).ratio()
                    if ratio > best_ratio:
                        best_ratio = ratio

        combined_score = (token_score * 0.4) + (best_ratio * 0.6)

        if combined_score > 0.15:
            results.append({
                "id": song_id,
                "title": title,
                "artist": artist,
                "thumbnail": thumbnail,
                "score": round(combined_score, 3),
                "matched_words": overlap
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_n]
