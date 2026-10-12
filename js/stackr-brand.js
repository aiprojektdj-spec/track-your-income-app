// Reine Entwurfsansicht: Kontrast der Logo-Proben wechseln.
document.getElementById('contrast').addEventListener('click', function () {
    var light = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', String(light));
    this.textContent = light ? 'Logos auf Schwarz ansehen' : 'Logos auf Weiß ansehen';
    document.body.classList.toggle('light-logos', light);
});
