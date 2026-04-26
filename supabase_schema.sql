-- ==========================================
-- SI PERDI - SUPABASE DATABASE SCHEMA
-- ==========================================
-- Deskripsi: Skema database untuk sistem presensi otomatis berbasis QR/Barcode & OCR.
-- Cara Penggunaan: Salin dan jalankan di SQL Editor Dashboard Supabase Anda.

-- 1. CLEANUP (Hapus tabel lama jika ada)
DROP TABLE IF EXISTS public.presensi CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;

-- 2. TABEL MAHASISWA (Data Master Mahasiswa)
CREATE TABLE public.students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    npm TEXT UNIQUE NOT NULL,                       -- NPM format standar (e.g., 202143501234)
    name TEXT NOT NULL,                             -- Nama Lengkap Mahasiswa
    barcode_id TEXT UNIQUE NOT NULL,                -- ID unik dari Barcode KTM
    major TEXT DEFAULT '-',                         -- Program Studi
    face_descriptor DOUBLE PRECISION[],             -- Array untuk menyimpan embedding wajah (128-dim)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing untuk pencarian cepat saat scan barcode/NPM
CREATE INDEX idx_students_barcode ON public.students(barcode_id);
CREATE INDEX idx_students_npm ON public.students(npm);

-- 3. TABEL MATA KULIAH / JADWAL (Data Master Jadwal)
CREATE TABLE public.courses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    day_name TEXT NOT NULL,                         -- 'Senin', 'Selasa', dsb.
    subject_name TEXT NOT NULL,                     -- Nama Mata Kuliah
    time_start TIME NOT NULL,                       -- Jam Mulai (e.g., 12:00:00)
    time_end TIME NOT NULL,                         -- Jam Selesai
    room TEXT DEFAULT '-',                          -- Ruangan Kelas
    sks INTEGER DEFAULT 0,                          -- Jumlah SKS
    lecturer TEXT DEFAULT '-',                      -- Nama Dosen Pengampu
    phone TEXT,                                     -- WhatsApp Dosen (format 62...)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_courses_day ON public.courses(day_name);

-- 4. TABEL PRESENSI (Log Transaksi Kehadiran)
CREATE TABLE public.presensi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    course_id BIGINT REFERENCES public.courses(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alfa')),
    lat DOUBLE PRECISION,                           -- Geolocation Latitude
    lng DOUBLE PRECISION,                           -- Geolocation Longitude
    waktu_scan TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing untuk laporan real-time
CREATE INDEX idx_presensi_student ON public.presensi(student_id);
CREATE INDEX idx_presensi_course ON public.presensi(course_id);
CREATE INDEX idx_presensi_date ON public.presensi(waktu_scan);

-- 5. KEAMANAN (Row Level Security)
-- Catatan: Untuk aplikasi internal pendidikan ini, kita izinkan publik (anon) akses penuh.
-- Di lingkungan produksi profesional, disarankan menambahkan autentikasi.

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presensi ENABLE ROW LEVEL SECURITY;

-- Policy Students: Izin akses CRUD publik
CREATE POLICY "Public Students Access" ON public.students FOR ALL USING (true) WITH CHECK (true);

-- Policy Courses: Izin akses CRUD publik
CREATE POLICY "Public Courses Access" ON public.courses FOR ALL USING (true) WITH CHECK (true);

-- Policy Presensi: Izin akses CRUD publik
CREATE POLICY "Public Presensi Access" ON public.presensi FOR ALL USING (true) WITH CHECK (true);

-- 6. DOKUMENTASI TABEL
COMMENT ON TABLE public.students IS 'Data master profil mahasiswa.';
COMMENT ON TABLE public.courses IS 'Data master jadwal perkuliahan.';
COMMENT ON TABLE public.presensi IS 'Log kehadiran mahasiswa per mata kuliah.';
