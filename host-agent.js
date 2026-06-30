/**
 * Host Agent — runs natively on Windows, outside Docker.
 * Exposes real Windows process data (Get-Process) on port 9201.
 * Start with: node host-agent.js
 */
const http = require('http');
const { exec } = require('child_process');

// ── Display name map (no hardcoded filtering — just friendly names) ───────────
const DISPLAY_NAMES = {
  'antigravity ide':        'Antigravity IDE',
  'chrome':                 'Google Chrome',
  'msedge':                 'Microsoft Edge',
  'firefox':                'Mozilla Firefox',
  'code':                   'Visual Studio Code',
  'winword':                'Microsoft Word',
  'excel':                  'Microsoft Excel',
  'powerpnt':               'Microsoft PowerPoint',
  'onenote':                'Microsoft OneNote',
  'outlook':                'Microsoft Outlook',
  'teams':                  'Microsoft Teams',
  'slack':                  'Slack',
  'discord':                'Discord',
  'spotify':                'Spotify',
  'telegram':               'Telegram',
  'whatsapp':               'WhatsApp',
  'zoom':                   'Zoom',
  'skype':                  'Skype',
  'obs64':                  'OBS Studio',
  'vlc':                    'VLC Media Player',
  'steam':                  'Steam',
  'epicgameslauncher':      'Epic Games Launcher',
  'notepad':                'Notepad',
  'notepad++':              'Notepad++',
  'mspaint':                'Paint',
  'explorer':               'Windows Explorer',
  'taskmgr':                'Task Manager',
  'windowsterminal':        'Windows Terminal',
  'cmd':                    'Command Prompt',
  'powershell':             'PowerShell',
  'pwsh':                   'PowerShell Core',
  'com.docker.backend':     'Docker Backend',
  'com.docker.proxy':       'Docker Proxy',
  'docker desktop':         'Docker Desktop',
  'dockerd':                'Docker Daemon',
  'vmware':                 'VMware',
  'virtualbox':             'VirtualBox',
  'vmmemwsl':               'WSL Memory',
  'wsl':                    'Windows Subsystem for Linux',
  'wslhost':                'WSL Host',
  'wslrelay':               'WSL Relay',
  'node':                   'Node.js',
  'python':                 'Python',
  'python3':                'Python 3',
  'java':                   'Java',
  'javaw':                  'Java (Windowed)',
  'dotnet':                 '.NET Runtime',
  'postman':                'Postman',
  'figma':                  'Figma',
  'gitkraken':              'GitKraken',
  'terabox':                'Terabox',
  'teraboxhost':            'Terabox Host',
  'teraboxunite':           'Terabox Unite',
  'mongod':                 'MongoDB',
  'postgres':               'PostgreSQL',
  'mysqld':                 'MySQL',
  'redis-server':           'Redis',
  'nginx':                  'Nginx',
  'svchost':                'Windows Service Host',
  'lsass':                  'Local Security Authority',
  'dwm':                    'Desktop Window Manager',
  'audiodg':                'Audio Device Graph',
  'searchindexer':          'Windows Search',
  'msmpeng':                'Windows Defender',
  'memory compression':     'Memory Compression',
  'registry':               'Windows Registry',
  'runtimebroker':          'Runtime Broker',
  'msedgewebview2':         'Edge WebView2',
  'sihost':                 'Shell Infrastructure Host',
  'shellexperiencehost':    'Shell Experience Host',
  'startmenuexperiencehost':'Start Menu',
  'textinputhost':          'Text Input',
  'widgetboard':            'Widget Board',
  'widgetservice':          'Widget Service',
  'codesetup-stable-7e7950df89d055b5a378379db9ee14290772148a': 'VS Code Setup',
  'xboxpcappft':            'Xbox App',
  'lghub':                  'Logitech G Hub',
};

// ── Category map ──────────────────────────────────────────────────────────────
function getCategory(name) {
  const n = name.toLowerCase();
  if (['chrome', 'msedge', 'firefox', 'iexplore'].includes(n))      return 'Browser';
  if (['code', 'idea64', 'webstorm64', 'pycharm64', 'atom'].includes(n)) return 'Developer';
  if (['postman', 'insomnia', 'gitkraken', 'tableplus'].includes(n)) return 'Developer';
  if (['node', 'python', 'python3', 'java', 'javaw', 'dotnet', 'pwsh', 'powershell'].includes(n)) return 'Runtime';
  if (['winword', 'excel', 'powerpnt', 'onenote', 'outlook', 'teams'].includes(n)) return 'Productivity';
  if (['slack', 'discord', 'telegram', 'whatsapp', 'skype', 'zoom'].includes(n)) return 'Communication';
  if (['spotify', 'vlc', 'obs64'].includes(n))                       return 'Media';
  if (['steam', 'epicgameslauncher', 'xboxpcappft'].includes(n))     return 'Gaming';
  if (['com.docker.backend', 'com.docker.proxy', 'docker desktop', 'dockerd', 'vmmemwsl', 'wsl', 'wslhost', 'wslrelay', 'vmware', 'virtualbox'].includes(n)) return 'Virtualization';
  if (['mongod', 'postgres', 'mysqld', 'redis-server'].includes(n))  return 'Database';
  if (['nginx', 'apache'].includes(n))                               return 'Web Server';
  if (['terabox', 'teraboxhost', 'teraboxunite'].includes(n))        return 'Cloud Storage';
  if (['antigravity ide'].includes(n))                               return 'Developer';
  // System internals
  const systemProcesses = ['svchost', 'lsass', 'csrss', 'wininit', 'winlogon', 'services',
    'system', 'smss', 'spoolsv', 'searchindexer', 'msmpeng', 'memory compression', 'registry',
    'runtimebroker', 'dwm', 'fontdrvhost', 'audiodg', 'dashost', 'dllhost', 'taskhostw',
    'ctfmon', 'sihost', 'textinputhost', 'applicationframehost', 'lockapp', 'wsappx',
    'startmenuexperiencehost', 'searchhost', 'shellexperiencehost', 'widgetboard', 'widgetservice',
    'backgroundtaskhost', 'wmiprv', 'wmiprvse', 'wmiapsrv', 'wudfhost', 'vmcompute', 'vmms'];
  if (systemProcesses.some(s => n.includes(s)))                      return 'System';
  return 'Application';
}

function getDisplayName(rawName) {
  const key = rawName.toLowerCase();
  if (DISPLAY_NAMES[key]) return DISPLAY_NAMES[key];
  // Title-case fallback
  return rawName.charAt(0).toUpperCase() + rawName.slice(1);
}

// ── In-memory cache (15s TTL) ─────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_TTL = 15000;

function fetchProcesses(callback) {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_TTL) {
    return callback(null, cache.data);
  }

  const psCmd = `Get-Process | Select-Object Name, Id, WorkingSet64, CPU, StartTime | ConvertTo-Json -Compress`;
  exec(
    `powershell -NoProfile -NonInteractive -Command "${psCmd}"`,
    { maxBuffer: 1024 * 1024 * 20 },
    (err, stdout) => {
      if (err) return callback(err);
      try {
        const rawArr = JSON.parse(stdout);
        const processArray = Array.isArray(rawArr) ? rawArr : [rawArr];

        // Aggregate by process name
        const aggregated = {};
        for (const p of processArray) {
          if (!p || !p.Name) continue;
          const key = p.Name.toLowerCase();
          const mem = p.WorkingSet64 || 0;
          const cpu = p.CPU || 0;

          // Parse /Date(...)/ format from PowerShell
          let startMs = null;
          if (p.StartTime && p.StartTime.value) {
            const m = p.StartTime.value.match(/\/Date\((\d+)\)\//);
            if (m) startMs = parseInt(m[1], 10);
          } else if (typeof p.StartTime === 'string') {
            const d = new Date(p.StartTime);
            if (!isNaN(d.getTime())) startMs = d.getTime();
          }

          if (!aggregated[key]) {
            aggregated[key] = {
              name: p.Name,
              displayName: getDisplayName(p.Name),
              category: getCategory(p.Name),
              totalMemBytes: 0,
              totalCpuSecs: 0,
              instanceCount: 0,
              pids: [],
              earliestStart: null,
            };
          }

          aggregated[key].totalMemBytes += mem;
          aggregated[key].totalCpuSecs += cpu;
          aggregated[key].instanceCount++;
          aggregated[key].pids.push(p.Id);
          if (startMs && (!aggregated[key].earliestStart || startMs < aggregated[key].earliestStart)) {
            aggregated[key].earliestStart = startMs;
          }
        }

        const processes = Object.values(aggregated).map(p => {
          const memMB = parseFloat((p.totalMemBytes / 1024 / 1024).toFixed(1));
          const uptimeSeconds = p.earliestStart
            ? Math.floor((now - p.earliestStart) / 1000)
            : null;
          return {
            type: 'Process',
            name: p.name,
            displayName: p.displayName,
            category: p.category,
            state: 'Running',
            stateCode: 4,
            startType: 'Process',
            startTypeCode: -1,
            runAs: '',
            processId: p.pids[0] || null,
            instanceCount: p.instanceCount,
            cpuPercent: parseFloat(p.totalCpuSecs.toFixed(2)),
            memoryBytes: p.totalMemBytes,
            memoryMB: memMB,
            uptimeSeconds,
            pids: p.pids,
          };
        });

        // Sort alphabetically
        processes.sort((a, b) => a.displayName.localeCompare(b.displayName));

        const result = {
          success: true,
          data: {
            processes,
            total: processes.length,
            fetchedAt: new Date().toISOString(),
          }
        };

        cache = { data: result, ts: now };
        callback(null, result);
      } catch (e) {
        callback(e);
      }
    }
  );
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/api/processes') {
    fetchProcesses((err, data) => {
      if (err) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
      res.end(JSON.stringify(data));
    });
  } else if (req.url === '/health') {
    res.end(JSON.stringify({ ok: true, pid: process.pid }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(9201, '0.0.0.0', () => {
  console.log('[Host Agent] Running on http://0.0.0.0:9201');
  console.log('[Host Agent] Press Ctrl+C to stop');
});
