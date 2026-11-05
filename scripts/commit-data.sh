#!/usr/bin/env bash
set -euo pipefail
file="${1:?data path required}"
message="${2:?commit message required}"
case "$file" in data/today.json|data/charts.json) ;; *) echo 'Unsupported data path' >&2; exit 1;; esac
# Both scheduled writers share a concurrency group. Handle unrelated human pushes
# without force-pushing or overwriting their changes; conflicts stop for review.
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -- "$file"
if git diff --cached --quiet; then echo 'No data changes'; exit 0; fi
git commit -m "$message"
for attempt in 1 2 3; do
  git fetch origin main
  if ! git rebase origin/main; then
    git rebase --abort
    echo 'Concurrent changes need review; nothing was overwritten.' >&2
    exit 1
  fi
  if git push origin HEAD:main; then exit 0; fi
  sleep "$attempt"
done
echo 'Unable to publish after concurrent updates; retry the workflow.' >&2
exit 1
