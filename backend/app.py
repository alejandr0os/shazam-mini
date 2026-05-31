import os 

try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except ImportError:
    pass

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from core.audio_processor import AudioProcessor
from core.database_manager import DatabaseManager
from core.matcher import SongMatcher
from core.lyrics_search import transcribe_audio, search_lyrics

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_folder = os.path.join(base_dir, "frontend", "www")
thumbnails_dir = os.path.join(base_dir, "thumbnails")
os.makedirs(thumbnails_dir, exist_ok=True)

app = Flask(__name__, static_folder=frontend_folder, static_url_path="")
CORS(app, origins="*")

app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

db = DatabaseManager()
processor = AudioProcessor()
matcher = SongMatcher(db)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

for f in os.listdir(UPLOAD_FOLDER):
    p = os.path.join(UPLOAD_FOLDER, f)
    if os.path.isfile(p):
        os.remove(p)

ALLOWED_MIMES = {'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/mp4', 'video/webm', 'application/octet-stream'}

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/history.html")
@app.route("/history")
def history_page():
    return app.send_static_file("history.html")

@app.route("/playlist.html")
@app.route("/playlist")
def playlist_page():
    return app.send_static_file("playlist.html")

@app.route("/stats.html")
@app.route("/stats")
def stats_page():
    return app.send_static_file("stats.html")

@app.route("/api/identify", methods=["POST"])
def identify():
    if "audio" not in request.files:
        return jsonify({"status": "error", "message": "No se proporciono archivo de audio"}), 400
        
    audio_file = request.files["audio"]
    if audio_file.filename == "":
        return jsonify({"status": "error", "message": "Archivo vacio"}), 400

    if audio_file.content_type and audio_file.content_type not in ALLOWED_MIMES:
        if not audio_file.filename.lower().endswith(('.wav', '.mp3', '.ogg', '.webm', '.m4a')):
            return jsonify({"status": "error", "message": "Tipo de archivo no soportado"}), 400
        
    import uuid
    filename = f"{uuid.uuid4()}.wav"
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(file_path)
    
    try:
        picos = processor.get_peaks(file_path)
        hashes = processor.generate_hashes(picos)
        resultado = matcher.identify_audio(hashes)
        
        if resultado["status"] == "success":
            import json
            resultado["offset_seconds"] = resultado["best_time_difference"] * 512 / processor.sample_rate
            resultado["thumbnail_url"] = "/api/thumbnail/" + str(resultado["id"]) if resultado.get("thumbnail") else None
            if resultado.get("lyrics"):
                try:
                    parsed = json.loads(resultado["lyrics"])
                    if isinstance(parsed, list):
                        resultado["lyrics"] = parsed
                    else:
                        resultado["lyrics"] = None
                except (json.JSONDecodeError, ValueError):
                    resultado["lyrics"] = None
            
            db.log_scan(resultado["id"])
        
        if os.path.exists(file_path):
            os.remove(file_path)
            
        return jsonify(resultado)
        
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/search-lyrics", methods=["POST"])
def search_lyrics_endpoint():
    if "audio" not in request.files:
        return jsonify({"status": "error", "message": "No se proporciono archivo de audio"}), 400

    audio_file = request.files["audio"]
    if audio_file.filename == "":
        return jsonify({"status": "error", "message": "Archivo vacio"}), 400

    import uuid
    filename = f"{uuid.uuid4()}.wav"
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(file_path)

    try:
        transcribed = transcribe_audio(file_path)
        if not transcribed or len(transcribed.strip()) < 2:
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({"status": "success", "query": "", "results": []})

        results = search_lyrics(transcribed, db)

        for r in results:
            r["thumbnail_url"] = "/api/thumbnail/" + str(r["id"]) if r.get("thumbnail") else None

        if os.path.exists(file_path):
            os.remove(file_path)

        return jsonify({
            "status": "success",
            "query": transcribed,
            "results": results
        })

    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/history", methods=["GET"])
def get_history():
    with db.cursor() as cursor:
        cursor.execute("""
            SELECT h.id, s.id, s.title, s.artist, s.thumbnail, h.scanned_at 
            FROM scan_history h
            JOIN songs s ON h.song_id = s.id
            ORDER BY h.id DESC 
            LIMIT 15
        """)
        rows = cursor.fetchall()
        
        history_list = [
            {"id": row[0], "song_id": row[1], "title": row[2], "artist": row[3], "thumbnail": row[4], "scanned_at": row[5]}
            for row in rows
        ]
        return jsonify({"status": "success", "history": history_list})

@app.route("/api/playlist", methods=["POST"])
def add_to_playlist():
    data = request.json
    song_id = data.get("song_id")
    if not song_id:
        return jsonify({"status": "error", "message": "No song_id provided"}), 400

    with db.cursor() as cursor:
        cursor.execute("SELECT id FROM songs WHERE id = ?", (song_id,))
        if not cursor.fetchone():
            return jsonify({"status": "error", "message": "Cancion no encontrada"}), 404

    success = db.add_to_playlist(song_id)
    if success:
        return jsonify({"status": "success", "message": "Añadida a la playlist"})
    else:
        return jsonify({"status": "info", "message": "Ya estaba en la playlist"})

@app.route("/api/playlist", methods=["GET"])
def get_playlist():
    playlist = db.get_playlist()
    return jsonify({"status": "success", "playlist": playlist})

@app.route("/api/playlist/<int:playlist_id>", methods=["DELETE"])
def delete_from_playlist(playlist_id):
    with db.cursor() as cursor:
        cursor.execute("DELETE FROM playlist WHERE id = ?", (playlist_id,))
        if cursor.rowcount > 0:
            return jsonify({"status": "success", "message": "Eliminada de la playlist"})
        return jsonify({"status": "error", "message": "No encontrada"}), 404

@app.route("/api/history/<int:scan_id>", methods=["DELETE"])
def delete_from_history(scan_id):
    with db.cursor() as cursor:
        cursor.execute("DELETE FROM scan_history WHERE id = ?", (scan_id,))
        if cursor.rowcount > 0:
            return jsonify({"status": "success", "message": "Eliminada del historial"})
        return jsonify({"status": "error", "message": "No encontrada"}), 404

@app.route("/api/health", methods=["GET"])
def health_check():
    with db.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM songs")
        song_count = cursor.fetchone()[0]
    return jsonify({"status": "ok", "songs": song_count})

@app.route("/api/thumbnail/<int:song_id>", methods=["GET"])
def get_thumbnail(song_id):
    with db.cursor() as cursor:
        cursor.execute("SELECT thumbnail FROM songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
    if not row or not row[0]:
        return jsonify({"status": "error", "message": "Sin miniatura"}), 404
    filename = row[0]
    filepath = os.path.join(thumbnails_dir, filename)
    if not os.path.exists(filepath):
        return jsonify({"status": "error", "message": "Archivo no encontrado"}), 404
    return send_from_directory(thumbnails_dir, filename)

@app.route("/api/stats", methods=["GET"])
def get_stats():
    stats = db.get_stats()
    return jsonify({"status": "success", "stats": stats})

@app.route("/api/song/<int:song_id>", methods=["GET"])
def get_song(song_id):
    with db.cursor() as cur:
        cur.execute("SELECT id, title, artist, lyrics, thumbnail FROM songs WHERE id = ?", (song_id,))
        row = cur.fetchone()
    if not row:
        return jsonify({"status": "error", "message": "Cancion no encontrada"}), 404
    import json
    lyrics = None
    if row[3]:
        try:
            parsed = json.loads(row[3])
            if isinstance(parsed, list):
                lyrics = parsed
        except (json.JSONDecodeError, ValueError):
            lyrics = None
    return jsonify({
        "status": "success",
        "song": {
            "id": row[0],
            "title": row[1],
            "artist": row[2],
            "lyrics": lyrics,
            "thumbnail": row[4]
        }
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)