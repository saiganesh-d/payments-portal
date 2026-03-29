import { useState, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; msg: string; type: ToastType; }

type Handler = (msg: string, type: ToastType) => void;
let _handler: Handler = () => {};

export const toast = {
  success: (msg: string) => _handler(msg, 'success'),
  error: (msg: string) => _handler(msg, 'error'),
  info: (msg: string) => _handler(msg, 'info'),
};

const COLORS: Record<ToastType, string> = {
  success: '#16a34a',
  error: '#dc2626',
  info: '#2563eb',
};

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    _handler = (msg, type) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, msg, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    };
    return () => { _handler = () => {}; };
  }, []);

  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed', top: '1rem', right: '1rem',
      zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '0.5rem',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.7rem 1rem',
            borderRadius: '8px',
            background: COLORS[t.type],
            color: '#fff',
            fontWeight: 500,
            fontSize: '0.875rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            maxWidth: '320px',
            minWidth: '200px',
            animation: 'toast-in 0.22s ease',
            pointerEvents: 'auto',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}>{ICONS[t.type]}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
