# Shazam Mini

Clon funcional de Shazam para reconocimiento de canciones mediante huellas digitales de audio (audio fingerprinting). Permite identificar música desde el micrófono en tiempo real, buscar canciones cantando/ tarareando, y gestionar un historial y playlist personal.

---

## Características

- **Reconocimiento por fingerprinting:** Identifica canciones a partir de una grabación corta usando detección de picos espectrales y hash combinatorio
- **Búsqueda por voz (STT):** Tararea o canta — el sistema transcribe con Whisper (faster-whisper) y busca coincidencias difusas en las letras almacenadas
- **Historial:** Últimas 15 canciones identificadas
- **Playlist personal:** Guarda tus canciones favoritas
- **Estadísticas:** Canciones más escuchadas, artistas top, escaneos por día
- **App Android:** Empaquetada con Capacitor, genera APK nativo
- **Interfaz obscura:** Tema dark con galaxia animada en canvas, texturas y capas de brillo

---

## Arquitectura del Proyecto

```
shazam-mini/
├── backend/                        # API REST (Python/Flask)
│   ├── app.py                      # Entry point del servidor, rutas API
│   ├── auto_register.py            # CLI para registrar canciones desde YouTube
│   ├── core/
│   │   ├── audio_processor.py      # Algoritmo de fingerprinting (picos + hashes)
│   │   ├── database_manager.py     # Capa de acceso a SQLite
│   │   ├── matcher.py              # Comparador de fingerprints (votación)
│   │   └── lyrics_search.py        # STT con Whisper + búsqueda difusa de letras
│   ├── database.db                 # Base de datos SQLite
│   └── temp/                       # Archivos de audio temporales (autolimpieza)
├── frontend/
│   ├── www/                        # Aplicación web (vanilla HTML/CSS/JS)
│   │   ├── index.html              # Página principal (escaneo)
│   │   ├── history.html            # Historial
│   │   ├── playlist.html           # Playlist
│   │   ├── stats.html              # Estadísticas
│   │   ├── css/styles.css          # Único archivo de estilos
│   │   └── js/                     # JavaScript plano (sin framework)
│   ├── android/                    # Proyecto nativo Android (Capacitor)
│   ├── capacitor.config.json       # Configuración de Capacitor
│   └── package.json                # Dependencias de Capacitor
├── thumbnails/                     # Imágenes de portada de álbumes
└── .gitignore
```

---

## Algoritmo de Fingerprinting

El sistema implementa un algoritmo inspirado en el paper de Shazam (Wang, 2003). El proceso consta de 3 etapas:

### 1. Extracción de Picos (audio_processor.py)

```
Audio → STFT (Short-Time Fourier Transform) → Espectrograma → Filtro de máximos locales
```

- **STFT:** Se aplica la Transformada de Fourier de tiempo corto con `n_fft=2048` y `hop_length=512` usando `librosa`. Esto convierte la señal de audio en una representación tiempo-frecuencia (espectrograma).
- **Normalización:** La señal se normaliza y el espectrograma se convierte a decibelios.
- **Detección de picos:** Se aplica un filtro de máximos locales con ventana de vecindad 20×20 (`scipy.ndimage.maximum_filter`). Un pico se define como un punto (frecuencia, tiempo) cuyo valor es el máximo dentro de su vecindario y supera el umbral de -65 dB.
- **Erosión binaria:** Se aplica `binary_erosion` para eliminar ruido de fondo y retener solo las regiones más energéticas.

### 2. Generación de Hashes (audio_processor.py)

```
Picos → Combinación de pares → Hash (f1|f2|Δt)
```

- Cada pico se combina con hasta 15 picos siguientes en el tiempo (`fan_value=15`), formando pares.
- Cada par genera un hash en formato `"{frecuencia1}|{frecuencia2}|{delta_tiempo}"`.
- Solo se aceptan pares con `delta_tiempo ≤ 200` unidades temporales.
- Esto produce una constelación de hashes que es robusta frente a ruido y distorsión.

### 3. Matching por Votación (matcher.py + database_manager.py)

```
Hashes de muestra → Consulta SQL → Votación por offset → Canción con más coincidencias
```

- **Consulta:** Todos los hashes de la muestra se buscan en la base de datos mediante `SELECT hash, song_id, offset WHERE hash IN (...)`.
- **Votación:** Para cada hash encontrado, se calcula `time_difference = db_offset - input_offset`. Cada coincidencia es un "voto" para el par `(song_id, time_difference)`.
- **Decisión:** Se selecciona la canción con mayor número de votos que compartan el mismo `time_difference`. Si supera el umbral de 3 votos, se considera un match exitoso.
- La diferencia de tiempo común entre los hashes de la muestra y los de la base de datos revela el offset temporal dentro de la canción original.

### Búsqueda por Voz (lyrics_search.py)

```
Audio → faster-whisper (modelo base, español) → Transcripción → Tokenización → Coincidencia difusa
```

1. **Transcripción:** Usa `faster-whisper` con modelo `base` en CPU (int8) para transcribir el audio a texto en español.
2. **Tokenización:** El texto transcrito y las letras almacenadas se normalizan (minúsculas, sin puntuación) y se convierten en conjuntos de tokens.
3. **Coincidencia:** Se calcula un puntaje combinado:
   - **Solapamiento de tokens (40%):** Intersección de tokens entre consulta y letra.
   - **Similaridad de cadenas (60%):** `SequenceMatcher` de Python aplicado a n-gramas de hasta 8 palabras.
4. Si el puntaje combinado supera 0.15, la canción se incluye en resultados.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Backend** | Python 3.14+, Flask, flask-cors |
| **Fingerprinting** | librosa, numpy, scipy |
| **STT** | faster-whisper (modelo base, CPU) |
| **Base de datos** | SQLite (sin servidor) |
| **Frontend web** | HTML5, CSS3, JavaScript vanilla |
| **App Android** | Capacitor 8 (Android Studio) |
| **Descarga de audio** | yt-dlp + FFmpeg (via static_ffmpeg) |

---

## Requisitos

- Python 3.14+
- FFmpeg (se instala automáticamente con `static_ffmpeg`)
- Node.js 18+ (solo para construir APK)
- Android Studio (solo para construir APK)

---

## Instalación y Ejecución

### Backend

```bash
# Clonar el repositorio
git clone https://github.com/alejandr0os/shazam-mini.git
cd shazam-mini

# Crear y activar entorno virtual
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

# Instalar dependencias
pip install -r backend/requirements.txt

# Iniciar servidor
cd backend
python app.py
```

El servidor corre en `http://0.0.0.0:5000`.

> La base de datos SQLite se crea automáticamente al iniciar el servidor (vacía). Para poblarla con canciones, usa `auto_register.py`. El archivo `schema.sql` documenta la estructura de tablas.

### Frontend web

Abre `http://localhost:5000` en el navegador. El servidor sirve los archivos estáticos automáticamente.

### App Android

```bash
# Requiere Android Studio y JDK (JBR)
cd frontend/android
./build_apk.bat      # Build rápido
# o
./rebuild.bat         # Clean + assembleDebug

# APK generado en:
# frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

### Registrar canciones en la base de datos

```bash
cd backend
python auto_register.py "https://youtu.be/..."           # URL directa
python auto_register.py "nombre de canción"               # Búsqueda interactiva
python auto_register.py --playlist "https://..."          # Playlist completa
python auto_register.py --file urls.txt                   # Batch desde archivo
```

---

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/identify` | Identificar canción desde archivo de audio |
| POST | `/api/search-lyrics` | Buscar por voz (STT + fuzzy match) |
| GET | `/api/history` | Últimas 15 canciones escaneadas |
| DELETE | `/api/history/<id>` | Eliminar entrada del historial |
| GET | `/api/playlist` | Obtener playlist guardada |
| POST | `/api/playlist` | Añadir canción a playlist |
| DELETE | `/api/playlist/<id>` | Eliminar canción de playlist |
| GET | `/api/song/<id>` | Detalles + letra de canción |
| GET | `/api/thumbnail/<id>` | Imagen de portada |
| GET | `/api/stats` | Estadísticas de uso |
| GET | `/api/health` | Health check + conteo de canciones |

---

## Estructura de la Base de Datos

```sql
songs (id, title, artist, lyrics, thumbnail)
fingerprints (hash, song_id, offset)
playlist (id, song_id, added_at)
scan_history (id, song_id, scanned_at)
```

- **songs:** Catálogo de canciones registradas. `lyrics` almacena JSON plano o arreglo de `{"time": segundos, "text": "..."}` para letras sincronizadas.
- **fingerprints:** Tabla principal con índices compuestos para búsqueda rápida de hashes.
- **playlist:** Relación muchos-a-muchos entre canciones y la playlist del usuario.
- **scan_history:** Registro de cada identificación exitosa con timestamp.

---

## Licencia

MIT
