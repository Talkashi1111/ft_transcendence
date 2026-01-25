#!/bin/sh
set -eu
: "${ELASTIC_PASSWORD:?missing ELASTIC_PASSWORD}"

until curl -sS -u "elastic:${ELASTIC_PASSWORD}" http://kibana:5601/api/status \
  | grep -q '"level":"available"\|"level":"degraded"'; do
  echo "Waiting for Kibana..."
  sleep 2
done

resp="$(curl -sS -u "elastic:${ELASTIC_PASSWORD}" \
  -X POST "http://kibana:5601/api/saved_objects/_import?overwrite=true" \
  -H "kbn-xsrf: true" \
  -F "file=@/import/config_dash.ndjson")"
echo "$resp"
echo "$resp" | grep -q '"success":true'
