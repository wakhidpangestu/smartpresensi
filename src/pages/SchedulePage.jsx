import React, { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, User, MessageCircle, Calendar, Coffee, RefreshCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './SchedulePage.css';

// New Flat Structure matching the upgraded database schema
// Constants moved outside component to prevent re-creation
const DEFAULT_COURSES = [
  { day_name: 'Senin', subject_name: 'Sistem Basis Data', time_start: '12:00:00', time_end: '13:40:00', room: 'R 5.5.2', sks: 2, lecturer: 'Nila Rusiardi Jayanti, S.Kom., M.Kom', phone: '6281311652979' },
  { day_name: 'Senin', subject_name: 'Praktikum Sistem Basis Data', time_start: '13:40:00', time_end: '14:30:00', room: 'R 5.5.2', sks: 1, lecturer: 'Nila Rusiardi Jayanti, S.Kom., M.Kom', phone: '6281311652979' },
  { day_name: 'Selasa', subject_name: 'Arisitektur dan Organisasi Komputer', time_start: '12:00:00', time_end: '14:30:00', room: 'R 7.4.6', sks: 3, lecturer: 'Andi Prastomo, S.Kom., M.Kom', phone: '6289673435470' },
  { day_name: 'Selasa', subject_name: 'Metode Numerik', time_start: '14:30:00', time_end: '17:00:00', room: 'R 7.4.6', sks: 3, lecturer: 'Rifki Ristiawan, S.Pd., M.Msi', phone: '6285780051361' },
  { day_name: 'Kamis', subject_name: 'Aljabar Linier dan Matrik', time_start: '12:00:00', time_end: '14:30:00', room: 'R 7.4.6', sks: 3, lecturer: 'Muslihatul Hidayah, S.Pd., M.Pd', phone: '6281228929988' },
  { day_name: 'Kamis', subject_name: 'Manajemen Proyek', time_start: '14:30:00', time_end: '17:00:00', room: 'R 7.4.6', sks: 3, lecturer: 'Juliana, S.Kom., M.T', phone: '628999308740' },
  { day_name: 'Jumat', subject_name: 'Sejarah Pendidikan dan PGRI', time_start: '07:30:00', time_end: '09:10:00', room: 'R 7.4.6', sks: 2, lecturer: 'Septa Wati, S.Pd., M.Pd', phone: '6281212405217' },
  { day_name: 'Jumat', subject_name: 'Fisika Listrik Magnet', time_start: '09:10:00', time_end: '10:50:00', room: 'R 7.4.6', sks: 2, lecturer: 'Alhidayatuddiniyah T.W, S.Si., M.Si', phone: '6285770249979' },
];

const DAYS_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const SchedulePage = () => {
  const [groupedSchedule, setGroupedSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const groupDataByDay = useCallback((data) => {
    const grouped = {};
    DAYS_ORDER.forEach(day => {
      grouped[day] = data.filter(item => item.day_name === day);
    });
    return grouped;
  }, []);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('time_start', { ascending: true });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setGroupedSchedule(groupDataByDay(data));
      } else {
        setGroupedSchedule(groupDataByDay(DEFAULT_COURSES));
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setGroupedSchedule(groupDataByDay(DEFAULT_COURSES)); 
    } finally {
      setLoading(false);
    }
  }, [groupDataByDay]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleSyncToSupabase = async () => {
    setSyncing(true);
    try {
      // Delete old data
      await supabase.from('courses').delete().neq('id', 0);
      
      // Insert new flat data
      const { error: insertError } = await supabase
        .from('courses')
        .insert(DEFAULT_COURSES);

      if (insertError) throw insertError;
      alert("Sinkronisasi jadwal ke tabel 'courses' berhasil!");
      fetchSchedules();
    } catch (err) {
      console.error("Sync error:", err);
      alert(`Gagal sinkron: ${err.message || "Tabel 'courses' mungkin belum dibuat di Supabase."}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleWhatsApp = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // Helper for time display
  const formatTimeRange = (start, end) => {
    return `${start.substring(0, 5)} - ${end.substring(0, 5)}`;
  };

  return (
    <div className="schedule-container animate-fade-in">
      <div className="schedule-hero">
        <div className="hero-badge">
          <Calendar size={16} />
          <span>Semester Genap 2025/2026</span>
        </div>
        <h1>Jadwal <span>Perkuliahan</span></h1>
        <p className="subtitle">Data terintegrasi untuk sistem presensi otomatis</p>
        
        {!import.meta.env.PROD && (
          <button 
            className={`sync-trigger-btn ${syncing ? 'loading' : ''}`}
            onClick={handleSyncToSupabase}
            disabled={syncing}
          >
            <RefreshCcw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sedang Menyinkronkan...' : 'Upgrade Database & Sync'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="schedule-loading">
          <div className="loader-dots"><span></span><span></span><span></span></div>
          <p>Memuat Jadwal...</p>
        </div>
      ) : (
        <div className="days-stack">
          {DAYS_ORDER.map((day) => {
            const courses = groupedSchedule[day] || [];
            if (courses.length === 0 && day === 'Rabu') {
                return (
                    <div key={day} className="day-section day-off">
                      <div className="day-header">
                        <h2>{day}</h2>
                        <span className="off-badge">
                            <Coffee size={14} /> Libur
                        </span>
                      </div>
                    </div>
                );
            }
            if (courses.length === 0) return null;

            return (
              <div key={day} className="day-section">
                <div className="day-header">
                  <h2>{day}</h2>
                </div>

                <div className="courses-grid">
                  {courses.map((course, cIdx) => (
                    <div key={course.id || cIdx} className="course-card glass-panel">
                      <div className="course-main">
                        <div className="course-time-box">
                          <Clock size={16} />
                          <span>{formatTimeRange(course.time_start, course.time_end)}</span>
                        </div>
                        <h3>{course.subject_name}</h3>
                        <div className="course-meta">
                          <span className="meta-item">
                            <MapPin size={14} />
                            {course.room}
                          </span>
                          <span className="meta-divider">•</span>
                          <span className="meta-item">
                            <strong>SKS:</strong> {course.sks}
                          </span>
                        </div>
                      </div>

                      <div className="course-footer">
                        <div className="lecturer-info">
                          <div className="lecturer-avatar">
                            <User size={18} />
                          </div>
                          <div className="lecturer-text">
                            <p>{course.lecturer}</p>
                          </div>
                        </div>
                        {course.phone && (
                          <button 
                            className="wa-button-mini" 
                            onClick={() => handleWhatsApp(course.phone)}
                            title="Chat WhatsApp"
                          >
                            <MessageCircle size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!import.meta.env.PROD && (
        <div className="schedule-footer-hint">
          <p>⚠️ Pastikan Anda sudah menjalankan SQL Script terbaru di dashboard Supabase sebelum menekan tombol Sync.</p>
        </div>
      )}
    </div>
  );
};

export default SchedulePage;
