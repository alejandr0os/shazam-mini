(function () {
    var onboardingDone = localStorage.getItem('onboarding_done');
    if (onboardingDone) return;

    var overlay = document.getElementById("onboarding-overlay");
    if (!overlay) return;

    var slides = overlay.querySelectorAll(".onboarding-slide");
    var dots = overlay.querySelectorAll(".onboarding-dot");
    var prevBtn = document.getElementById("onboarding-prev");
    var nextBtn = document.getElementById("onboarding-next");
    var currentSlide = 0;

    function showSlide(index) {
        for (var i = 0; i < slides.length; i++) {
            slides[i].classList.toggle("onboarding-slide-active", i === index);
        }
        for (var j = 0; j < dots.length; j++) {
            dots[j].classList.toggle("onboarding-dot-active", j === index);
        }
        if (prevBtn) prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
        if (nextBtn) {
            if (index === slides.length - 1) {
                nextBtn.textContent = 'Comenzar';
            } else {
                nextBtn.textContent = 'Siguiente';
            }
        }
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", function () {
            if (currentSlide < slides.length - 1) {
                currentSlide++;
                showSlide(currentSlide);
            } else {
                localStorage.setItem('onboarding_done', '1');
                overlay.classList.add("onboarding-overlay-exit");
                setTimeout(function () {
                    overlay.remove();
                }, 400);
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", function () {
            if (currentSlide > 0) {
                currentSlide--;
                showSlide(currentSlide);
            }
        });
    }

    for (var d = 0; d < dots.length; d++) {
        (function (idx) {
            dots[idx].addEventListener("click", function () {
                currentSlide = idx;
                showSlide(currentSlide);
            });
        })(d);
    }

    showSlide(0);
    overlay.classList.remove("hidden");
})();