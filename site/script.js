const donationText = 'Bantu SabatKu hadir di Google Play Store. Kami menggalang dana untuk biaya pendaftaran satu kali akun pengembang Google Play agar aplikasi SabatKu bisa diterbitkan dan lebih mudah dicari serta diunduh. Biayanya US$25 (sekitar Rp447.000, perkiraan kurs acuan 9 Oktober 2026). Donasi sukarela melalui OVO/GoPay: 082190822641 (FRENGKY LOKOBAL).';
const numberToCopy = '082190822641';
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
const feedback = document.querySelector('#copy-feedback');
let feedbackTimer;

function showFeedback(message) {
  feedback.textContent = message;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { feedback.textContent = ''; }, 2800);
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Clipboard unavailable');
}

document.querySelector('#copy-number').addEventListener('click', async () => {
  try {
    await copyText(numberToCopy);
    showFeedback('Nomor OVO/GoPay berhasil disalin.');
  } catch {
    showFeedback('Nomor: 082190822641');
  }
});

document.querySelector('#share-donation').addEventListener('click', async () => {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Dukung SabatKu', text: donationText, url: window.location.href });
    } else {
      await copyText(`${donationText}\n${window.location.href}`);
      showFeedback('Info donasi disalin, siap dibagikan.');
    }
  } catch (error) {
    if (error.name !== 'AbortError') showFeedback('Info donasi belum dapat dibagikan.');
  }
});
