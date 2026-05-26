'use client';

import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

export default function GrafanaDashboardPage() {
  const { user } = useAuth();
  const [iframeError, setIframeError] = useState(false);
  const [isKiosk, setIsKiosk] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Use our secure Next.js API proxy instead of direct Grafana port
  const grafanaUrl = '/api/grafana';

  // Construct the URL to embed the Multi-Organization AWS Node Monitoring dashboard
  // We pass sidroidUser so the proxy can inject the Auth Proxy header for seamless SSO.
  const organizationName = user?.organizationId ? user.organizationId : '.*';
  const kioskParam = isKiosk ? '&kiosk=tv' : '';
  const userEmail = user?.email || 'admin@sidroid.com';
  const embedUrl = `${grafanaUrl}/d/multi-org-aws-monitoring/multi-organization-aws-node-monitoring?orgId=1${kioskParam}&var-organization=${organizationName}&refresh=30s&sidroidUser=${encodeURIComponent(userEmail)}`;

  return (
    <div className="space-y-5 h-[calc(100vh-120px)] flex flex-col page-enter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center border border-orange-500/15">
              📈
            </span>
            Grafana Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Viewing real-time Prometheus telemetry provisioned via VictoriaMetrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Kiosk toggle */}
          <button
            onClick={() => setIsKiosk(!isKiosk)}
            className={`btn-ghost text-xs !py-2 !px-3 ${isKiosk ? 'border-blue-500/30 text-blue-400' : ''}`}
          >
            {isKiosk ? '🖥 Kiosk Mode' : '📊 Full UI'}
          </button>

          {/* Refresh */}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="btn-ghost text-xs !py-2 !px-3"
          >
            🔄 Reload
          </button>

          {/* Open in Grafana */}
          <a
            href={embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs !py-2 !px-4 inline-flex items-center gap-1.5"
          >
            Open in Grafana
            <span className="text-[10px]">↗</span>
          </a>
        </div>
      </div>

      {/* Iframe Container */}
      <div className="flex-1 glass-card overflow-hidden relative min-h-[500px]">
        <iframe
          key={refreshKey}
          src={embedUrl}
          className="w-full h-full border-0 absolute inset-0 rounded-2xl"
          allow="fullscreen"
          title="Grafana Dashboard"
          onError={() => setIframeError(true)}
        />

        {/* Error overlay */}
        {iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e1a]/95 text-center p-6 rounded-2xl">
            <div className="max-w-sm space-y-4 animate-scale-in">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-lg font-bold text-white">Grafana Frame Blocked</h3>
              <p className="text-sm text-slate-400">
                Could not connect to Grafana proxy at{' '}
                <code className="text-blue-400 font-mono text-xs bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {grafanaUrl}
                </code>
              </p>
              <div className="glass-card p-3 text-left text-xs space-y-2">
                <p className="text-slate-400 font-medium">Troubleshooting:</p>
                <ul className="text-slate-500 space-y-1.5 list-disc list-inside">
                  <li>Ensure Grafana container is running on port 3001</li>
                  <li>Check <code className="text-blue-400 font-mono">GF_SECURITY_ALLOW_EMBEDDING=true</code></li>
                  <li>Verify <code className="text-blue-400 font-mono">docker-compose up grafana</code></li>
                </ul>
              </div>
              <button
                onClick={() => { setIframeError(false); setRefreshKey((k) => k + 1); }}
                className="btn-primary text-xs !py-2"
              >
                🔄 Retry Connection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
