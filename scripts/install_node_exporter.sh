#!/usr/bin/env bash
set -euo pipefail

NODE_EXPORTER_VERSION="${NODE_EXPORTER_VERSION:-1.9.1}"
NODE_EXPORTER_USER="${NODE_EXPORTER_USER:-node_exporter}"
INSTALL_DIR="/usr/local/bin"
SERVICE_FILE="/etc/systemd/system/node_exporter.service"
DOWNLOAD_URL="https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ $EUID -ne 0 ]]; then
  echo "Run as root or with sudo."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  apt-get update && apt-get install -y curl tar
fi

id "$NODE_EXPORTER_USER" >/dev/null 2>&1 || useradd --no-create-home --shell /usr/sbin/nologin "$NODE_EXPORTER_USER"

curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/node_exporter.tar.gz"
tar -xzf "$TMP_DIR/node_exporter.tar.gz" -C "$TMP_DIR"
install -m 0755 "$TMP_DIR/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter" "$INSTALL_DIR/node_exporter"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Prometheus Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=${NODE_EXPORTER_USER}
Group=${NODE_EXPORTER_USER}
Type=simple
ExecStart=${INSTALL_DIR}/node_exporter \
  --web.listen-address=:9100 \
  --collector.systemd \
  --collector.processes \
  --collector.ethtool
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now node_exporter
systemctl status node_exporter --no-pager || true

echo "node_exporter installed and listening on :9100"
