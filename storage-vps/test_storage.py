"""Real loopback HTTP tests; all fixture bytes stay in this staging directory."""
import contextlib
import hashlib
import http.client
import io
import json
import os
from pathlib import Path
import secrets
import socket
import stat
import subprocess
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor

from server import MAX_BYTES, StorageServer, sign

HERE = Path(__file__).resolve().parent


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix=".test-", dir=HERE)
        self.root = Path(self.temp.name) / "private"
        self.secret = secrets.token_bytes(48)  # Generated only in process memory.
        self.now = 1000
        self.server = StorageServer(str(self.root), self.secret, clock=lambda: self.now,
                                    timeout=2, origins=("https://cartoonova.example",))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]
        self.body = b"\x00binary\xff\r\n%PDF-1.7\n"
        self.path = "/v1/files/orders/" + "a" * 32
        self.errors = io.StringIO()
        self.capture = contextlib.redirect_stderr(self.errors)
        self.capture.__enter__()

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.capture.__exit__(None, None, None)
        self.temp.cleanup()
        self.assertNotIn(self.secret.hex(), self.errors.getvalue())
        self.assertEqual(self.errors.getvalue(), "")

    def claims(self, method="PUT", path=None, **changes):
        value = {"v": 1, "method": method, "path": path or self.path,
                 "exp": 1060, "sha256": hashlib.sha256(self.body).hexdigest(),
                 "type": "application/octet-stream", "maxbytes": MAX_BYTES}
        value.update(changes)
        return value

    def request(self, method="PUT", path=None, body=None, claims=None, token=None, headers=None):
        path = path or self.path
        payload = self.body if body is None and method == "PUT" else body
        grant = token if token is not None else sign(self.secret, claims or self.claims(method, path))
        request_headers = {"Authorization": "Bearer " + grant}
        if method == "PUT":
            request_headers["Content-Type"] = "application/octet-stream"
        request_headers.update(headers or {})
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=4)
        try:
            connection.request(method, path, body=payload, headers=request_headers)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_roundtrip_binary_and_private_permissions(self):
        status, _, body = self.request()
        self.assertEqual(status, 201)
        self.assertEqual(json.loads(body)["sha256"], hashlib.sha256(self.body).hexdigest())
        status, headers, body = self.request("GET")
        self.assertEqual((status, body), (200, self.body))
        self.assertEqual(headers["Cache-Control"], "private, no-store")
        self.assertEqual(headers["Content-Disposition"], 'attachment; filename="download"')
        for path in [self.root, self.root / "orders"]:
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE((self.root / "orders" / ("a" * 32 + ".blob")).stat().st_mode), 0o400)

    def test_all_categories_pdf(self):
        for category in ("orders", "retouches", "final", "extras"):
            path = "/v1/files/" + category + "/" + "b" * 32
            claims = self.claims(path=path, type="application/pdf")
            self.assertEqual(self.request(path=path, claims=claims, headers={"Content-Type": "application/pdf"})[0], 201)
            self.assertEqual(self.request("GET", path=path, claims={**claims, "method": "GET"})[0], 200)

    def test_invalid_grants_and_no_secret_exposure(self):
        valid = sign(self.secret, self.claims())
        cases = ["", "invalid", valid + "x", sign(secrets.token_bytes(48), self.claims()),
                 sign(self.secret, self.claims(exp=1000)), sign(self.secret, self.claims(exp=1121)),
                 sign(self.secret, self.claims(method="GET")), sign(self.secret, self.claims(v=True)),
                 sign(self.secret, self.claims(maxbytes=MAX_BYTES + 1)),
                 sign(self.secret, self.claims(type="text/html")),
                 sign(self.secret, self.claims(sha256="g" * 64)),
                 sign(self.secret, self.claims(type=[]))]
        for token in cases:
            with self.subTest(token_shape=len(token)):
                status, headers, body = self.request(token=token)
                self.assertEqual(status, 403)
                self.assertEqual(body, b"")
                self.assertNotIn(token, str(headers)) if token else None
        self.assertFalse((self.root / "orders").exists())

    def test_traversal_and_query_confusion(self):
        for path in ("/v1/files/orders/../final/" + "a" * 32,
                     "/v1/files/orders/%2e%2e/" + "a" * 32,
                     "/v1/files/orders/" + "a" * 32 + "%2f..", "/etc/passwd",
                     "/v1/files//orders/" + "a" * 32, self.path + "/", self.path + "#fragment"):
            self.assertEqual(self.request(path=path)[0], 400)
        self.assertEqual(self.request(path=self.path + "?grant=x")[0], 403)
        self.assertEqual(self.request("GET", path=self.path + "?grant=x&other=1")[0], 403)

    def test_duplicate_replay_and_concurrent_exclusion(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = sorted(pool.map(lambda _: self.request()[0], range(2)))
        self.assertEqual(statuses, [201, 409])
        self.assertEqual(self.request()[0], 409)
        self.assertEqual(self.request("GET")[2], self.body)
        # A new grant cannot replace the same key either.
        self.assertEqual(self.request(claims=self.claims(exp=1070))[0], 409)

    def test_grants_bound_to_method_path_and_download_ceiling(self):
        token = sign(self.secret, self.claims())
        self.assertEqual(self.request("GET", token=token)[0], 403)
        other = "/v1/files/orders/" + "c" * 32
        self.assertEqual(self.request(path=other, token=token)[0], 403)
        self.assertEqual(self.request()[0], 201)
        self.assertEqual(self.request("GET", claims=self.claims("GET", maxbytes=1))[0], 413)

    def test_reservations_and_verified_objects_survive_restart(self):
        self.assertEqual(self.request()[0], 201)
        failed = "/v1/files/orders/" + "b" * 32
        self.assertEqual(self.request(path=failed, claims=self.claims(path=failed, sha256="0" * 64))[0], 422)
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.server = StorageServer(str(self.root), self.secret, clock=lambda: self.now)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]
        self.assertEqual(self.request()[0], 409)
        self.assertEqual(self.request(path=failed)[0], 409)
        self.assertEqual(self.request("GET")[2], self.body)
        self.assertEqual(self.request("GET", path=failed)[0], 404)

    def test_corrupted_object_not_served(self):
        self.assertEqual(self.request()[0], 201)
        blob = self.root / "orders" / ("a" * 32 + ".blob")
        blob.chmod(0o600)
        blob.write_bytes(b"corrupted")
        blob.chmod(0o400)
        self.assertEqual(self.request("GET")[0], 422)

    def test_maxsize_global_cap_grant_cap_and_type(self):
        self.assertEqual(self.request(headers={"Content-Length": str(MAX_BYTES + 1)})[0], 413)
        self.assertEqual(self.request(claims=self.claims(maxbytes=1))[0], 413)
        self.assertEqual(self.request(headers={"Content-Type": "image/png"})[0], 415)
        self.assertFalse((self.root / "orders" / ("a" * 32 + ".claim")).exists())
        # Exercise exactly the hard cap with real bytes (10 MiB).
        data = b"x" * MAX_BYTES
        claims = self.claims(sha256=hashlib.sha256(data).hexdigest())
        self.assertEqual(self.request(body=data, claims=claims)[0], 201)
        result = self.request("GET", claims={**claims, "method": "GET"})
        self.assertEqual(result[0], 200)
        self.assertEqual(hashlib.sha256(result[2]).hexdigest(), claims["sha256"])

    def test_hash_mismatch_consumes_key_no_partial_publication(self):
        self.assertEqual(self.request(claims=self.claims(sha256="0" * 64))[0], 422)
        self.assertEqual(self.request("GET")[0], 404)
        self.assertEqual(self.request()[0], 409)
        self.assertEqual(list((self.root / "orders").glob("*.pending")), [])

    def test_download_auth_expiry_signed_url_and_hash(self):
        self.assertEqual(self.request()[0], 201)
        self.assertEqual(self.request("GET", token="")[0], 403)
        self.assertEqual(self.request("GET", claims=self.claims("GET", sha256="0" * 64))[0], 422)
        token = sign(self.secret, self.claims("GET"))
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=4)
        connection.request("GET", self.path + "?grant=" + token)
        response = connection.getresponse()
        self.assertEqual((response.status, response.read()), (200, self.body))
        connection.close()
        self.now = 1060
        self.assertEqual(self.request("GET", token=token)[0], 403)

    def raw(self, wire, *, half_close=False):
        with socket.create_connection(("127.0.0.1", self.port), timeout=4) as sock:
            sock.sendall(wire)
            if half_close:
                sock.shutdown(socket.SHUT_WR)
            data = b""
            while True:
                block = sock.recv(65536)
                if not block:
                    return data
                data += block

    def test_partial_upload_and_retry(self):
        token = sign(self.secret, self.claims())
        wire = (f"PUT {self.path} HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\n"
                f"Content-Type: application/octet-stream\r\nContent-Length: {len(self.body)}\r\n\r\n").encode() + self.body[:2]
        self.assertIn(b"400", self.raw(wire, half_close=True).split(b"\r\n")[0])
        self.assertEqual(self.request("GET")[0], 404)
        self.assertEqual(self.request()[0], 409)
        self.assertEqual(list((self.root / "orders").glob("*.pending")), [])

    def test_time_bound_body_and_headers(self):
        # Actual deadline, not a mocked socket. watchdog also bounds slow headers.
        self.server.io_timeout = 0.15
        token = sign(self.secret, self.claims())
        wire = (f"PUT {self.path} HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\n"
                "Content-Type: application/octet-stream\r\nContent-Length: 10\r\n\r\nx").encode()
        self.raw(wire)
        self.assertEqual(self.request("GET")[0], 404)
        self.assertEqual(self.request()[0], 409)
        self.assertEqual(self.raw(b"GET /v1/files/ HTTP/1.1\r\nHost:"), b"")

    def test_ambiguous_framing_rejected(self):
        token = sign(self.secret, self.claims())
        head = f"PUT {self.path} HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\n"
        for tail, expected in [("Content-Length: 1\r\nContent-Length: 1\r\n\r\nx", b"411"),
                               ("Transfer-Encoding: chunked\r\n\r\n0\r\n\r\n", b"400"),
                               ("\r\n", b"411")]:
            self.assertIn(expected, self.raw((head + tail).encode()).split(b"\r\n")[0])

    def test_symlink_and_unsafe_root_rejected(self):
        outside = Path(self.temp.name) / "untouched"
        outside.mkdir(mode=0o700)
        (self.root / "orders").symlink_to(outside, target_is_directory=True)
        self.assertEqual(self.request()[0], 400)
        self.assertEqual(list(outside.iterdir()), [])
        linked = Path(self.temp.name) / "linked"
        linked.symlink_to(outside, target_is_directory=True)
        with self.assertRaises(OSError):
            StorageServer(str(linked), self.secret)
        unsafe = Path(self.temp.name) / "unsafe"
        unsafe.mkdir(mode=0o755)
        unsafe.chmod(0o755)
        with self.assertRaises(ValueError):
            StorageServer(str(unsafe), self.secret)

    def test_symlink_file_cannot_be_read_or_overwritten(self):
        self.assertEqual(self.request()[0], 201)
        folder = self.root / "orders"
        other_key = "b" * 32
        (folder / (other_key + ".blob")).symlink_to(folder / ("a" * 32 + ".blob"))
        path = "/v1/files/orders/" + other_key
        self.assertEqual(self.request("GET", path=path)[0], 400)
        self.assertEqual(self.request(path=path)[0], 409)
        self.assertTrue((folder / (other_key + ".blob")).is_symlink())

    def test_cors_is_explicit_no_credentials(self):
        origin = "https://cartoonova.example"
        self.assertEqual(self.request("OPTIONS", headers={"Origin": origin})[0], 204)
        self.assertEqual(self.request("OPTIONS", headers={"Origin": "https://evil.example"})[0], 403)
        status, headers, _ = self.request(headers={"Origin": origin})
        self.assertEqual(status, 201)
        self.assertEqual(headers["Access-Control-Allow-Origin"], origin)
        self.assertNotIn("Access-Control-Allow-Credentials", headers)

    def test_process_startup_and_no_credential_output(self):
        # Execute the real entrypoint with a generated ENV-only secret, no dotenv.
        runtime_secret = secrets.token_hex(32)
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
        environment = {"PATH": os.environ.get("PATH", ""), "PYTHONDONTWRITEBYTECODE": "1",
                       "STORAGE_ROOT": str(Path(self.temp.name) / "process-private"),
                       "STORAGE_HMAC_SECRET": runtime_secret, "STORAGE_PORT": str(port)}
        process = subprocess.Popen([sys.executable, "-B", str(HERE / "server.py")],
                                   env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            assert process.stdout is not None
            self.assertEqual(process.stdout.readline(), b"Private storage listening on loopback\n")
            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
            connection.request("GET", self.path)
            response = connection.getresponse()
            self.assertEqual((response.status, response.read()), (403, b""))
            connection.close()
        finally:
            process.terminate()
            stdout, stderr = process.communicate(timeout=4)
        self.assertEqual((stdout, stderr), (b"", b""))
        for file in Path(self.temp.name).rglob("*"):
            if file.is_file() and not file.is_symlink():
                self.assertNotIn(runtime_secret.encode(), file.read_bytes())


if __name__ == "__main__":
    unittest.main(verbosity=2)
