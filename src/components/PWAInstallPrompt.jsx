import React, { useState } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';
import './PWAInstallPrompt.css';

const PWAInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(() => {
    // Basic check for browser environment
    if (typeof window === 'undefined') return false;

    // Check if it's iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    // Check if it's already in standalone mode
    const isStandalone = window.navigator.standalone === true || 
                       window.matchMedia('(display-mode: standalone)').matches;

    // Check if the user has dismissed the prompt before
    const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');

    return !!(isIOS && !isStandalone && !hasDismissed);
  });

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="pwa-prompt-overlay" onClick={handleDismiss}>
      <div className="pwa-prompt-card" onClick={(e) => e.stopPropagation()}>
        <div className="pwa-prompt-header">
          <img src="/pwa-192x192.png" alt="SmartPresensi Icon" className="pwa-icon" />
          <div className="pwa-prompt-title">
            <h3>Instal SmartPresensi</h3>
            <p>Tambahkan ke Layar Utama untuk akses cepat.</p>
          </div>
        </div>

        <div className="pwa-steps">
          <div className="pwa-step">
            <div className="pwa-step-icon">
              <Share size={20} color="#007AFF" />
            </div>
            <span>Tap tombol <strong>Share</strong> di bar navigasi Safari.</span>
          </div>
          <div className="pwa-step">
            <div className="pwa-step-icon">
              <PlusSquare size={20} color="#007AFF" />
            </div>
            <span>Scroll ke bawah dan pilih <strong>'Add to Home Screen'</strong>.</span>
          </div>
        </div>

        <button className="pwa-close-btn" onClick={handleDismiss}>
          Ok, Mengerti
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
