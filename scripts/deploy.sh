#!/usr/bin/env bash
# Phase 4 deploy — orchestrates GitHub repo creation + Netlify site + env vars + first deploy.
# Run from project root: bash scripts/deploy.sh

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
SITE_NAME="aim-studio"
GH_OWNER="ai-mindset-org"
GH_REPO="${GH_OWNER}/${SITE_NAME}"
OPENROUTER_KEY_FILE="${HOME}/.config/openrouter/api_key"

step() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$*"; }

# 1. Sanity checks
step "Sanity checks"
command -v gh >/dev/null || { echo "gh not installed"; exit 1; }
command -v netlify >/dev/null || { echo "netlify not installed"; exit 1; }
[ -f "$OPENROUTER_KEY_FILE" ] || { echo "OpenRouter key not at $OPENROUTER_KEY_FILE"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated"; exit 1; }
netlify status >/dev/null 2>&1 || { echo "netlify not authenticated"; exit 1; }
ok "gh + netlify authenticated, openrouter key present"

# 2. Build labs bundle to ensure latest
step "Build labs bundle"
node scripts/build-labs.mjs
ok "labs.bundle.js up to date"

# 3. Create GitHub repo if missing
step "GitHub repo ${GH_REPO}"
if gh repo view "$GH_REPO" >/dev/null 2>&1; then
  ok "repo already exists"
else
  gh repo create "$GH_REPO" --public --source="$ROOT" --remote=origin --description "AIM Studio — multi-lab banner generator (x26 / s3 / core)" --push
  ok "repo created and pushed"
fi

# 4. Push latest if not already
step "Push latest"
git push -u origin main 2>&1 | tail -3 || warn "nothing to push (already up to date)"

# 5. Create or link Netlify site
step "Netlify site ${SITE_NAME}"
if netlify api getSiteByName --data="{\"name\":\"${SITE_NAME}\"}" >/dev/null 2>&1; then
  ok "site exists, linking"
  netlify link --name "$SITE_NAME"
else
  ok "creating new site ${SITE_NAME}"
  netlify sites:create --name "$SITE_NAME" --account-slug ai-mindset
fi

# 6. Set env var
step "Set OPENROUTER_API_KEY"
OPENROUTER_KEY="$(cat "$OPENROUTER_KEY_FILE" | tr -d '[:space:]')"
netlify env:set OPENROUTER_API_KEY "$OPENROUTER_KEY" --context production --force
ok "env var set in production context"

# 7. Deploy
step "Deploy to production"
netlify deploy --prod --dir=. --message "first deploy of aim-studio"
ok "deploy complete"

# 8. Final URL
URL="https://${SITE_NAME}.netlify.app/"
step "Smoke test"
HTTP="$(curl -s -o /dev/null -w "%{http_code}" "$URL")"
if [ "$HTTP" = "200" ]; then
  ok "${URL} returns 200"
else
  warn "${URL} returned ${HTTP} — may need a minute to propagate"
fi

printf "\n\033[1;32m✓ aim-studio live at %s\033[0m\n" "$URL"
