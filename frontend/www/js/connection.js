document.addEventListener("DOMContentLoaded", function () {
    var dot = document.getElementById("connection-dot");
    if (!dot) return;

    function checkConnection() {
        var controller = new AbortController();
        var timeoutId = setTimeout(function () { controller.abort(); }, 3000);

        fetch(getBaseUrl() + "/api/health", { method: "GET", signal: controller.signal })
            .then(function (res) {
                clearTimeout(timeoutId);
                return res.json();
            })
            .then(function (data) {
                dot.className = "connection-dot connection-dot-online";
                if (data.songs !== undefined) {
                    dot.title = "Conectado \u2014 " + data.songs + " canciones registradas";
                } else {
                    dot.title = "Conectado";
                }
            })
            .catch(function () {
                clearTimeout(timeoutId);
                dot.className = "connection-dot connection-dot-offline";
                dot.title = "Sin conexi\u00f3n con el servidor";
            });
    }

    checkConnection();
    setInterval(checkConnection, 8000);
});