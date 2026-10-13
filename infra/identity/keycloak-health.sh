#!/usr/bin/env bash
set -euo pipefail
if [[ ${1:-} == --check-response && $# == 1 ]]; then
  response=$(cat)
elif [[ $# == 0 ]]; then
  exec 3<>/dev/tcp/127.0.0.1/9000
  printf 'GET /health/ready HTTP/1.0\r\nHost: localhost\r\n\r\n' >&3
  response=$(cat <&3)
else
  exit 2
fi
status=${response%%$'\r\n'*}
[[ $status =~ ^HTTP/1\.[01][[:space:]]200[[:space:]] ]] || exit 1
body=${response#*$'\r\n\r\n'}
body=${body//[[:space:]]/}
[[ $body == *'}' ]] || exit 1
[[ $body == '{"status":"UP"}' || $body == '{"status":"UP",'* ]] || exit 1
