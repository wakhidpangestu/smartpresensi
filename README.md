# 🚀 SmartPresensi: Smart Attendance System

**SmartPresensi** adalah aplikasi manajemen kehadiran mahasiswa modern yang menggabungkan teknologi **Neural OCR** dan **Barcode Scanning**. Dirancang dengan estetika *Liquid Glass* (Glassmorphism), sistem ini memungkinkan pendaftaran mahasiswa secara otomatis dari KTM dan pencatatan presensi yang sinkron secara real-time dengan database.

---

## ✨ Fitur Unggulan

*   **🔍 High-Tolerance Barcode Scanner**: Pemindaian barcode 1D/2D secara cepat dengan filter stabilisasi kamera.
*   **🧠 Neural OCR KTM**: Pendaftaran mahasiswa tanpa input manual. Cukup foto kartu mahasiswa (KTM), dan sistem akan mengekstrak NPM, Nama, dan Program Studi secara otomatis menggunakan *pattern matching* cerdas.
*   **📅 Integrated Schedule System**: Deteksi otomatis mata kuliah yang sedang aktif berdasarkan jam dan hari saat ini.
*   **📊 Real-time Reporting & Sync**: Laporan kehadiran yang diperbarui secara otomatis setiap kali ada mahasiswa yang melakukan scan.
*   **📄 Ultra-Compact PDF Export**: Fitur cetak laporan dengan desain mikro yang sangat efisien, modern, dan siap untuk arsip fisik.
*   **📱 Fully Responsive**: Antarmuka yang adaptif untuk penggunaan di HP (Scanner) maupun Desktop (Laporan/Admin).

---

## 🛠️ Tech Stack

*   **Frontend**: React.js (Vite)
*   **Backend / Database**: Supabase (PostgreSQL)
*   **Detection Engine**: 
    *   `Tesseract.js` (OCR Logic)
    *   `Html5-QRCode` (Barcode Scanning)
*   **Icons**: `Lucide React`
*   **Styling**: Vanilla CSS (Custom Glassmorphism UI)
*   **State Management**: React Hooks (useState, useEffect, useRef, useCallback)

---

## 📸 Visual Tour

> *Silakan masukkan screenshot Anda pada bagian ini.*

| Scanner Page | Registration Page |
| :---: | :---: |
| ![Scanner](./scanner_placeholder.png) | ![Registration](./registration_placeholder.png) |
| *Status Deteksi Real-time* | *Alur OCR KTM* |

| Schedule Page | Report Page |
| :---: | :---: |
| ![Schedule](./schedule_placeholder.png) | ![Report](./report_placeholder.png) |
| *Manajemen Mata Kuliah* | *Tampilan Laporan & PDF* |

---

## 🗄️ Schema Database

Aplikasi ini menggunakan relasi database PostgreSQL di Supabase dengan skema sebagai berikut:

```sql
-- Tabel Mahasiswa
CREATE TABLE students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barcode_id TEXT UNIQUE NOT NULL,
    npm TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    major TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel Mata Kuliah
CREATE TABLE courses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    day_name TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    time_start TIME NOT NULL,
    time_end TIME NOT NULL,
    room TEXT,
    sks INTEGER,
    lecturer TEXT,
    phone TEXT
);

-- Tabel Presensi (Relational)
CREATE TABLE presensi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    course_id BIGINT REFERENCES courses(id) ON DELETE CASCADE,
    waktu_scan TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL -- 'Hadir', 'Terlambat', 'Izin', dsb.
);
```

---

## ⚙️ Cara Instalasi

1.  **Clone Repositori**:
    ```bash
    git clone https://github.com/username/smartpresensi.git
    cd smartpresensi
    ```

2.  **Install Dependensi**:
    ```bash
    npm install
    ```

3.  **Konfigurasi Environment**:
    Buat file `.env` di root folder dan masukkan kredensial Supabase Anda:
    ```env
    VITE_SUPABASE_URL=https://your-project-url.supabase.co
    VITE_SUPABASE_ANON_KEY=your-anon-key
    ```

4.  **Jalankan Aplikasi**:
    ```bash
    npm run dev
    ```

---

## 👤 Credit
*   **UI/UX Design**: Antigravity (Liquid Glass v3)
*   **Engine**: React + Supabase

---
Developed with ❤️ for Higher Education Efficiency.
