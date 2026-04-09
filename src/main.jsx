import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker dengan agresif auto-update (Khusus PWA iOS)
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, r) {
    // 1. Cek update ketika user kembali ke PWA (saat app di-resume dari background di iOS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && r) {
        r.update();
      }
    });

    // 2. Cek update di background secara berkala (tiap 5 menit) jika PWA ditinggal menyala
    if (r) {
      setInterval(() => {
        r.update();
      }, 5 * 60 * 1000);
    }
  }
});

// 3. Paksa refresh secara otomatis ketika service worker baru berhasil di-download & aktif
let refreshing = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      // Berikan jeda sangat kecil agar iOS tidak nge-hang, lalu reload page-nya
      setTimeout(() => window.location.reload(), 100);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
