import { useState, useEffect } from 'react';
import { SignOut, Sun, Moon } from '@phosphor-icons/react';
import { useAuthStore } from './store/authStore';
import ClientDashboard from './ClientDashboard';
import StaffDashboard from './StaffDashboard';
import './App.css';

function App() {
  const { role, username, logout } = useAuthStore();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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
      <header className="header" style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Payment Portal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Logged in as <strong>{username}</strong> ({role})
          </p>
        </div>
        
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-icon" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button className="btn-icon" onClick={logout} title="Logout" style={{ color: 'var(--accent-color)' }}>
            <SignOut size={20} />
          </button>
        </div>
      </header>
      
      <main style={{ marginTop: '2rem' }}>
        {(role === 'CLIENT' || role === 'ADMIN') && <ClientDashboard />}
        {role === 'STAFF' && <StaffDashboard />}
      </main>
    </div>
  );
}

export default App;
