# Ibnu Masyurf App - Aplikasi Kajian Sunnah Multimedia (Audio & Video)

Aplikasi web modern dan terpadu untuk menyimak **Kajian Sunnah, Siaran Radio Dakwah Ahlus Sunnah, dan 20 Saluran TV Sunnah Populer** di Indonesia, dilengkapi integrasi **LocalStorage** permanen untuk riwayat pemutaran (*play history*), bookmark favorit, catatan faidah ilmiah, dan sleep timer.

---

## 🌟 Sumber Rujukan Terpercaya

1. **Daftar Radio Dakwah Islam Ahlus Sunnah**:
   - Rujukan: [Abu Ayaz's Blog - Daftar Radio Dakwah Islam Ahlus Sunnah di Indonesia](https://abuayaz.blogspot.com/2011/03/daftar-radio-dakwah-islam-ahlus-sunnah.html)
   - Dan streaming server resmi **Radio Islam Indonesia (RII)**.
   - *Stasiun Unggulan*: Radio Rodja 756 AM, Radio Riyadhul Jannah 104.5 FM Tasikmalaya, Radio Rodja Bandung 104.3 FM, Radio Rodja Majalengka, Radio Tarbiyah Sunnah 1476 AM Bandung, Radio Suara Al-Iman 846 AM Surabaya, Radio Muslim Sleman Yogyakarta, Radio Bass FM Salatiga, Radio Hidayah FM Pekanbaru, Radio Hang FM Batam, Radio Muadz Kendari, Radio An-Nashihah Makassar, Radio Qur'an 24 Jam, dll.

2. **Daftar Saluran TV Sunnah Populer (20 Saluran Lengkap)**:
   - Rodja TV
   - MGI TV (Media Gema Islam - Tasikmalaya)
   - Insan TV
   - Ashiil TV
   - Surau TV
   - Ahsan TV
   - Muadz TV
   - Naajiya TV
   - Hijrah TV
   - Al-Iman TV
   - Niaga TV
   - Salam TV
   - Puldapii TV
   - TV Sunnah
   - Sunnah Jalan Pasti TV (SJP)
   - Bin Baz TV
   - Media Sunnah Aceh TV (MedS.TV)
   - Al-Furqon TV
   - Rasyaad TV
   - Dei Kids TV (khusus anak)

3. **Kajian Ilmiah Audio MP3 On-Demand**:
   - Rujukan: [Kajian.net - Ceramah Islam MP3 Terlengkap](https://kajian.net/)
   - Menampilkan rekaman kajian ilmiah para Asatidzah Ahlussunnah (Ustadz Yazid bin Abdul Qadir Jawas, Ustadz Abdul Hakim bin Amir Abdat, Ustadz Dr. Firanda Andirja, Ustadz Dr. Syafiq Riza Basalamah, Ustadz Dr. Khalid Basalamah, Ustadz Dr. Erwandi Tarmizi, Ustadz Abu Yahya Badrusalam, Ustadz Ahmad Zainuddin, Ustadz Abdullah Roy, Ustadz Abu Haidar As-Sundawy, Ustadz Subhan Bawazier, Ustadz Muhammad Nuzul Dzikri).
   - Fitur streaming langsung dan unduh (*download*) MP3 resmi.

---

## 💾 Integrasi LocalStorage Browser (Permanen)

Aplikasi mengimplementasikan **LocalStorage Engine** tanpa batasan kedaluwarsa sehingga data tetap tersimpan selama penyimpanan browser tidak dibersihkan secara manual:

1. **Riwayat Pemutaran (Play History)**:
   - Mencatat otomatis stasiun radio, saluran TV, dan audio ceramah yang diputar.
   - Menyimpan judul, asatidzah/stasiun, tanggal, jumlah pemutaran (*play count*), dan jenis media.
   - Tombol **"Lanjutkan Terakhir Diputar" (Resume)** di bagian Beranda dan header.
   - Opsi filter riwayat (Semua, Radio, TV, Audio, Video) dan tombol hapus individual atau seluruh riwayat.

2. **Koleksi Favorit (Bookmarks)**:
   - Menandai stasiun radio, saluran TV, atau audio dengan ikon bintang (★).
   - Muncul di tab "Riwayat & Favorit" > "Favorit Tersimpan".

3. **Catatan Faidah Kajian (Study Notes)**:
   - Menulis faidah, ayat, hadits, atau poin penting ketika sedang menyimak kajian langsung di aplikasi.
   - Disimpan secara lokal dan dapat disunting (*edit*) atau dihapus kapan saja.

4. **Pengaturan Pemutar**:
   - Volume suara, kecepatan putar (*playback speed* 0.75x hingga 2.0x), dan sleep timer.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi dibangun menggunakan arsitektur web modern **HTML5, Vanilla CSS3 (Luxury Islamic Dark Theme & Glassmorphism), dan Modular JavaScript (ES6 Modules)** tanpa ketergantungan rumit.

### Opsi 1: Menjalankan dengan Node.js (Rekomendasi)
```bash
npm run dev
```
atau
```bash
npx -y serve . -l 3000
```
Buka browser pada: `http://localhost:3000`

### Opsi 2: Menggunakan Python Web Server
```bash
python -m http.server 3000
```

---

## 📁 Struktur Direktori Proyek

```
Ibnu Masyurf App/
├── index.html            # Halaman utama aplikasi (Hero, TV Theater, Radio, Kajian, Dzikir)
├── index.css             # Desain luxury Islamic dark mode, glassmorphism & visualizer
├── app.js                # Core controller, audio streaming, TV theater, LocalStorage engine
├── data/
│   ├── radios.js         # Database stasiun radio dakwah sunnah & live stream URLs (termasuk Radio Riyadhul Jannah)
│   ├── tvChannels.js     # Database 20 saluran TV Sunnah populer (termasuk MGI TV Tasikmalaya)
│   ├── kajianAudio.js    # Database ceramah MP3 dari Kajian.net (streaming & download)
│   ├── kajianVideo.js    # Database video kajian pilihan & edukasi anak Dei Kids TV
│   └── dzikir.js         # Dzikir pagi petang shahih & atsar mutiara salaf
├── package.json          # Konfigurasi npm script dev & start
├── manifest.json         # Manifest PWA (name, icons, standalone display, shortcuts)
├── sw.js                 # Service Worker PWA (caching app shell & offline fallback)
├── .nojekyll             # Bypass Jekyll preprocessing pada GitHub Pages
├── .github/workflows/
│   └── deploy.yml        # GitHub Actions CI/CD otomatis deploy ke GitHub Pages
├── icons/                # Ikon resolusi tinggi (SVG, PNG 192x192, 512x512, apple-touch)
└── README.md             # Dokumentasi teknis aplikasi
```

---

## 🌐 Akses Online & PWA (GitHub Pages)

- **Repository**: [https://github.com/maisya-portal/ibnumasyruf.git](https://github.com/maisya-portal/ibnumasyruf.git)
- **Live URL**: [https://maisya-portal.github.io/ibnumasyruf/](https://maisya-portal.github.io/ibnumasyruf/)

### 📲 Instalasi Progressive Web App (PWA)

Aplikasi ini mendukung penuh standar **Progressive Web App (PWA)**:
1. **Android (Chrome/Edge)**: Klik tombol **"Install App"** di pojok kanan atas atau buka menu browser lalu pilih *"Tambahkan ke Layar Utama / Install App"*.
2. **iOS (Safari)**: Buka tautan di Safari, tekan tombol *Bagikan (Share)* -> pilih *"Tambahkan ke Layar Utama (Add to Home Screen)"*.
3. **Desktop (Windows/Mac/Linux)**: Klik ikon Install di address bar Chrome atau Edge untuk memasang aplikasi sebagai aplikasi mandiri di desktop Anda.


---

*Alhamdulillah, semoga aplikasi ini menjadi ladang amal jariyah dan memudahkan kaum muslimin dalam menuntut ilmu syar'i di manapun berada.*
