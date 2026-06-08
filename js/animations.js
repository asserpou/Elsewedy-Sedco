document.addEventListener('DOMContentLoaded', function() {
  var reveals = document.querySelectorAll('.reveal');

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var delay = entry.target.getAttribute('data-delay') || 0;
        setTimeout(function() {
          entry.target.classList.add('visible');
        }, delay * 1000);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '-50px'
  });

  reveals.forEach(function(el) {
    observer.observe(el);
  });

  var counters = document.querySelectorAll('.hero-stat-value, .stat-box .value');
  var counterObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var text = el.innerText;
        var hasPlus = text.includes('+');
        var hasComma = text.includes(',');
        var max = parseInt(text.replace(/,/g, '').replace('+', ''), 10);
        if (!isNaN(max) && max > 0) {
          var duration = 2000;
          var startTime = performance.now();
          function updateCounter(currentTime) {
             var elapsed = currentTime - startTime;
             var progress = elapsed / duration;
             if(progress > 1) progress = 1;
             
             var easeProgress = (progress === 1) ? 1 : 1 - Math.pow(2, -10 * progress);
             var val = Math.floor(easeProgress * max);
             
             var displayVal = val.toString();
             if (hasComma) displayVal = val.toLocaleString();
             if (hasPlus) displayVal += "+";
             el.innerText = displayVal;
             
             if(progress < 1) {
                 requestAnimationFrame(updateCounter);
             }
          }
          requestAnimationFrame(updateCounter);
        }
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.1 });

  counters.forEach(function(el) {
    counterObserver.observe(el);
  });
});

