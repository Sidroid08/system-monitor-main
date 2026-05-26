#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

// Define all directories
const directories = [
  'src',
  'src/app',
  'src/app/(auth)',
  'src/app/(auth)/login',
  'src/app/(auth)/register',
  'src/app/(dashboard)',
  'src/app/(dashboard)/overview',
  'src/app/(dashboard)/instances',
  'src/app/(dashboard)/organizations',
  'src/app/(dashboard)/alerts',
  'src/app/(dashboard)/settings',
  'src/components',
  'src/components/dashboard',
  'src/components/common',
  'src/context',
  'src/hooks',
  'src/lib',
  'src/lib/api',
  'src/lib/redis',
  'src/styles',
  'src/types',
  'src/utils',
  'public',
  'public/icons',
];

// Create all directories
directories.forEach((dir) => {
  const fullPath = path.join(projectRoot, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
});

console.log('\n✓ All directories created successfully!');
