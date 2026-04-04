import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Printer, Calendar, Users, CheckCircle, XCircle, BookOpen } from 'lucide-react';
import './ReportPage.css';

const ReportPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date] = useState(new Date());

  const fetchReport = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const { data: students, error: studentError } = await supabase
        .from('students')
        .select('*')
        .order('npm', { ascending: true });

      if (studentError) throw studentError;

      const todayString = date.toISOString().split('T')[0];
      const { data: presensi, error: presensiError } = await supabase
        .from('presensi')
        .select(`*, courses (subject_name)`)
        .gte('waktu_scan', `${todayString}T00:00:00.000Z`)
        .lte('waktu_scan', `${todayString}T23:59:59.999Z`);

      if (presensiError) throw presensiError;

      const mergedData = students.map(student => {
        const studentAttendance = presensi.filter(p => p.student_id === student.id);
        return {
          ...student,
          attendanceRecords: studentAttendance.length > 0 ? studentAttendance : null,
          status: studentAttendance.length > 0 ? studentAttendance[0].status : 'Alfa',
          courseName: studentAttendance.length > 0 
                      ? studentAttendance.map(p => p.courses?.subject_name).join(', ') 
                      : 'Belum Scan',
          timestamp: studentAttendance.length > 0 
                      ? new Date(studentAttendance[0].waktu_scan).toLocaleTimeString('id-ID', { hour12: false })
                      : '-'
        };
      });

      setData(mergedData);
    } catch (error) {
      console.error("Failed to load report", error);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchReport(true);
    // Sinkronisasi Real-Time Otomatis setiap 10 detik
    const interval = setInterval(() => fetchReport(false), 10000); 
    return () => clearInterval(interval);
  }, [fetchReport]);

  const formattedDate = date.toLocaleDateString('id-ID', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  const presentCount = data.filter(d => d.attendanceRecords !== null).length;
  const absentCount = data.filter(d => d.attendanceRecords === null).length;

  return (
    <div className="report-container">
      <div className="report-header glass-panel">
        <div className="report-title-section">
          <Calendar size={32} className="accent-icon" />
          <div>
            <h1>Laporan Kehadiran Mahasiswa</h1>
            <p className="subtitle">Real-time Data Sync Enabled • {formattedDate}</p>
            <p className="subtitle">Kelas: <strong>R4M</strong></p>
          </div>
        </div>

        {/* Logo Kampus (Ganti URL src dengan logo asli Anda) */}
        <div className="campus-logo-container">
            <img 
                src="/Logo_Universitas_Indraprasta_PGRI_(UNINDRA).png" 
                alt="Logo Unindra" 
                className="campus-logo" 
            />
        </div>

        <div className="report-header-actions">
             <button className="glass-button primary print-action" onClick={() => window.print()}>
               <Printer size={20} /> Cetak Laporan
             </button>
        </div>
      </div>

      <div className="report-stats">
        <div className="stat-card glass-panel">
          <Users size={24} />
          <div className="stat-info">
            <span className="stat-value">{data.length}</span>
            <span className="stat-label"> Terdaftar</span>
          </div>
        </div>
        <div className="stat-card glass-panel success">
          <CheckCircle size={24} />
          <div className="stat-info">
            <span className="stat-value">{presentCount}</span>
            <span className="stat-label"> Hadir</span>
          </div>
        </div>
        <div className="stat-card glass-panel danger">
          <XCircle size={24} />
          <div className="stat-info">
            <span className="stat-value">{absentCount}</span>
            <span className="stat-label"> Alfa</span>
          </div>
        </div>
      </div>

      <div className="calendar-grid glass-panel">
        {loading && data.length === 0 ? (
          <div className="loading-state">Menyingkronkan data...</div>
        ) : (
          <div className="table-responsive">
            <table className="google-calendar-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>NPM</th>
                  <th>Nama Mahasiswa</th>
                  <th>Program Studi</th>
                  <th>Keterangan Sesi</th>
                  <th>Waktu Scan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>{row.npm}</td>
                    <td className="font-medium">{row.name}</td>
                    <td className="sub-text-cell">{row.major || '-'}</td>
                    <td className="course-cell">
                        {row.courseName}
                    </td>
                    <td>{row.timestamp}</td>
                    <td>
                      <span className={`status-badge ${row.status.toLowerCase()}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
