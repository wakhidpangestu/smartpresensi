import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, RefreshCw, CheckCircle, XCircle, Loader2, Clock, CalendarIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './ScannerPage.css';

const ScannerPage = () => {
  const [time, setTime] = useState(new Date());
  const [dailySchedules, setDailySchedules] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  const [dbStatus, setDbStatus] = useState('connecting'); 
  const [notification, setNotification] = useState(null); 
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  const scannerRef = useRef(null);
  const isScanningRef = useRef(false);
  const lastScanRef = useRef({ time: 0, text: '' });
  const notifTimerRef = useRef(null);
  const activeCourseRef = useRef(null);

  useEffect(() => {
    activeCourseRef.current = activeCourse;
  }, [activeCourse]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchSchedules = useCallback(async () => {
    setDbStatus('connecting');
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const currentDay = dayNames[new Date().getDay()].toLowerCase().trim();

    try {
      const { data, error } = await supabase.from('courses').select('*');
      if (error) throw error;
      
      const filtered = data ? data.filter(c => 
        (c.day_name || '').toLowerCase().trim() === currentDay
      ) : [];
      
      setDailySchedules(filtered);
      setDbStatus(filtered.length > 0 ? 'ready' : (data?.length > 0 ? 'no_today' : 'empty'));
    } catch {
      setDbStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    const nowTotal = time.getHours() * 60 + time.getMinutes();
    const active = dailySchedules.find(course => {
        const startParts = (course.time_start || '').replace(/\./g, ':').split(':');
        const endParts = (course.time_end || '').replace(/\./g, ':').split(':');
        if (startParts.length < 2 || endParts.length < 2) return false;
        const sH = parseInt(startParts[0], 10);
        const sM = parseInt(startParts[1], 10);
        const eH = parseInt(endParts[0], 10);
        const eM = parseInt(endParts[1], 10);
        const startTotal = sH * 60 + sM - 30;
        const endTotal = eH * 60 + eM;
        return nowTotal >= startTotal && nowTotal <= endTotal;
    });

    if (active?.id !== activeCourse?.id) {
      setActiveCourse(active || null);
    }
  }, [time, dailySchedules, activeCourse]);

  const formattedDate = time.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const formattedTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  const showNotification = useCallback((notif) => {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    setNotification(notif);
    if (notif.type !== 'loading') notifTimerRef.current = setTimeout(() => setNotification(null), 5000);
  }, []);

  const handleScan = useCallback(async (decodedText) => {
    const barcodeId = decodedText.trim();
    const now = Date.now();
    if (lastScanRef.current.text === barcodeId && now - lastScanRef.current.time < 5000) return;
    lastScanRef.current = { time: now, text: barcodeId };

    const currentCourse = activeCourseRef.current;
    showNotification({ type: 'loading', title: 'Memproses...', message: `NPM: ${barcodeId}` });

    try {
      const { data: student, error } = await supabase.from('students').select('*').eq('barcode_id', barcodeId).single();
      
      if (error || !student) {
        showNotification({ type: 'error', title: 'Data Gagal', message: `ID "${barcodeId}" tidak ditemukan.` });
        return;
      }

      if (!currentCourse) {
        showNotification({ type: 'error', title: 'Sesi Tidak Aktif', message: 'Sistem tidak mendeteksi jadwal aktif.' });
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: exist } = await supabase.from('presensi').select('id').eq('student_id', student.id).eq('course_id', currentCourse.id).gte('waktu_scan', `${today}T00:00:00.000Z`).lte('waktu_scan', `${today}T23:59:59.999Z`);

      if (exist?.length > 0) {
        showNotification({ type: 'already', title: 'E-Presence', message: `${student.name} sudah absen.` });
        return;
      }

      const [sH, sM] = currentCourse.time_start.replace(/\./g, ':').split(':').map(Number);
      const limit = new Date(); limit.setHours(sH, sM + 15, 0);
      const status = new Date() > limit ? 'Terlambat' : 'Hadir';

      const { error: insErr } = await supabase.from('presensi').insert([{ 
        student_id: student.id, 
        course_id: currentCourse.id, 
        status 
      }]);

      if (insErr) throw insErr;

      showNotification({ 
        type: 'success', 
        title: `Absen ${status}!`, 
        message: student.name, 
        sub: currentCourse.subject_name 
      });
    } catch {
      showNotification({ type: 'error', title: 'Error', message: 'Masalah koneksi database.' });
    }
  }, [showNotification]);

  const startScanner = useCallback((cameraConfig) => {
    if (!scannerRef.current || isScanningRef.current) return;
    isScanningRef.current = true;
    scannerRef.current.start(cameraConfig, { fps: 30, qrbox: { width: 300, height: 200 } }, (t) => handleScan(t), () => {}).catch(() => isScanningRef.current = false);
  }, [handleScan]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && isScanningRef.current) {
        await scannerRef.current.stop();
        isScanningRef.current = false;
    }
  }, []);

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await stopScanner();
    setTimeout(() => startScanner(cameras[nextIndex].id), 300);
  };

  useEffect(() => {
    const init = async () => {
      try { const d = await Html5Qrcode.getCameras(); if (d?.length) setCameras(d); } catch (e) {
        console.warn("Camera discovery skipped or failed", e);
      }
      const el = document.getElementById('reader');
      if (el) { scannerRef.current = new Html5Qrcode('reader'); startScanner({ facingMode: 'environment' }); }
    };
    const t = setTimeout(init, 200);
    return () => { clearTimeout(t); stopScanner(); };
  }, [startScanner, stopScanner]);

  const getStatusText = () => {
    if (dbStatus === 'connecting') return 'Syncing...';
    if (dbStatus === 'empty') return 'Belum Ada Jadwal';
    if (dbStatus === 'no_today') return 'Libur Hari Ini';
    if (activeCourse) return `Sesi Aktif: ${activeCourse.subject_name}`;
    return 'Menunggu Jadwal';
  };

  return (
    <div className="scanner-container">
      <div className="scanner-viewport glass-panel">
        <div id="reader" className="camera-feed"></div>
        <div className="overlay-top">
          <div className={`glass-badge ${activeCourse ? 'active' : 'idle'}`}>
            <div className="pulse-dot"></div>
            {getStatusText()}
          </div>
        </div>
        <div className="scan-frame">
          <span className="corner tl"></span><span className="corner tr"></span>
          <span className="corner bl"></span><span className="corner br"></span>
          <div className="scan-line"></div>
        </div>
        <div className="overlay-bottom">
          <div className="datetime-info">
            <h2 className="time-text">{formattedTime}</h2>
            <p className="date-text">{formattedDate}</p>
          </div>
          <div className="controls">
            {cameras.length > 1 && (
              <button className="glass-icon-button" onClick={switchCamera} title="Ganti Kamera">
                <RefreshCw size={22} />
              </button>
            )}
            <button className="glass-icon-button primary" onClick={fetchSchedules} title="Refresh Jam">
              <Clock size={22} className={dbStatus === 'connecting' ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div className={`notif-popup notif-${notification.type}`}>
          <div className="notif-icon">
            {notification.type === 'loading' ? <Loader2 className="spin" /> : (notification.type === 'error' ? <XCircle /> : <CheckCircle />)}
          </div>
          <div className="notif-body">
            <div className="notif-title">{notification.title}</div>
            <div className="notif-message">{notification.message}</div>
            {notification.sub && <div className="notif-sub">{notification.sub}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScannerPage;
