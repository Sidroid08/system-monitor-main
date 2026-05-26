'use client';

import { useState } from 'react';

type Platform = 'linux' | 'windows';

export default function AgentSetupPage() {
  const [platform, setPlatform] = useState<Platform>('linux');
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div style={{ position: 'relative', marginTop: 10 }}>
      <pre style={{
        background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)',
        borderRadius: 10, padding: '14px 16px', overflowX: 'auto',
        fontSize: '0.78rem', lineHeight: 1.7, color: '#a89cff',
        fontFamily: 'JetBrains Mono, monospace',
      }}>{code}</pre>
      <button
        onClick={() => copy(code, id)}
        style={{
          position: 'absolute', top: 8, right: 8,
          padding: '3px 10px', borderRadius: 6,
          fontSize: '0.7rem', cursor: 'pointer',
          background: copied === id ? 'rgba(46,204,113,0.2)' : 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: copied === id ? 'var(--success)' : 'var(--text-muted)',
          transition: 'all 0.2s',
        }}
      >
        {copied === id ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>🔧 Agent Setup</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Install the metrics exporter on your local or cloud machines to start monitoring
        </p>
      </div>

      {/* Platform toggle */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['linux', 'windows'] as Platform[]).map(p => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            style={{
              padding: '8px 20px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 500,
              cursor: 'pointer', border: '1px solid',
              background: platform === p ? 'var(--accent-subtle)' : 'var(--glass-bg)',
              borderColor: platform === p ? 'var(--accent-border)' : 'var(--glass-border)',
              color: platform === p ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
          >
            {p === 'linux' ? '🐧 Linux / macOS' : '🪟 Windows'}
          </button>
        ))}
      </div>

      {platform === 'linux' ? (
        <>
          {/* Linux Steps */}
          <div className="glass-card" style={{ padding: '22px' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Step 1 — Install node_exporter
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.6 }}>
              Run this on your Linux/macOS machine with sudo. This installs <strong>node_exporter v1.9.1</strong> as a systemd service on port <code style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 4 }}>:9100</code>.
            </p>
            <CodeBlock id="linux-install" code={`curl -fsSL https://raw.githubusercontent.com/prometheus/node_exporter/master/scripts/install-node-exporter.sh | sudo bash

# Or manually:
NODE_EXPORTER_VERSION=1.9.1
wget https://github.com/prometheus/node_exporter/releases/download/v\${NODE_EXPORTER_VERSION}/node_exporter-\${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
tar xvf node_exporter-*.tar.gz
sudo mv node_exporter-*/node_exporter /usr/local/bin/
sudo useradd --no-create-home --shell /bin/false node_exporter`} />
          </div>

          <div className="glass-card" style={{ padding: '22px' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Step 2 — Create systemd service
            </h2>
            <CodeBlock id="linux-service" code={`sudo tee /etc/systemd/system/node_exporter.service <<EOF
[Unit]
Description=Prometheus Node Exporter
After=network-online.target

[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter \\
  --web.listen-address=:9100 \\
  --collector.systemd \\
  --collector.processes
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter
sudo systemctl status node_exporter`} />
          </div>

          <div className="glass-card" style={{ padding: '22px' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Step 3 — Verify
            </h2>
            <CodeBlock id="linux-verify" code={`curl http://localhost:9100/metrics | head -20
# You should see lines like:
# node_cpu_seconds_total{cpu="0",mode="idle"} 1234.56`} />
          </div>
        </>
      ) : (
        <>
          {/* Windows Steps */}
          <div className="glass-card" style={{ padding: '22px' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Step 1 — Download windows_exporter MSI
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.6 }}>
              This installs <strong>windows_exporter v0.29.2</strong> as a Windows service on port <code style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 4 }}>:9182</code>.
            </p>
            <CodeBlock id="win-install" code={`# Run in PowerShell (Administrator)
$url = "https://github.com/prometheus-community/windows_exporter/releases/download/v0.29.2/windows_exporter-0.29.2-amd64.msi"
$dest = "$env:TEMP\\windows_exporter.msi"
Invoke-WebRequest -Uri $url -OutFile $dest

# Install with selected collectors
Start-Process msiexec.exe -Wait -ArgumentList \`
  '/I', $dest, \`
  'ENABLED_COLLECTORS=cpu,memory,logical_disk,net,os,system,process', \`
  'LISTEN_PORT=9182', \`
  '/quiet'`} />
          </div>

          <div className="glass-card" style={{ padding: '22px' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Step 2 — Allow firewall (optional, local only)
            </h2>
            <CodeBlock id="win-firewall" code={`# Allow inbound traffic on port 9182 (run as Administrator)
New-NetFirewallRule -DisplayName "Windows Exporter" \`
  -Direction Inbound -Protocol TCP -LocalPort 9182 -Action Allow`} />
          </div>

          <div className="glass-card" style={{ padding: '22px' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Step 3 — Verify
            </h2>
            <CodeBlock id="win-verify" code={`# In PowerShell
Invoke-WebRequest http://localhost:9182/metrics | Select-Object -First 20 -ExpandProperty Content

# Expected output includes:
# windows_cpu_time_total{core="0",mode="idle"} 1234.56`} />
          </div>
        </>
      )}

      {/* Register Instance */}
      <div className="glass-card" style={{ padding: '22px', border: '1px solid var(--accent-border)' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          Step {platform === 'linux' ? '4' : '4'} — Register instance in Sidroid
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          After the exporter is running, go to the <strong>Instances</strong> page and click{' '}
          <strong style={{ color: 'var(--accent)' }}>Register Local Instance</strong>. Enter:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.8rem' }}>
          {[
            ['Instance Name', 'e.g. my-laptop or prod-server'],
            ['IP Address', 'Your machine\'s IP (use `ip addr` or `ipconfig`)'],
            ['Port', platform === 'linux' ? '9100 (node_exporter)' : '9182 (windows_exporter)'],
            ['Platform', platform === 'linux' ? 'Linux' : 'Windows'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
              <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.72rem', marginBottom: 3 }}>{k}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
