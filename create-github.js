#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

const cicdWorkflow = `name: Build and Deploy Next.js Dashboard

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Use Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ESLint
        run: npm run lint --if-present
      
      - name: Build application
        run: npm run build

  security-scan:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Run npm audit
        run: npm audit --audit-level=moderate

  docker-build:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Build Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: false
          tags: sidroid-dashboard:latest
`;

const devContainerConfig = `{
  "name": "Sidroid Dashboard Dev",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:18",
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-vscode.vscode-typescript-next",
        "bradlc.vscode-tailwindcss",
        "GraphQL.vscode-graphql"
      ]
    }
  },
  "postCreateCommand": "npm install",
  "forwardPorts": [3000, 5000, 3306, 6379, 8428],
  "portsAttributes": {
    "3000": {
      "label": "Dashboard",
      "onAutoForward": "notify"
    },
    "5000": {
      "label": "Backend API",
      "onAutoForward": "silent"
    },
    "3306": {
      "label": "MySQL",
      "onAutoForward": "silent"
    },
    "6379": {
      "label": "Redis",
      "onAutoForward": "silent"
    },
    "8428": {
      "label": "VictoriaMetrics",
      "onAutoForward": "silent"
    }
  }
}
`;

// Create directories
const workflowDir = path.join(projectRoot, '.github', 'workflows');
const devcontainerDir = path.join(projectRoot, '.devcontainer');

if (!fs.existsSync(workflowDir)) {
  fs.mkdirSync(workflowDir, { recursive: true });
}

if (!fs.existsSync(devcontainerDir)) {
  fs.mkdirSync(devcontainerDir, { recursive: true });
}

// Write files
fs.writeFileSync(path.join(workflowDir, 'ci-cd.yml'), cicdWorkflow);
console.log('✓ Created: .github/workflows/ci-cd.yml');

fs.writeFileSync(path.join(devcontainerDir, 'devcontainer.json'), devContainerConfig);
console.log('✓ Created: .devcontainer/devcontainer.json');
