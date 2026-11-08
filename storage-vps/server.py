#!/usr/bin/env python3
"""Private, immutable binary storage. No third-party dependencies."""
import base64
import hashlib
import hmac
import json
import os
import re
import socket
import stat
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import cast
from urllib.parse import urlsplit

MAX_BYTES = 10 * 1024 * 1024
MAX_TTL = 120
CHUNK = 64 * 1024
PATH = re.compile(r"/v1/files/(orders|retouches|final|extras)/([a-f0-9]{32})\Z")
TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf", "application/octet-stream"}
FIELDS = {"v", "method", "path", "exp", "sha256", "type", "maxbytes"}
NOFOLLOW = os.O_NOFOLLOW | os.O_CLOEXEC


class Rejected(Exception):
    def __init__(self, status):
        self.status = status


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign(secret, claims):
    """Issuer helper; secret is supplied in memory, never read from a file."""
    payload = b64(json.dumps(claims, sort_keys=True, separators=(",", ":")).encode())
    signature = b64(hmac.digest(secret, b"cartoonova-storage-v1." + payload.encode(), "sha256"))
    return payload + "." + signature


def verify(secret, token, method, path, now):
    try:
        if len(token) > 2048 or not re.fullmatch(r"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}", token):
            raise ValueError()
        payload, signature = token.split(".")
        expected = b64(hmac.digest(secret, b"cartoonova-storage-v1." + payload.encode(), "sha256"))
        if not hmac.compare_digest(expected, signature):
            raise ValueError()
        raw = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
        claims = json.loads(raw)
        if not isinstance(claims, dict) or set(claims) != FIELDS:
            raise ValueError()
        if type(claims["v"]) is not int or claims["v"] != 1:
            raise ValueError()
        if claims["method"] != method or claims["path"] != path or not PATH.fullmatch(path):
            raise ValueError()
        if type(claims["exp"]) is not int or not now < claims["exp"] <= now + MAX_TTL:
            raise ValueError()
        if type(claims["maxbytes"]) is not int or not 1 <= claims["maxbytes"] <= MAX_BYTES:
            raise ValueError()
        if not isinstance(claims["sha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", claims["sha256"]):
            raise ValueError()
        if claims["type"] not in TYPES:
            raise ValueError()
        return claims
    except (ValueError, TypeError, KeyError, UnicodeError):
        raise Rejected(403) from None


def private_dir(fd):
    info = os.fstat(fd)
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError("Storage directory must be owned by service user and private (0700)")
    return fd


def open_root(path):
    """Walk every ancestor without following symlinks; create only final leaf."""
    if not os.path.isabs(path) or any(p in ("", ".", "..") for p in path.split("/")[1:]):
        raise ValueError("STORAGE_ROOT must be an absolute canonical path")
    parts = path.split("/")[1:]
    fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY | NOFOLLOW)
    try:
        for i, part in enumerate(parts):
            if i == len(parts) - 1:
                try:
                    os.mkdir(part, 0o700, dir_fd=fd)
                except FileExistsError:
                    pass
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = child
        private_dir(fd)
        return fd
    except BaseException:
        os.close(fd)
        raise


class StorageServer(ThreadingHTTPServer):
    daemon_threads = True
    block_on_close = False
    request_queue_size = 16

    def __init__(self, root, secret, port=0, *, clock=time.time, timeout: float=15, origins=()):
        if not isinstance(secret, bytes) or len(secret) < 32:
            raise ValueError("Runtime secret must contain at least 32 bytes")
        self.root_fd = open_root(root)
        self.secret = secret
        self.clock = clock
        self.io_timeout = timeout
        self.origins = frozenset(origins)
        self.slots = threading.BoundedSemaphore(8)
        try:
            super().__init__(("127.0.0.1", port), Handler)
        except BaseException:
            os.close(self.root_fd)
            raise

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()

    def handle_error(self, request, client_address):
        pass  # Never print request lines, grants, headers, paths or credentials.

    def server_close(self):
        super().server_close()
        os.close(self.root_fd)

    def directory(self, category):
        try:
            os.mkdir(category, 0o700, dir_fd=self.root_fd)
        except FileExistsError:
            pass
        fd = os.open(category, os.O_RDONLY | os.O_DIRECTORY | NOFOLLOW, dir_fd=self.root_fd)
        try:
            private_dir(fd)
            return fd
        except BaseException:
            os.close(fd)
            raise


class Handler(BaseHTTPRequestHandler):
    server_version = "PrivateStorage"
    sys_version = ""
    protocol_version = "HTTP/1.0"  # Always close: no pipelining/unread body ambiguity.

    @property
    def storage(self):
        return cast(StorageServer, self.server)

    def setup(self):
        self.request.settimeout(self.storage.io_timeout)
        super().setup()
        self.deadline = time.monotonic() + self.storage.io_timeout
        self.watchdog = threading.Timer(self.storage.io_timeout, self.expire)
        self.watchdog.daemon = True
        self.watchdog.start()

    def expire(self):
        try:
            self.connection.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass

    def finish(self):
        self.watchdog.cancel()
        super().finish()

    def log_message(self, format, *args):
        pass

    def send_error(self, code, message=None, explain=None):
        self.reply(code)  # No reflected request data, including parser errors.

    def reply(self, code, body=b"", headers=None):
        self.send_response(code)
        self.send_header("Content-Length", str(len(body)))
        self.security_headers()
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if body:
            self.wfile.write(body)
        self.close_connection = True

    def security_headers(self):
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; sandbox")
        self.send_header("Connection", "close")
        origin = self.headers.get("Origin")
        if origin is not None and origin in self.storage.origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def remaining(self):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise Rejected(408)
        self.connection.settimeout(remaining)

    def do_OPTIONS(self):
        if not PATH.fullmatch(self.path) or self.headers.get("Origin") not in self.storage.origins:
            self.reply(403)
            return
        self.reply(204, headers={"Access-Control-Allow-Methods": "PUT, GET", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "60"})

    def do_PUT(self):
        self.dispatch()

    def do_GET(self):
        self.dispatch()

    def dispatch(self):
        try:
            # Require exact raw target, no decoding, normalization or alternate queries.
            parsed = urlsplit(self.path)
            path = parsed.path
            match = PATH.fullmatch(path)
            if match is None or parsed.fragment or parsed.scheme or parsed.netloc:
                raise Rejected(400)
            auths = self.headers.get_all("Authorization", [])
            if parsed.query:
                if self.command != "GET" or auths or not re.fullmatch(r"grant=[A-Za-z0-9_.-]{1,2048}", parsed.query):
                    raise Rejected(403)
                token = parsed.query[6:]
            elif len(auths) == 1 and auths[0].startswith("Bearer "):
                token = auths[0][7:]
            else:
                raise Rejected(403)
            claims = verify(self.storage.secret, token, self.command, path, self.storage.clock())
            if "Transfer-Encoding" in self.headers:
                raise Rejected(400)
            category, key = match.groups()
            fd = self.storage.directory(category)
            try:
                if self.command == "PUT":
                    self.upload(fd, key, claims)
                else:
                    self.download(fd, key, claims)
            finally:
                os.close(fd)
        except Rejected as exc:
            self.reply(exc.status)
        except FileExistsError:
            self.reply(409)
        except FileNotFoundError:
            self.reply(404)
        except (TimeoutError, socket.timeout):
            self.reply(408)
        except (OSError, ValueError):
            self.reply(400)

    def upload(self, fd, key, claims):
        lengths = self.headers.get_all("Content-Length", [])
        if len(lengths) != 1 or not re.fullmatch(r"[0-9]{1,12}", lengths[0]):
            raise Rejected(411)
        length = int(lengths[0])
        if not 1 <= length <= claims["maxbytes"]:
            raise Rejected(413)
        if self.headers.get_all("Content-Type", []) != [claims["type"]]:
            raise Rejected(415)
        # Permanent O_EXCL tombstone consumes this immutable key, even on failure.
        claim = os.open(key + ".claim", os.O_WRONLY | os.O_CREAT | os.O_EXCL | NOFOLLOW, 0o600, dir_fd=fd)
        try:
            os.fsync(claim)
            os.fsync(fd)
        finally:
            os.close(claim)
        pending = key + ".pending"
        out = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL | NOFOLLOW, 0o600, dir_fd=fd)
        try:
            digest = hashlib.sha256()
            with os.fdopen(out, "wb") as target:
                left = length
                while left:
                    self.remaining()
                    block = self.rfile.read1(min(CHUNK, left))
                    if not block:
                        raise Rejected(400)
                    target.write(block)
                    digest.update(block)
                    left -= len(block)
                if not hmac.compare_digest(digest.hexdigest(), claims["sha256"]):
                    raise Rejected(422)
                target.flush()
                os.fsync(target.fileno())
                os.fchmod(target.fileno(), 0o400)
            # Hard-link publish is atomic and never replaces an existing target.
            os.link(pending, key + ".blob", src_dir_fd=fd, dst_dir_fd=fd, follow_symlinks=False)
            os.fsync(fd)
        finally:
            os.unlink(pending, dir_fd=fd)
        self.reply(201, json.dumps({"path": claims["path"], "sha256": claims["sha256"], "bytes": length}, separators=(",", ":")).encode(), {"Content-Type": "application/json"})

    def download(self, fd, key, claims):
        source = os.open(key + ".blob", os.O_RDONLY | os.O_NONBLOCK | NOFOLLOW, dir_fd=fd)
        with os.fdopen(source, "rb") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077 or info.st_nlink != 1:
                raise Rejected(400)
            if not 1 <= info.st_size <= claims["maxbytes"]:
                raise Rejected(413)
            digest = hashlib.sha256()
            while True:
                self.remaining()
                block = stream.read(CHUNK)
                if not block:
                    break
                digest.update(block)
            if not hmac.compare_digest(digest.hexdigest(), claims["sha256"]):
                raise Rejected(422)
            stream.seek(0)
            self.send_response(200)
            self.security_headers()
            self.send_header("Content-Type", claims["type"])
            self.send_header("Content-Length", str(info.st_size))
            self.send_header("Content-Disposition", 'attachment; filename="download"')
            self.end_headers()
            while True:
                self.remaining()
                block = stream.read(CHUNK)
                if not block:
                    break
                self.wfile.write(block)
            self.close_connection = True


def main():
    # No CLI credentials, secret files, dotenv loader, or unsafe default root.
    secret = os.environ.get("STORAGE_HMAC_SECRET", "").encode("utf-8")
    root = os.environ.get("STORAGE_ROOT", "")
    origins = tuple(filter(None, os.environ.get("STORAGE_CORS_ORIGINS", "").split(",")))
    try:
        server = StorageServer(root, secret, int(os.environ.get("STORAGE_PORT", "8765")), origins=origins)
    except (ValueError, OSError):
        raise SystemExit("Storage configuration invalid (private absolute root and runtime secret required)") from None
    print("Private storage listening on loopback", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
