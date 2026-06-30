import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

// In-memory cache for processes (15 second TTL to keep searches fast)
let processCache = { data: null, ts: 0 };
const CACHE_TTL = 15000;

// Well-known process display name map
const DISPLAY_NAMES = {
  'chrome':                 'Google Chrome',
  'msedge':                 'Microsoft Edge',
  'firefox':                'Mozilla Firefox',
  'code':                   'Visual Studio Code',
  'code - insiders':        'VS Code Insiders',
  'idea64':                 'IntelliJ IDEA',
  'webstorm64':             'WebStorm',
  'pycharm64':              'PyCharm',
  'slack':                  'Slack',
  'discord':                'Discord',
  'spotify':                'Spotify',
  'teams':                  'Microsoft Teams',
  'outlook':                'Microsoft Outlook',
  'winword':                'Microsoft Word',
  'excel':                  'Microsoft Excel',
  'powerpnt':               'Microsoft PowerPoint',
  'onenote':                'Microsoft OneNote',
  'mspaint':                'Paint',
  'notepad':                'Notepad',
  'notepad++':              'Notepad++',
  'explorer':               'Windows Explorer',
  'taskmgr':                'Task Manager',
  'cmd':                    'Command Prompt',
  'powershell':             'PowerShell',
  'windowsterminal':        'Windows Terminal',
  'docker desktop':         'Docker Desktop',
  'com.docker.backend':     'Docker Backend',
  'com.docker.proxy':       'Docker Proxy',
  'dockerd':                'Docker Daemon',
  'vmware':                 'VMware',
  'virtualbox':             'VirtualBox',
  'obs64':                  'OBS Studio',
  'vlc':                    'VLC Media Player',
  'zoom':                   'Zoom',
  'skype':                  'Skype',
  'telegram':               'Telegram',
  'whatsapp':               'WhatsApp',
  'postman':                'Postman',
  'insomnia':               'Insomnia',
  'tableplus':              'TablePlus',
  'dbeaver':                'DBeaver',
  'gitkraken':              'GitKraken',
  'github desktop':         'GitHub Desktop',
  'sourcetree':             'SourceTree',
  'figma':                  'Figma',
  'xd':                     'Adobe XD',
  'photoshop':              'Adobe Photoshop',
  'illustrator':            'Adobe Illustrator',
  'premiere pro':           'Adobe Premiere Pro',
  'afterfx':                'Adobe After Effects',
  'audition':               'Adobe Audition',
  'msedgewebview2':         'Edge WebView2',
  'node':                   'Node.js',
  'python':                 'Python',
  'python3':                'Python 3',
  'java':                   'Java',
  'javaw':                  'Java (Windowed)',
  'php':                    'PHP',
  'ruby':                   'Ruby',
  'go':                     'Go',
  'rust':                   'Rust',
  'dotnet':                 '.NET Runtime',
  'mongod':                 'MongoDB',
  'postgres':               'PostgreSQL',
  'mysqld':                 'MySQL Server',
  'redis-server':           'Redis Server',
  'nginx':                  'Nginx',
  'apache':                 'Apache HTTP Server',
  'svchost':                'Windows Service Host',
  'lsass':                  'Local Security Authority',
  'csrss':                  'Client Server Runtime',
  'wininit':                'Windows Init',
  'winlogon':               'Windows Logon',
  'services':               'Services Manager',
  'system':                 'Windows System',
  'smss':                   'Session Manager',
  'spoolsv':                'Print Spooler',
  'searchindexer':          'Windows Search Indexer',
  'msmpeng':                'Windows Defender',
  'antimalware service executable': 'Windows Defender',
  'vmmemwsl':               'WSL Memory',
  'wsl':                    'Windows Subsystem for Linux',
  'wslhost':                'WSL Host',
  'memory compression':     'Memory Compression',
  'registry':               'Windows Registry',
  'runtimebroker':          'Runtime Broker',
  'startmenuexperiencehost': 'Start Menu',
  'searchhost':             'Search Host',
  'shellexperiencehost':    'Shell Experience Host',
  'sihost':                 'Shell Infrastructure Host',
  'ctfmon':                 'CTF Loader',
  'dwm':                    'Desktop Window Manager',
  'fontdrvhost':            'Font Driver Host',
  'audiodg':                'Audio Device Graph',
  'dashost':                'Device Association',
  'dllhost':                'DLL Host',
  'taskhostw':              'Task Host',
  'textinputhost':          'Text Input Application',
  'useroobebroker':         'OOBE Broker',
  'wsappx':                 'Windows Store App',
  'applicationframehost':   'App Frame Host',
  'lockapp':                'Lock App',
  'logioverlay':            'Logi Overlay',
  'lghub':                  'Logitech G Hub',
  'antigravity ide':        'Antigravity IDE',
  'language_server_windows_x64': 'Language Server',
  'srtasks':                'System Restore Tasks',
  'terabox':                'Terabox',
  'soundcloud':             'SoundCloud',
};

function getDisplayName(rawName) {
  const lower = rawName.toLowerCase();
  return DISPLAY_NAMES[lower] || rawName.charAt(0).toUpperCase() + rawName.slice(1);
}

function getCategory(rawName) {
  const lower = rawName.toLowerCase();
  if (['chrome', 'msedge', 'firefox', 'iexplore'].includes(lower)) return 'Browser';
  if (['code', 'code - insiders', 'idea64', 'webstorm64', 'pycharm64', 'sublime_text', 'atom'].includes(lower)) return 'Developer';
  if (['winword', 'excel', 'powerpnt', 'onenote', 'outlook', 'teams', 'lync'].includes(lower)) return 'Productivity';
  if (['slack', 'discord', 'telegram', 'whatsapp', 'skype', 'zoom'].includes(lower)) return 'Communication';
  if (['docker desktop', 'com.docker.backend', 'com.docker.proxy', 'dockerd', 'vmware', 'virtualbox', 'wsl', 'vmmemwsl'].includes(lower)) return 'Virtualization';
  if (['spotify', 'vlc', 'obs64', 'audition', 'afterfx'].includes(lower)) return 'Media';
  if (['node', 'python', 'python3', 'java', 'javaw', 'php', 'ruby', 'go', 'dotnet'].includes(lower)) return 'Runtime';
  if (['mongod', 'postgres', 'mysqld', 'redis-server'].includes(lower)) return 'Database';
  if (['nginx', 'apache'].includes(lower)) return 'Web Server';
  if (['svchost', 'lsass', 'csrss', 'wininit', 'winlogon', 'services', 'system', 'smss', 'spoolsv',
       'searchindexer', 'msmpeng', 'memory compression', 'registry', 'runtimebroker', 'dwm',
       'fontdrvhost', 'audiodg', 'dashost', 'dllhost', 'taskhostw', 'ctfmon', 'sihost',
       'textinputhost', 'useroobebroker', 'applicationframehost', 'lockapp', 'wsappx',
       'startmenuexperiencehost', 'searchhost', 'shellexperiencehost'].includes(lower)) return 'System';
  return 'Application';
}

/**
 * GET /api/processes
 * Returns real Windows processes via PowerShell Get-Process
 * Aggregates multiple instances of the same process (e.g. multiple chrome tabs)
 */
router.get('/', async (req, res) => {
  try {
    // Check cache
    const now = Date.now();
    if (processCache.data && (now - processCache.ts) < CACHE_TTL) {
      return res.json({ success: true, fromCache: true, data: processCache.data });
    }

    // PowerShell command to get all processes with memory and start time
    const psCmd = `Get-Process | Select-Object Name, Id, WorkingSet64, CPU, StartTime, MainWindowTitle | ConvertTo-Json -Compress`;
    
    const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, {
      timeout: 10000,
    });

    const rawProcesses = JSON.parse(stdout);
    const processArray = Array.isArray(rawProcesses) ? rawProcesses : [rawProcesses];

    // Aggregate by process name (group chrome tabs, etc.)
    const aggregated = {};
    const nowSeconds = Math.floor(now / 1000);

    for (const p of processArray) {
      const name = (p.Name || '').toLowerCase();
      const mem = p.WorkingSet64 || 0;
      const cpu = p.CPU || 0;
      
      // Parse start time from /Date(...)/ format
      let startMs = null;
      if (p.StartTime?.value) {
        const match = p.StartTime.value.match(/\/Date\((\d+)\)\//);
        if (match) startMs = parseInt(match[1], 10);
      }

      if (!aggregated[name]) {
        aggregated[name] = {
          name: p.Name,
          displayName: getDisplayName(p.Name),
          category: getCategory(p.Name),
          totalMemBytes: 0,
          totalCpuSecs: 0,
          instanceCount: 0,
          pids: [],
          earliestStart: null,
          hasWindow: false,
        };
      }

      aggregated[name].totalMemBytes += mem;
      aggregated[name].totalCpuSecs += cpu;
      aggregated[name].instanceCount++;
      aggregated[name].pids.push(p.Id);
      if (startMs && (!aggregated[name].earliestStart || startMs < aggregated[name].earliestStart)) {
        aggregated[name].earliestStart = startMs;
      }
      if (p.MainWindowTitle) aggregated[name].hasWindow = true;
    }

    const processes = Object.values(aggregated).map((p) => {
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
        cpuPercent: null,   // cumulative seconds, not %
        cpuSecs: parseFloat(p.totalCpuSecs.toFixed(2)),
        memoryBytes: p.totalMemBytes,
        memoryMB: memMB,
        path: '',
        uptimeSeconds,
        hasWindow: p.hasWindow,
      };
    });

    // Sort by memory desc
    processes.sort((a, b) => b.memoryMB - a.memoryMB);

    const data = {
      processes,
      total: processes.length,
      fetchedAt: new Date().toISOString(),
    };

    // Cache result
    processCache = { data, ts: now };

    return res.json({ success: true, fromCache: false, data });
  } catch (err) {
    console.error('[processes] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch processes', error: err.message });
  }
});

export default router;
