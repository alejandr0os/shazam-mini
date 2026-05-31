import sqlite3
import os
from contextlib import contextmanager

class DatabaseManager:
    def __init__(self, db_name="database.db"):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.db_path = os.path.join(base_dir, db_name)
        self.thumbnails_dir = os.path.join(base_dir, "thumbnails")
        os.makedirs(self.thumbnails_dir, exist_ok=True)
        self.setup_tables()

    def get_connection(self):
        return sqlite3.connect(self.db_path)

    @contextmanager
    def cursor(self):
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def setup_tables(self):
        with self.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS songs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    artist TEXT NOT NULL,
                    lyrics TEXT,
                    thumbnail TEXT DEFAULT NULL
                )
            """)
            try:
                cursor.execute("ALTER TABLE songs ADD COLUMN thumbnail TEXT DEFAULT NULL")
            except Exception:
                pass
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS fingerprints (
                    hash TEXT NOT NULL,
                    song_id INTEGER NOT NULL,
                    offset INTEGER NOT NULL,
                    FOREIGN KEY (song_id) REFERENCES songs (id)
                )
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_hash 
                ON fingerprints (hash)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_fingerprints_composite 
                ON fingerprints (hash, song_id, offset)
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS playlist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    song_id INTEGER NOT NULL,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (song_id) REFERENCES songs (id)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS scan_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    song_id INTEGER NOT NULL,
                    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (song_id) REFERENCES songs (id)
                )
            """)

    def add_song(self, title, artist, hashes, lyrics=None, thumbnail=None):
        with self.cursor() as cursor:
            cursor.execute(
                "INSERT INTO songs (title, artist, lyrics, thumbnail) VALUES (?, ?, ?, ?)", 
                (title, artist, lyrics, thumbnail)
            )
            song_id = cursor.lastrowid
            
            fingerprint_data = [
                (h_val, song_id, offset) 
                for h_val, offset in hashes
            ]
            
            cursor.executemany(
                "INSERT INTO fingerprints (hash, song_id, offset) VALUES (?, ?, ?)",
                fingerprint_data
            )
            return song_id

    def find_matches(self, hashes):
        if not hashes:
            return {}
            
        with self.cursor() as cursor:
            results = {}
            
            offset_map = {}
            for hash_value, input_offset in hashes:
                if hash_value not in offset_map:
                    offset_map[hash_value] = []
                offset_map[hash_value].append(input_offset)
                
            hash_values = list(offset_map.keys())
            chunk_size = 900
            
            for i in range(0, len(hash_values), chunk_size):
                chunk = hash_values[i:i+chunk_size]
                placeholders = ",".join("?" for _ in chunk)
                query = f"SELECT hash, song_id, offset FROM fingerprints WHERE hash IN ({placeholders})"
                cursor.execute(query, chunk)
                matches = cursor.fetchall()
                
                for hash_val, song_id, db_offset in matches:
                    input_offsets = offset_map.get(hash_val, [])
                    for input_offset in input_offsets:
                        time_difference = db_offset - input_offset
                        if song_id not in results:
                            results[song_id] = {}
                        if time_difference not in results[song_id]:
                            results[song_id][time_difference] = 0
                        results[song_id][time_difference] += 1
            
            return results

    def log_scan(self, song_id):
        with self.cursor() as cursor:
            cursor.execute("INSERT INTO scan_history (song_id) VALUES (?)", (song_id,))

    def add_to_playlist(self, song_id):
        with self.cursor() as cursor:
            cursor.execute("SELECT id FROM playlist WHERE song_id = ?", (song_id,))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO playlist (song_id) VALUES (?)", (song_id,))
                return True
            return False

    def get_playlist(self):
        with self.cursor() as cursor:
            cursor.execute("""
                SELECT p.id, s.id, s.title, s.artist, s.thumbnail
                FROM playlist p
                JOIN songs s ON p.song_id = s.id
                ORDER BY p.id DESC
            """)
            return [{"playlist_id": r[0], "song_id": r[1], "title": r[2], "artist": r[3], "thumbnail": r[4]} for r in cursor.fetchall()]

    def get_stats(self):
        with self.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM songs")
            total_songs = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM scan_history")
            total_scans = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM scan_history WHERE scanned_at >= datetime('now', '-1 day')")
            scans_today = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM playlist")
            playlist_count = cursor.fetchone()[0]

            cursor.execute("""
                SELECT s.id, s.title, s.artist, s.thumbnail, COUNT(h.id) as scan_count
                FROM scan_history h
                JOIN songs s ON h.song_id = s.id
                GROUP BY h.song_id
                ORDER BY scan_count DESC
                LIMIT 5
            """)
            top_songs = [{"song_id": r[0], "title": r[1], "artist": r[2], "thumbnail": r[3], "scan_count": r[4]} for r in cursor.fetchall()]

            cursor.execute("""
                SELECT s.artist, COUNT(h.id) as scan_count
                FROM scan_history h
                JOIN songs s ON h.song_id = s.id
                GROUP BY s.artist
                ORDER BY scan_count DESC
                LIMIT 5
            """)
            top_artists = [{"artist": r[0], "scan_count": r[1]} for r in cursor.fetchall()]

            return {
                "total_songs": total_songs,
                "total_scans": total_scans,
                "scans_today": scans_today,
                "playlist_count": playlist_count,
                "top_songs": top_songs,
                "top_artists": top_artists
            }