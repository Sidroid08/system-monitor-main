'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(form.email, form.password, form.name);
      router.push('/overview');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', zIndex: 1,
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link href="/landing" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--accent), #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', boxShadow: 'var(--shadow-accent)',
            }}>⚡</div>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sidroid</span>
          </Link>
          <p style={{ marginTop: 22, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Create your account
          </p>
          <p style={{ marginTop: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Free forever · No credit card required
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name */}
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Full Name
              </label>
              <input
                type="text" required placeholder="John Smith"
                value={form.name} onChange={set('name')}
                className="input-glass"
              />
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Work Email
              </label>
              <input
                type="email" required placeholder="you@company.com"
                value={form.email} onChange={set('email')}
                className="input-glass"
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Password
              </label>
              <input
                type="password" required placeholder="Min. 6 characters"
                value={form.password} onChange={set('password')}
                className="input-glass"
              />
            </div>

            {/* Confirm */}
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Confirm Password
              </label>
              <input
                type="password" required placeholder="Repeat your password"
                value={form.confirm} onChange={set('confirm')}
                className="input-glass"
                style={{ borderColor: form.confirm && form.confirm !== form.password ? 'var(--danger)' : undefined }}
              />
            </div>

            {/* Terms */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" required style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                I agree to the{' '}
                <Link href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Terms of Service</Link>
                {' '}and{' '}
                <Link href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Privacy Policy</Link>
              </span>
            </label>

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '11px',
                borderRadius: 10, fontWeight: 600, fontSize: '0.9rem',
                background: loading ? 'rgba(108,99,255,0.5)' : 'linear-gradient(135deg, var(--accent), #a855f7)',
                color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--shadow-accent)', marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
              }}
            >
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating account…</>
                : 'Create Free Account →'}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <Link href="/landing" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
