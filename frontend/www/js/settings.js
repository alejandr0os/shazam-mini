document.addEventListener("DOMContentLoaded", function () {
    var settingsButton = document.getElementById("settings-button");
    var settingsModal = document.getElementById("settings-modal");
    var backendUrlInput = document.getElementById("backend-url-input");
    var saveSettingsBtn = document.getElementById("save-settings-btn");
    var closeSettingsBtn = document.getElementById("close-settings-btn");

    if (settingsButton && settingsModal) {
        settingsButton.addEventListener("click", function () {
            backendUrlInput.value = getBaseUrl();
            settingsModal.classList.remove("hidden");
            settingsModal.style.opacity = "0";
            requestAnimationFrame(function () {
                settingsModal.style.opacity = "1";
            });
        });
    }

    if (closeSettingsBtn && settingsModal) {
        closeSettingsBtn.addEventListener("click", function () {
            settingsModal.style.opacity = "0";
            setTimeout(function () { settingsModal.classList.add("hidden"); }, 350);
        });
    }

    if (saveSettingsBtn && settingsModal) {
        saveSettingsBtn.addEventListener("click", function () {
            var url = backendUrlInput.value.trim();
            if (url) {
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    url = "http://" + url;
                }
                localStorage.setItem("backend_url", url);
            } else {
                localStorage.removeItem("backend_url");
            }
            settingsModal.style.opacity = "0";
            setTimeout(function () { settingsModal.classList.add("hidden"); }, 350);

            var toastContainer = document.getElementById("toast-container");
            if (toastContainer) {
                var existingToasts = toastContainer.querySelectorAll(".toast");
                existingToasts.forEach(function (t) { t.remove(); });
            }

            if (typeof showToast === "function") {
                showToast("Configuración guardada", "success");
            } else if (toastContainer) {
                var toast = document.createElement("div");
                toast.className = "toast toast-success";
                toast.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> <span>Configuraci\u00f3n guardada</span>';
                toastContainer.appendChild(toast);
                setTimeout(function () {
                    toast.classList.add("toast-out");
                    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 250);
                }, 2800);
            }
        });
    }
});