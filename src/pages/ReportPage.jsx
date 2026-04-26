import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Printer, Calendar, CheckCircle, XCircle, Clock, 
  ChevronLeft, ChevronRight, BookOpen, TrendingUp,
  FileText, Search, X, ChevronDown
} from 'lucide-react';
import './ReportPage.css';

// ======================== HELPER FUNCTIONS ========================

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const DAY_ORDER = {
  'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 7
};

const formatDateID = (date) => {
  if (!date) return '-';
  return date.toLocaleDateString('id-ID', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
};

const formatDateShort = (date) => {
  if (!date) return '-';
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].substring(0, 3)} ${date.getFullYear()}`;
};

const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  return d1.getFullYear() === d2.getFullYear() && 
         d1.getMonth() === d2.getMonth() && 
         d1.getDate() === d2.getDate();
};

const isInRange = (date, start, end) => {
  if (!date || !start || !end) return false;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return d >= s && d <= e;
};

const toISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ======================== MINI CALENDAR COMPONENT ========================

const MiniCalendar = ({ selectedStart, selectedEnd, onSelectDate, onSelectRange }) => {
  const [viewDate, setViewDate] = useState(new Date());

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const today = new Date();

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day) => {
    const clicked = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onSelectDate(clicked);
  };

  // Quick range presets
  const setToday = () => {
    const t = new Date();
    onSelectRange(t, t);
  };

  const setThisWeek = () => {
    const t = new Date();
    const dayOfWeek = t.getDay();
    const monday = new Date(t);
    monday.setDate(t.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    onSelectRange(monday, t);
  };

  const setThisMonth = () => {
    const t = new Date();
    const firstDay = new Date(t.getFullYear(), t.getMonth(), 1);
    onSelectRange(firstDay, t);
  };

  const setLast3Months = () => {
    const t = new Date();
    const threeMonthsAgo = new Date(t.getFullYear(), t.getMonth() - 3, t.getDate());
    onSelectRange(threeMonthsAgo, t);
  };

  const setThisSemester = () => {
    const t = new Date();
    // Semester Genap: Feb-Jul, Semester Ganjil: Aug-Jan
    let semesterStart;
    if (t.getMonth() >= 1 && t.getMonth() <= 6) {
      semesterStart = new Date(t.getFullYear(), 1, 1);
    } else {
      semesterStart = new Date(t.getMonth() >= 7 ? t.getFullYear() : t.getFullYear() - 1, 7, 1);
    }
    onSelectRange(semesterStart, t);
  };

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  return (
    <div className="mini-calendar">
      <div className="cal-nav">
        <button className="cal-nav-btn lg-btn" onClick={prevMonth} aria-label="Bulan sebelumnya">
          <ChevronLeft size={16} />
        </button>
        <span className="cal-month-label">
          {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <button className="cal-nav-btn lg-btn" onClick={nextMonth} aria-label="Bulan berikutnya">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="cal-day-names">
        {DAY_NAMES_SHORT.map(d => <span key={d} className="cal-day-name">{d}</span>)}
      </div>

      <div className="cal-grid">
        {calendarDays.map((day, i) => {
          if (day === null) return <span key={`empty-${i}`} className="cal-day empty" />;

          const dateObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
          const isToday = isSameDay(dateObj, today);
          const isStart = isSameDay(dateObj, selectedStart);
          const isEnd = isSameDay(dateObj, selectedEnd);
          const inRange = selectedStart && selectedEnd && isInRange(dateObj, selectedStart, selectedEnd);
          const isFuture = dateObj > today;

          let cls = 'cal-day';
          if (isToday) cls += ' today';
          if (isStart) cls += ' range-start';
          if (isEnd) cls += ' range-end';
          if (inRange && !isStart && !isEnd) cls += ' in-range';
          if (isFuture) cls += ' future';

          return (
            <button 
              key={day} 
              className={cls} 
              onClick={() => !isFuture && handleDayClick(day)}
              disabled={isFuture}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="cal-presets">
        <button className="preset-btn lg-btn" onClick={setToday}>Hari Ini</button>
        <button className="preset-btn lg-btn" onClick={setThisWeek}>Minggu Ini</button>
        <button className="preset-btn lg-btn" onClick={setThisMonth}>Bulan Ini</button>
        <button className="preset-btn lg-btn" onClick={setLast3Months}>3 Bulan</button>
        <button className="preset-btn lg-btn" onClick={setThisSemester}>Semester</button>
      </div>
    </div>
  );
};

// ======================== MAIN REPORT PAGE ========================

const ReportPage = () => {
  const [data, setData] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Date range state
  const [dateStart, setDateStart] = useState(() => new Date());
  const [dateEnd, setDateEnd] = useState(() => new Date());
  const [selectingDate, setSelectingDate] = useState('start'); // 'start' | 'end'
  
  // Filter state
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterModal, setActiveFilterModal] = useState(null); // 'period' | 'course' | 'search' | null



  // Close dropdowns on outside click
  useEffect(() => {
    if (activeFilterModal) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('modal-open');
    }
    return () => { 
      document.body.style.overflow = 'unset';
      document.body.classList.remove('modal-open');
    };
  }, [activeFilterModal]);

  // Fetch courses list
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data: courseData } = await supabase
          .from('courses')
          .select('id, subject_name, day_name, lecturer');
        
        if (courseData) {
          // Sort by day of the week, then by name
          const sorted = [...courseData].sort((a, b) => {
            const orderA = DAY_ORDER[a.day_name] || 99;
            const orderB = DAY_ORDER[b.day_name] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.subject_name.localeCompare(b.subject_name);
          });
          setCourses(sorted);
        }
      } catch (err) {
        console.error('Failed to fetch courses', err);
      }
    };
    fetchCourses();
  }, []);

  // Main data fetch based on filters
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const startISO = `${toISODate(dateStart)}T00:00:00.000Z`;
      const endISO = `${toISODate(dateEnd)}T23:59:59.999Z`;

      let query = supabase
        .from('presensi')
        .select(`*, students (id, npm, name, major), courses (id, subject_name, day_name, lecturer)`)
        .gte('waktu_scan', startISO)
        .lte('waktu_scan', endISO)
        .order('waktu_scan', { ascending: false });

      if (selectedCourseId !== 'all') {
        query = query.eq('course_id', parseInt(selectedCourseId));
      }

      const { data: presensiData, error } = await query;
      if (error) throw error;

      setData(presensiData || []);
    } catch (error) {
      console.error('Failed to load report', error);
    } finally {
      setLoading(false);
    }
  }, [dateStart, dateEnd, selectedCourseId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Calendar date selection logic
  const handleCalendarDateSelect = (date) => {
    if (selectingDate === 'start') {
      setDateStart(date);
      setSelectingDate('end');
    } else {
      setDateEnd(date);
      setSelectingDate('start');
      setActiveFilterModal(null);
    }
  };

  const handleSelectRange = (start, end) => {
    setDateStart(start);
    setDateEnd(end);
    setActiveFilterModal(null);
  };

  // Computed statistics — separate Alfa, Izin, Sakit
  const stats = useMemo(() => {
    const hadir = data.filter(d => d.status === 'Hadir').length;
    const terlambat = data.filter(d => d.status === 'Terlambat').length;
    const izin = data.filter(d => d.status === 'Izin').length;
    const sakit = data.filter(d => d.status === 'Sakit').length;
    const alfa = data.filter(d => d.status === 'Alfa').length;
    return { hadir, terlambat, izin, sakit, alfa, total: data.length };
  }, [data]);

  // Filtered data by search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(row => 
      (row.students?.name || '').toLowerCase().includes(q) ||
      (row.students?.npm || '').toLowerCase().includes(q) ||
      (row.courses?.subject_name || '').toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // Get unique dates in the filtered data for grouping
  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredData.forEach(row => {
      const dateKey = new Date(row.waktu_scan).toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      if (!groups[dateKey]) {
        groups[dateKey] = { date: new Date(row.waktu_scan), rows: [] };
      }
      groups[dateKey].rows.push(row);
    });
    return Object.entries(groups).sort((a, b) => b[1].date - a[1].date);
  }, [filteredData]);

  const selectedCourseName = useMemo(() => {
    if (selectedCourseId === 'all') return 'Semua Mata Kuliah';
    const found = courses.find(c => c.id === parseInt(selectedCourseId));
    return found ? found.subject_name : 'Semua Mata Kuliah';
  }, [selectedCourseId, courses]);

  const dateRangeLabel = useMemo(() => {
    if (isSameDay(dateStart, dateEnd)) {
      return formatDateID(dateStart);
    }
    return `${formatDateShort(dateStart)} — ${formatDateShort(dateEnd)}`;
  }, [dateStart, dateEnd]);

  const handlePrint = () => {
    const printDate = new Date().toLocaleDateString('id-ID', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    });
    const originalTitle = document.title;
    document.title = `Rekap Presensi ${selectedCourseName} ${printDate}`;
    
    // PERF: Small timeout ensures the button active state and UI is settled before print dialog blocks execution
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  return (
    <div className="report-container">
      {/* ========== HEADER ========== */}
      <div className="report-header lg-card">
        <div className="report-title-section">
          <div className="report-icon-wrapper">
            <FileText size={24} strokeWidth={2.2} />
          </div>
          <div className="report-text-block">
            <h1>Rekap Presensi</h1>
            <p className="subtitle">Riwayat Kehadiran Mahasiswa</p>
          </div>
        </div>

        {/* Logo Kampus (Print Only) */}
        <div className="campus-logo-container">
          <img 
            src="/Logo_Universitas_Indraprasta_PGRI_(UNINDRA).png" 
            alt="Logo Unindra" 
            className="campus-logo" 
          />
        </div>

        <button className="lg-btn lg-btn-primary print-action" onClick={handlePrint}>
          <Printer size={16} /> Cetak
        </button>

        {/* Print-only: Period info moved here for better aesthetic */}
        <div className="print-period-info">
          <p>Periode: {dateRangeLabel}</p>
          <p>Mata Kuliah: {selectedCourseName}</p>
          <p>Kelas: <strong>R4M</strong></p>
        </div>
      </div>

      {/* ========== FILTER BAR ========== */}
      <div className="filter-bar lg-card">
        {/* Date Range Picker Trigger */}
        <div className="filter-group">
          <label className="filter-label"><Calendar size={13} /> Periode</label>
          <button 
            className={`filter-trigger lg-btn ${activeFilterModal === 'period' ? 'active' : ''}`}
            onClick={() => { setActiveFilterModal('period'); setSelectingDate('start'); }}
          >
            <Calendar size={14} className="trigger-icon" />
            <span className="trigger-text">{dateRangeLabel}</span>
            <ChevronDown size={14} className="trigger-chevron" />
          </button>
        </div>

        {/* Course Filter Trigger */}
        <div className="filter-group">
          <label className="filter-label"><BookOpen size={13} /> Mata Kuliah</label>
          <button 
            className={`filter-trigger lg-btn ${activeFilterModal === 'course' ? 'active' : ''}`}
            onClick={() => setActiveFilterModal('course')}
          >
            <BookOpen size={14} className="trigger-icon" />
            <span className="trigger-text">{selectedCourseName}</span>
            <ChevronDown size={14} className="trigger-chevron" />
          </button>
        </div>

        {/* Search Trigger */}
        <div className="filter-group">
          <label className="filter-label"><Search size={13} /> Cari</label>
          <button 
            className={`filter-trigger lg-btn ${activeFilterModal === 'search' ? 'active' : ''}`}
            onClick={() => setActiveFilterModal('search')}
          >
            <Search size={14} className="trigger-icon" />
            <span className="trigger-text">{searchQuery || 'Nama / NPM...'}</span>
            <ChevronDown size={14} className="trigger-chevron" />
          </button>
        </div>
      </div>

      {/* ========== FILTER MODAL SYSTEM ========== */}
      {activeFilterModal && (
        <div className="modal-overlay" onClick={() => setActiveFilterModal(null)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {activeFilterModal === 'period' && 'Filter Periode'}
                {activeFilterModal === 'course' && 'Pilih Mata Kuliah'}
                {activeFilterModal === 'search' && 'Cari Mahasiswa'}
              </h3>
              <button className="modal-close-btn" onClick={() => setActiveFilterModal(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {activeFilterModal === 'period' && (
                <div className="modal-calendar-wrap">
                  <div className="calendar-hint">
                    {selectingDate === 'start' ? '📌 Pilih tanggal mulai' : '📌 Pilih tanggal akhir'}
                  </div>
                  <MiniCalendar 
                    selectedStart={dateStart}
                    selectedEnd={dateEnd}
                    onSelectDate={handleCalendarDateSelect}
                    onSelectRange={handleSelectRange}
                  />
                </div>
              )}

              {activeFilterModal === 'course' && (
                <div className="modal-course-list">
                  <button 
                    className={`modal-option ${selectedCourseId === 'all' ? 'active' : ''}`}
                    onClick={() => { setSelectedCourseId('all'); setActiveFilterModal(null); }}
                  >
                    <span className="option-title">Semua Mata Kuliah</span>
                    <span className="option-desc">Tampilkan seluruh riwayat perkuliahan</span>
                  </button>
                  {courses.map(course => (
                    <button 
                      key={course.id}
                      className={`modal-option ${selectedCourseId === String(course.id) ? 'active' : ''}`}
                      onClick={() => { setSelectedCourseId(String(course.id)); setActiveFilterModal(null); }}
                    >
                      <span className="option-title">{course.subject_name}</span>
                      <span className="option-desc">{course.day_name} • {course.lecturer}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeFilterModal === 'search' && (
                <div className="modal-search-wrap">
                  <div className="search-input-field lg-btn">
                    <Search size={18} className="search-field-icon" />
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Masukkan Nama atau NPM..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="modal-search-input"
                    />
                    {searchQuery && (
                      <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <button className="lg-btn lg-btn-primary modal-apply-btn" onClick={() => setActiveFilterModal(null)}>
                    Tampilkan Hasil
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== STATISTICS — 4 cards ========== */}
      <div className="report-stats">
        <div className="stat-card lg-card">
          <div className="stat-icon-wrap total-icon">
            <TrendingUp size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>
        <div className="stat-card lg-card">
          <div className="stat-icon-wrap hadir-icon">
            <CheckCircle size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.hadir}</span>
            <span className="stat-label">Hadir</span>
          </div>
        </div>
        <div className="stat-card lg-card">
          <div className="stat-icon-wrap terlambat-icon">
            <Clock size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.terlambat}</span>
            <span className="stat-label">Terlambat</span>
          </div>
        </div>
        <div className="stat-card lg-card">
          <div className="stat-icon-wrap alfa-icon">
            <XCircle size={18} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.alfa}</span>
            <span className="stat-label">Tidak Hadir</span>
          </div>
        </div>
      </div>

      {/* ========== DATA TABLE ========== */}
      <div className="data-section">
        {loading ? (
          <div className="loading-state lg-card">
            <div className="loader-spinner" />
            <p>Memuat data presensi...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="empty-state lg-card">
            <div className="empty-icon">
              <Calendar size={44} />
            </div>
            <h3>Tidak Ada Data</h3>
            <p>Tidak ditemukan data presensi untuk periode dan filter yang dipilih.</p>
          </div>
        ) : (
          groupedByDate.map(([dateLabel, group]) => (
            <div key={dateLabel} className="date-group">
              <div className="date-group-header">
                <div className="date-badge">
                  <Calendar size={13} />
                  <span>{dateLabel}</span>
                </div>
                <span className="date-count">{group.rows.length} data</span>
              </div>
              <div className="table-card lg-card">
                <div className="table-responsive">
                  <table className="rekap-table">
                    <thead>
                      <tr>
                        <th className="th-no">No</th>
                        <th className="th-npm">NPM</th>
                        <th className="th-name">Nama</th>
                        <th className="th-major">Prodi</th>
                        <th className="th-course">Mata Kuliah</th>
                        <th className="th-time">Waktu</th>
                        <th className="th-status">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row, index) => (
                        <tr key={row.id}>
                          <td className="td-no">{index + 1}</td>
                          <td className="td-npm">{row.students?.npm || '-'}</td>
                          <td className="td-name">{row.students?.name || '-'}</td>
                          <td className="td-major">{row.students?.major || '-'}</td>
                          <td className="td-course">{row.courses?.subject_name || '-'}</td>
                          <td className="td-time">
                            {new Date(row.waktu_scan).toLocaleTimeString('id-ID', { 
                              hour: '2-digit', minute: '2-digit', hour12: false 
                            })}
                          </td>
                          <td className="td-status">
                            <span className={`status-badge ${row.status.toLowerCase()}`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))
        )}
      </div>



      {/* Print-only Signature */}
      <div className="print-signature-only">
        <div className="signature-box">
          <p>Dosen Pengampu,</p>
          <div className="signature-space"></div>
          <p className="signature-line">..........................................</p>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
