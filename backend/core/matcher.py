class SongMatcher:
    def __init__(self, db_manager):
        self.db = db_manager

    def identify_audio(self, sample_hashes):
        raw_matches = self.db.find_matches(sample_hashes)
        
        best_song_id = None
        highest_vote_count = 0
        best_time_difference = 0
        
        for song_id, offsets in raw_matches.items():
            for time_difference, count in offsets.items():
                if count > highest_vote_count:
                    highest_vote_count = count
                    best_song_id = song_id
                    best_time_difference = time_difference
                    
        if best_song_id and highest_vote_count > 3:
            with self.db.cursor() as cursor:
                cursor.execute(
                    "SELECT id, title, artist, lyrics, thumbnail FROM songs WHERE id = ?", 
                    (best_song_id,)
                )
                result = cursor.fetchone()
                if result:
                    return {
                        "status": "success",
                        "id": result[0],
                        "title": result[1],
                        "artist": result[2],
                        "lyrics": result[3],
                        "thumbnail": result[4],
                        "confidence": highest_vote_count,
                        "best_time_difference": best_time_difference
                    }
                    
        return {"status": "not_found"}