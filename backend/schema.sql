CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    lyrics TEXT,
    thumbnail TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS fingerprints (
    hash TEXT NOT NULL,
    song_id INTEGER NOT NULL,
    offset INTEGER NOT NULL,
    FOREIGN KEY (song_id) REFERENCES songs (id)
);

CREATE INDEX IF NOT EXISTS idx_hash ON fingerprints (hash);

CREATE INDEX IF NOT EXISTS idx_fingerprints_composite ON fingerprints (hash, song_id, offset);

CREATE TABLE IF NOT EXISTS playlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (song_id) REFERENCES songs (id)
);

CREATE TABLE IF NOT EXISTS scan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (song_id) REFERENCES songs (id)
);
