import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QrCode, ClipboardList, UserPlus, Home, Calendar } from 'lucide-react';
import ScannerPage from './pages/ScannerPage';
import ReportPage from './pages/ReportPage';
import AddStudentPage from './pages/AddStudentPage';
import SchedulePage from './pages/SchedulePage';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Desktop Header */}
        <header className="desktop-header glass-panel">
          <NavLink to="/" className="navbar-brand">
            <QrCode size={24} strokeWidth={2.5} />
            Smart<span>Pren</span>
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
        <nav className="mobile-bottom-nav">
          <NavLink to="/" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <QrCode size={22} />
            <span>Scan</span>
          </NavLink>
          <NavLink to="/add-student" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <UserPlus size={22} />
            <span>Tambah</span>
          </NavLink>
          <NavLink to="/schedule" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <Calendar size={22} />
            <span>Jadwal</span>
          </NavLink>
          <NavLink to="/report" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <ClipboardList size={22} />
            <span>Laporan</span>
          </NavLink>
        </nav>
      </div>
    </BrowserRouter>
  );
}

export default App;
