"""Private native bootstrap HTTPS, without proxies or redirects."""
import http.client
import ipaddress
import socket
import ssl
import time
import urllib.parse
import urllib.request


class ClosedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('NATIVE_REDIRECT_CLOSED')


class FixedNativeOrigin(urllib.request.BaseHandler):
    def default_open(self, req):
        origin = urllib.parse.urlsplit(req.full_url)
        if (origin.scheme != 'https' or origin.hostname != 'keycloak'
                or origin.port != 8443 or origin.username is not None
                or origin.password is not None):
            raise RuntimeError('NATIVE_ORIGIN_CLOSED')
        return None


def keycloak_opener(private_address, ca_file):
    assert ipaddress.ip_address(private_address).is_private, 'PRIVATE_ADDRESS_REQUIRED'
    context = ssl.create_default_context(cafile=str(ca_file))

    class NativeConnection(http.client.HTTPSConnection):
        def connect(self):
            stream = socket.create_connection((private_address, 8443), self.timeout)
            try:
                self.sock = context.wrap_socket(stream, server_hostname='keycloak')
            except BaseException:
                stream.close()
                raise

    class NativeHTTPSHandler(urllib.request.HTTPSHandler):
        def https_open(self, req):
            return self.do_open(NativeConnection, req)

    return urllib.request.build_opener(
        urllib.request.ProxyHandler({}), FixedNativeOrigin(),
        NativeHTTPSHandler(), ClosedRedirect()
    )


def bootstrap_service_token(request, secret):
    """Retry scheduling budget: 30s, only native 503 of the technical grant."""
    deadline = time.monotonic() + 30
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError('NATIVE_BOOTSTRAP_NOT_READY')
        try:
            response = request('POST', '/realms/master/protocol/openid-connect/token',
                               {'grant_type': 'client_credentials', 'client_id': 's01-bootstrap',
                                'client_secret': secret}, form=True, timeout=min(20, remaining))
            token = response['access_token']
            if not isinstance(token, str) or not token:
                raise RuntimeError('NATIVE_BOOTSTRAP_TOKEN_INVALID')
            return token
        except RuntimeError as error:
            remaining = deadline - time.monotonic()
            if str(error) != 'NATIVE_HTTP_503' or remaining <= 0:
                raise
            time.sleep(min(1, remaining))
