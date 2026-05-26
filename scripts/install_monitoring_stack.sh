#!/usr/bin/env bash
set -euo pipefail

# Quick installer for Ubuntu/Debian-like systems.

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin not found. Please install docker compose plugin and re-run."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker"

cd "$DOCKER_DIR"
docker compose pull
docker compose up -d

echo "Monitoring stack is up."
echo "Grafana: http://localhost:3000  (admin / admin123)"
echo "VictoriaMetrics: http://localhost:8428"
echo "vmagent: http://localhost:8429"
