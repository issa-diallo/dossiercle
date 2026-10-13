"""Real synthetic TLS checks; no credential or response body is printed."""
import json
from pathlib import Path
import ssl
import subprocess
import urllib.error
from s01_native_transport import ClosedRedirect, keycloak_opener

root = Path.cwd().resolve()
state = json.loads((root / '.local/environment.json').read_text())
assert state['syntheticOnly'] is True and state['root'] == str(root)
private = Path(state['private'])
assert json.loads((private / 'synthetic.json').read_text()) == {
    'root': str(root), 'project': state['project']
}


def address(service):
    networks = json.loads(subprocess.check_output([
        'docker', 'inspect', '--format', '{{json .NetworkSettings.Networks}}',
        state['project'] + '-' + service + '-1'
    ]))
    return networks[state['project'] + '_private']['IPAddress']


endpoint = 'https://keycloak:8443/realms/dossiercle/.well-known/openid-configuration'
opener = keycloak_opener(address('keycloak'), private / 'ca/ca.crt')
with opener.open(endpoint, timeout=10) as response:
    assert response.status == 200, 'NATIVE_TLS_NOT_READY'

for native_address, ca_file in [
    (address('keycloak'), private / 'coordinator-tls/ca.crt'),
    (address('privacyidea'), private / 'ca/ca.crt'),
]:
    try:
        with keycloak_opener(native_address, ca_file).open(endpoint, timeout=10):
            raise AssertionError('UNTRUSTED_NATIVE_TLS_OPEN')
    except urllib.error.URLError as error:
        assert isinstance(error.reason, ssl.SSLCertVerificationError), 'TLS_FAILURE_NOT_VERIFICATION'

for closed_url in ['http://keycloak:8080/', 'https://invalid.example:8443/']:
    try:
        opener.open(closed_url, timeout=10)
        raise AssertionError('NATIVE_ORIGIN_OPEN')
    except RuntimeError as error:
        assert str(error) == 'NATIVE_ORIGIN_CLOSED'

try:
    ClosedRedirect().redirect_request(None, None, 302, '', {}, 'https://invalid.example')
    raise AssertionError('NATIVE_REDIRECT_OPEN')
except RuntimeError as error:
    assert str(error) == 'NATIVE_REDIRECT_CLOSED'

print(json.dumps({'syntheticOnly': True, 'nativeTLS': True,
                  'wrongCAClosed': True, 'wrongHostnameClosed': True,
                  'httpClosed': True, 'foreignOriginClosed': True, 'redirectHandlerClosed': True}))
