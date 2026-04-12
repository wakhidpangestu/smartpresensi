import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ScanBarcode, BarChart3, UserPlus, CalendarClock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { haptics } from './lib/haptics';
import ScannerPage from './pages/ScannerPage';
import ReportPage from './pages/ReportPage';
import AddStudentPage from './pages/AddStudentPage';
import SchedulePage from './pages/SchedulePage';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import LoadingScreen from './components/LoadingScreen';

import './App.css';

const ROUTES = ['/', '/add-student', '/schedule', '/report'];

function NavigationContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const itemRefs = useRef([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [centers, setCenters] = useState([]);
  const currentIndex = ROUTES.indexOf(location.pathname);

  // PERF: Cache centers to avoid layout thrashing (getBoundingClientRect) during drag
  const updateCenters = useCallback(() => {
    if (!navRef.current) return;
    const navRect = navRef.current.getBoundingClientRect();
    const newCenters = itemRefs.current.map(item => {
      if (!item) return 0;
      const rect = item.getBoundingClientRect();
      return rect.left - navRect.left + rect.width / 2;
    });
    setCenters(newCenters);
  }, []);

  useLayoutEffect(() => {
    updateCenters();
    // Re-calculate after a short delay for PWA/Mobile dynamic UI shifts
    const timer = setTimeout(updateCenters, 500);
    return () => clearTimeout(timer);
  }, [updateCenters]);


  useEffect(() => {
    window.addEventListener('resize', updateCenters);
    return () => window.removeEventListener('resize', updateCenters);
  }, [updateCenters]);

  const activeX = isDragging ? dragX : (centers[currentIndex] ?? 0);

  const handleTouchStart = (e) => {
    setIsDragging(true);
    const navLeft = navRef.current?.getBoundingClientRect().left || 0;
    setDragX(e.targetTouches[0].clientX - navLeft);
  };

  const handleTouchMove = (e) => {
    const navLeft = navRef.current?.getBoundingClientRect().left || 0;
    const rawX = e.targetTouches[0].clientX - navLeft;
    
    // PERF: Uses cached 'centers' instead of triggering reflows
    let pulledX = rawX;
    centers.forEach((center) => {
      const distance = Math.abs(rawX - center);
      if (distance < 45) {
        const strength = 1 - (distance / 45);
        pulledX = rawX + (center - rawX) * (strength * 0.5);
      }
    });

    setDragX(pulledX);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    centers.forEach((center, index) => {
      const distance = Math.abs(dragX - center);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    });

    if (nearestIndex !== currentIndex) {
      haptics.soft();
      navigate(ROUTES[nearestIndex]);
    }
  };

  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const handleNotify = (e) => {
      setNotification(e.detail);
      if (e.detail && !e.detail.type.includes('loading')) {
        setTimeout(() => {
          setNotification(prev => prev ? { ...prev, isExiting: true } : null);
          setTimeout(() => setNotification(null), 500);
        }, 3000);
      }
    };
    window.addEventListener('app-notify', handleNotify);
    return () => window.removeEventListener('app-notify', handleNotify);
  }, []);

  return (
    <div className="app-layout">

      <PWAInstallPrompt />
      {/* Desktop Header */}
      <header className="desktop-header glass-panel">
        <NavLink to="/" className="navbar-brand">
          <ScanBarcode size={24} strokeWidth={2.5} />
          Si<span>Perdi</span>
        </NavLink>
        <div className="desktop-nav">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Scan
          </NavLink>
          <NavLink to="/add-student" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Tambah
          </NavLink>
          <NavLink to="/schedule" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Jadwal
          </NavLink>
          <NavLink to="/report" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Laporan
          </NavLink>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ScannerPage />} />
          <Route path="/add-student" element={<AddStudentPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation - Floating Capsule */}
      <nav 
        className="mobile-bottom-nav" 
        ref={navRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Dynamic Interactive Bubble */}
        <div 
          className="active-bubble-interactive"
          style={{ 
            left: `${activeX}px`,
            transition: isDragging ? 'none' : 'all 0.5s cubic-bezier(0.34, 1.85, 0.64, 1)'
          }}
        />

        <NavLink 
          to="/" 
          ref={el => itemRefs.current[0] = el}
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
          onClick={() => haptics.soft()}
        >
          <ScanBarcode size={22} />
          <span>Scan</span>
        </NavLink>
        <NavLink 
          to="/add-student" 
          ref={el => itemRefs.current[1] = el}
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
          onClick={() => haptics.soft()}
        >
          <UserPlus size={22} />
          <span>Tambah</span>
        </NavLink>
        <NavLink 
          to="/schedule" 
          ref={el => itemRefs.current[2] = el}
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
          onClick={() => haptics.soft()}
        >
          <CalendarClock size={22} />
          <span>Jadwal</span>
        </NavLink>
        <NavLink 
          to="/report" 
          ref={el => itemRefs.current[3] = el}
          className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
          onClick={() => haptics.soft()}
        >
          <BarChart3 size={22} />
          <span>Laporan</span>
        </NavLink>
      </nav>

      {/* GLOBAL NOTIFICATION - FIXED AT BOTTOM OF DOM FOR STABILITY */}
      {notification && (
        <div className={`notif-popup notif-${notification.type} ${notification.isExiting ? 'notif-exiting' : ''}`}>
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
}

function App() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        {isLoading && (
          <LoadingScreen key="loading" onComplete={() => setIsLoading(false)} />
        )}
      </AnimatePresence>
      <NavigationContent />
    </BrowserRouter>
  );
}

export default App;
