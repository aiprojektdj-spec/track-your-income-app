// ponytail: ein IntersectionObserver für Scroll-Reveal, mehr JS braucht die Seite nicht
var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); }
    });
}, { threshold: 0.1 });
document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });
