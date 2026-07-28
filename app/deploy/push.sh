#!/usr/bin/env bash
# Redeploy via git: push local commits to GitHub, then pull + restart on the VPS.
#
#   VPS=you@1.2.3.4 ./app/deploy/push.sh
#
# Commit your work first (this only ships committed state):
#   git commit -am "…"  &&  VPS=you@host ./app/deploy/push.sh
#
# Optional: DEST=/opt/guildhq (default install path on the VPS)
#
# Secrets stay off git and out of this flow — /etc/guildhq.env is placed on the
# VPS once and never overwritten. Guild data lives in /var/lib/guildhq (outside
# the checkout), untouched by any git operation. Tests run in GitHub Actions on
# every push, so a red CI is your signal not to deploy.
set -euo pipefail

VPS="${VPS:?set VPS=user@host, e.g. VPS=you@1.2.3.4 ./app/deploy/push.sh}"
DEST="${DEST:-/opt/guildhq}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ -n "$(git status --porcelain)" ]; then
  echo "⚠ uncommitted changes — commit them first (git commit -am '…'). Aborting." >&2
  exit 1
fi

echo "→ pushing $BRANCH to origin"
git push origin "$BRANCH"

echo "→ pulling + restarting on $VPS"
ssh "$VPS" "cd '$DEST' && git pull --ff-only && sudo systemctl restart guildhq && systemctl is-active guildhq"

echo "✓ deployed $(git rev-parse --short HEAD) to $VPS"
echo "  Changed the Caddy site block?  re-append app/deploy/Caddyfile.snippet into /etc/caddy/Caddyfile, then sudo systemctl reload caddy"
echo "  Changed guildhq.service?       ssh $VPS 'sudo cp $DEST/app/deploy/guildhq.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart guildhq'"
echo "  Roll back?                     ssh $VPS 'cd $DEST && git reset --hard <old-sha> && sudo systemctl restart guildhq'"
