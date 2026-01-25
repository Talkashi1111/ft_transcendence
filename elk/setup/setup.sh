#!/bin/sh
set -eu

: "${ELASTIC_PASSWORD:?missing ELASTIC_PASSWORD}"
: "${KIBANA_PASSWORD:?missing KIBANA_PASSWORD}"

echo "Waiting for Elasticsearch (elastic auth)..."
until curl -fsS -u "elastic:${ELASTIC_PASSWORD}" \
  http://elasticsearch:9200/_security/_authenticate >/dev/null; do
  echo "  ...not ready yet"
  sleep 2
done

echo "Setting kibana_system password..."
curl -fsS -u "elastic:${ELASTIC_PASSWORD}" \
  -H "Content-Type: application/json" \
  -X POST "http://elasticsearch:9200/_security/user/kibana_system/_password" \
  -d "{\"password\":\"${KIBANA_PASSWORD}\"}" >/dev/null

echo "Verifying kibana_system..."
curl -fsS -u "kibana_system:${KIBANA_PASSWORD}" \
  http://elasticsearch:9200/_security/_authenticate >/dev/null

echo "Done."
