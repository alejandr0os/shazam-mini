let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let activeStream = null;
let audioCtx = null;
let analyser = null;
let source = null;
let animationFrameId = null;
let vizCanvas = null;
let vizCtx = null;
let vizAnimId = null;

const recordButton = document.getElementById("record-button");
const recordContainer = document.getElementById("record-container");
const statusText = document.getElementById("status-text");
const timerDisplay = document.getElementById("timer-display");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultArtist = document.getElementById("result-artist");
const resultConfidence = document.getElementById("result-confidence");
const lyricsContainer = document.getElementById("lyrics-container");
const resultLyrics = document.getElementById("result-lyrics");
const addPlaylistBtn = document.getElementById("add-playlist-btn");
const shareButton = document.getElementById("share-button");
const retryButton = document.getElementById("retry-button");
const progressRingFill = document.getElementById("progress-ring-fill");
const resultThumb = document.getElementById("result-thumb");
const RING_CIRCUMFERENCE = 2 * Math.PI * 64;

let currentSongId = null;
let currentSongTitle = "";
let currentSongArtist = "";
let recordingStartTime = 0;
let timerInterval = null;
const RECORD_DURATION = 7;
const SING_DURATION = 15;

let searchMode = false;
let silenceStartTime = 0;
const SILENCE_THRESHOLD = 12;
const SILENCE_DURATION = 2000;

const modeScanBtn = document.getElementById("mode-scan-btn");
const modeSingBtn = document.getElementById("mode-sing-btn");
const searchResults = document.getElementById("search-results");
const searchResultsList = document.getElementById("search-results-list");

if (modeScanBtn && modeSingBtn) {
    modeScanBtn.addEventListener("click", function() {
        searchMode = false;
        modeScanBtn.classList.add("mode-btn-active");
        modeSingBtn.classList.remove("mode-btn-active");
        if (statusText) statusText.textContent = "Presiona el botón para descubrir música";
        if (searchResults) searchResults.classList.add("hidden");
    });
    modeSingBtn.addEventListener("click", function() {
        searchMode = true;
        modeSingBtn.classList.add("mode-btn-active");
        modeScanBtn.classList.remove("mode-btn-active");
        if (statusText) statusText.textContent = "Canta una parte de la canción";
        if (resultCard) resultCard.classList.add("hidden", "result-card-hidden");
    });
}

// ─── TIMER + PROGRESS RING ───
function startTimer() {
    var maxDuration = searchMode ? SING_DURATION : RECORD_DURATION;
    recordingStartTime = Date.now();
    timerDisplay.textContent = "0:" + maxDuration;
    timerDisplay.classList.remove("hidden");
    progressRingFill.style.strokeDashoffset = RING_CIRCUMFERENCE;
    updateTimer();
    timerInterval = setInterval(updateTimer, 80);
}

function updateTimer() {
    var maxDuration = searchMode ? SING_DURATION : RECORD_DURATION;
    var elapsed = (Date.now() - recordingStartTime) / 1000;
    var remaining = Math.max(0, maxDuration - elapsed);
    var secs = Math.floor(remaining);
    var tenths = Math.floor((remaining - secs) * 10);
    timerDisplay.textContent = "0:" + secs + "." + tenths;

    var progress = Math.min(1, elapsed / maxDuration);
    progressRingFill.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

    if (remaining <= 1.5) {
        timerDisplay.style.color = "var(--accent-dim)";
        progressRingFill.style.stroke = "var(--accent-dim)";
    }
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    if (timerDisplay) timerDisplay.classList.add("hidden");
    if (timerDisplay) timerDisplay.style.color = "var(--accent-light)";
    if (progressRingFill) {
        progressRingFill.style.strokeDashoffset = RING_CIRCUMFERENCE;
        progressRingFill.style.stroke = "var(--accent)";
    }
}

// ─── CONFETTI ───
function launchConfetti() {
    var container = document.getElementById("confetti-container");
    if (!container) return;
    var colors = ["#6c9cff", "#a4c4ff", "#4a6eb5", "#8892a4", "#e4e8f0", "#ffffff", "#b48cff", "#6cc8dc", "#ff9c6c"];
    var shapes = ["circle", "rect", "note"];
    for (var i = 0; i < 65; i++) {
        var piece = document.createElement("div");
        piece.className = "confetti-piece";
        var shape = shapes[Math.floor(Math.random() * shapes.length)];
        piece.style.left = (15 + Math.random() * 70) + "%";
        piece.style.top = (5 + Math.random() * 25) + "%";
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDuration = (0.9 + Math.random() * 1.2) + "s";
        piece.style.animationDelay = (Math.random() * 0.4) + "s";

        if (shape === "circle") {
            piece.style.width = (4 + Math.random() * 5) + "px";
            piece.style.height = piece.style.width;
            piece.style.borderRadius = "50%";
        } else if (shape === "note") {
            piece.style.background = "none";
            piece.style.color = colors[Math.floor(Math.random() * colors.length)];
            piece.style.fontSize = (0.8 + Math.random() * 0.6) + "rem";
            piece.style.width = "auto";
            piece.style.height = "auto";
            piece.textContent = ["\u266A", "\u266B", "\u2669"][Math.floor(Math.random() * 3)];
        } else {
            piece.style.width = (3 + Math.random() * 4) + "px";
            piece.style.height = (6 + Math.random() * 8) + "px";
            piece.style.borderRadius = "1px";
        }

        container.appendChild(piece);
        (function(p) {
            setTimeout(function() { if (p.parentNode) p.remove(); }, 2500);
        })(piece);
    }
}

// ─── VISUALIZADOR DE AUDIO REAL ───
function startAudioVisualization(stream) {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const eqBars = document.querySelectorAll(".eq-bar");

        function draw() {
            if (!isRecording) return;
            animationFrameId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            eqBars.forEach((bar, index) => {
                const val = dataArray[index];
                const percent = val / 255;
                const height = 4 + percent * 26;
                bar.style.height = `${height}px`;
                bar.style.background = `rgba(108, 156, 255, ${0.45 + percent * 0.55})`;
            });

            if (searchMode) {
                var sum = 0;
                for (var i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                var avg = sum / bufferLength;

                if (avg < SILENCE_THRESHOLD) {
                    if (silenceStartTime === 0) {
                        silenceStartTime = Date.now();
                    } else if (Date.now() - silenceStartTime > SILENCE_DURATION) {
                        var elapsed = (Date.now() - recordingStartTime) / 1000;
                        if (elapsed > 2) {
                            isRecording = false;
                            setRecordingState(false);
                            if (mediaRecorder && mediaRecorder.state === "recording") {
                                mediaRecorder.stop();
                            }
                        }
                    }
                } else {
                    silenceStartTime = 0;
                }
            }
        }
        draw();
    } catch (e) {
        console.error("Error al iniciar visualización de audio:", e);
    }
}

function stopAudioVisualization() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (vizAnimId) {
        cancelAnimationFrame(vizAnimId);
        vizAnimId = null;
    }
    if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
    }
    if (vizCanvas) {
        vizCanvas.style.opacity = "0";
        setTimeout(function() {
            if (vizCanvas && vizCanvas.parentNode) vizCanvas.remove();
            vizCanvas = null;
            vizCtx = null;
        }, 500);
    }
    const eqBars = document.querySelectorAll(".eq-bar");
    eqBars.forEach(bar => {
        bar.style.height = "";
        bar.style.background = "";
    });
}

function startCircularVisualizer(analyserNode) {
    var container = document.getElementById("record-container");
    if (!container) return;

    vizCanvas = document.getElementById("visualizer-canvas");
    if (!vizCanvas) {
        vizCanvas = document.createElement("canvas");
        vizCanvas.id = "visualizer-canvas";
        vizCanvas.style.cssText = "position:absolute;inset:0;width:180px;height:180px;z-index:3;pointer-events:none;opacity:0;transition:opacity 0.5s ease;";
        container.insertBefore(vizCanvas, container.querySelector(".btn-record"));
    }

    var dpr = window.devicePixelRatio || 1;
    vizCanvas.width = 180 * dpr;
    vizCanvas.height = 180 * dpr;
    vizCtx = vizCanvas.getContext("2d");
    vizCtx.scale(dpr, dpr);

    vizCanvas.style.opacity = "1";

    var bufferLength = analyserNode.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);
    var cx = 90, cy = 90, baseRadius = 62;
    var barsToDraw = 56;
    var vizTime = 0;

    function drawViz() {
        if (!isRecording) return;
        vizAnimId = requestAnimationFrame(drawViz);
        vizTime++;

        analyserNode.getByteFrequencyData(dataArray);
        vizCtx.clearRect(0, 0, 180, 180);

        var glowPulse = 0.5 + 0.5 * Math.sin(vizTime * 0.03);
        vizCtx.beginPath();
        vizCtx.arc(cx, cy, baseRadius + 8, 0, Math.PI * 2);
        vizCtx.strokeStyle = "rgba(108, 156, 255, " + (0.04 + glowPulse * 0.04) + ")";
        vizCtx.lineWidth = 12;
        vizCtx.stroke();

        for (var i = 0; i < barsToDraw; i++) {
            var angle = (i / barsToDraw) * Math.PI * 2 - Math.PI / 2;
            var dataIndex = Math.floor(i * bufferLength / barsToDraw);
            var value = dataArray[dataIndex] / 255;
            var barHeight = 2 + value * 28;

            var x1 = cx + Math.cos(angle) * baseRadius;
            var y1 = cy + Math.sin(angle) * baseRadius;
            var x2 = cx + Math.cos(angle) * (baseRadius + barHeight);
            var y2 = cy + Math.sin(angle) * (baseRadius + barHeight);

            var alpha = 0.25 + value * 0.75;
            var hue = 215 + value * 25;
            var lightness = 55 + value * 20;

            vizCtx.beginPath();
            vizCtx.moveTo(x1, y1);
            vizCtx.lineTo(x2, y2);
            vizCtx.strokeStyle = "hsla(" + hue + ", 75%, " + lightness + "%, " + alpha + ")";
            vizCtx.lineWidth = 2.2;
            vizCtx.lineCap = "round";
            vizCtx.stroke();

            if (value > 0.6) {
                vizCtx.beginPath();
                vizCtx.arc(x2, y2, 1.5 + value * 2, 0, Math.PI * 2);
                vizCtx.fillStyle = "hsla(" + hue + ", 80%, " + (lightness + 10) + "%, " + (alpha * 0.5) + ")";
                vizCtx.fill();
            }
        }

        vizCtx.beginPath();
        vizCtx.arc(cx, cy, baseRadius - 1, 0, Math.PI * 2);
        vizCtx.strokeStyle = "rgba(108, 156, 255, " + (0.08 + glowPulse * 0.06) + ")";
        vizCtx.lineWidth = 0.5;
        vizCtx.stroke();
    }

    drawViz();
}

function spawnMusicalNotes() {
    var notes = ["\u266A", "\u266B", "\u2669", "\u266C", "\u266A", "\u266B"];
    for (var i = 0; i < 14; i++) {
        (function(index) {
            setTimeout(function() {
                var note = document.createElement("div");
                note.className = "music-note";
                note.textContent = notes[index % notes.length];
                note.style.left = (15 + Math.random() * 70) + "%";
                note.style.bottom = (15 + Math.random() * 25) + "%";
                note.style.animationDuration = (2 + Math.random() * 1.5) + "s";
                note.style.animationDelay = (Math.random() * 0.2) + "s";
                note.style.fontSize = (1.2 + Math.random() * 1) + "rem";
                document.body.appendChild(note);
                setTimeout(function() { if (note.parentNode) note.remove(); }, 4000);
            }, index * 120);
        })(i);
    }
}

function stopAllTracks() {
    stopAudioVisualization();
    if (activeStream) {
        activeStream.getTracks().forEach(track => {
            track.stop();
        });
        activeStream = null;
    }
}

// ─── RECORDING ───
if (recordButton) {
    recordButton.addEventListener("click", async () => {
        if (isRecording) return;
        if (retryButton) retryButton.classList.remove("visible");
        if (searchResults) searchResults.classList.add("hidden");

        if (navigator.vibrate) {
            navigator.vibrate([60]);
        }

        try {
            activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(activeStream);
            audioChunks = [];
            silenceStartTime = 0;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                stopTimer();
                const rawBlob = new Blob(audioChunks);
                stopAllTracks();
                
                try {
                    if (statusText) statusText.textContent = "Analizando audio...";
                    const wavBlob = await convertToWav(rawBlob);
                    if (searchMode) {
                        await sendAudioToSearch(wavBlob);
                    } else {
                        await sendAudioToServer(wavBlob);
                    }
                } catch (err) {
                    console.error("Error al convertir audio:", err);
                    if (statusText) {
                        statusText.textContent = "Error al procesar el audio";
                        statusText.className = "status-label";
                    }
                    if (retryButton) retryButton.classList.add("visible");
                }
            };

            isRecording = true;
            setRecordingState(true);
            mediaRecorder.start();
            startTimer();
            startAudioVisualization(activeStream);
            if (analyser) startCircularVisualizer(analyser);

            var maxDuration = searchMode ? SING_DURATION : RECORD_DURATION;
            setTimeout(() => {
                if (isRecording) {
                    isRecording = false;
                    setRecordingState(false);
                    if (mediaRecorder && mediaRecorder.state === "recording") {
                        mediaRecorder.stop();
                    } else {
                        stopAllTracks();
                        stopTimer();
                    }
                }
            }, maxDuration * 1000);

        } catch (error) {
            isRecording = false;
            setRecordingState(false);
            stopAllTracks();
            stopTimer();

            if (statusText) {
                if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    statusText.innerHTML = "Permiso de micrófono denegado<br><span style='font-size:0.7rem;color:var(--accent-dim)'>Abre la app desde el APK o usa HTTPS</span>";
                } else {
                    statusText.textContent = "No se pudo acceder al micrófono";
                }
            }
            if (retryButton) retryButton.classList.add("visible");
            console.error(error);
        }
    });
}

function setRecordingState(recording) {
    if (recording) {
        if (statusText) {
            statusText.textContent = "Escuchando...";
            statusText.className = "status-label recording";
        }
        if (recordContainer) recordContainer.classList.add("is-recording");
        if (resultCard) {
            resultCard.classList.add("hidden", "result-card-hidden");
            resultCard.classList.remove("result-card-visible");
        }
        if (retryButton) retryButton.classList.remove("visible");
    } else {
        if (statusText) statusText.className = "status-label";
        if (recordContainer) recordContainer.classList.remove("is-recording");
    }
}

// ─── RETRY ───
if (retryButton) {
    retryButton.addEventListener("click", () => {
        if (recordButton) recordButton.click();
    });
}

// ─── SERVER ───
async function sendAudioToServer(blob) {
    const formData = new FormData();
    formData.append("audio", blob, "recording.wav");

    try {
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/api/identify`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();
        displayResult(data);

    } catch (error) {
        if (statusText) {
            statusText.className = "status-label";
            statusText.textContent = "Sin conexión con el servidor";
        }
        showToast("No se pudo conectar con el servidor. Revisa la configuración.", "error");
        if (retryButton) retryButton.classList.add("visible");
        console.error(error);
    }
}

async function sendAudioToSearch(blob) {
    var formData = new FormData();
    formData.append("audio", blob, "recording.wav");

    try {
        var baseUrl = getBaseUrl();
        if (statusText) {
            statusText.textContent = "Transcribiendo...";
            statusText.className = "status-label";
        }
        var response = await fetch(baseUrl + "/api/search-lyrics", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        var data = await response.json();
        displaySearchResults(data);

    } catch (error) {
        if (statusText) {
            statusText.className = "status-label";
            statusText.textContent = "Sin conexión con el servidor";
        }
        showToast("No se pudo conectar con el servidor. Revisa la configuración.", "error");
        if (retryButton) retryButton.classList.add("visible");
        console.error(error);
    }
}

function displaySearchResults(data) {
    if (!statusText) return;

    if (data.status !== "success") {
        statusText.className = "status-label";
        statusText.textContent = "Error en la búsqueda";
        if (retryButton) retryButton.classList.add("visible");
        return;
    }

    if (!data.results || data.results.length === 0) {
        statusText.className = "status-label";
        statusText.textContent = "No se encontraron coincidencias";
        if (searchResults) searchResults.classList.add("hidden");
        if (retryButton) retryButton.classList.add("visible");
        return;
    }

    statusText.className = "status-label matched";
    statusText.textContent = "Canciones encontradas";

    if (searchResults && searchResultsList) {
        searchResultsList.innerHTML = "";

        if (data.query) {
            var queryEl = document.createElement("p");
            queryEl.className = "search-query-text";
            queryEl.textContent = 'Escuché: "' + escapeHtml(data.query) + '"';
            searchResultsList.appendChild(queryEl);
        }

        data.results.forEach(function(result) {
            var item = document.createElement("div");
            item.className = "search-result-item";
            item.onclick = function() { showSongDetail(result.id); };

            var palette = [
                { bg: 'rgba(108,156,255,0.18)', fg: '#6c9cff' },
                { bg: 'rgba(168,120,255,0.18)', fg: '#a878ff' },
                { bg: 'rgba(107,168,122,0.18)', fg: '#6ba87a' },
                { bg: 'rgba(255,156,108,0.18)', fg: '#ff9c6c' },
                { bg: 'rgba(255,120,156,0.18)', fg: '#ff789c' },
                { bg: 'rgba(108,200,220,0.18)', fg: '#6cc8dc' },
                { bg: 'rgba(220,180,108,0.18)', fg: '#dcb46c' },
                { bg: 'rgba(180,140,255,0.18)', fg: '#b48cff' }
            ];
            var hash = 0;
            var artistName = result.artist || '';
            for (var ci = 0; ci < artistName.length; ci++) {
                hash = ((hash << 5) - hash) + artistName.charCodeAt(ci);
                hash = hash & hash;
            }
            var color = palette[Math.abs(hash) % palette.length];
            var letter = escapeHtml(artistName.charAt(0).toUpperCase());
            var thumbUrl = result.thumbnail_url ? (getBaseUrl() + result.thumbnail_url) : null;

            var thumbDiv = '<div class="search-result-thumb" style="background-color:' + color.bg + ';color:' + color.fg + ';">' + letter;
            if (thumbUrl) {
                thumbDiv += '<img src="' + escapeHtml(thumbUrl) + '" alt="" onerror="this.style.display=\'none\';">';
            }
            thumbDiv += '</div>';

            var scorePercent = Math.round(result.score * 100);

            item.innerHTML = thumbDiv +
                '<div class="search-result-info">' +
                    '<div class="search-result-title">' + escapeHtml(result.title) + '</div>' +
                    '<div class="search-result-artist">' + escapeHtml(result.artist) + '</div>' +
                '</div>' +
                '<div class="search-result-score">' + scorePercent + '%</div>';

            searchResultsList.appendChild(item);
        });

        searchResults.classList.remove("hidden");
    }

    setTimeout(function() {
        if (statusText && statusText.className === "status-label matched") {
            statusText.className = "status-label";
            statusText.textContent = "Canta una parte de la canción";
        }
    }, 5000);
}

// ─── RESULT ───
function displayResult(data) {
    if (!statusText) return;
    if (data.status === "success") {
        statusText.textContent = "¡Canción identificada!";
        statusText.className = "status-label matched";
        if (resultTitle) resultTitle.textContent = data.title || "";
        if (resultArtist) resultArtist.textContent = data.artist || "";
        if (resultConfidence) resultConfidence.textContent = "Coincidencia: " + (data.confidence || 0) + " puntos";
        currentSongId = data.id;
        currentSongTitle = data.title || "";
        currentSongArtist = data.artist || "";

        if (resultThumb && data.artist) {
            var thumbUrl = data.thumbnail_url ? (getBaseUrl() + data.thumbnail_url) : null;
            if (thumbUrl) {
                resultThumb.style.backgroundColor = 'rgba(108,156,255,0.18)';
                resultThumb.style.color = '#6c9cff';
                resultThumb.textContent = data.artist.charAt(0).toUpperCase();
                resultThumb.innerHTML = resultThumb.textContent + '<img src="' + thumbUrl + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.style.display=\'none\';">';
                resultThumb.style.display = 'flex';
            } else {
                var palette = [
                    { bg: 'rgba(108,156,255,0.18)', fg: '#6c9cff' },
                    { bg: 'rgba(168,120,255,0.18)', fg: '#a878ff' },
                    { bg: 'rgba(107,168,122,0.18)', fg: '#6ba87a' },
                    { bg: 'rgba(255,156,108,0.18)', fg: '#ff9c6c' },
                    { bg: 'rgba(255,120,156,0.18)', fg: '#ff789c' },
                    { bg: 'rgba(108,200,220,0.18)', fg: '#6cc8dc' },
                    { bg: 'rgba(220,180,108,0.18)', fg: '#dcb46c' },
                    { bg: 'rgba(180,140,255,0.18)', fg: '#b48cff' }
                ];
                var hash = 0;
                for (var ci = 0; ci < data.artist.length; ci++) {
                    hash = ((hash << 5) - hash) + data.artist.charCodeAt(ci);
                    hash = hash & hash;
                }
                var color = palette[Math.abs(hash) % palette.length];
                resultThumb.style.background = color.bg;
                resultThumb.style.color = color.fg;
                resultThumb.textContent = data.artist.charAt(0).toUpperCase();
                resultThumb.style.display = 'flex';
            }
        } else if (resultThumb) {
            resultThumb.style.display = 'none';
        }

        if (data.lyrics && data.offset_seconds !== undefined && lyricsContainer && resultLyrics) {
            const offset = data.offset_seconds;
            let bestLine = "\u266A";
            for (let i = 0; i < data.lyrics.length; i++) {
                if (data.lyrics[i].time <= offset) {
                    bestLine = data.lyrics[i].text;
                } else {
                    break;
                }
            }
            resultLyrics.textContent = bestLine;
            lyricsContainer.classList.remove("hidden");
        } else if (lyricsContainer) {
            lyricsContainer.classList.add("hidden");
        }

        if (resultCard) {
            resultCard.classList.remove("hidden");
            resultCard.classList.add("result-card-visible");
            resultCard.classList.remove("result-card-hidden");

            resultCard.style.animation = 'none';
            resultCard.offsetHeight;
            resultCard.style.animation = 'card-celebrate 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) forwards';
        }

        launchConfetti();
        spawnMusicalNotes();

        setTimeout(() => {
            if (statusText && statusText.className === "status-label matched") {
                statusText.className = "status-label";
                statusText.textContent = "Presiona el botón para descubrir música";
            }
        }, 5000);

    } else {
        statusText.className = "status-label";
        statusText.textContent = "No se encontraron coincidencias";
        if (retryButton) retryButton.classList.add("visible");
    }
}

// ─── PLAYLIST ───
if (addPlaylistBtn) {
    addPlaylistBtn.addEventListener("click", async () => {
        if (!currentSongId) return;
        try {
            const baseUrl = getBaseUrl();
            const response = await fetch(`${baseUrl}/api/playlist`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ song_id: currentSongId })
            });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const data = await response.json();
            showToast(data.message || "Guardada", "success");
        } catch (err) {
            console.error(err);
            showToast("No se pudo guardar en la playlist", "error");
        }
    });
}

// ─── SHARE ───
if (shareButton) {
    shareButton.addEventListener("click", () => {
        var text = currentSongTitle + " - " + currentSongArtist;
        if (navigator.share) {
            navigator.share({
                title: "Shazam Mini",
                text: "Acabo de identificar: " + text,
            }).catch(function() {});
        } else {
            navigator.clipboard.writeText(text).then(function() {
                showToast("Copiado al portapapeles", "success");
            }).catch(function() {
                showToast("No se pudo compartir", "error");
            });
        }
    });
}

// ─── WAV CONVERSION ───
async function convertToWav(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const wavBuffer = audioBufferToWav(audioBuffer);
    return new Blob([wavBuffer], { type: "audio/wav" });
}

function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let offset = 0;
    let pos = 0;

    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = ((sample < 0 ? sample * 32768 : sample * 32767) + 0.5) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return bufferArray;

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}