import os, sys, argparse, json, re, tempfile, shutil, urllib.request, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core.audio_processor import AudioProcessor
from core.database_manager import DatabaseManager

def download_audio(url, output_dir):
    try:
        import yt_dlp
    except ImportError:
        print("Error: yt-dlp no instalado. Ejecuta: pip install yt-dlp")
        sys.exit(1)
    
    output_template = os.path.join(output_dir, "%(title)s.%(ext)s")
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_template,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
        }],
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        title = info.get('title', 'Unknown')
        artist = info.get('artist') or info.get('uploader') or 'Unknown'
        thumbnail = info.get('thumbnail')
        ext = 'wav'
        filename = f"{title}.{ext}"
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
        filepath = os.path.join(output_dir, sanitized)
        if not os.path.exists(filepath):
            for f in os.listdir(output_dir):
                if f.startswith(title[:30].replace('/', '_')) and f.endswith('.wav'):
                    filepath = os.path.join(output_dir, f)
                    break
        if not os.path.exists(filepath):
            filepath = os.path.join(output_dir, sorted([f for f in os.listdir(output_dir) if f.endswith('.wav')])[-1])
        return filepath, title, artist, thumbnail

def download_thumbnail(url, thumbnails_dir):
    if not url:
        return None
    try:
        ext = url.split('.')[-1].split('?')[0][:4] if '.' in url else 'jpg'
        if ext not in ('jpg', 'jpeg', 'png', 'webp'):
            ext = 'jpg'
        name = urllib.parse.quote_plus(url)[:40] + '.' + ext
        path = os.path.join(thumbnails_dir, name)
        if not os.path.exists(path):
            urllib.request.urlretrieve(url, path)
        return name
    except:
        return None

def parse_lrc_to_json(lrc_text):
    lines = lrc_text.strip().split('\n')
    result = []
    for line in lines:
        m = re.match(r'\[(\d+):(\d+\.\d+)\](.*)', line.strip())
        if m:
            minutes, seconds, text = int(m.group(1)), float(m.group(2)), m.group(3).strip()
            if text:
                result.append({"time": minutes * 60 + seconds, "text": text})
    return json.dumps(result, ensure_ascii=False) if result else None

def fetch_lyrics(title, artist):
    params = urllib.parse.urlencode({"artist_name": artist, "track_name": title})
    url = f"https://lrclib.net/api/get?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ShazamMini/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if data.get("syncedLyrics"):
                return parse_lrc_to_json(data["syncedLyrics"])
            if data.get("plainLyrics"):
                return json.dumps(data["plainLyrics"], ensure_ascii=False)
    except:
        pass
    return None

def register_song(filepath, title, artist, thumbnail_url, processor, db, thumbnails_dir):
    thumb_file = download_thumbnail(thumbnail_url, thumbnails_dir) if thumbnail_url else None
    peaks = processor.get_peaks(filepath)
    hashes = processor.generate_hashes(peaks)
    if not hashes:
        print(f"  [!] No se pudieron generar hashes para: {title}")
        return None
    lyrics = fetch_lyrics(title, artist)
    if lyrics:
        print(f"  [+] Letras descargadas")
    else:
        print(f"  [-] Sin letras disponibles")
    song_id = db.add_song(title, artist, hashes, lyrics=lyrics, thumbnail=thumb_file)
    return song_id

def process_url(url, processor, db, thumbnails_dir, temp_dir):
    print(f"\n  Descargando: {url}")
    try:
        filepath, title, artist, thumbnail = download_audio(url, temp_dir)
        print(f"  Title: {title}")
        print(f"  Artist: {artist}")
        sid = register_song(filepath, title, artist, thumbnail, processor, db, thumbnails_dir)
        if sid:
            print(f"  [+] Registrada con ID {sid}")
        else:
            print(f"  [-] Fallo al registrar")
    except Exception as e:
        print(f"  [!] Error: {e}")

def search_and_register(query, processor, db, thumbnails_dir, temp_dir):
    try:
        import yt_dlp
    except ImportError:
        print("Error: yt-dlp no instalado")
        sys.exit(1)
    
    print(f"\n  Buscando: {query}")
    ydl_opts = {'quiet': True, 'no_warnings': True, 'extract_flat': True, 'force_generic_extractor': False}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            results = ydl.extract_info(f"ytsearch5:{query}", download=False)
            entries = results.get('entries', [])
            if not entries:
                print("  [!] Sin resultados")
                return
            for i, entry in enumerate(entries, 1):
                print(f"  {i}. {entry.get('title', 'N/A')} - {entry.get('uploader', 'N/A')}")
            print()
            choice = input("  Numero a registrar (o 0 para cancelar): ").strip()
            if not choice.isdigit() or int(choice) < 1 or int(choice) > len(entries):
                print("  Cancelado")
                return
            selected = entries[int(choice)-1]
            process_url(selected['webpage_url'], processor, db, thumbnails_dir, temp_dir)
        except Exception as e:
            print(f"  [!] Error en busqueda: {e}")

def main():
    parser = argparse.ArgumentParser(description="Auto-registrar canciones desde YouTube")
    parser.add_argument("inputs", nargs="*", help="URLs o terminos de busqueda")
    parser.add_argument("--file", "-f", help="Archivo con URLs/terminos (uno por linea)")
    parser.add_argument("--playlist", "-p", help="URL de playlist de YouTube")
    args = parser.parse_args()
    
    db = DatabaseManager()
    processor = AudioProcessor()
    base_dir = os.path.dirname(os.path.abspath(__file__))
    thumbnails_dir = os.path.join(os.path.dirname(base_dir), "thumbnails")
    os.makedirs(thumbnails_dir, exist_ok=True)
    
    temp_dir = tempfile.mkdtemp(prefix="shazam_")
    try:
        if args.playlist:
            try:
                import yt_dlp
            except ImportError:
                print("Error: yt-dlp no instalado")
                sys.exit(1)
            ydl_opts = {'quiet': True, 'no_warnings': True, 'extract_flat': True, 'force_generic_extractor': False}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(args.playlist, download=False)
                entries = info.get('entries', [])
                print(f"\nPlaylist: {info.get('title', 'N/A')} ({len(entries)} videos)")
                for entry in entries:
                    url = entry.get('webpage_url') or f"https://youtube.com/watch?v={entry.get('id')}"
                    process_url(url, processor, db, thumbnails_dir, temp_dir)
        
        if args.file:
            with open(args.file, 'r', encoding='utf-8') as f:
                lines = [l.strip() for l in f if l.strip()]
            for line in lines:
                if line.startswith('http'):
                    process_url(line, processor, db, thumbnails_dir, temp_dir)
                else:
                    search_and_register(line, processor, db, thumbnails_dir, temp_dir)
        
        for inp in args.inputs:
            if inp.startswith('http'):
                process_url(inp, processor, db, thumbnails_dir, temp_dir)
            else:
                search_and_register(inp, processor, db, thumbnails_dir, temp_dir)
        
        if not any([args.playlist, args.file, args.inputs]):
            parser.print_help()
            print("\nEjemplos:")
            print("  python auto_register.py https://youtu.be/dQw4w9WgXcQ")
            print('  python auto_register.py "never gonna give you up"')
            print("  python auto_register.py --file urls.txt")
            print("  python auto_register.py --playlist https://youtube.com/playlist?list=...")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
    
    with db.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM songs")
        print(f"\nTotal canciones en BD: {cur.fetchone()[0]}")

if __name__ == "__main__":
    main()
