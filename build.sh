#!/usr/bin/env bash
set -euo pipefail

if [ -n "$(git status --porcelain)" ]; then
    echo "Aborting due to dirty working tree" >&2
    exit 1
fi

REV=$(git rev-parse --short HEAD)
REMOTE=$(git remote get-url origin)
NAME=$(git config user.name)
EMAIL=$(git config user.email)

rm -rf dist
npm run build

cd dist
git init -b gh-pages
git config user.name "$NAME"
git config user.email "$EMAIL"
git remote add origin "$REMOTE"
git add -A
git commit -m "Build for commit $REV"
git push --force origin gh-pages
