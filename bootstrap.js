#!/usr/bin/env node
/**
 * Master Bootstrap Script
 * Orchestrates the entire Next.js project setup
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = process.cwd();

console.log('🚀 Starting Sidroid Next.js Dashboard Project Setup...\n');

// Step 1: Create directories
console.log('📁 Step 1: Creating project directories...');
try {
  require('./create-dirs.js');
  console.log('✓ Directories created successfully\n');
} catch (error) {
  console.error('✗ Failed to create directories:', error.message);
  process.exit(1);
}

// Step 2: Create main files
console.log('📝 Step 2: Creating main application files...');
try {
  require('./create-files.js');
  console.log('✓ Main files created successfully\n');
} catch (error) {
  console.error('✗ Failed to create files:', error.message);
  process.exit(1);
}

// Step 3: Create additional components
console.log('🧩 Step 3: Creating components and utilities...');
try {
  require('./create-more-files.js');
  console.log('✓ Components created successfully\n');
} catch (error) {
  console.error('✗ Failed to create components:', error.message);
  process.exit(1);
}

// Step 4: Create pages
console.log('📄 Step 4: Creating dashboard pages...');
try {
  require('./create-pages.js');
  console.log('✓ Pages created successfully\n');
} catch (error) {
  console.error('✗ Failed to create pages:', error.message);
  process.exit(1);
}

// Step 5: Create .env.local if it doesn't exist
console.log('⚙️  Step 5: Setting up environment configuration...');
const envPath = path.join(projectRoot, '.env.local');
if (!fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(path.join(projectRoot, '.env.local.example'), 'utf8');
  fs.writeFileSync(envPath, envContent);
  console.log('✓ Created .env.local from template');
} else {
  console.log('✓ .env.local already exists');
}
console.log();

// Step 6: Create .eslintrc.json
console.log('✅ Step 6: Creating ESLint configuration...');
const eslintConfig = {
  extends: ['next/core-web-vitals'],
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
    '@next/next/no-img-element': 'warn',
  },
};
fs.writeFileSync(
  path.join(projectRoot, '.eslintrc.json'),
  JSON.stringify(eslintConfig, null, 2)
);
console.log('✓ ESLint configured\n');

// Step 7: Install dependencies
console.log('📦 Step 7: Installing npm dependencies...');
console.log('This may take a few minutes...\n');

try {
  // Check if npm is available
  execSync('npm --version', { stdio: 'pipe' });

  // Install dependencies
  execSync('npm install', {
    stdio: 'inherit',
    cwd: projectRoot,
  });

  console.log('\n✓ Dependencies installed successfully\n');
} catch (error) {
  console.warn('⚠️  Could not auto-install dependencies.');
  console.log('Please run manually: npm install\n');
}

// Step 8: Summary
console.log('='.repeat(60));
console.log('✅ PROJECT SETUP COMPLETE!\n');
console.log('📋 Next Steps:\n');
console.log('1. Configure your environment:');
console.log('   • Edit .env.local with your API URLs');
console.log('   • Set REDIS_URL if using Redis');
console.log('   • Update SESSION_SECRET for production\n');

console.log('2. Start development server:');
console.log('   npm run dev\n');

console.log('3. Open browser to:');
console.log('   http://localhost:3000\n');

console.log('4. Default test credentials:');
console.log('   Email: test@example.com');
console.log('   Password: password123\n');

console.log('📚 Documentation:');
console.log('   • Setup guide: DASHBOARD_SETUP.md');
console.log('   • API integration: src/lib/api/');
console.log('   • Component examples: src/components/\n');

console.log('🚀 For production build:');
console.log('   npm run build && npm start\n');

console.log('='.repeat(60));
console.log('\n✨ Happy coding! ✨\n');
