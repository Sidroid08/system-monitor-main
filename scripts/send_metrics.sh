#!/usr/bin/env bash
set -euo pipefail

# Pull metrics from a node_exporter endpoint, inject multi-org labels, and push to VictoriaMetrics.
# Example:
# ORGANIZATION_ID=1001 ORGANIZATION_NAME=CompanyA SERVICE=ec2 NODE_NAME=ec2-prod-01 \
# VICTORIAMETRICS_URL=http://monitoring.example.com:8428 \
# NODE_EXPORTER_URL=http://127.0.0.1:9100/metrics ./send_metrics.sh

ORGANIZATION_ID="${ORGANIZATION_ID:?ORGANIZATION_ID is required}"
ORGANIZATION_NAME="${ORGANIZATION_NAME:?ORGANIZATION_NAME is required}"
SERVICE="${SERVICE:?SERVICE is required}"
NODE_NAME="${NODE_NAME:?NODE_NAME is required}"
NODE_EXPORTER_URL="${NODE_EXPORTER_URL:-http://127.0.0.1:9100/metrics}"
VICTORIAMETRICS_URL="${VICTORIAMETRICS_URL:-http://127.0.0.1:8428}"
METRIC_FILTER_REGEX="${METRIC_FILTER_REGEX:-^(node_|go_|process_)}"
INSTANCE="${INSTANCE:-$(echo "$NODE_EXPORTER_URL" | sed -E 's#https?://([^/]+)/?.*#\1#')}"
TMP_RAW="$(mktemp)"
TMP_LABELED="$(mktemp)"

cleanup() {
  rm -f "$TMP_RAW" "$TMP_LABELED"
}
trap cleanup EXIT

curl -fsSL "$NODE_EXPORTER_URL" -o "$TMP_RAW"

awk -v org_id="$ORGANIZATION_ID" \
    -v org_name="$ORGANIZATION_NAME" \
    -v service="$SERVICE" \
    -v node="$NODE_NAME" \
    -v instance="$INSTANCE" \
    -v metric_regex="$METRIC_FILTER_REGEX" '
function add_labels(line, prefix, labelset, suffix) {
  extra = "organization_id=\"" org_id "\",organization_name=\"" org_name "\",service=\"" service "\",node=\"" node "\",instance=\"" instance "\""
  if (line ~ /^#/) return line
  if (line !~ metric_regex) return ""
  if (match(line, /^[^{ ]+\{[^}]*\}/)) {
    prefix = substr(line, 1, RLENGTH)
    suffix = substr(line, RLENGTH + 1)
    sub(/\{$/, "", prefix)
    labelset = substr(line, index(line, "{") + 1, RLENGTH - index(line, "{") - 1)
    return prefix "{" labelset "," extra "}" suffix
  }
  if (match(line, /^[^ {]+/)) {
    prefix = substr(line, 1, RLENGTH)
    suffix = substr(line, RLENGTH + 1)
    return prefix "{" extra "}" suffix
  }
  return ""
}
{ 
  transformed = add_labels($0)
  if (transformed != "") print transformed
}
' "$TMP_RAW" > "$TMP_LABELED"

curl -fsS -X POST \
  -H "Content-Type: text/plain; version=0.0.4" \
  --data-binary @"$TMP_LABELED" \
  "$VICTORIAMETRICS_URL/api/v1/import/prometheus"

echo "Metrics pushed successfully for ${ORGANIZATION_NAME}/${SERVICE}/${NODE_NAME} (${INSTANCE})"
