'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        display: 'flex', flexDirection: 'column', gap: 12, zIndex: 9999
      }}>
        {toasts.map(t => {
          const colors = {
            info: '#06b6d4', success: '#2ecc71',
            warning: '#f59e0b', error: '#ff4e6a'
          };
          const color = colors[t.type];
          return (
            <div key={t.id} className="glass-card animate-slide-in" style={{
              width: 320, padding: '16px',
              borderLeft: `4px solid ${color}`,
              background: `linear-gradient(90deg, ${color}15, var(--glass-bg))`
            }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {t.title}
              </p>
              {t.description && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
