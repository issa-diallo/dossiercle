"""Deterministic retry policy tests, distinct from native runtime evidence."""
import json
from unittest.mock import patch
from s01_native_transport import bootstrap_service_token


class Clock:
    def __init__(self):
        self.now = 0

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


passed = 0
for result in ['recover', 'NATIVE_HTTP_401', 'NATIVE_HTTP_403', 'NATIVE_HTTP_500', 'timeout', 'invalid']:
    clock = Clock()
    calls = []

    def request(method, path, body, **options):
        calls.append(options)
        assert method == 'POST' and path == '/realms/master/protocol/openid-connect/token'
        assert body['client_id'] == 's01-bootstrap' and body['grant_type'] == 'client_credentials'
        assert options['form'] is True and 0 < options['timeout'] <= 20
        if result == 'recover':
            if len(calls) < 3:
                raise RuntimeError('NATIVE_HTTP_503')
            return {'access_token': 'synthetic-test-result'}
        if result == 'timeout':
            raise RuntimeError('NATIVE_HTTP_503')
        if result == 'invalid':
            return {'access_token': ''}
        raise RuntimeError(result)

    with patch('s01_native_transport.time.monotonic', clock.monotonic), patch('s01_native_transport.time.sleep', clock.sleep):
        try:
            token = bootstrap_service_token(request, 'synthetic-test-input')
            assert result == 'recover' and token == 'synthetic-test-result' and len(calls) == 3
        except RuntimeError as error:
            assert result != 'recover'
            if result == 'timeout':
                assert str(error) == 'NATIVE_BOOTSTRAP_NOT_READY' and clock.now == 30 and len(calls) == 30
            elif result == 'invalid':
                assert str(error) == 'NATIVE_BOOTSTRAP_TOKEN_INVALID' and len(calls) == 1
            else:
                assert str(error) == result and len(calls) == 1
    passed += 1

print(json.dumps({'policyCasesPassed': passed, 'boundaryMockOnly': True,
                  'noHumanOrBffRetry': True, 'onlyTechnical503Retries': True}))
