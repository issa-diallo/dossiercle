"""Private native bootstrap HTTPS, without proxies or redirects."""
import http.client
import ipaddress
import socket
import ssl
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
