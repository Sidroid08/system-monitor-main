'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      router.push('/overview');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', zIndex: 1,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link href="/landing" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--accent), #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', boxShadow: 'var(--shadow-accent)',
            }}>⚡</div>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sidroid</span>
          </Link>
          <p style={{ marginTop: 24, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Welcome back
          </p>
          <p style={{ marginTop: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Sign in to your monitoring dashboard
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 20, padding: '32px 28px',
          boxShadow: 'var(--shadow)',
        }}>
          {error && (
            <div style={{
              marginBottom: 20, padding: '12px 16px', borderRadius: 10,
              background: 'rgba(255,78,106,0.10)', border: '1px solid rgba(255,78,106,0.25)',
              color: 'var(--danger)', fontSize: '0.875rem',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Email address
              </label>
              <input
                type="email" required placeholder="you@company.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="input-glass"
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
                <Link href="#" style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                type="password" required placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="input-glass"
              />
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '11px',
                borderRadius: 10, fontWeight: 600, fontSize: '0.9rem',
                background: loading ? 'rgba(108,99,255,0.5)' : 'var(--accent)',
                color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--shadow-accent)', marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
              }}
            >
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Signing in…</>
                : 'Sign In →'}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Create one free
            </Link>
          </p>
        </div>

        {/* Demo hint */}
        <div style={{
          marginTop: 14, padding: '11px 16px', borderRadius: 10,
          background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            📌 <strong style={{ color: 'var(--accent)' }}>New?</strong> Register a free account to explore all features
          </p>
        </div>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <Link href="/landing" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
