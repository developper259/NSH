#!/usr/bin/env bash
set -euo pipefail

name="${1:-world}"
if [[ -n "$name" ]]; then
  echo "Hello $name"
fi

for file in *.txt; do
  printf '%s\n' "$file"
done

cat <<EOF
done
EOF
