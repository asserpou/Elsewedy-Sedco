document.addEventListener('DOMContentLoaded', function() {
  var tagBtns = document.querySelectorAll('.tag-btn');
  var searchInput = document.getElementById('product-search');
  var productCards = document.querySelectorAll('.product-card');
  var noResults = document.querySelector('.no-results');

  function filterProducts() {
    var activeTag = document.querySelector('.tag-btn.active');
    var tag = activeTag ? activeTag.getAttribute('data-tag') : 'All';
    var search = searchInput ? searchInput.value.toLowerCase() : '';
    var visibleCount = 0;

    productCards.forEach(function(card) {
      var cardTag = card.getAttribute('data-tag');
      var cardTitle = card.getAttribute('data-title').toLowerCase();
      var cardSpec = card.getAttribute('data-spec').toLowerCase();

      var matchTag = tag === 'All' || cardTag === tag;
      var matchSearch = !search || cardTitle.includes(search) || cardSpec.includes(search);

      if (matchTag && matchSearch) {
        if (card.style.display === 'none' || !card.style.display) {
          card.style.display = 'flex';
          card.style.animation = 'fadeSlideUp 0.4s ease forwards';
        }
        visibleCount++;
      } else {
        card.style.display = 'none';
        card.style.animation = '';
      }
    });

    if (noResults) {
      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  tagBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      tagBtns.forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      filterProducts();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', filterProducts);
  }
});
