document.addEventListener("DOMContentLoaded", async () => {
    const loadingText = document.getElementById("loading-text");
    const playlistContainer = document.getElementById("playlist-container");

    function addSwipeDelete(card, playlistId, songId) {
        var startX = 0;
        var currentX = 0;
        var isDragging = false;
        var isSwiping = false;
        var SWIPE_THRESHOLD = 80;
        var CLICK_THRESHOLD = 10;

        card.addEventListener("touchstart", function(e) {
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
            if (e.target.closest(".delete-btn")) return;
            if (songId) showSongDetail(songId);
        });

        var deleteBtn = card.querySelector(".delete-btn");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", function() {
                card.classList.remove("swiped");
                card.style.transform = "";
                card.classList.add("deleting");
                var wrapper = card.closest(".song-card-wrapper") || card.parentElement;
                fetch(getBaseUrl() + "/api/playlist/" + playlistId, { method: "DELETE" })
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
                        showToast("Eliminada de la playlist", "success");
                    })
                    .catch(function() {
                        card.classList.remove("deleting");
                        card.style.transform = "";
                        showToast("Error al eliminar", "error");
                    });
            });
        }
    }

    try {
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/api/playlist`);

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();

        if (data.status === "success" && data.playlist.length > 0) {
            loadingText.classList.add("hidden");
            playlistContainer.classList.remove("hidden");

            const fragment = document.createDocumentFragment();

            data.playlist.forEach(item => {
                const wrapper = document.createElement("div");
                wrapper.className = "song-card-wrapper";

                const songCard = document.createElement("div");
                songCard.className = "song-card";

                songCard.innerHTML = `
                    <div class="song-card-content">
                        ${getThumbnailHtml(item.artist, item.thumbnail ? (getBaseUrl() + "/api/thumbnail/" + item.song_id) : null)}
                        <div class="song-card-info">
                            <h3 class="song-card-title">${escapeHtml(item.title)}</h3>
                            <p class="song-card-artist">${escapeHtml(item.artist)}</p>
                        </div>
                    </div>
                    <button class="delete-btn" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.642-2.08l.332-1.423c.09-.44.166-1.02.166-1.48 0-.53-.166-1.08-.409-1.592M19.81 3.72l-.39.12m0 0l-.94.301m.94-.301l1.488.463m0 0c.427.14.865.3 1.294.495M12 2.25c-1.308 0-2.392.495-3.186 1.264A4.27 4.27 0 006.75 7.5H5.25m6.75 0h2.25m-2.25 0V4.5a2.25 2.25 0 00-2.25-2.25H6.75" />
                        </svg>
                    </button>
                `;

                wrapper.appendChild(songCard);
                fragment.appendChild(wrapper);

                addSwipeDelete(songCard, item.playlist_id, item.song_id);
            });

            playlistContainer.appendChild(fragment);

            var wrappers = playlistContainer.querySelectorAll(".song-card-wrapper");
            for (var i = 0; i < wrappers.length; i++) {
                wrappers[i].style.maxHeight = wrappers[i].scrollHeight + "px";
            }

        } else {
            loadingText.className = "empty-state";
            loadingText.innerHTML = `
                <div class="empty-state-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 0v5.25m0-5.25v12.75a3 3 0 01-3 3h-3a3 3 0 01-3-3V9H9.75M9 9V4.5a3 3 0 00-3-3H3a3 3 0 00-3 3V15a3 3 0 003 3h3a3 3 0 003-3V9h.75" />
                    </svg>
                </div>
                <div class="empty-state-title">Tu playlist está vacía</div>
                <div class="empty-state-desc">Cuando identifiques una canción, guárdala aquí para no olvidarla.</div>
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
            loadingText.textContent = "No se pudo cargar la playlist. Conéctate al servidor e inténtalo de nuevo.";
        }
        console.error(error);
    }
});