'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const features = [
  {
    icon: '🌩️',
    title: 'Cloud Monitoring',
    desc: 'Connect your AWS account with IAM credentials. Auto-discover EC2 instances tagged Monitor=true. Pull metrics via node_exporter.',
  },
  {
    icon: '🖥️',
    title: 'Local System Monitoring',
    desc: 'Install node_exporter (Linux) or windows_exporter (Windows) on any machine. Sidroid auto-detects and personalizes your view.',
  },
  {
    icon: '📊',
    title: 'Grafana Integration',
    desc: 'Switch between the custom Sidroid dashboard and your Grafana provisioned panels — all in one interface.',
  },
  {
    icon: '🏢',
    title: 'Multi-Organization',
    desc: 'Manage multiple AWS accounts under one platform. Isolate metrics, users, and alerts per organization.',
  },
  {
    icon: '🚨',
    title: 'Real-time Alerts',
    desc: 'Configure threshold-based alerts. Get notified when CPU, memory, or disk exceeds your defined limits.',
  },
  {
    icon: '💻',
    title: 'Desktop App',
    desc: 'Download Sidroid as a native desktop app (Windows .exe, macOS .dmg). Full monitoring without a browser.',
  },
];

const steps = [
  { num: '01', title: 'Create Account', desc: 'Sign up with your email. A personal organization is created automatically.' },
  { num: '02', title: 'Add Your Systems', desc: 'Connect AWS accounts or install node_exporter on local machines. Register instances.' },
  { num: '03', title: 'Monitor Live', desc: 'View real-time CPU, memory, disk, and network metrics. Set alerts and explore trends.' },
];

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    // If already logged in, skip landing
    const token = localStorage.getItem('auth_token');
    if (token) router.push('/overview');
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 48px',
        background: 'rgba(10,10,26,0.85)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--glass-border)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', boxShadow: 'var(--shadow-accent)',
          }}>⚡</div>
          <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sidroid</span>
        </div>

        {/* Nav actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login" style={{
            padding: '8px 20px', borderRadius: 10,
            fontSize: '0.875rem', fontWeight: 500,
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            background: 'none',
            transition: 'all 0.2s',
          }}>
            Log In
          </Link>
          <Link href="/register" style={{
            padding: '8px 20px', borderRadius: 10,
            fontSize: '0.875rem', fontWeight: 600,
            background: 'var(--accent)',
            color: '#fff',
            textDecoration: 'none',
            boxShadow: 'var(--shadow-accent)',
            transition: 'all 0.2s',
          }}>
            Get Started →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', padding: '100px 24px 80px',
        position: 'relative', zIndex: 1,
      }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 16px', borderRadius: 20,
          fontSize: '0.78rem', fontWeight: 500,
          background: 'var(--accent-subtle)',
          border: '1px solid var(--accent-border)',
          color: '#a89cff',
          marginBottom: 28,
        }}>
          ✦ Open-source · Node Exporter · VictoriaMetrics
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(2.2rem, 6vw, 4.2rem)',
          fontWeight: 800, lineHeight: 1.12,
          marginBottom: 24, color: 'var(--text-primary)',
          maxWidth: 800,
        }}>
          Monitor Everything,{' '}
          <span className="gradient-text">Cloud & Local</span>
          <br />in One Dashboard
        </h1>

        <p style={{
          fontSize: '1.05rem', color: 'var(--text-secondary)',
          maxWidth: 540, lineHeight: 1.75, marginBottom: 44,
        }}>
          Sidroid connects your AWS EC2 instances and local machines into a single personalized
          monitoring dashboard. Real-time metrics, multi-org support, and Grafana integration.
        </p>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
          <Link href="/register" style={{
            padding: '14px 34px', borderRadius: 12,
            fontSize: '1rem', fontWeight: 600,
            background: 'linear-gradient(135deg, var(--accent), #a855f7)',
            color: '#fff', textDecoration: 'none',
            boxShadow: '0 4px 24px rgba(108,99,255,0.35)',
            transition: 'all 0.2s',
          }}>
            🚀 Start Monitoring Free
          </Link>
          <Link href="/login" style={{
            padding: '14px 34px', borderRadius: 12,
            fontSize: '1rem', fontWeight: 500,
            background: 'var(--glass-bg)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            border: '1px solid var(--glass-border)',
          }}>
            Sign In
          </Link>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          No credit card required · Works with any Linux or Windows machine
        </p>

        {/* Dashboard preview mockup */}
        <div style={{
          marginTop: 60, width: '100%', maxWidth: 900,
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 20,
          padding: '24px',
          boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.1)',
        }}>
          {/* Fake browser chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            <div style={{
              flex: 1, height: 28, borderRadius: 6,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                🔒 sidroid.app/overview
              </span>
            </div>
          </div>

          {/* Fake metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'CPU Usage', value: '34.2%', color: '#6c63ff', delta: '+2.1%' },
              { label: 'Memory', value: '67.8%', color: '#a855f7', delta: '-0.3%' },
              { label: 'Disk', value: '41.5%', color: '#f59e0b', delta: 'stable' },
            ].map((m) => (
              <div key={m.label} style={{
                padding: '16px', borderRadius: 12,
                background: 'var(--bg-secondary)',
                border: `1px solid ${m.color}30`,
              }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</p>
                <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>{m.value}</p>
                <p style={{ fontSize: '0.7rem', color: m.color, marginTop: 4 }}>{m.delta}</p>
                {/* Fake sparkline */}
                <div style={{ marginTop: 8, height: 24, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                  {[40, 55, 45, 60, 50, 65, 55, 70, 60, 75, 65, 68].map((h, i) => (
                    <div key={i} style={{
                      flex: 1, height: `${h}%`, borderRadius: 2,
                      background: `${m.color}50`,
                    }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section style={{
        padding: '80px 48px',
        maxWidth: 1100, margin: '0 auto',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            Everything you need to monitor at scale
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            From a single Raspberry Pi to a fleet of hundreds of EC2 instances — Sidroid handles it all.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {features.map((f) => (
            <div
              key={f.title}
              className="glass-card"
              style={{ padding: '28px 24px', transition: 'all 0.3s' }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '60px 48px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            Up and running in 3 steps
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 52, lineHeight: 1.7 }}>
            No complex setup. No Kubernetes required.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {steps.map((s) => (
              <div key={s.num} style={{
                display: 'flex', alignItems: 'flex-start', gap: 24,
                textAlign: 'left', padding: '24px 28px',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 16,
              }}>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 800,
                  color: 'var(--accent)', flexShrink: 0,
                  minWidth: 40,
                }}>{s.num}</div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Box ── */}
      <section style={{ padding: '80px 24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          maxWidth: 560, margin: '0 auto',
          padding: '60px 40px',
          borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(168,85,247,0.10))',
          border: '1px solid rgba(108,99,255,0.30)',
          backdropFilter: 'blur(16px)',
        }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
            Start monitoring today
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 36, lineHeight: 1.7 }}>
            Free to use. Open source. Deploy on your own infrastructure or use our hosted version.
          </p>
          <Link href="/register" style={{
            display: 'inline-block', padding: '14px 40px',
            borderRadius: 12, fontSize: '1rem', fontWeight: 600,
            background: 'var(--accent)', color: '#fff',
            textDecoration: 'none',
            boxShadow: 'var(--shadow-accent)',
          }}>
            Create Free Account →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        textAlign: 'center', padding: '32px 24px',
        borderTop: '1px solid var(--glass-border)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--accent), #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem',
          }}>⚡</div>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Sidroid</span>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} Sidroid · Built with VictoriaMetrics · Grafana · Next.js
        </p>
      </footer>
    </div>
  );
}
