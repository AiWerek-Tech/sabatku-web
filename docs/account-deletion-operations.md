# Operasi permintaan hapus akun SabatKu

8 November 2026. **Runbook untuk pengembang/operator berwenang; belum merupakan bukti uji penghapusan end-to-end.** Tidak ada penghapusan dijalankan saat menyusun dokumen ini.

## Jalur dan ekspektasi pengguna

- Source web: `site/delete-account/index.html`; permintaan dikirim ke inbox privat yang tercantum pada halaman.
- Tombol menyiapkan draft. Pengguna harus mengirimnya sendiri; membuka draft atau menerima email belum berarti penghapusan selesai.
- Jika alamat akun tidak dapat diakses, operator memerlukan bukti kepemilikan alternatif yang diverifikasi secara independen. Nama, alamat From, screenshot atau ID tiket saja tidak cukup.
- Jangan meminta password Google, kode masuk/2FA, isi catatan, token atau berkas cadangan. Simpan korespondensi dan bukti operasional di tempat terbatas; jangan memasukkannya ke repo publik, grup WhatsApp atau laporan audit yang dipublikasikan.
- Profil perangkat tanpa Google tidak membuat akun cloud. Penghapusan server tidak menghapus akun Google, unduhan, berkas ekspor atau salinan perangkat pengguna.

## Urutan operasi

1. Catat ID permintaan tanpa menyalin data pribadi ke log publik. Pastikan permintaan memang ditujukan ke SabatKu dan bukan permintaan menutup akun Google.
2. Cari Firebase Authentication user yang sesuai di project/package yang benar. Hentikan proses jika identitas atau lingkungan ambigu. Jangan menyimpulkan UID dari nama tampilan.
3. Kirim tantangan verifikasi melalui alamat yang terverifikasi dalam record Authentication atau mekanisme alternatif yang disetujui. Tantangan bukan kode login Google. Verifikasi balasan dan masa berlaku sebelum melakukan tindakan data.
4. Ikuti target yang ditetapkan pemilik: balas maksimal **2 hari kerja** sejak permintaan diterima; selesaikan penghapusan maksimal **7 hari kerja** setelah kepemilikan terverifikasi. Catat waktu penerimaan dan verifikasi secara terpisah. Waktu menunggu verifikasi tidak termasuk periode penyelesaian. Batas hukum yang mewajibkan tindakan lebih cepat tetap diikuti; target maksimum bukan alasan menunda tindakan.
5. Setelah terverifikasi, cocokkan ulang **project, UID dan target test/produksi** sebelum bertindak. Ikuti urutan idempotent yang sama dengan `FirebaseAccountRepository.deleteAccount`:
   - Pertahankan atau buat `users/{uid}/account/deletion` dengan `startedAt` timestamp server.
   - Hapus seluruh dokumen `users/{uid}/studyData`, termasuk salinan konflik, melalui batch terbatas sesuai API.
   - Hapus `users/{uid}/profile/main`.
   - Hapus Firebase Authentication user dengan UID yang sama.
6. Verifikasi bahwa Authentication user tidak ada, profil tidak ada dan studyData kosong. Jangan mengirim konfirmasi selesai hanya dari respons sukses satu batch atau dari status halaman email.
7. Pertahankan marker penghapusan agar klien lama tidak mengunggah data lagi. Klien saat ini tidak memasang TTL otomatis. Mengubah retensi marker memerlukan analisis protokol/policy tersendiri; jangan menghapusnya sebagai cleanup rutin.
8. Jika sebagian operasi gagal, simpan tahap dan marker, periksa ulang target, lalu lanjutkan secara aman. Jangan membuka kembali upload atau mengganti pemilik demi menyelesaikan permintaan.
9. Kirim konfirmasi penyelesaian melalui kanal privat yang terverifikasi. Jelaskan data server yang dihapus, pengecualian marker/retensi penyedia dan salinan yang harus dikelola pengguna pada perangkat/ekspor.

Pemeriksaan ini bukan izin menjalankan langkah destruktif pada akun tertentu. Pengujian harus memakai akun khusus yang secara eksplisit diizinkan pemiliknya.

## Bukti uji penerimaan yang harus dicatat

| Skenario | Bukti yang diperlukan | Status pass ini |
|---|---|---|
| Request web/email | Draft benar, pengguna mengirim, inbox operator menerima | TIDAK DIJALANKAN |
| Verifikasi pemilik | Tantangan dan konfirmasi pemilik akun uji valid | TIDAK DIJALANKAN |
| Penghapusan selesai | Auth tidak ada, profil tidak ada, studyData kosong, marker tetap ada | TIDAK DIJALANKAN |
| Salah UID/akun lain | Operasi ditolak sebelum penghapusan target yang salah | TIDAK DIJALANKAN |
| Koneksi terputus/retry | Marker tetap ada dan operasi bisa dilanjutkan pada target sama | TIDAK DIJALANKAN |
| Perangkat lama | Tidak dapat mengunggah kembali data akun yang telah dihapus | TIDAK DIJALANKAN |

Catat hanya metadata minimum yang diperlukan dalam catatan operasi privat: ID permintaan, lingkungan, tahap, waktu verifikasi, operator dan hasil pemeriksaan. Tetapkan pembatasan akses serta retensi korespondensi sebelum layanan dipublikasikan. Jangan mencatat password, bearer token atau isi belajar.

## Kriteria sebelum memakai URL pada Play Console

URL harus dapat dijangkau tanpa login/instal aplikasi, menyebut SabatKu/pengelolanya, menyediakan permintaan yang dapat dikirim, serta menjelaskan cakupan dan retensi. Pada pass ini kedua URL publik merespons HTTP 200; source terbaru masih menunggu publikasi dan pemeriksaan konten sesudah deploy.

Pemilik telah menetapkan target balasan 2 hari kerja dan penyelesaian 7 hari kerja setelah verifikasi. Retensi email dukungan, penanggung jawab inbox, pembuktian pemantauan dan uji akun khusus masih perlu dituntaskan. Pengujian tiket lama yang sebelumnya dilewati tidak dilanjutkan otomatis oleh runbook ini.

[Ketentuan resmi Google Play](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [privasi/retensi Firebase](https://firebase.google.com/support/privacy).
