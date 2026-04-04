-- SQL Schema for SmartPren Application (Clean & Connected Version)
-- Copy and run this in your Supabase SQL Editor

-- 1. DROP ALL OLD TABLES TO REMOVE CONFLICTS
DROP TABLE IF EXISTS public.presensi;
DROP TABLE IF EXISTS public.attendance;
DROP TABLE IF EXISTS public.schedules;
DROP TABLE IF EXISTS public.courses;
DROP TABLE IF EXISTS public.students;

-- 2. CREATE STUDENTS TABLE (Source of Truth for Students)
CREATE TABLE public.students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barcode_id TEXT UNIQUE NOT NULL,
    npm TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    major TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREATE COURSES TABLE (Source of Truth for Schedule)
CREATE TABLE public.courses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    day_name TEXT NOT NULL,           -- 'Senin', 'Selasa', etc.
    subject_name TEXT NOT NULL,
    time_start TIME NOT NULL,
    time_end TIME NOT NULL,
    room TEXT,
    sks INTEGER,
    lecturer TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREATE PRESENSI TABLE (Connecting Students to Courses)
CREATE TABLE public.presensi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    course_id BIGINT REFERENCES public.courses(id) ON DELETE CASCADE,
    waktu_scan TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpha')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SETUP RELIABLE RLS POLICIES
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presensi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All Students" ON public.students;
CREATE POLICY "Allow All Students" ON public.students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow All Courses" ON public.courses;
CREATE POLICY "Allow All Courses" ON public.courses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow All Presensi" ON public.presensi;
CREATE POLICY "Allow All Presensi" ON public.presensi FOR ALL USING (true) WITH CHECK (true);
