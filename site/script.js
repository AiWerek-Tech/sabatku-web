const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-navigation');
menuToggle.hidden = false;
document.documentElement.classList.add('js-enabled');
function closeMenu() {
  menuToggle.setAttribute('aria-expanded', 'false');
}
menuToggle.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded', String(menuToggle.getAttribute('aria-expanded') !== 'true'));
});
navigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('click', event => {
  if (!event.target.closest('.topbar')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuToggle.focus();
  }
});
window.matchMedia('(min-width: 1024px)').addEventListener('change', closeMenu);
const featureFilter = document.querySelector('.feature-filter');
if (featureFilter) {
  featureFilter.hidden = false;
  featureFilter.addEventListener('click', event => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    featureFilter.querySelectorAll('button').forEach(item => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    document.querySelectorAll('.feature-card[data-category]').forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
    });
  });
}
