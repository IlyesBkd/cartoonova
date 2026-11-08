"""Real isolated TLS nginx -> Python service test. No live server config changed."""
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import ssl
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

from server import StorageServer, sign


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@unittest.skipUnless(shutil.which("nginx") and importlib.util.find_spec("cryptography") and hasattr(os, "memfd_create"), "nginx/cryptography/Linux memfd required for isolated TLS test")
class NginxProxyTests(unittest.TestCase):
    def test_private_tls_upload_download_via_actual_proxy(self):
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import serialization, hashes
        from cryptography.hazmat.primitives.asymmetric import rsa

        with tempfile.TemporaryDirectory(prefix="cartoonova-nginx-", dir=os.environ["TMPDIR"]) as scratch:
            secret = secrets.token_bytes(32)
            storage = StorageServer(str(Path(scratch) / "objects"), secret)
            thread = threading.Thread(target=storage.serve_forever, daemon=True)
            thread.start()
            files = []
            process = None
            try:
                key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
                name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
                now = datetime.datetime.now(datetime.timezone.utc)
                cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
                        .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=1))
                        .not_valid_after(now + datetime.timedelta(hours=1))
                        .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")]), critical=False)
                        .sign(key, hashes.SHA256()))
                cert_bytes = cert.public_bytes(serialization.Encoding.PEM)
                key_bytes = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption())
                for label, data in [("synthetic-cert", cert_bytes), ("synthetic-key", key_bytes)]:
                    fd = os.memfd_create(label, 0)
                    files.append(fd)
                    os.write(fd, data)
                cert_fd, key_fd = files
                http_port, tls_port = free_port(), free_port()
                config = Path(__file__).with_name("nginx-cartoonova-files.conf").read_text()
                config = config.replace("listen 80;", f"listen 127.0.0.1:{http_port};").replace("    listen [::]:80;", "")
                config = config.replace("listen 443 ssl;", f"listen 127.0.0.1:{tls_port} ssl;").replace("    listen [::]:443 ssl;", "")
                config = config.replace("/etc/letsencrypt/live/files.cartoonova.com/fullchain.pem", f"/proc/self/fd/{cert_fd}")
                config = config.replace("/etc/letsencrypt/live/files.cartoonova.com/privkey.pem", f"/proc/self/fd/{key_fd}")
                config = config.replace("127.0.0.1:8765", f"127.0.0.1:{storage.server_port}")
                config = f"daemon off; error_log /dev/null emerg; pid {scratch}/nginx.pid; events {{}} http {{ {config} }}"
                config_fd = os.memfd_create("isolated-config", 0)
                files.append(config_fd)
                os.write(config_fd, config.encode())
                nginx = shutil.which("nginx")
                assert nginx is not None
                process = subprocess.Popen([nginx, "-c", f"/proc/self/fd/{config_fd}", "-p", scratch], pass_fds=tuple(files), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                for _ in range(100):
                    if process.poll() is not None:
                        self.fail("Isolated nginx failed to start")
                    try:
                        with socket.create_connection(("127.0.0.1", tls_port), timeout=0.1):
                            break
                    except OSError:
                        time.sleep(0.02)
                context = ssl.create_default_context(cadata=cert_bytes.decode())
                content = b"synthetic-cartoonova-private-fixture"
                path = "/v1/files/orders/" + "c" * 32
                url = f"https://localhost:{tls_port}{path}"
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(url, context=context, timeout=5)
                self.assertEqual(error.exception.code, 403)
                error.exception.close()
                claims = {"v": 1, "method": "PUT", "path": path, "exp": int(time.time()) + 60,
                          "sha256": hashlib.sha256(content).hexdigest(), "type": "application/octet-stream", "maxbytes": len(content)}
                request = urllib.request.Request(url, data=content, method="PUT", headers={"Authorization": "Bearer " + sign(secret, claims), "Content-Type": claims["type"]})
                with urllib.request.urlopen(request, context=context, timeout=5) as response:
                    self.assertEqual(response.status, 201)
                    self.assertEqual(json.load(response)["sha256"], claims["sha256"])
                claims["method"] = "GET"
                request = urllib.request.Request(url, headers={"Authorization": "Bearer " + sign(secret, claims)})
                with urllib.request.urlopen(request, context=context, timeout=5) as response:
                    self.assertEqual(response.read(), content)
                    self.assertIn("private", response.headers["Cache-Control"])
                with self.assertRaises(urllib.error.HTTPError) as denied:
                    urllib.request.urlopen(url, context=context, timeout=5)
                self.assertEqual(denied.exception.code, 403)
                denied.exception.close()
            finally:
                if process:
                    process.terminate()
                    try:
                        out, err = process.communicate(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        out, err = process.communicate()
                    self.assertNotIn(secret, out + err)
                storage.shutdown()
                storage.server_close()
                thread.join(timeout=2)
                for fd in files:
                    os.close(fd)


if __name__ == "__main__":
    unittest.main()
