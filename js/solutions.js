document.addEventListener('DOMContentLoaded', function() {
  var tabs = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.tab-panel');
  var dots = document.querySelectorAll('.tab-dot');

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var target = this.getAttribute('data-tab');

      tabs.forEach(function(t) { t.classList.remove('active'); });
      panels.forEach(function(p) { p.classList.remove('active'); });
      dots.forEach(function(d) { d.classList.remove('active'); });

      this.classList.add('active');
      var panel = document.getElementById(target);
      if (panel) {
        panel.classList.add('active');
        panel.style.animation = 'none';
        panel.offsetHeight;
        panel.style.animation = '';
      }

      var idx = parseInt(this.getAttribute('data-index'));
      if (dots[idx]) {
        dots[idx].classList.add('active');
      }
    });
  });
});
