document.addEventListener("DOMContentLoaded", async () => {
    const loadingText = document.getElementById("loading-text");
    const statsGrid = document.getElementById("stats-grid");
    const topSongsList = document.getElementById("top-songs-list");
    const topArtistsList = document.getElementById("top-artists-list");

    try {
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/api/stats`);

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();

        if (data.status === "success") {
            loadingText.classList.add("hidden");
            statsGrid.classList.remove("hidden");
            document.getElementById("stats-sections").classList.remove("hidden");

            const stats = data.stats;
            const statCards = [
                { label: "Canciones registradas", value: stats.total_songs, icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 0v5.25m0-5.25v12.75a3 3 0 01-3 3h-3a3 3 0 01-3-3V9H9.75M9 9V4.5a3 3 0 00-3-3H3a3 3 0 00-3 3V15a3 3 0 003 3h3a3 3 0 003-3V9h.75" /></svg>' },
                { label: "Escaneos totales", value: stats.total_scans, icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' },
                { label: "Escaneos hoy", value: stats.scans_today, icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L6 18M6 18L6 10.5M6 10.5L8.25 10.5M6.75 6.75L9 6.75M9 6.75L9 18M9 18L12.75 18M12.75 18L12.75 9M12.75 9L15 9M12.75 9L12.75 2.25M15 9L15 18M15 18L18.75 18M18.75 18L18.75 12.75M18.75 12.75L21 12.75" /></svg>' },
                { label: "En playlist", value: stats.playlist_count, icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 0v5.25m0-5.25v12.75a3 3 0 01-3 3h-3a3 3 0 01-3-3V9H9.75M9 9V4.5a3 3 0 00-3-3H3a3 3 0 00-3 3V15a3 3 0 003 3h3a3 3 0 003-3V9h.75" /></svg>' }
            ];

            statCards.forEach(function (card) {
                var div = document.createElement("div");
                div.className = "stat-card";
                div.innerHTML = '<div class="stat-card-icon">' + card.icon + '</div><div class="stat-card-value">' + card.value + '</div><div class="stat-card-label">' + card.label + '</div>';
                statsGrid.appendChild(div);
            });

            if (topSongsList && stats.top_songs && stats.top_songs.length > 0) {
                stats.top_songs.forEach(function (song) {
                    var div = document.createElement("div");
                    div.className = "stat-rank-item";
                    div.innerHTML = getThumbnailHtml(song.artist, song.thumbnail ? (getBaseUrl() + "/api/thumbnail/" + song.song_id) : null) + '<div class="stat-rank-info"><div class="stat-rank-title">' + escapeHtml(song.title) + '</div><div class="stat-rank-sub">' + escapeHtml(song.artist) + ' &middot; ' + song.scan_count + ' escaneos</div></div>';
                    topSongsList.appendChild(div);
                });
            } else if (topSongsList) {
                topSongsList.innerHTML = '<div class="stat-rank-empty">Sin datos suficientes</div>';
            }

            if (topArtistsList && stats.top_artists && stats.top_artists.length > 0) {
                stats.top_artists.forEach(function (artist) {
                    var div = document.createElement("div");
                    div.className = "stat-rank-item";
                    div.innerHTML = getThumbnailHtml(artist.artist) + '<div class="stat-rank-info"><div class="stat-rank-title">' + escapeHtml(artist.artist) + '</div><div class="stat-rank-sub">' + artist.scan_count + ' escaneos</div></div>';
                    topArtistsList.appendChild(div);
                });
            } else if (topArtistsList) {
                topArtistsList.innerHTML = '<div class="stat-rank-empty">Sin datos suficientes</div>';
            }
        } else {
            loadingText.className = "error-state";
            loadingText.textContent = data.message || "Error al cargar estadísticas";
        }
    } catch (error) {
        if (loadingText) {
            loadingText.className = "error-state";
            loadingText.textContent = "No se pudo conectar con el servidor.";
        }
        console.error(error);
    }
});