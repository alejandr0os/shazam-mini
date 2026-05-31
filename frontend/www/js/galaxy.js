(function () {
    var canvas = document.getElementById("galaxy-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");

    var stars = [];
    var bursts = [];
    var shootingStars = [];
    var nebulae = [];
    var STAR_COUNT = 220;
    var MIN_STAR_SIZE = 0.4;
    var MAX_STAR_SIZE = 2.0;
    var swipeActive = false;

    document.addEventListener("touchstart", function () { swipeActive = false; }, { passive: true });
    document.addEventListener("touchmove", function () { swipeActive = true; }, { passive: true });
    document.addEventListener("touchend", function () { setTimeout(function () { swipeActive = false; }, 50); }, { passive: true });

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initNebulae();
    }

    function initNebulae() {
        nebulae = [];
        var count = 3 + Math.floor(Math.random() * 2);
        for (var i = 0; i < count; i++) {
            nebulae.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: 120 + Math.random() * 200,
                hue: 200 + Math.random() * 60,
                alpha: 0.012 + Math.random() * 0.018,
                driftX: (Math.random() - 0.5) * 0.03,
                driftY: (Math.random() - 0.5) * 0.02,
                pulseSpeed: 0.0008 + Math.random() * 0.001,
                pulseOffset: Math.random() * Math.PI * 2
            });
        }
    }

    function init() {
        resize();
        stars = [];
        for (var i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: MIN_STAR_SIZE + Math.random() * (MAX_STAR_SIZE - MIN_STAR_SIZE),
                opacity: 0.15 + Math.random() * 0.55,
                drift: (Math.random() - 0.5) * 0.08,
                driftY: (Math.random() - 0.5) * 0.04,
                twinkleSpeed: 0.003 + Math.random() * 0.008,
                twinkleOffset: Math.random() * Math.PI * 2
            });
        }
    }

    function createBurst(x, y) {
        var count = 30 + Math.floor(Math.random() * 20);
        for (var i = 0; i < count; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = 1.5 + Math.random() * 4;
            var hue = 210 + Math.random() * 40;
            bursts.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.008 + Math.random() * 0.015,
                size: 1 + Math.random() * 2.5,
                hue: hue,
                lightness: 60 + Math.random() * 25
            });
        }
    }

    function spawnShootingStar() {
        var fromLeft = Math.random() > 0.5;
        shootingStars.push({
            x: fromLeft ? -20 : canvas.width + 20,
            y: Math.random() * canvas.height * 0.5,
            vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 8),
            vy: 3 + Math.random() * 4,
            life: 1.0,
            decay: 0.012 + Math.random() * 0.008,
            length: 60 + Math.random() * 80,
            size: 1.5 + Math.random() * 1.5
        });
    }

    var time = 0;
    var lastShootingStar = 0;

    function draw() {
        time++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (var n = 0; n < nebulae.length; n++) {
            var neb = nebulae[n];
            neb.x += neb.driftX;
            neb.y += neb.driftY;
            if (neb.x < -neb.radius) neb.x = canvas.width + neb.radius;
            if (neb.x > canvas.width + neb.radius) neb.x = -neb.radius;
            if (neb.y < -neb.radius) neb.y = canvas.height + neb.radius;
            if (neb.y > canvas.height + neb.radius) neb.y = -neb.radius;

            var pulse = 0.7 + 0.3 * Math.sin(time * neb.pulseSpeed + neb.pulseOffset);
            var grad = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.radius);
            grad.addColorStop(0, "hsla(" + neb.hue + ", 60%, 50%, " + (neb.alpha * pulse) + ")");
            grad.addColorStop(0.5, "hsla(" + neb.hue + ", 50%, 40%, " + (neb.alpha * pulse * 0.4) + ")");
            grad.addColorStop(1, "transparent");
            ctx.fillStyle = grad;
            ctx.fillRect(neb.x - neb.radius, neb.y - neb.radius, neb.radius * 2, neb.radius * 2);
        }

        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            s.x += s.drift;
            s.y += s.driftY;

            if (s.x < 0) s.x = canvas.width;
            if (s.x > canvas.width) s.x = 0;
            if (s.y < 0) s.y = canvas.height;
            if (s.y > canvas.height) s.y = 0;

            var twinkle = 0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinkleOffset);
            var alpha = s.opacity * twinkle;

            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(180, 200, 255, " + alpha + ")";
            ctx.fill();

            if (s.size > 1.2) {
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(108, 156, 255, " + (alpha * 0.08) + ")";
                ctx.fill();
            }
        }

        if (time - lastShootingStar > 180 + Math.random() * 300) {
            spawnShootingStar();
            lastShootingStar = time;
        }

        for (var k = shootingStars.length - 1; k >= 0; k--) {
            var ss = shootingStars[k];
            ss.x += ss.vx;
            ss.y += ss.vy;
            ss.life -= ss.decay;

            if (ss.life <= 0) {
                shootingStars.splice(k, 1);
                continue;
            }

            var tailX = ss.x - ss.vx * (ss.length / Math.abs(ss.vx));
            var tailY = ss.y - ss.vy * (ss.length / Math.abs(ss.vx));

            var grad2 = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
            grad2.addColorStop(0, "rgba(180, 210, 255, 0)");
            grad2.addColorStop(0.7, "rgba(200, 220, 255, " + (ss.life * 0.4) + ")");
            grad2.addColorStop(1, "rgba(230, 240, 255, " + (ss.life * 0.8) + ")");

            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(ss.x, ss.y);
            ctx.strokeStyle = grad2;
            ctx.lineWidth = ss.size * ss.life;
            ctx.lineCap = "round";
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(ss.x, ss.y, ss.size * ss.life * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(230, 240, 255, " + ss.life + ")";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(ss.x, ss.y, ss.size * ss.life * 4, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(108, 156, 255, " + (ss.life * 0.15) + ")";
            ctx.fill();
        }

        for (var j = bursts.length - 1; j >= 0; j--) {
            var b = bursts[j];
            b.x += b.vx;
            b.y += b.vy;
            b.vx *= 0.985;
            b.vy *= 0.985;
            b.life -= b.decay;

            if (b.life <= 0) {
                bursts.splice(j, 1);
                continue;
            }

            var a = b.life;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size * a, 0, Math.PI * 2);
            ctx.fillStyle = "hsla(" + b.hue + ", 75%, " + b.lightness + "%, " + a + ")";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size * a * 3, 0, Math.PI * 2);
            ctx.fillStyle = "hsla(" + b.hue + ", 75%, " + b.lightness + "%, " + (a * 0.12) + ")";
            ctx.fill();
        }

        requestAnimationFrame(draw);
    }

    window.addEventListener("resize", function () {
        resize();
    });

    document.addEventListener("click", function (e) {
        createBurst(e.clientX, e.clientY);
    });

    document.addEventListener("touchend", function (e) {
        if (!swipeActive && e.changedTouches && e.changedTouches[0]) {
            createBurst(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }
    }, { passive: true });

    init();
    draw();
})();
