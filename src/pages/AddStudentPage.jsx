import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import Tesseract from 'tesseract.js';
import { Camera, Upload, Scan, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import './AddStudentPage.css';

const AddStudentPage = () => {
  const [mode, setMode] = useState('select'); // 'select', 'camera', 'processing', 'review', 'result'
  const [status, setStatus] = useState(null); // { type, message }
  const [studentData, setStudentData] = useState({ npm: '', name: '', major: '', barcode_id: '' });
  const [devices, setDevices] = useState([]);
  const [currentCamera, setCurrentCamera] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [initCamera, setInitCamera] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startStream = useCallback(async (deviceId) => {
    stopCamera();
    try {
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : { ideal: "environment" },
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 }
        }
      };
      
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("High-res failed, falling back to basic constraints", e);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.error("Play error:", e));
        };
      }
    } catch (err) {
      console.error("Stream initialization error:", err);
      throw new Error('Koneksi kamera gagal.');
    }
  }, [stopCamera]);

  // Stop camera when unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // UseEffect to start the stream once Mode changes and video element is potentially ready
  useEffect(() => {
    if (mode === 'camera' && initCamera) {
      const waitAndStart = async () => {
        await new Promise(r => setTimeout(r, 200));
        try {
          const deviceId = devices[currentCamera]?.deviceId || null;
          await startStream(deviceId);
        } catch {
          setStatus({ type: 'error', message: 'Gagal inisialisasi kamera.' });
          setMode('select');
        } finally {
          setInitCamera(false);
        }
      };
      waitAndStart();
    }
  }, [mode, initCamera, currentCamera, devices, startStream]);

  const startCamera = async () => {
    stopCamera(); // Reset any existing stream first
    setStatus({ type: 'loading', message: 'Sedang menyiapkan kamera...' });
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Kamera tidak didukung oleh browser ini.");
      }
      
      // Request permissions
      const initialStream = await navigator.mediaDevices.getUserMedia({ video: true });
      initialStream.getTracks().forEach(t => t.stop()); 
      
      // Fetch devices
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = mediaDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      
      const backCamIdx = videoDevices.findIndex(d => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('rear') || 
        d.label.toLowerCase().includes('0')
      );
      
      setCurrentCamera(backCamIdx !== -1 ? backCamIdx : 0);
      setMode('camera');
      setInitCamera(true); 
      setStatus(null);
      
    } catch (err) {
      console.error("Discovery error:", err);
      setStatus({ type: 'error', message: 'Izin kamera ditolak atau kamera tidak ditemukan.' });
      setMode('select');
    }
  };


  const switchCamera = () => {
    if (devices.length > 1) {
      const nextIdx = (currentCamera + 1) % devices.length;
      setCurrentCamera(nextIdx);
      startStream(devices[nextIdx].deviceId);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Use high resolution for better OCR
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Visual feedback (flash)
    video.style.opacity = '0';
    setTimeout(() => video.style.opacity = '1', 100);

    stopCamera();
    
    // Convert to File
    canvas.toBlob((blob) => {
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      processImage(file);
    }, 'image/jpeg', 1.0);
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      processImage(e.target.files[0]);
    }
  };

  const processImage = async (file) => {
    setMode('processing');
    setStatus({ type: 'loading', message: 'Membaca data Kartu Tanda Mahasiswa...' });
    
    try {
      // 1. Barcode Scanning
      setStatus({ type: 'loading', message: 'Mendeteksi ID Barcode...' });
      const html5QrCode = new Html5Qrcode("hidden-scanner", false);
      let barcode_id = '';
      
      try {
        const decoded = await html5QrCode.scanFileV2(file, false);
        barcode_id = decoded?.decodedText || '';
      } catch {
        console.warn("Barcode scanner could not find barcode.");
      }

      // 2. OCR (Tesseract) with Improved Image Pre-processing
      setStatus({ type: 'loading', message: 'Mengoptimalkan kualitas gambar...' });
      const processedImage = await preprocessImage(file);
      
      setStatus({ type: 'loading', message: 'Mengekstrak teks (Deep Neural OCR)...' });
      // Use both ind and eng for better recognition of common OCR tokens
      const worker = await Tesseract.createWorker('ind+eng');
      
      // Less restrictive whitelist to avoid missing characters in fuzzy matches
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -/.:()',
        tessedit_pageseg_mode: '1' // Automatic page segmentation with OSD
      });

      const { data: { text } } = await worker.recognize(processedImage);
      await worker.terminate();
      
      console.log("Extracted Text:\n", text);
      
      // Parse Logic
      const parsedData = parseOCRText(text);
      
      // Fallback: If barcode is unreadable, use NPM as barcode_id
      if (!barcode_id && parsedData.npm) {
        barcode_id = parsedData.npm;
      }
      
      setStudentData({
        npm: parsedData.npm || '',
        name: parsedData.name || '',
        major: parsedData.major || '',
        barcode_id: barcode_id || ''
      });

      // Instead of saving directly, go to review mode
      setMode('review');
      setStatus(null);

    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Gagal memproses kartu mahasiswa.' });
      setMode('result');
    }
  };

  const preprocessImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Scaling for OCR optimization (limit to 1600px width/height)
          const MAX_DIM = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          
          // Draw image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Advanced pre-processing for "burik" images
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          
          // Simple luminosity calculation for adaptive contrast
          let totalBrightness = 0;
          for (let i = 0; i < data.length; i += 4) {
            totalBrightness += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
          }
          const avgBrightness = totalBrightness / (width * height);
          
          // Adjust contrast based on brightness
          const contrast = avgBrightness < 128 ? 1.8 : 1.4; 
          const brightnessFactor = avgBrightness < 80 ? 40 : (avgBrightness > 180 ? -20 : 0);

          for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale first
            const avg = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
            
            // Apply contrast & brightness
            let color = contrast * (avg + brightnessFactor - 128) + 128;
            
            // Clipping
            color = Math.min(255, Math.max(0, color));
            
            data[i] = data[i+1] = data[i+2] = color;
          }
          
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const parseOCRText = (text) => {
    // Normalization: Remove weird symbols, fix common OCR errors
    let cleanText = text.replace(/\|/g, 'I').replace(/©/g, '0').replace(/@/g, 'O').replace(/¢/g, 'C');
    const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let npm = null;
    let name = null;
    let major = null;

    // 1. IMPROVED NPM EXTRACTION (Fuzzy)
    // Common NPM pattern in Unindra or general ID: 10-12 digits
    const npmRegex = /(?:NPM|NIM|NO|N0|NRM|ID|STUK)[:;.-]?\s*([0-9OISLB]{7,15})/i;
    const directNpms = cleanText.match(/\b([0-9OISLB]{9,13})\b/g);

    const npmMatch = cleanText.match(npmRegex);
    let npmCandidate = npmMatch ? npmMatch[1] : (directNpms ? directNpms[0] : null);

    if (npmCandidate) {
      // Fix common OCR digit errors
      npm = npmCandidate.toUpperCase()
        .replace(/O/g, '0')
        .replace(/I/g, '1')
        .replace(/L/g, '1')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
        .replace(/\D/g, ''); // Final cleanup for any non-digits
      
      // Ensure NPM is exactly 12 digits (typical for Unindra)
      if (npm.length > 12) npm = npm.substring(0, 12);
    }

    // 2. IMPROVED NAME EXTRACTION
    const nameKeywords = ['NAMA', 'NAME', 'N4MA', 'N AM A'];
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      if (nameKeywords.some(kw => upperLine.includes(kw))) {
        name = line.split(/[:;.-]/).pop()?.trim() || '';
        if (name) break;
      }
    }

    // Fallback name search (Look for long uppercase lines that aren't titles)
    if (!name || name.length < 3) {
      for (const line of lines) {
        if (line.length > 8 && /^[A-Z\s.]{8,}$/.test(line.trim())) {
          if (!line.match(/UNIVERS|KARTU|MAHASISWA|FAKULTAS|PRODI|TEKNIK|ILMU|STUDI|UNINDRA|INDRA/i)) {
            name = line.trim();
            break;
          }
        }
      }
    }

    // 3. MAJOR / PRODI EXTRACTION (Prioritize PRODI/STUDI and ignore FAKULTAS)
    const prodiKeywords = ['PRODI', 'PROGRAM STUDI', 'STUDI', 'JURUSAN'];
    for (const line of lines) {
      const upperLine = line.toUpperCase();
      // Skip lines that are clearly faculty lines
      if (upperLine.includes('FAKULTAS') && !prodiKeywords.some(kw => upperLine.includes(kw))) continue;
      
      if (prodiKeywords.some(kw => upperLine.includes(kw))) {
        major = line.split(/[:;.-]/).pop()?.trim() || '';
        // Remove the keyword itself if splitting didn't work perfectly
        prodiKeywords.forEach(kw => {
          if (major?.toUpperCase().startsWith(kw)) {
             major = major.substring(kw.length).replace(/^[:;.-]*/, '').trim();
          }
        });
        if (major && major.length > 3) break;
      }
    }

    // Final cleanup of Name (remove things like "TTL")
    if (name) {
      name = name.split(/(?:TTL|TEMPAT|TGL|TANGGAL)/i)[0].trim().toUpperCase();
      name = name.replace(/[^A-Z\s.]/g, ''); // Remove symbols
    }

    return { npm, name: name || '', major: major || '' };
  };

  const handleSaveData = async () => {
    if (!studentData.npm || !studentData.name) {
      setStatus({ type: 'error', message: 'NPM dan Nama wajib diisi!' });
      return;
    }

    setMode('processing');
    setStatus({ type: 'loading', message: 'Menyimpan profil mahasiswa...' });

    try {
      // Check if NPM exists
      const { data: existingNpm } = await supabase.from('students').select('npm').eq('npm', studentData.npm).maybeSingle();
      if (existingNpm) {
        throw new Error(`Mahasiswa dengan NPM ${studentData.npm} sudah terdaftar!`);
      }

      const { error } = await supabase.from('students').insert([{
        npm: studentData.npm,
        name: studentData.name,
        major: studentData.major || '-',
        barcode_id: studentData.barcode_id || studentData.npm
      }]);

      if (error) throw error;

      setStatus({ 
        type: 'success', 
        message: `Mahasiswa ${studentData.name} (${studentData.npm}) berhasil didaftarkan!` 
      });
      setMode('result');

    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: err.message });
      setMode('result');
    }
  };

  return (
    <div className="add-student-container">
      <div className="glass-panel auto-card animate-fade-in">
        <div className="form-header centered">
          <div className="accent-icon">
            <Scan size={26} />
          </div>
          <div>
            <h1>Registrasi Mahasiswa</h1>
            <p className="subtitle">Otomatisasi Pendaftaran via Neural OCR</p>
          </div>
        </div>

        {/* Hidden area for barcode logic */}
        <div id="hidden-scanner" style={{ display: 'none' }}></div>
        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

        {mode === 'select' && (
          <div className="selection-actions">
            <button className="giant-button camera-theme" onClick={startCamera}>
              <div className="btn-icon">
                <Camera size={22} />
              </div>
              <div className="btn-label">
                <span className="main-text">Gunakan Kamera</span>
                <span className="sub-text">Pindai KTM secara langsung</span>
              </div>
            </button>
            <div className="upload-wrapper">
              <label htmlFor="file-upload" className="giant-button upload-theme">
                <div className="btn-icon">
                  <Upload size={22} />
                </div>
                <div className="btn-label">
                  <span className="main-text">Upload Foto</span>
                  <span className="sub-text">Pilih file dari galeri</span>
                </div>
              </label>
              <input 
                id="file-upload" 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload}
                style={{ display: 'none' }} 
              />
            </div>
          </div>
        )}

        {mode === 'camera' && (
          <div className="camera-viewport-wrapper">
            <div className="camera-container-stack">
              <div className="camera-container">
                <video ref={videoRef} autoPlay playsInline className="video-preview"></video>
                <div className="camera-overlay">
                   <div className="guideline-box">
                     <div className="scan-line-scanner"></div>
                   </div>
                   <p className="guideline-text">Posisikan KTM di dalam kotak</p>
                </div>
              </div>
              <div className="camera-controls external">
                <button className="glass-button liquid-glass-btn" onClick={() => { stopCamera(); setMode('select'); }} title="Kembali">
                  <XCircle size={24} />
                </button>
                <button className="capture-trigger-btn" onClick={capturePhoto} title="Ambil Foto">
                  <div className="capture-glow-ring"></div>
                  <div className="capture-btn-core transparent-glass">
                    <Camera size={22} strokeWidth={2.5} />
                  </div>
                </button>
                {devices.length > 1 ? (
                  <button className="glass-button liquid-glass-btn" onClick={switchCamera} title="Ganti Kamera">
                    <RefreshCw size={24} />
                  </button>
                ) : (
                  <div className="placeholder-btn"></div>
                )}
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
              <div className="progress-bar-minimal">
                <div className="progress-fill"></div>
              </div>
              <p className="scanning-fx">Enhancing image pixels & Neural Mapping...</p>
            </div>
          </div>
        )}

        {mode === 'review' && (
          <div className="review-container animate-slide-up">
            <div className="review-header">
              <CheckCircle size={24} className="text-success" />
              <h3>Verifikasi Data Hasil Scan</h3>
            </div>
            <p className="review-hint">Mohon periksa kembali data di bawah. Anda dapat memperbaiki jika ada kesalahan pembacaan teks.</p>
            
            <div className="review-form">
              <div className="input-group">
                <label>NPM (Nomor Pokok Mahasiswa)</label>
                <input 
                  type="text" 
                  value={studentData.npm} 
                  onChange={(e) => setStudentData({...studentData, npm: e.target.value.replace(/\D/g, '')})}
                  placeholder="Contoh: 202143501234"
                  className="review-input"
                />
              </div>
              <div className="input-group">
                <label>Nama Lengkap</label>
                <input 
                  type="text" 
                  value={studentData.name} 
                  onChange={(e) => setStudentData({...studentData, name: e.target.value.toUpperCase()})}
                  placeholder="Sesuai KTP / KTM"
                  className="review-input"
                />
              </div>
              <div className="input-group">
                <label>Program Studi (Prodi)</label>
                <input 
                  type="text" 
                  value={studentData.major} 
                  onChange={(e) => setStudentData({...studentData, major: e.target.value})}
                  placeholder="Informatika / DKV / dsb"
                  className="review-input"
                />
              </div>
              <div className="input-group">
                <label>Barcode ID (Opsional)</label>
                <input 
                  type="text" 
                  value={studentData.barcode_id} 
                  onChange={(e) => setStudentData({...studentData, barcode_id: e.target.value})}
                  placeholder="ID Barcode fisik"
                  className="review-input"
                />
              </div>
            </div>

            <div className="review-actions">
              <button className="glass-button outline block" onClick={() => setMode('select')}>Ulangi Foto</button>
              <button className="glass-button primary block" onClick={handleSaveData}>Simpan Data</button>
            </div>
          </div>
        )}

        {mode === 'result' && status && (
          <div className={`result-container ${status.type} animate-zoom-in`}>
            <div className="result-icon-wrapper">
              {status.type === 'success' ? <CheckCircle size={60} /> : <XCircle size={60} />}
            </div>
            <h2>{status.type === 'success' ? 'Berhasil Terdaftar' : 'Pendaftaran Gagal'}</h2>
            <p className="result-message">{status.message}</p>
            <button 
              className="glass-button primary mt-2 w-full" 
              onClick={() => {
                setStatus(null);
                setMode('select');
              }}
            >
              Daftarkan Mahasiswa Lain
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddStudentPage;
