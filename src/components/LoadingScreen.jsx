import React, { useEffect } from 'react';
import { motion as Motion } from 'framer-motion';
import { ScanFace } from 'lucide-react';
import './LoadingScreen.css';

const LoadingScreen = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Spring physics for iOS feel
  const springConfig = { type: "spring", bounce: 0.25, duration: 1.5 };

  return (
    <Motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="loading-overlay"
    >
      {/* Background Liquid Motion Entities */}
      <div className="motion-background">
        <Motion.div 
          className="liquid-orb orb-1"
          animate={{
            x: [0, 30, -10, 0],
            y: [0, -20, 15, 0],
            scale: [1, 1.15, 0.9, 1],
            borderRadius: ["40%", "60%", "35%", "50%"]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <Motion.div 
          className="liquid-orb orb-2"
          animate={{
            x: [0, -20, 25, 0],
            y: [0, 30, -10, 0],
            scale: [1, 0.9, 1.1, 1],
            borderRadius: ["50%", "30%", "60%", "40%"]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </div>

      <div className="loading-container">
        {/* Floating Glass Plate */}
        <Motion.div 
          className="ios-glass-plate"
          initial={{ y: 30, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={springConfig}
        >
          <div className="plate-inner">
            <Motion.div
              animate={{ 
                scale: [1, 1.05, 1],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <ScanFace strokeWidth={1} className="plate-icon" />
            </Motion.div>
            
            {/* Minimalist Scanning Laser */}
            <Motion.div 
              className="ios-laser"
              animate={{ y: ["-10px", "54px", "-10px"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </Motion.div>

        {/* Deep Typography */}
        <div className="text-cluster">
          <Motion.h2 
            className="brand-title"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springConfig, delay: 0.2 }}
          >
            SMART PRESENSI
          </Motion.h2>

          <Motion.div 
            className="subtitle-wrapper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <span className="subtitle-text">Authenticating</span>
            <div className="pulse-dot" />
          </Motion.div>
        </div>
      </div>
    </Motion.div>
  );
};

export default LoadingScreen;
