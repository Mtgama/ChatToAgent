#!/bin/sh
set -eu
task_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js نسخهٔ ۲۲.۱۲ یا جدیدتر را نصب کنید.' >&2
  exit 1
fi
exec node "$task_directory/install.mjs" "$@"
