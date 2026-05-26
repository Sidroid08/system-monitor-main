const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootPath = path.join(__dirname, '..');
const desktopAppPath = path.join(rootPath, 'desktop', 'next-app');
const desktopPath = path.join(rootPath, 'desktop');

const standalonePath = path.join(rootPath, '.next', 'standalone');
const staticPath = path.join(rootPath, '.next', 'static');
const publicPath = path.join(rootPath, 'public');

console.log('Building Next.js for standalone mode...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: rootPath });
} catch (e) {
  console.error('Next.js build failed.');
  process.exit(1);
}

const oldAppPath = path.join(rootPath, 'desktop', 'app');
if (fs.existsSync(oldAppPath)) {
  fs.rmSync(oldAppPath, { recursive: true, force: true });
}

console.log('Copying standalone build to desktop/next-app...');
if (fs.existsSync(desktopAppPath)) {
  fs.rmSync(desktopAppPath, { recursive: true, force: true });
}

// Copy the standalone output which contains server.js and node_modules
fs.cpSync(standalonePath, desktopAppPath, { recursive: true });

// Copy the static assets required by Next.js standalone server
fs.cpSync(staticPath, path.join(desktopAppPath, '.next', 'static'), { recursive: true });
if (fs.existsSync(publicPath)) {
  fs.cpSync(publicPath, path.join(desktopAppPath, 'public'), { recursive: true });
}

console.log('Installing desktop dependencies...');
try {
  execSync('npm install', { cwd: desktopPath, stdio: 'inherit' });
} catch (e) {
  console.error('Failed to install desktop dependencies.');
  process.exit(1);
}

console.log('Building Electron EXE with electron-packager...');
try {
  execSync('npx electron-packager . "Cloud Ventur Dashboard" --platform=win32 --arch=x64 --out=dist --overwrite', { cwd: desktopPath, stdio: 'inherit' });
} catch (e) {
  console.error('Electron packager failed.');
  process.exit(1);
}

console.log('Successfully built Windows EXE! Check desktop/dist folder.');
