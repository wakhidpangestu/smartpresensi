import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import Tesseract from 'tesseract.js';
import * as faceapi from '@vladmandic/face-api';
import { Camera, Upload, Scan, CheckCircle, XCircle, RefreshCw, User, Smile, ShieldCheck, AlertCircle } from 'lucide-react';
import { haptics } from '../lib/haptics';
import './AddStudentPage.css';

const AddStudentPage = () => {
  const [mode, setMode] = useState('select'); 
  const [status, setStatus] = useState(null);
  const [studentData, setStudentData] = useState({ npm: '', name: '', major: '', barcode_id: '' });
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [devices, setDevices] = useState([]);
  const [currentCamera, setCurrentCamera] = useState(0);
  const [initCamera, setInitCamera] = useState(false);
  const [enrollProgress, setEnrollProgress] = useState(0);
  const [faceBox, setFaceBox] = useState(null);
  const [ktmStatus, setKtmStatus] = useState('idle'); // 'idle', 'success', 'error'

  const isFrontCamera = useMemo(() => {
    if (devices.length === 0) return mode === 'face_enroll';
    const label = devices[currentCamera]?.label.toLowerCase() || '';
    return label.includes('front') || label.includes('user') || label.includes('selfie') || (!label && mode === 'face_enroll');
  }, [devices, currentCamera, mode]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceTrackingInt = useRef(null);
  const faceEnrollIntervalRef = useRef(null);
  const enrollMissingCounter = useRef(0);
  const isMounted = useRef(true);

  // --- Functions (useCallback) ---

  const stopCamera = useCallback(() => {
    if (faceTrackingInt.current) {
        clearInterval(faceTrackingInt.current);
        faceTrackingInt.current = null;
    }
    if (faceEnrollIntervalRef.current) {
      clearInterval(faceEnrollIntervalRef.current);
      faceEnrollIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setFaceBox(null);
  }, []);

  const performFaceTracking = useCallback(async () => {
    if (!videoRef.current || mode !== 'face_enroll' || !modelsLoaded) return;
    try {
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));
      if (detection) {
        const video = videoRef.current;
        const displayWidth = video.offsetWidth;
        const displayHeight = video.offsetHeight;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        const scale = Math.max(displayWidth / videoWidth, displayHeight / videoHeight);
        const offsetX = (displayWidth - videoWidth * scale) / 2;
        const offsetY = (displayHeight - videoHeight * scale) / 2;

        const x = detection.box.x * scale + offsetX;
        const y = detection.box.y * scale + offsetY;
        const width = detection.box.width * scale;
        const height = detection.box.height * scale;

        const size = Math.max(width, height) * 1.3;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // Flip X if mirrored
        const finalCenterX = isFrontCamera ? (displayWidth - centerX) : centerX;

        setFaceBox({
          x: finalCenterX - size / 2,
          y: centerY - size / 2,
          width: size,
          height: size
        });
      } else {
        setFaceBox(null);
      }
    } catch (e) { console.debug("Tracking fail", e); }
  }, [mode, modelsLoaded, isFrontCamera]);

  const startStream = useCallback(async (deviceId) => {
    stopCamera();
    try {
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : ( (mode==='face_enroll') ? {ideal:"user"} : {ideal:"environment"} ),
          width: { ideal: mode === 'face_enroll' ? 1024 : 1920 }, 
          height: { ideal: mode === 'face_enroll' ? 1024 : 1080 },
          frameRate: { ideal: 30, min: 15 },
          advanced: [
            { focusMode: "continuous" },
            { whiteBalanceMode: "continuous" },
            { exposureMode: "continuous" },
            { brightness: 100 },
            { contrast: 100 },
            { saturation: 100 },
            { sharpness: 100 }
          ]
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!isMounted.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
             if (videoRef.current) {
                 videoRef.current.play().catch(console.error);
             }
        };
      }
    } catch (err) {
      console.error(err);
      if (isMounted.current) {
          setStatus({ type: 'error', message: 'Koneksi kamera gagal.' });
          setMode('select');
      }
    }
  }, [stopCamera, mode]);

  const startCamera = useCallback(async (isBiometric = false) => {
    stopCamera(); 
    setStatus({ type: 'loading', message: 'Sedang menyiapkan kamera...' });
    
    try {
      const initialStream = await navigator.mediaDevices.getUserMedia({ video: true });
      initialStream.getTracks().forEach(t => t.stop()); 
      
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = mediaDevices.filter(d => d.kind === 'videoinput');
      if (isMounted.current) setDevices(videoDevices);
      
      const targetIdx = videoDevices.findIndex(d => {
        const label = d.label.toLowerCase();
        if (isBiometric) {
          return label.includes('front') || label.includes('user') || label.includes('selfie');
        } else {
          return label.includes('back') || label.includes('rear') || label.includes('environment');
        }
      });
      
      if (isMounted.current) {
          setCurrentCamera(targetIdx !== -1 ? targetIdx : 0);
          setMode(isBiometric ? 'face_enroll' : 'camera');
          setInitCamera(true); 
          setStatus(null);
      }
    } catch (err) {
      console.error(err);
      if (isMounted.current) {
          setStatus({ type: 'error', message: 'Izin kamera ditolak.' });
          setMode('select');
      }
    }
  }, [stopCamera]);

  const preprocessImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const MAX_DIM = 1200;
          let width = img.width, height = img.height;
          if (width > height) { if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } }
          else { if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; } }
          canvas.width = width; canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Enhanced Image Processing for OCR
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const gray = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
            
            // Adaptive-like Contrast Enhancement
            let c = gray;
            if (gray < 100) c = gray * 0.7; // Darken shadows
            else if (gray > 160) c = Math.min(255, gray * 1.3); // Brighten highlights
            
            data[i] = data[i+1] = data[i+2] = c;
          }
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.90));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const parseOCRText = (text) => {
    // Basic Normalization
    let cleanText = text.replace(/\|/g, 'I').replace(/©/g, '0').replace(/®/g, '8');
    const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    
    let npm = '', name = '', major = '';

    // 1. Optimized NPM Regex (Handle common misread chars)
    const npmRegex = /(?:NPM|NIM|NO|N0|NRM|ID|STUK|MHS|NIK)[:;.\s-]*(?:ID)?\s*([0-9OISLBZ]{8,15})/i;
    const npmMatch = cleanText.match(npmRegex);
    if (npmMatch) {
      npm = npmMatch[1]
        .replace(/O/g, '0')
        .replace(/I/g, '1')
        .replace(/L/g, '1')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
        .replace(/Z/g, '2')
        .replace(/\D/g, '')
        .substring(0, 15);
    }

    // 2. Intelligent Name Extraction
    const nameKeywords = ['NAMA', 'NAME', 'N4MA', 'NAM4'];
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (nameKeywords.some(kw => upperLine.includes(kw)) && !upperLine.includes('IBU')) {
        let candidate = line;
        // Strip out the "NAMA" part correctly even if colon is missing
        for (const kw of nameKeywords) {
          const regex = new RegExp(`^.*${kw}[:;.\\s-]*`, 'i');
          candidate = candidate.replace(regex, '');
        }
        candidate = candidate.trim().toUpperCase();
        if (candidate.length > 2) {
          name = candidate;
          break;
        }
      }
    }

    // 3. Intelligent Prodi/Major Extraction
    const prodiKeywords = ['PROG. STUDI', 'PROGRAM STUDI', 'PRODI', 'STUDI', 'JURUSAN'];
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      // Skip lines that explicitly mention Faculty to avoid confusion
      if (upperLine.includes('FAKULTAS') && !upperLine.includes('PROG')) continue;
      
      if (prodiKeywords.some(kw => upperLine.includes(kw))) {
        let candidate = line;
        for (const kw of prodiKeywords) {
          const regex = new RegExp(`^.*${kw}[:;.\\s-]*`, 'i');
          candidate = candidate.replace(regex, '');
        }
        candidate = candidate.trim();
        
        if (candidate.length > 2) {
           major = candidate;
           break; 
        }
      }
    }

    // 4. Fallback: If name not found by keyword, try the most "name-like" line
    if (!name && lines.length > 0) {
      // Often the name is just a line in ALL CAPS with no numbers
      for (const line of lines) {
        if (/^[A-Z\s]{5,30}$/.test(line.toUpperCase()) && 
            !line.toUpperCase().includes('UNIVERSITAS') && 
            !line.toUpperCase().includes('KARTU')) {
          name = line.trim().toUpperCase();
          break;
        }
      }
    }

    return { npm, name, major };
  };

  const processImage = useCallback(async (file) => {
    try {
      const html5QrCode = new Html5Qrcode("hidden-scanner", false);
      let barcode_id = '';
      try {
        const decoded = await html5QrCode.scanFileV2(file, false);
        barcode_id = decoded?.decodedText || '';
      } catch { 
        // Image may not contain a QR/Barcode, continue to OCR
      }

      if (!barcode_id) return; 

      setKtmStatus('success');
      setMode('processing');
      setStatus({ type: 'loading', message: 'Membaca data Kartu Tanda Mahasiswa...' });

      const processedImage = await preprocessImage(file);
      const worker = await Tesseract.createWorker('ind+eng');
      await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -/.:()', tessedit_pageseg_mode: '1' });
      const { data: { text } } = await worker.recognize(processedImage);
      await worker.terminate();
      
      const parsedData = parseOCRText(text);
      
      if (isMounted.current) {
          setStudentData({ npm: parsedData.npm || '', name: parsedData.name || '', major: parsedData.major || '', barcode_id: barcode_id });
          startCamera(true); 
      }
    } catch {
      console.warn("Auto-OCR fail");
    }
  }, [startCamera]);

  const handleSaveData = async () => {
    if (!studentData.npm || !studentData.name) {
      setStatus({ type: 'error', message: 'NPM dan Nama wajib diisi!' });
      return;
    }
    setMode('processing');
    setStatus({ type: 'loading', message: 'Menyimpan profil mahasiswa...' });
    try {
      const { data: existingNpm } = await supabase.from('students').select('npm').eq('npm', studentData.npm).maybeSingle();
      if (existingNpm) throw new Error(`Mahasiswa dengan NPM ${studentData.npm} sudah terdaftar!`);
      const { error } = await supabase.from('students').insert([{
        npm: studentData.npm, name: studentData.name, major: studentData.major || '-', barcode_id: studentData.barcode_id || studentData.npm, face_descriptor: faceDescriptor
      }]);
      if (error) throw error;
      if (isMounted.current) {
          haptics.notify();
          setStatus({ type: 'success', message: `Mahasiswa ${studentData.name} berhasil didaftarkan!` });
          setMode('result');
      }
    } catch (err) { 
        if (isMounted.current) {
            haptics.error();
            setStatus({ type: 'error', message: err.message }); 
            setMode('result'); 
        }
    }
  };


  // --- Effects (useEffect) ---

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        console.log('🔄 [AddStudent] Loading Face models from local /models...');
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        console.log('✅ [AddStudent] All face models loaded successfully');
        if (isMounted.current) setModelsLoaded(true);
      } catch (err) {
        console.error('❌ [AddStudent] Failed to load face models:', err);
        if (isMounted.current) {
          setStatus({ type: 'error', message: 'Gagal memuat sistem AI. Periksa koneksi.' });
        }
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    let animationFrameId = null;
    
    if (mode === 'face_enroll' && modelsLoaded) {
      setEnrollProgress(0);
      enrollMissingCounter.current = 0;
      
      let isProcessing = false;
      
      const processCycle = async () => {
         if (!isMounted.current || mode !== 'face_enroll') return;
         
         const video = videoRef.current;
         if (!video || isProcessing || video.readyState < 2) {
            animationFrameId = requestAnimationFrame(processCycle);
            return;
         }
         
         isProcessing = true;
         try {
            const detection = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.85 }))
               .withFaceLandmarks()
               .withFaceDescriptor();
            
            if (detection) {
                enrollMissingCounter.current = 0;
                setEnrollProgress(prev => {
                  const next = Math.min(100, prev + 10); 
                  if (next >= 100) {
                      setFaceDescriptor(Array.from(detection.descriptor));
                      setTimeout(() => {
                        if (isMounted.current) {
                           stopCamera();
                           setMode('review');
                        }
                      }, 400);
                      return 100;
                  }
                  return next;
                });
            } else {
                enrollMissingCounter.current += 1;
                if (enrollMissingCounter.current > 10) { 
                    setEnrollProgress(prev => Math.max(0, prev - 5));
                }
            }
         } catch (err) {
            console.error("Enroll Cycle Error", err);
         } finally {
            isProcessing = false;
            if (isMounted.current && mode === 'face_enroll') {
                animationFrameId = requestAnimationFrame(processCycle);
            }
         }
      };

      animationFrameId = requestAnimationFrame(processCycle);
      faceTrackingInt.current = setInterval(performFaceTracking, 100);
      
      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (faceTrackingInt.current) clearInterval(faceTrackingInt.current);
      };
    }
  }, [mode, modelsLoaded, stopCamera, performFaceTracking]);

  useEffect(() => {
    let intervalId = null;
    if (mode === 'camera' && isMounted.current) {
      intervalId = setInterval(() => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          const canvas = canvasRef.current;
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            const file = new File([blob], "auto_capture.jpg", { type: "image/jpeg" });
            processImage(file);
          }, 'image/jpeg', 0.9);
        }
      }, 3000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [mode, processImage]);

  useEffect(() => {
    if ((mode === 'camera' || mode === 'face_enroll') && initCamera) {
      const waitAndStart = async () => {
        await new Promise(r => setTimeout(r, 500));
        if (!isMounted.current) return;
        
        try {
          const deviceId = devices[currentCamera]?.deviceId || null;
          await startStream(deviceId);
        } catch {
          setMode('select');
        } finally {
          if (isMounted.current) setInitCamera(false);
        }
      };
      waitAndStart();
    }
  }, [mode, initCamera, currentCamera, devices, startStream]);

  return (
    <div className="add-student-container">
      <div className="glass-panel auto-card animate-fade-in">
        <div className="form-header centered">
          <div className="accent-icon">
             {mode === 'face_enroll' ? <Smile size={26} /> : <Scan size={26} />}
          </div>
          <h1>Registrasi Mahasiswa</h1>
          <p className="subtitle">
              {mode === 'face_enroll' ? 'Pendaftaran Biometrik Wajah' : 'Otomatisasi Pendaftaran via Neural OCR'}
          </p>
        </div>

        <div id="hidden-scanner" style={{ display: 'none' }}></div>
        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

        {mode === 'select' && (
          <div className="selection-actions">
            <button className="giant-button camera-theme" onClick={() => { haptics.light(); startCamera(false); }}>
              <div className="btn-icon"><Camera size={22} /></div>
              <div className="btn-label"><span className="main-text">Scan KTM</span><span className="sub-text">Otomatis ekstraksi data</span></div>
            </button>
            <button className="giant-button upload-theme" onClick={() => {
                 haptics.light();
                 setStudentData({ npm: '', name: '', major: '', barcode_id: '' });
                 startCamera(true);
            }}>
              <div className="btn-icon"><User size={22} /></div>
              <div className="btn-label"><span className="main-text">Registrasi Baru</span><span className="sub-text">Face ID + Input Manual</span></div>
            </button>
          </div>
        )}

        {mode === 'camera' && (
          <div className="camera-viewport-wrapper animate-zoom-in">
            <div className={`camera-container ktm-mode`}>
              <video ref={videoRef} autoPlay playsInline className="video-preview"></video>
              <div className="viewport-overlay"></div>
              
              <div className={`ktm-id-frame ${ktmStatus}`}>
                <div className="id-corner tl"></div>
                <div className="id-corner tr"></div>
                <div className="id-corner bl"></div>
                <div className="id-corner br"></div>
                <div className="scan-line-scanner"></div>
              </div>
            </div>
            
            <div className="auto-scan-indicator">
              <RefreshCw className="spin-icon" size={18} />
              <span>Sistem Mencari Data KTM...</span>
            </div>
          </div>
        )}

        {mode === 'face_enroll' && (
          <div className="camera-viewport-wrapper">
            <div className="ai-status-indicator">
              <div className="glass-pill">
                <div className={`status-dot ${faceBox ? 'active' : ''}`}></div>
                <span className="status-label">{faceBox ? 'LOCKING FACE' : 'SEARCHING...'}</span>
              </div>
            </div>
            
            <div className="camera-container face-mode">
              <video ref={videoRef} autoPlay playsInline className={`video-preview ${isFrontCamera ? 'mirrored' : ''}`}></video>
              <div className="viewport-overlay"></div>

              {/* iOS Face ID Visual Overlay */}
              <div 
                className="face-id-frame"
                style={faceBox ? {
                  left: `${faceBox.x}px`,
                  top: `${faceBox.y}px`,
                  width: `${faceBox.width}px`,
                  height: `${faceBox.height}px`
                } : {
                  left: '50%',
                  top: '50%',
                  width: '65%',
                  height: '65%',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                  <div className="id-corner tl"></div>
                  <div className="id-corner tr"></div>
                  <div className="id-corner bl"></div>
                  <div className="id-corner br"></div>
                  {modelsLoaded && <div className="face-id-scan-line"></div>}
              </div>

              {!modelsLoaded && (
                <div className="loading-models-overlay glass-blur">
                  <RefreshCw className="spin-icon" size={24} />
                  <span>Preparing Biometric Engine...</span>
                </div>
              )}
            </div>

            <div className="enroll-instructions">
                <p className="ios-text">
                  {!faceBox ? 'Posisikan Wajah Anda' :
                    enrollProgress < 30 ? 'Tetap Diam...' : 
                    enrollProgress < 70 ? 'Ikuti Laser Pemindai' : 
                    enrollProgress < 100 ? 'Sedikit Lagi...' : 'Pendaftaran Selesai'}
                </p>
                <div className="progress-pills">
                    {[20, 40, 60, 80, 100].map(p => (
                        <div key={p} className={`pill ${enrollProgress >= p ? 'active' : ''}`}></div>
                    ))}
                </div>
            </div>
          </div>
        )}

        {mode === 'processing' && (
          <div className="processing-container">
            <div className="neural-loader">
              <div className="loader-ring"></div>
              <Scan className="scan-icon-pulse" size={40} />
            </div>
            <div className="status-box">
              <h3>{status?.message}</h3>
              <p className="scanning-fx">Processing Neural Engine...</p>
            </div>
          </div>
        )}

        {mode === 'review' && (
          <div className="review-container animate-slide-up">
            <div className="review-header">
              <CheckCircle size={24} className="text-success" />
              <h3>Verifikasi Profil Mahasiswa</h3>
            </div>
            <div className="review-form">
              <div className="input-group">
                <label>NPM (Nomor Pokok Mahasiswa)</label>
                <input 
                  type="text" 
                  value={studentData.npm} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setStudentData({...studentData, npm: val});
                  }} 
                  placeholder="Contoh: 202143501234" 
                  className="review-input" 
                />
              </div>
              <div className="input-group">
                <label>Nama Lengkap</label>
                <input 
                  type="text" 
                  value={studentData.name} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^a-zA-Z\s]/g, '').toUpperCase();
                    setStudentData({...studentData, name: val});
                  }} 
                  placeholder="Sesuai KTP / KTM" 
                  className="review-input" 
                />
              </div>
              <div className="input-group">
                <label>Program Studi (Prodi)</label>
                <input type="text" value={studentData.major} onChange={(e) => setStudentData({...studentData, major: e.target.value})} placeholder="Teknik Informatika" className="review-input" />
              </div>
            </div>
            <div className="review-actions row">
              <button className="glass-button outline capsule" onClick={() => { haptics.light(); setMode('select'); }}>Batal</button>
              <button className="glass-button primary capsule" onClick={() => { haptics.medium(); handleSaveData(); }}>
                Simpan Data
              </button>
            </div>
          </div>
        )}

        {mode === 'result' && status && (
          <div className={`result-container ${status.type} animate-zoom-in`}>
            <div className="result-icon-wrapper">
              {status.type === 'success' ? <CheckCircle size={60} /> : <XCircle size={60} />}
            </div>
            <h2>{status.type === 'success' ? 'Registrasi Berhasil' : 'Registrasi Gagal'}</h2>
            <p className="result-message">{status.message}</p>
            <div className="result-actions">
              <button className="glass-button primary capsule" style={{ minWidth: '120px' }} onClick={() => { haptics.light(); setStatus(null); setMode('select'); setFaceDescriptor(null); }}>Selesai</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddStudentPage;
