document.addEventListener("DOMContentLoaded", async () => {
    const loadingText = document.getElementById("loading-text");
    const historyContainer = document.getElementById("history-container");

function addSwipeDelete(card, id, songId) {
        var startX = 0;
        var currentX = 0;
        var isDragging = false;
        var isSwiping = false;
        var SWIPE_THRESHOLD = 80;
        var CLICK_THRESHOLD = 10;

        card.addEventListener("touchstart", function(e) {
            if (e.target.closest(".playlist-add-btn")) return;
            startX = e.touches[0].clientX;
            isDragging = true;
            isSwiping = false;
            card.classList.add("swiping");
        }, { passive: true });

        card.addEventListener("touchmove", function(e) {
            if (!isDragging) return;
            currentX = e.touches[0].clientX - startX;
            if (Math.abs(currentX) > CLICK_THRESHOLD) {
                isSwiping = true;
            }
            if (currentX < 0) {
                card.style.transform = "translateX(" + currentX + "px)";
            }
        }, { passive: true });

        card.addEventListener("touchend", function() {
            isDragging = false;
            card.classList.remove("swiping");
            if (currentX < -SWIPE_THRESHOLD) {
                card.classList.add("swiped");
            } else {
                card.style.transform = "";
                card.classList.remove("swiped");
            }
            if (!isSwiping && Math.abs(currentX) < CLICK_THRESHOLD) {
                if (songId) showSongDetail(songId);
            }
            currentX = 0;
        });

        card.addEventListener("click", function(e) {
            if (card.classList.contains("swiped")) {
                card.classList.remove("swiped");
                card.style.transform = "";
                e.stopPropagation();
                return;
            }
            if (e.target.closest(".delete-btn") || e.target.closest(".playlist-add-btn")) return;
            if (songId) showSongDetail(songId);
        });

        var deleteBtn = card.querySelector(".delete-btn");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", function() {
                card.classList.remove("swiped");
                card.style.transform = "";
                card.classList.add("deleting");
                var wrapper = card.closest(".song-card-wrapper") || card.parentElement;
                fetch(getBaseUrl() + "/api/history/" + id, { method: "DELETE" })
                    .then(function(res) {
                        if (!res.ok) throw new Error("HTTP " + res.status);
                        return res.json();
                    })
                    .then(function() {
                        if (wrapper) {
                            wrapper.style.maxHeight = wrapper.scrollHeight + "px";
                            requestAnimationFrame(function() {
                                wrapper.classList.add("removing");
                                wrapper.style.maxHeight = "0";
                            });
                            setTimeout(function() { wrapper.remove(); }, 400);
                        }
                        showToast("Eliminada del historial", "success");
                    })
                    .catch(function() {
                        card.classList.remove("deleting");
                        card.style.transform = "";
                        showToast("Error al eliminar", "error");
                    });
            });
        }

        card.addEventListener("click", function(e) {
            if (card.classList.contains("swiped")) {
                card.classList.remove("swiped");
                card.style.transform = "";
                e.stopPropagation();
            }
        });
    }

    try {
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/api/history`);

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();

        if (data.status === "success" && data.history.length > 0) {
            loadingText.classList.add("hidden");
            historyContainer.classList.remove("hidden");

            const fragment = document.createDocumentFragment();

            data.history.forEach(song => {
                const wrapper = document.createElement("div");
                wrapper.className = "song-card-wrapper";

                const songCard = document.createElement("div");
                songCard.className = "song-card";

                let dateStr = "";
                let timeAgo = "";
                if (song.scanned_at) {
                    try {
                        const date = new Date(song.scanned_at.replace(" ", "T") + "Z");
                        const now = new Date();
                        const diffMs = now - date;
                        const diffMin = Math.floor(diffMs / 60000);
                        const diffHr = Math.floor(diffMs / 3600000);
                        const diffDays = Math.floor(diffMs / 86400000);

                        if (diffMin < 1) timeAgo = "Ahora mismo";
                        else if (diffMin < 60) timeAgo = "Hace " + diffMin + " min";
                        else if (diffHr < 24) timeAgo = "Hace " + diffHr + " h";
                        else if (diffDays < 7) timeAgo = "Hace " + diffDays + " d";
                        else timeAgo = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

                        dateStr = date.toLocaleString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    } catch (e) {
                        dateStr = song.scanned_at;
                        timeAgo = "";
                    }
                }

                songCard.innerHTML = `
                    <div class="song-card-content">
                        ${getThumbnailHtml(song.artist, song.thumbnail ? (getBaseUrl() + "/api/thumbnail/" + song.song_id) : null)}
                        <div class="song-card-info">
                            <h3 class="song-card-title">${escapeHtml(song.title)}</h3>
                            <p class="song-card-artist">${escapeHtml(song.artist)}</p>
                            <p class="song-card-meta">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:10px;height:10px">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                ${escapeHtml(timeAgo || dateStr)}
                            </p>
                        </div>
                        <button class="playlist-add-btn" data-song-id="${song.song_id}" title="Añadir a playlist">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 0v5.25m0-5.25v12.75a3 3 0 01-3 3h-3a3 3 0 01-3-3V9H9.75M9 9V4.5a3 3 0 00-3-3H3a3 3 0 00-3 3V15a3 3 0 003 3h3a3 3 0 003-3V9h.75" />
                            </svg>
                        </button>
                    </div>
                    <button class="delete-btn" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.642-2.08l.332-1.423c.09-.44.166-1.02.166-1.48 0-.53-.166-1.08-.409-1.592M19.81 3.72l-.39.12m0 0l-.94.301m.94-.301l1.488.463m0 0c.427.14.865.3 1.294.495M12 2.25c-1.308 0-2.392.495-3.186 1.264A4.27 4.27 0 006.75 7.5H5.25m6.75 0h2.25m-2.25 0V4.5a2.25 2.25 0 00-2.25-2.25H6.75" />
                        </svg>
                    </button>
                `;

                wrapper.appendChild(songCard);
                fragment.appendChild(wrapper);

                addSwipeDelete(songCard, song.id, song.song_id);

                var playlistBtn = songCard.querySelector(".playlist-add-btn");
                if (playlistBtn) {
                    playlistBtn.addEventListener("click", function(e) {
                        e.stopPropagation();
                        var btn = this;
                        var sid = btn.getAttribute("data-song-id");
                        btn.disabled = true;
                        fetch(getBaseUrl() + "/api/playlist", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ song_id: parseInt(sid) })
                        })
                        .then(function(res) {
                            if (!res.ok) throw new Error("HTTP " + res.status);
                            return res.json();
                        })
                        .then(function(data) {
                            if (data.status === "success") {
                                showToast("Añadida a la playlist", "success");
                                btn.classList.add("added");
                            } else {
                                showToast(data.message || "Ya está en la playlist", "info");
                                btn.classList.add("added");
                            }
                        })
                        .catch(function() {
                            showToast("Error al añadir a la playlist", "error");
                            btn.disabled = false;
                        });
                    });
                }
            });

            historyContainer.appendChild(fragment);

            var wrappers = historyContainer.querySelectorAll(".song-card-wrapper");
            for (var i = 0; i < wrappers.length; i++) {
                wrappers[i].style.maxHeight = wrappers[i].scrollHeight + "px";
            }

        } else {
            loadingText.className = "empty-state";
            loadingText.innerHTML = `
                <div class="empty-state-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div class="empty-state-title">Aún no has descubierto nada</div>
                <div class="empty-state-desc">Las canciones que identifiques aparecerán aquí.</div>
                <a href="index.html" class="empty-state-action">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                    Identificar música
                </a>
            `;
        }

    } catch (error) {
        if (loadingText) {
            loadingText.className = "error-state";
            loadingText.textContent = "No se pudo cargar el historial. Conéctate al servidor e inténtalo de nuevo.";
        }
        console.error(error);
    }
});