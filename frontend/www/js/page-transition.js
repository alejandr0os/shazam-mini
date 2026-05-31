(function () {
    var guard = document.getElementById("flash-guard");

    function removeGuard() {
        if (!guard) return;
        guard.style.opacity = "0";
        setTimeout(function () {
            if (guard.parentNode) guard.remove();
            guard = null;
        }, 500);
    }

    if (document.readyState === "complete") {
        setTimeout(removeGuard, 50);
    } else {
        window.addEventListener("load", function () {
            setTimeout(removeGuard, 50);
        });
    }

    setTimeout(removeGuard, 2500);

    document.addEventListener("click", function (e) {
        var link = e.target.closest("a.tab-item, a.empty-state-action");
        if (!link) return;
        var href = link.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto") || href.startsWith("tel")) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

        e.preventDefault();
        var g = document.createElement("div");
        g.id = "flash-guard";
        g.style.cssText = "position:fixed;inset:0;z-index:9999;background:#06080f;pointer-events:none;opacity:0;transition:opacity 0.15s ease;";
        document.body.appendChild(g);
        requestAnimationFrame(function() { g.style.opacity = "1"; });
        setTimeout(function () {
            window.location.href = href;
        }, 150);
    });

    var tabBar = document.querySelector(".tab-bar");
    var activeTab = document.querySelector(".tab-item.active");
    if (tabBar && activeTab) {
        var indicator = document.createElement("div");
        indicator.className = "tab-indicator";
        tabBar.appendChild(indicator);

        function updateIndicator(tab) {
            var barRect = tabBar.getBoundingClientRect();
            var tabRect = tab.getBoundingClientRect();
            indicator.style.left = (tabRect.left - barRect.left + tabRect.width * 0.2) + "px";
            indicator.style.width = (tabRect.width * 0.6) + "px";
        }

        setTimeout(function() { updateIndicator(activeTab); }, 50);
        window.addEventListener("resize", function() { updateIndicator(activeTab); });
    }
})();
