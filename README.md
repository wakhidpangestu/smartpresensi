# 🚀 Si Perdi (SmartPresensi Digital)

**Si Perdi** adalah sistem manajemen kehadiran mahasiswa modern yang dirancang untuk efisiensi, akurasi, dan estetika. Nama **"Si Perdi"** sendiri merupakan plesetan kreatif dari **SiPreDI** yang merupakan singkatan dari **Sistem Presensi Digital**.

Aplikasi ini hadir sebagai solusi untuk menggantikan metode absensi manual yang lambat dan rentan kecurangan. Dengan mengombinasikan teknologi pemindaian biometrik wajah dan kode batang (barcode), Si Perdi memastikan setiap data kehadiran tercatat secara valid, real-time, dan terintegrasi langsung dengan jadwal perkuliahan.

---

## ✨ Fitur Utama

Si Perdi dilengkapi dengan berbagai fitur canggih yang dirancang untuk platform mobile dan desktop:

*   **👤 Dual-Mode Scanner (Face & Barcode)**:
    *   **Face Recognition**: Menggunakan AI untuk mengenali wajah mahasiswa secara instan. Fitur ini berfungsi sebagai validasi biometrik untuk mencegah penitipan absen.
    *   **High-Speed Barcode Scanner**: Pemindaian Barcode/QR Code pada Kartu Tanda Mahasiswa (KTM) dengan algoritma stabilisasi kamera untuk performa cepat.
*   **🧠 Neural OCR KTM Registration**: Pendaftaran mahasiswa tanpa input manual yang membosankan. Cukup pindai KTM, dan sistem akan mengekstrak NPM, Nama, dan Program Studi secara otomatis menggunakan teknologi *Optical Character Recognition* (OCR) yang cerdas.
*   **📅 Intelligent Schedule System**: Sistem secara dinamis mendeteksi mata kuliah yang sedang aktif berdasarkan hari dan jam real-time. Jika tidak ada jadwal, sistem akan memberikan notifikasi yang sesuai.
*   **📊 Real-time Monitoring & Reporting**: Dashboard laporan yang diperbarui secara otomatis (Real-time Sync) setiap kali ada data masuk. Memudahkan dosen dalam memantau statistik kehadiran (Hadir, Terlambat, Alfa).
*   **📄 Ultra-Compact PDF Export**: Fitur cetak laporan dengan layout khusus yang dioptimalkan untuk kertas A4, lengkap dengan area tanda tangan dosen dan desain yang bersih untuk keperluan arsip fisik.
*   **📱 Progressive Web App (PWA) iOS Optimized**:
    *   Aplikasi dapat diinstal langsung ke layar utama iPhone/iPad melalui Safari.
    *   Dilengkapi dengan **iOS-Style Install Prompt** yang memandu pengguna langkah demi langkah.
    *   Mendukung *standalone mode* untuk pengalaman aplikasi native tanpa bar navigasi browser.
*   **📳 Audio-Tactile Haptics**: Memberikan umpan balik berupa getaran (haptics) dan suara klik premium ala iOS setiap kali ada interaksi atau proses scan berhasil.

---

## 🛠️ Tech Stack

Dibalik antarmuka yang elegan, Si Perdi dibangun menggunakan teknologi mutakhir:

*   **React.js (Vite)**: Framework JavaScript paling populer untuk membangun antarmuka pengguna yang responsif. Menggunakan Vite sebagai *build tool* untuk kecepatan performa pengembangan yang maksimal.
*   **Supabase**: Backend-as-a-Service (BaaS) berbasis PostgreSQL. Supabase menangani database, autentikasi, dan fitur *real-time subscription* yang memungkinkan data tersinkronisasi tanpa refresh halaman.
*   **Vanilla CSS (Liquid Glass UI)**: Desain antarmuka menggunakan CSS murni dengan pendekatan *Glassmorphism* (efek kaca transparan) untuk memberikan kesan premium, bersih, dan modern.
*   **Face-api.js**: Library berbasis TensorFlow.js untuk deteksi dan pengenalan wajah langsung di browser menggunakan sistem saraf tiruan (*neural networks*).
*   **Tesseract.js**: Engine OCR (Optical Character Recognition) berbasis web yang digunakan untuk membaca teks dari gambar KTM secara otomatis.
*   **Html5-QRCode**: Library pemindaian kode batang dan QR code lintas platform yang ringan dan andal.
*   **Framer Motion**: Library animasi untuk React yang digunakan untuk menciptakan transisi halaman dan elemen UI yang halus dan hidup.
*   **Lucide React**: Koleksi ikon minimalis yang konsisten digunakan di seluruh aplikasi.

---

## 🗄️ Arsitektur Database

Si Perdi menggunakan struktur database relasional yang dioptimalkan untuk kecepatan kueri dan integritas data.

### Schema Diagram
![Database Schema](./public/drawSQL-image-export-2026-04-12.jpg)

### Detail Tabel & Relasi

1.  **Tabel `students` (Master Data Mahasiswa)**:
    *   **Fungsi**: Menyimpan profil lengkap mahasiswa.
    *   **Kolom Kunci**: `npm` (Unik), `barcode_id` (Unik untuk identifikasi KTM), dan `face_descriptor` (Data biometrik wajah dalam bentuk array angka).
2.  **Tabel `courses` (Master Data Jadwal)**:
    *   **Fungsi**: Menyimpan jadwal perkuliahan harian.
    *   **Kolom Kunci**: Menyimpan data `day_name`, `time_start`, `time_end`, nama dosen, dan kontak WhatsApp.
3.  **Tabel `presensi` (Transaksi Kehadiran)**:
    *   **Fungsi**: Mencatat riwayat kehadiran setiap kali mahasiswa melakukan pemindaian.
    *   **Relasi**: 
        *   Tersambung ke `students` melalui `student_id` (Many-to-One).
        *   Tersambung ke `courses` melalui `course_id` (Many-to-One).
    *   **Logika Bisnis**: Status (Hadir/Terlambat) dihitung secara otomatis berdasarkan perbandingan `waktu_scan` dengan `time_start` mata kuliah.

---

## ⚙️ Cara Instalasi

1.  **Clone Repositori**:
    ```bash
    git clone https://github.com/wakhidpangestu/smartpresensi.git
    cd smartpresensi
    ```

2.  **Install Dependensi**:
    ```bash
    npm install
    ```

3.  **Konfigurasi Environment**:
    Buat file `.env` di root folder:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Jalankan Mode Pengembangan**:
    ```bash
    npm run dev
    ```

---

## 👤 Kontributor
*   **Wakhid Pangestu** - Lead Developer & UI Designer
*   **Development Tools**: React, Supabase, Lucide, Framer Motion.

---
*Si Perdi - Smart Presence for a Smarter Campus.* ❤️
