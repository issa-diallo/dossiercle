"""The top-level native status and HTTP status must both be ready."""
import json
from pathlib import Path
import subprocess

root = Path.cwd().resolve()
cases = [
    ('200 OK', '{"status":"UP","checks":[]}', True),
    ('503 Unavailable', '{"status":"DOWN","checks":[{"status":"UP"}]}', False),
    ('200 OK', '{"status":"DOWN","checks":[{"status":"UP"}]}', False),
    ('200 OK', '{"checks":[{"status":"UP"}]}', False),
    ('200 OK', 'invalid UP', False),
    ('200 OK', '{"status":"UP"', False),
    ('200 OK', '{"status":"UP"garbage}', False),
]
for status, body, expected in cases:
    result = subprocess.run(
        ['bash', str(root / 'infra/identity/keycloak-health.sh'), '--check-response'],
        input='HTTP/1.1 ' + status + '\r\nContent-Type: application/json\r\n\r\n' + body,
        text=True, capture_output=True
    )
    assert (result.returncode == 0) is expected, 'NATIVE_HEALTH_FALSE_POSITIVE'
    assert not result.stdout and not result.stderr, 'NATIVE_HEALTH_OUTPUT'
print(json.dumps({'casesPassed': len(cases), 'nestedUpCannotOpen': True}))
