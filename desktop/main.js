const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let nextProcess;
const PORT = 8790;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Cloud Ventur Dashboard'
  });

  // Wait a moment for Next.js to start, then load
  setTimeout(() => {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }, 1500);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startNextJsServer() {
  const serverPath = path.join(__dirname, 'next-app', 'server.js');
  
  // Set environment variables for the Next.js server
  const env = {
    ...process.env,
    PORT: PORT,
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
  };

  nextProcess = spawn('node', [serverPath], { env });

  nextProcess.stdout.on('data', (data) => {
    console.log(`[Next.js]: ${data}`);
  });

  nextProcess.stderr.on('data', (data) => {
    console.error(`[Next.js Error]: ${data}`);
  });

  createWindow();
}

app.on('ready', startNextJsServer);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (nextProcess) {
    nextProcess.kill();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    startNextJsServer();
  }
});
