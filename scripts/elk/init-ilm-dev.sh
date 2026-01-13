#!/usr/bin/env bash
set -euo pipefail

ES_URL="${ES_URL:-http://127.0.0.1:9200}"
POLICY="fttranscendence-dev-retention"
TEMPLATE="fttranscendence-dev-template"

echo "⏳ Waiting for Elasticsearch at $ES_URL ..."
until curl -s "$ES_URL" >/dev/null; do
  sleep 1
done

echo "✅ Elasticsearch is up. Installing ILM policy + index template..."

# Delete indices after 3 days (adjust if you want)
curl -s -X PUT "$ES_URL/_ilm/policy/$POLICY" \
  -H 'Content-Type: application/json' \
  -d @- <<'JSON'
{
  "policy": {
    "phases": {
      "hot": { "actions": {} },
      "delete": {
        "min_age": "3d",
        "actions": { "delete": {} }
      }
    }
  }
}
JSON

# Apply the ILM policy to our dev indices
curl -s -X PUT "$ES_URL/_index_template/$TEMPLATE" \
  -H 'Content-Type: application/json' \
  -d @- <<'JSON'
{
  "index_patterns": ["fttranscendence-dev-*"],
  "template": {
    "settings": {
      "index.lifecycle.name": "fttranscendence-dev-retention",
      "number_of_replicas": 0
    }
  }
}
JSON


echo "🎯 ILM installed:"
echo "  - policy:   $POLICY (delete after 3d)"
echo "  - template: $TEMPLATE (fttranscendence-dev-*)"
