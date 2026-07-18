(function() {
  var el = document.getElementById('current-date');
  if (el) {
    el.textContent = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
})();
