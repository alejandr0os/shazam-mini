function getBaseUrl() {
    var savedUrl = localStorage.getItem("backend_url");
    if (savedUrl) return savedUrl;
    return window.location.protocol === 'file:' ? 'http://localhost:5000' : 'http://' + window.location.hostname + ':5000';
}

function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, type) {
    type = type || "info";
    var toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.id = "toast-container";
        toastContainer.className = "toast-container";
        document.body.appendChild(toastContainer);
    }
    var icons = {
        success: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
        error: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>',
        info: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>'
    };
    var toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.innerHTML = icons[type] + " <span>" + escapeHtml(message) + "</span>";
    var oldToasts = toastContainer.querySelectorAll(".toast");
    oldToasts.forEach(function (t) {
        t.classList.add("toast-out");
        setTimeout(function () { if (t.parentNode) t.remove(); }, 250);
    });
    toastContainer.appendChild(toast);
    setTimeout(function () {
        toast.classList.add("toast-out");
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 250);
    }, 2800);
}

function getThumbnailHtml(artist, thumbnailUrl) {
    if (!artist) return '';
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
    for (var ci = 0; ci < artist.length; ci++) {
        hash = ((hash << 5) - hash) + artist.charCodeAt(ci);
        hash = hash & hash;
    }
    var color = palette[Math.abs(hash) % palette.length];
    var letter = escapeHtml(artist.charAt(0).toUpperCase());
    if (thumbnailUrl) {
        return '<div class="song-card-thumb song-card-thumb-img" style="background-color:' + color.bg + ';color:' + color.fg + ';">' + letter + '<img src="' + escapeHtml(thumbnailUrl) + '" alt="" class="thumb-img" loading="lazy" onerror="this.style.display=\'none\';"></div>';
    }
    return '<div class="song-card-thumb" style="background-color: ' + color.bg + '; color: ' + color.fg + ';">' + letter + '</div>';
}

function showSongDetail(songId) {
    var overlay = document.getElementById("song-detail-overlay");
    if (!overlay) return;
    var titleEl = document.getElementById("song-detail-title");
    var artistEl = document.getElementById("song-detail-artist");
    var lyricsEl = document.getElementById("song-detail-lyrics");
    var noLyricsEl = document.getElementById("song-detail-no-lyrics");
    var thumbEl = document.getElementById("song-detail-thumb");
    var loadingEl = document.getElementById("song-detail-loading");

    overlay.classList.remove("hidden");
    overlay.style.opacity = "0";
    requestAnimationFrame(function () { overlay.style.opacity = "1"; });

    if (titleEl) titleEl.textContent = "";
    if (artistEl) artistEl.textContent = "";
    if (lyricsEl) lyricsEl.innerHTML = "";
    if (noLyricsEl) noLyricsEl.classList.add("hidden");
    if (lyricsEl) lyricsEl.parentElement.classList.add("hidden");
    if (thumbEl) thumbEl.style.display = "none";
    if (loadingEl) loadingEl.classList.remove("hidden");

    fetch(getBaseUrl() + "/api/song/" + songId)
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        })
        .then(function (data) {
            if (loadingEl) loadingEl.classList.add("hidden");
            if (data.status !== "success") return;
            var song = data.song;
            if (titleEl) titleEl.textContent = song.title || "";
            if (artistEl) artistEl.textContent = song.artist || "";

            if (thumbEl && song.artist) {
                var thumbUrl = song.thumbnail ? (getBaseUrl() + "/api/thumbnail/" + song.id) : null;
                if (thumbUrl) {
                    thumbEl.style.backgroundColor = 'rgba(108,156,255,0.18)';
                    thumbEl.style.color = '#6c9cff';
                    thumbEl.textContent = song.artist.charAt(0).toUpperCase();
                    thumbEl.innerHTML = thumbEl.textContent + '<img src="' + escapeHtml(thumbUrl) + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.style.display=\'none\';">';
                    thumbEl.style.display = "flex";
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
                    var h = 0;
                    for (var i = 0; i < song.artist.length; i++) {
                        h = ((h << 5) - h) + song.artist.charCodeAt(i);
                        h = h & h;
                    }
                    var col = palette[Math.abs(h) % palette.length];
                    thumbEl.style.background = col.bg;
                    thumbEl.style.color = col.fg;
                    thumbEl.textContent = song.artist.charAt(0).toUpperCase();
                    thumbEl.style.display = "flex";
                }
            }

            if (song.lyrics && song.lyrics.length > 0) {
                if (lyricsEl) {
                    lyricsEl.innerHTML = "";
                    song.lyrics.forEach(function (line) {
                        var div = document.createElement("div");
                        div.className = "lyrics-line";
                        div.textContent = line.text || "";
                        lyricsEl.appendChild(div);
                    });
                }
                if (lyricsEl && lyricsEl.parentElement) lyricsEl.parentElement.classList.remove("hidden");
                if (noLyricsEl) noLyricsEl.classList.add("hidden");
            } else {
                if (lyricsEl && lyricsEl.parentElement) lyricsEl.parentElement.classList.add("hidden");
                if (noLyricsEl) noLyricsEl.classList.remove("hidden");
            }
        })
        .catch(function () {
            if (loadingEl) loadingEl.classList.add("hidden");
            showToast("No se pudo cargar la canción", "error");
        });
}

function closeSongDetail() {
    var overlay = document.getElementById("song-detail-overlay");
    if (!overlay) return;
    overlay.style.opacity = "0";
    setTimeout(function () { overlay.classList.add("hidden"); }, 300);
}

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSongDetail();
});

document.addEventListener("click", function (e) {
    var overlay = document.getElementById("song-detail-overlay");
    if (overlay && !overlay.classList.contains("hidden") && e.target === overlay) {
        closeSongDetail();
    }
});