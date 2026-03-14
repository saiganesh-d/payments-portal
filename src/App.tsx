import { useState, useEffect } from 'react';
import { SignOut, Sun, Moon, List, X } from '@phosphor-icons/react';
import { useAuthStore } from './store/authStore';
import ClientDashboard from './ClientDashboard';
import StaffDashboard from './StaffDashboard';
import './App.css';

function App() {
  const { role, username, logout } = useAuthStore();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      updateBodyTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      updateBodyTheme('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    updateBodyTheme(newTheme);
  };

  const updateBodyTheme = (currentTheme: 'light' | 'dark') => {
    if (currentTheme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Menu</h2>
          <button className="btn-icon" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-content">
          <div className="sidebar-user-info">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Logged in as</div>
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>{username}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{role}</div>
          </div>

          <button className="sidebar-item" onClick={() => { toggleTheme(); setSidebarOpen(false); }}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>

          <button className="sidebar-item sidebar-logout" onClick={() => { logout(); setSidebarOpen(false); }}>
            <SignOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Top bar with just hamburger */}
      <div className="topbar">
        <button className="btn-icon hamburger-btn" onClick={() => setSidebarOpen(true)} title="Menu">
          <List size={24} />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>7basic</h1>
      </div>

      <main style={{ marginTop: '1rem' }}>
        {(role === 'CLIENT' || role === 'ADMIN') && <ClientDashboard />}
        {role === 'STAFF' && <StaffDashboard />}
      </main>
    </div>
  );
}

export default App;
