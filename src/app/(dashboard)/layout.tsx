'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import TopNav from '@/components/common/TopNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, margin: '0 auto 20px',
            background: 'linear-gradient(135deg, var(--accent), #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', boxShadow: 'var(--shadow-accent)',
          }}>⚡</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }} className="thinking-dots">
            <span /><span /><span />
          </div>
          <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading Sidroid…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopNav />
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 28px',
          position: 'relative',
          zIndex: 1,
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
