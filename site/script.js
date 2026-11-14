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

// Progressively prepend any newer release published in releases.json beyond the static card.
fetch('releases.json', { cache: 'no-cache' })
  .then(response => (response.ok ? response.json() : null))
  .then(feed => {
    if (!feed || !Array.isArray(feed.releases)) return;
    const changelogSection = document.querySelector('#pembaruan');
    const firstCard = changelogSection && changelogSection.querySelector('.changelog-card[data-version-code]');
    const staticTopCode = Number(firstCard?.getAttribute('data-version-code') || 0);
    const newer = feed.releases
      .filter(item => Number(item?.versionCode) > staticTopCode && typeof item?.versionName === 'string')
      .sort((a, b) => Number(b.versionCode) - Number(a.versionCode));
    if (newer.length === 0 || !changelogSection || !firstCard) return;

    const fragment = document.createDocumentFragment();
    newer.forEach(item => {
      const card = document.createElement('article');
      card.className = 'changelog-card';
      card.setAttribute('data-version-code', String(item.versionCode));

      const meta = document.createElement('div');
      meta.className = 'changelog-meta';
      const pill = document.createElement('span');
      pill.className = 'release-pill release-pill-latest';
      pill.textContent = item.badgeId || 'Rilis terbaru';
      const versionStrong = document.createElement('strong');
      versionStrong.textContent = `${item.versionName} (${item.versionCode})`;
      const time = document.createElement('time');
      if (item.date) {
        time.dateTime = item.date;
        time.textContent = item.date;
      }
      meta.append(pill, versionStrong, time);

      const content = document.createElement('div');
      content.className = 'changelog-content';
      const heading = document.createElement('h3');
      heading.textContent = item.headlineId || `SabatKu ${item.versionName}`;
      content.appendChild(heading);

      if (Array.isArray(item.notesId) && item.notesId.length > 0) {
        const list = document.createElement('ul');
        item.notesId.forEach(note => {
          const li = document.createElement('li');
          li.textContent = note;
          list.appendChild(li);
        });
        content.appendChild(list);
      }
      card.append(meta, content);
      fragment.appendChild(card);
    });
    changelogSection.insertBefore(fragment, firstCard);

    const topRelease = newer[0];
    const heroRelease = document.querySelector('.release-note');
    if (heroRelease) {
      heroRelease.textContent = '';
      const pip = document.createElement('span');
      pip.className = 'status-pip';
      heroRelease.append(pip, ` Pengujian internal · versi ${topRelease.versionName} (${topRelease.versionCode}) · Android 8.0 ke atas`);
    }
    const mobileTitle = document.querySelector('.mobile-download strong');
    if (mobileTitle) mobileTitle.textContent = `SabatKu ${topRelease.versionName}`;
  })
  .catch(() => {});
