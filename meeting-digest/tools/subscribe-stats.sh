#!/usr/bin/env bash
# Print common D1 stats for the meeting-digest subscription system.
# Usage: ./tools/subscribe-stats.sh           # prod
#        ./tools/subscribe-stats.sh staging   # staging
#
# Requires: CLOUDFLARE_API_TOKEN exported, run from anywhere in the repo.

set -euo pipefail

env_flag=""
db="meeting-digest"
if [[ "${1:-}" == "staging" ]]; then
  env_flag="--env staging"
  db="meeting-digest-staging"
fi

cd "$(dirname "$0")/.."

run() {
  local title="$1"
  local sql="$2"
  echo
  echo "=== $title ==="
  npx wrangler --config worker/wrangler.toml d1 execute "$db" --remote $env_flag --command "$sql"
}

run "Subscribers by status" \
  "SELECT status, COUNT(*) AS n FROM subscriber GROUP BY status ORDER BY n DESC;"

run "Signups by day (last 30)" \
  "SELECT date(created_at,'unixepoch') AS day, COUNT(*) AS signups
   FROM subscriber
   WHERE created_at >= strftime('%s','now','-30 days')
   GROUP BY day ORDER BY day DESC;"

run "Pending-confirmation older than 24h" \
  "SELECT COUNT(*) AS stale_pending FROM subscriber
   WHERE status='pending_confirmation'
     AND created_at < strftime('%s','now','-1 day');"

run "Monday digest sends (last 8 weeks)" \
  "SELECT date(sent_at,'unixepoch') AS day,
          COUNT(*) AS sends,
          SUM(n_meetings) AS total_meetings,
          SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
          SUM(CASE WHEN status='bounced'   THEN 1 ELSE 0 END) AS bounced,
          SUM(CASE WHEN status='complained' THEN 1 ELSE 0 END) AS complained,
          SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END) AS failed
   FROM delivery_log
   WHERE sent_at >= strftime('%s','now','-56 days')
   GROUP BY day ORDER BY day DESC;"

run "Top boards/topics among confirmed subscribers" \
  "SELECT boards, topics, COUNT(*) AS n FROM subscriber
   WHERE status='confirmed'
   GROUP BY boards, topics ORDER BY n DESC LIMIT 10;"
