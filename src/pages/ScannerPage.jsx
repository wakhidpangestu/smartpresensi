import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import * as faceapi from '@vladmandic/face-api';
import { Camera, SwitchCamera, CheckCircle, XCircle, Loader2, RefreshCcw, ScanFace, ScanBarcode, AlertCircle } from 'lucide-react';
import { haptics } from '../lib/haptics';
import './ScannerPage.css';

// ======================== GEOLOCATION HELPERS ========================
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation tidak didukung'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 8000, maximumAge: 0
    });
  });
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};


const ScannerPage = () => {
  const [time, setTime] = useState(new Date());
  const [dailySchedules, setDailySchedules] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  const [dbStatus, setDbStatus] = useState('connecting'); 
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [scanMode, setScanMode] = useState('barcode'); // 'barcode' | 'face'
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [facialStudents, setFacialStudents] = useState([]);

  const [scanStatus, setScanStatus] = useState('idle'); // idle, loading, success, error, missing
  const [faceBox, setFaceBox] = useState(null);
  
  const isFrontCamera = useMemo(() => {
    if (cameras.length === 0) return scanMode === 'face';
    const label = cameras[currentCameraIndex]?.label.toLowerCase() || '';
    return label.includes('front') || label.includes('user') || label.includes('selfie') || (!label && scanMode === 'face');
  }, [cameras, currentCameraIndex, scanMode]);

  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isScanningRef = useRef(false);
  const lastScanRef = useRef({ time: 0, text: '' });
  const activeCourseRef = useRef(null);
  const faceRecognitionInterval = useRef(null);
  const scanStatusTimer = useRef(null);
  const faceMissingCounter = useRef(0);

  const setStatusWithTimeout = useCallback((status) => {
    if (scanStatusTimer.current) clearTimeout(scanStatusTimer.current);
    setScanStatus(status);
    scanStatusTimer.current = setTimeout(() => setScanStatus('idle'), 2500);
  }, []);

  useEffect(() => {
    activeCourseRef.current = activeCourse;
  }, [activeCourse]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load Models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        console.log('🔄 [Scanner] Loading face models from local /models...');
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        console.log('✅ [Scanner] All face models loaded successfully');
        setModelsLoaded(true);
        
        const { data } = await supabase.from('students').select('id, name, face_descriptor').not('face_descriptor', 'is', null);
        if (data) setFacialStudents(data);
      } catch (err) {
        console.error('❌ [Scanner] Failed to load face models:', err);
      }
    };
    loadModels();
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
      ).sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')) : [];
      
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
        const startTotal = sH * 60 + sM;
        const endTotal = eH * 60 + eM;
        return nowTotal >= startTotal && nowTotal <= endTotal;
    });

    if (active?.id !== activeCourse?.id) {
      setActiveCourse(active || null);
    }
  }, [time, dailySchedules, activeCourse]);

  const showNotification = useCallback((config) => {
    window.dispatchEvent(new CustomEvent('app-notify', { detail: config }));
  }, []);

  /**
   * Records attendance in the database with automatic grace period calculation.
   */
  const processAttendance = useCallback(async (student, course) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: exist } = await supabase.from('presensi')
        .select('id')
        .eq('student_id', student.id)
        .eq('course_id', course.id)
        .gte('waktu_scan', `${today}T00:00:00.000Z`)
        .lte('waktu_scan', `${today}T23:59:59.999Z`)
        .single();
      
      if (exist) {
        haptics.warning();
        setStatusWithTimeout('success');
        showNotification({ type: 'already', title: 'E-Presence', message: `${student.name} sudah absen.` });
        return;
      }

      // Silent background location capture — no UI indication
      let userCoords = null;
      try {
        const pos = await getCurrentLocation();
        userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch {
        // GPS unavailable — skip geolocation silently
      }

      // Proximity check (only if both user and first checkin have coords)
      if (userCoords) {
        const { data: firstCheckin } = await supabase
          .from('presensi')
          .select('lat, lng')
          .eq('course_id', course.id)
          .gte('waktu_scan', `${today}T00:00:00Z`)
          .not('lat', 'is', null)
          .order('waktu_scan', { ascending: true })
          .limit(1)
          .single();

        if (firstCheckin?.lat && firstCheckin?.lng) {
          const distance = calculateDistance(userCoords.lat, userCoords.lng, firstCheckin.lat, firstCheckin.lng);
          if (distance > 30) {
            haptics.error();
            setStatusWithTimeout('error');
            showNotification({ 
              type: 'error', 
              title: 'Di Luar Kelas', 
              message: 'Tidak dapat mengisi kehadiran di luar ruang kelas.' 
            });
            return;
          }
        }
      }

      const [sH, sM] = course.time_start.replace(/\./g, ':').split(':').map(Number);
      const limit = new Date(); limit.setHours(sH, sM + 15, 0);
      const status = new Date() > limit ? 'Terlambat' : 'Hadir';

      const { error: insErr } = await supabase.from('presensi').insert([{ 
        student_id: student.id, 
        course_id: course.id, 
        status,
        lat: userCoords?.lat ?? null,
        lng: userCoords?.lng ?? null
      }]);

      if (insErr) throw insErr;

      haptics.success();
      setStatusWithTimeout('success');
      showNotification({ 
        type: 'success', 
        title: `Absen ${status}!`, 
        message: student.name,
        sub: course.subject_name
      });
    } catch (err) {
      console.error("[Attendance] Error:", err);
      haptics.error();
      setStatusWithTimeout('error');
      showNotification({ type: 'error', title: 'Gagal Absen', message: err.message || 'Error tidak diketahui' });
    }
  }, [showNotification, setStatusWithTimeout]);

  /** 
   * OPTIMIZED TRACKING LOOP (High FPS - TinyFaceDetector)
   * Uses TinyFaceDetector which is optimized for mobile browser performance.
   */
  const performFaceTracking = useCallback(async () => {
    if (!videoRef.current || scanMode !== 'face' || scanStatus !== 'idle') return;
    if (!modelsLoaded) return;
    
    try {
      // PERF: TinyFaceDetector is significantly faster than SsdMobilenet for real-time tracking
      const detection = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
      );

      if (detection && videoRef.current) {
        const video = videoRef.current;
        const scale = Math.max(video.offsetWidth / video.videoWidth, video.offsetHeight / video.videoHeight);
        const offsetX = (video.offsetWidth - video.videoWidth * scale) / 2;
        const offsetY = (video.offsetHeight - video.videoHeight * scale) / 2;

        const x = detection.box.x * scale + offsetX;
        const y = detection.box.y * scale + offsetY;
        const width = detection.box.width * scale;
        const height = detection.box.height * scale;

        // Flip X coordinate if the camera is mirrored (Front Camera)
        const finalX = isFrontCamera ? (video.offsetWidth - x - width) : x;

        const size = Math.max(width, height) * 1.25;
        
        setFaceBox({
          x: (finalX + width / 2) - size / 2,
          y: (y + height / 2) - size / 2,
          width: size,
          height: size
        });
        faceMissingCounter.current = 0;
      } else {
        setFaceBox(null);
      }
    } catch {
      // Silently fail for frames
    }
  }, [scanMode, scanStatus, modelsLoaded, isFrontCamera]);

  /** 
   * OPTIMIZED RECOGNITION LOOP (Decoupled - Lower FPS)
   * Runs expensive descriptor calculation and matching less frequently to save resources.
   */
  const performFaceRecognition = useCallback(async () => {
    if (!videoRef.current || facialStudents.length === 0 || scanStatus !== 'idle') return;
    if (!modelsLoaded) return;
    
    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      ).withFaceLandmarks().withFaceDescriptor();
      
      if (detection) {
        let bestMatch = { score: 0, student: null };
        const threshold = 0.5; 

        facialStudents.forEach(student => {
          const distance = faceapi.euclideanDistance(detection.descriptor, new Float32Array(student.face_descriptor));
          const score = 1 - distance; 
          if (score > bestMatch.score) {
            bestMatch.score = score;
            bestMatch.student = student;
          }
        });
        
        if (bestMatch.student && bestMatch.score > threshold) {
          if (!activeCourseRef.current) {
             setStatusWithTimeout('error');
             showNotification({ type: 'error', title: 'Jadwal Kosong', message: 'Tidak ada perkuliahan aktif saat ini.' });
             return;
          }
          processAttendance(bestMatch.student, activeCourseRef.current);
        }
      } else {
        faceMissingCounter.current += 1;
        if (faceMissingCounter.current > 15) { 
           setStatusWithTimeout('missing');
           showNotification({ type: 'error', title: 'Wajah Tidak Terdeteksi', message: 'Pastikan wajah berada di dalam bingkai.' });
           faceMissingCounter.current = 0;
        }
      }
    } catch (err) {
      console.warn("[Face Recognition] Cycle error:", err);
    }
  }, [facialStudents, processAttendance, showNotification, setStatusWithTimeout, scanStatus, modelsLoaded]);

  const handleScan = useCallback(async (decodedText) => {
    const barcodeId = decodedText.trim();
    const now = Date.now();
    if (lastScanRef.current.text === barcodeId && now - lastScanRef.current.time < 3000) return;
    lastScanRef.current = { time: now, text: barcodeId };

    const currentCourse = activeCourseRef.current;
    showNotification({ type: 'loading', title: 'Memproses Barcode...', message: `ID: ${barcodeId}` });

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

      await processAttendance(student, currentCourse);
    } catch {
      showNotification({ type: 'error', title: 'Error', message: 'Masalah koneksi database.' });
    }
  }, [showNotification, processAttendance]);

  useEffect(() => {
    const init = async () => {
      if (scannerRef.current) {
        try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); } catch (e) { console.warn(e); }
        scannerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (faceRecognitionInterval.current) { 
        if (typeof faceRecognitionInterval.current === 'object') {
          clearInterval(faceRecognitionInterval.current.trackingInt);
          clearInterval(faceRecognitionInterval.current.recognitionInt);
        } else {
          clearInterval(faceRecognitionInterval.current);
        }
      }
      isScanningRef.current = false;

      let availableCameras = cameras;
      if (availableCameras.length === 0) {
        try {
          const d = await Html5Qrcode.getCameras();
          if (d?.length) {
            availableCameras = d;
            setCameras(d);
          }
        } catch (e) { console.warn("Camera discovery failed", e); }
      }

      if (availableCameras.length > 1) {
        const frontCamIdx = availableCameras.findIndex(c => c.label.toLowerCase().includes('front') || c.label.toLowerCase().includes('user') || c.label.toLowerCase().includes('selfie'));
        const backCamIdx = availableCameras.findIndex(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('rear') || c.label.toLowerCase().includes('0') || c.label.toLowerCase().includes('environment'));
        
        if (scanMode === 'face' && frontCamIdx !== -1 && currentCameraIndex !== frontCamIdx) {
          setCurrentCameraIndex(frontCamIdx);
          return;
        } else if (scanMode === 'barcode' && backCamIdx !== -1 && currentCameraIndex !== backCamIdx) {
          setCurrentCameraIndex(backCamIdx);
          return;
        }
      }

      await new Promise(r => setTimeout(r, 300));

      try {
        const deviceId = availableCameras[currentCameraIndex]?.id || (scanMode === 'face' ? { facingMode: 'user' } : { facingMode: 'environment' });

        if (scanMode === 'barcode') {
          const el = document.getElementById('reader');
          if (el) {
            scannerRef.current = new Html5Qrcode('reader');
            await scannerRef.current.start(
              deviceId, 
              { 
                fps: 24,
                qrbox: { width: 250, height: 150 },
                videoConstraints: {
                  width: { min: 640, ideal: 1280 },
                  height: { min: 480, ideal: 720 },
                  facingMode: "environment"
                },
                formatsToSupport: [ 
                  Html5QrcodeSupportedFormats.QR_CODE, 
                  Html5QrcodeSupportedFormats.CODE_128, 
                  Html5QrcodeSupportedFormats.CODE_39 
                ],
                experimentalFeatures: {
                  useBarCodeDetectorIfSupported: true
                }
              }, 
              (t) => handleScan(t), 
              () => {}
            );
            isScanningRef.current = true;
          }
        } else {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: availableCameras[currentCameraIndex] ? 
              { 
                deviceId: { exact: availableCameras[currentCameraIndex].id },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
                advanced: [{ focusMode: 'continuous', exposureMode: 'continuous', whiteBalanceMode: 'continuous' }]
              } : 
              { 
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                advanced: [{ focusMode: 'continuous', exposureMode: 'continuous' }]
              } 
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // 2 loops: fast for tracking, slow for recognition
            const trackingInt = setInterval(performFaceTracking, 100);
            const recognitionInt = setInterval(performFaceRecognition, 2000);
            
            faceRecognitionInterval.current = { trackingInt, recognitionInt };
          }
        }
      } catch (e) {
        console.error("Camera start failed", e);
      }
    };
    
    init();
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); } catch { /* ignore */ }
      }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (faceRecognitionInterval.current) {
        if (typeof faceRecognitionInterval.current === 'object') {
          clearInterval(faceRecognitionInterval.current.trackingInt);
          clearInterval(faceRecognitionInterval.current.recognitionInt);
        } else {
          clearInterval(faceRecognitionInterval.current);
        }
      }
    };
  }, [currentCameraIndex, scanMode, performFaceRecognition, performFaceTracking, handleScan, cameras, scanStatus]);

  const getStatusText = () => {
    if (dbStatus === 'connecting') return 'Syncing...';
    if (dbStatus === 'empty') return 'Belum Ada Jadwal';
    if (dbStatus === 'no_today') return 'Libur Hari Ini';
    if (activeCourse) return activeCourse.subject_name;
    
    if (dailySchedules.length > 0) {
      const nowTotal = time.getHours() * 60 + time.getMinutes();
      const firstS = dailySchedules[0].time_start.replace(/\./g, ':').split(':').map(Number);
      const lastE = dailySchedules[dailySchedules.length - 1].time_end.replace(/\./g, ':').split(':').map(Number);
      const firstStartTotal = firstS[0] * 60 + firstS[1];
      const lastEndTotal = lastE[0] * 60 + lastE[1];
      if (nowTotal < firstStartTotal) return 'Perkuliahan belum dimulai';
      if (nowTotal > lastEndTotal) return 'Perkuliahan hari ini telah selesai';
    }
    return 'Menunggu Jadwal';
  };

  const formattedDate = time.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="scanner-container">
      <div className={`scanner-viewport glass-panel ${scanMode === 'face' ? 'face-active' : ''}`}>
        {scanMode === 'barcode' ? (
          <div id="reader" className="camera-feed"></div>
        ) : (
          <div className="face-scanner-view">
             <video ref={videoRef} autoPlay playsInline className={`face-video-feed ${isFrontCamera ? 'mirrored' : ''}`}></video>
             <div className="face-detection-overlay">
                <div 
                  className={`face-id-frame ${scanStatus}`}
                  style={faceBox ? {
                    position: 'absolute',
                    left: `${faceBox.x}px`,
                    top: `${faceBox.y}px`,
                    width: `${faceBox.width}px`,
                    height: `${faceBox.height}px`,
                    transform: 'none'
                  } : {
                    left: '50%',
                    top: '50%',
                    width: '60%',
                    height: '60%',
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                   <div className="face-id-corners">
                      <span className="id-corner tl"></span>
                      <span className="id-corner tr"></span>
                      <span className="id-corner bl"></span>
                      <span className="id-corner br"></span>
                   </div>
                   {scanStatus === 'idle' && <div className="face-id-scan-line"></div>}
                   {scanStatus === 'success' && <CheckCircle size={80} className="status-icon-anim success" strokeWidth={3} />}
                   {scanStatus === 'error' && <XCircle size={80} className="status-icon-anim error" strokeWidth={3} />}
                   {scanStatus === 'missing' && <AlertCircle size={80} className="status-icon-anim info" strokeWidth={3} />}
                   <div className="face-id-dots"></div>
                </div>
             </div>
          </div>
        )}
        
        <div className="overlay-top">
          <div className={`glass-badge ${activeCourse ? 'active' : 'idle'}`}>
            <div className="pulse-dot"></div>
            {getStatusText()}
          </div>
        </div>
        
        {scanMode === 'barcode' && (
          <div className="scan-frame">
            <span className="corner tl"></span><span className="corner tr"></span>
            <span className="corner bl"></span><span className="corner br"></span>
            
            {scanStatus === 'idle' ? (
              <div className="scan-line"></div>
            ) : (
              <div className="scan-feedback-overlay">
                {scanStatus === 'success' && <CheckCircle size={64} className="status-icon-anim success" strokeWidth={3} />}
                {scanStatus === 'error' && <XCircle size={64} className="status-icon-anim error" strokeWidth={3} />}
              </div>
            )}
          </div>
        )}

        <div className="overlay-bottom">
          {scanMode === 'face' && (
            <p className="face-hint ios-text">
              {scanStatus === 'success' ? 'Verifikasi Berhasil' : 
               scanStatus === 'loading' ? 'Mengenali Wajah...' :
               scanStatus === 'error' ? 'Wajah Tidak Dikenal' :
               scanStatus === 'missing' ? 'Posisikan Wajah' : 'Dekatkan Wajah'}
            </p>
          )}
          <div className="bottom-main-row">
            <div className="datetime-info">
              <h2 className="time-text">{formattedTime}</h2>
              <p className="date-text">{formattedDate}</p>
            </div>
            <div className="controls">
              {cameras.length > 1 && (
                <button 
                  className="glass-icon-button" 
                  onClick={() => { haptics.light(); setCurrentCameraIndex((prev) => (prev + 1) % cameras.length); }} 
                  title="Ganti Kamera"
                >
                  <SwitchCamera size={18} />
                </button>
              )}
              <button 
                className={`glass-icon-button ${scanMode === 'face' ? 'active-mode' : ''}`} 
                onClick={() => { haptics.light(); setScanMode(scanMode === 'barcode' ? 'face' : 'barcode'); }}
                title={scanMode === 'barcode' ? "Ganti ke Face Recognition" : "Ganti ke Barcode Scanner"}
                disabled={!modelsLoaded}
              >
                {scanMode === 'barcode' ? <ScanFace size={18} /> : <ScanBarcode size={18} />}
              </button>
              <button className="glass-icon-button primary" onClick={() => { haptics.light(); fetchSchedules(); }} title="Refresh Jadwal">
                <RefreshCcw size={18} className={dbStatus === 'connecting' ? 'spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScannerPage;
