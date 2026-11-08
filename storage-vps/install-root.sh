#!/usr/bin/env bash
# Explicit root-only activation. Does not deploy the Next.js app or migrate DB.
set -euo pipefail
[[ "${1:-}" == "activate" ]] || { printf 'Usage: bash storage-vps/install-root.sh activate\n'; exit 2; }
[[ $(id -u) == 0 ]] || { printf 'Activation requires the VPS administrator account.\n'; exit 1; }
REPO=/home/hermes/projects/cartoonova
SOURCE="$REPO/storage-vps"
ROOT=/home/hermes/.hermes/profiles/cartoonova/data/private-storage
AVAILABLE=/etc/nginx/sites-available/cartoonova-files.conf
ENABLED=/etc/nginx/sites-enabled/cartoonova-files.conf
UNIT=/etc/systemd/system/cartoonova-storage.service
for command in nginx certbot systemctl runuser install python3; do command -v "$command" >/dev/null; done
for target in "$AVAILABLE" "$ENABLED" "$UNIT"; do
  [[ ! -e "$target" && ! -L "$target" ]] || { printf 'Existing Cartoonova installation detected; refusing to overwrite: %s\n' "$target"; exit 1; }
done
python3 -c 'import socket; addresses={r[4][0] for r in socket.getaddrinfo("files.cartoonova.com",80)}; assert addresses == {"57.129.155.13"}, "DNS does not match the expected VPS"'
# Check secret access before creating any configuration. No secret leaves memory.
runuser -u hermes -- env HOME=/home/hermes /usr/bin/python3 -B -c 'import runpy; m=runpy.run_path("/home/hermes/projects/cartoonova/storage-vps/run-from-vercel.py"); m["load_secret"]()'
python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",8765)); s.close()'
install -d -m 0700 -o hermes -g hermes "$ROOT"
install -d -m 0755 /var/lib/cartoonova-acme/.well-known/acme-challenge
install -m 0644 "$SOURCE/nginx-cartoonova-acme.conf" "$AVAILABLE"
ln -s "$AVAILABLE" "$ENABLED"
nginx -t
systemctl reload nginx
certbot certonly --webroot --webroot-path /var/lib/cartoonova-acme \
  --domain files.cartoonova.com --cert-name files.cartoonova.com \
  --email info.Cartoonova@gmail.com --agree-tos --non-interactive \
  --deploy-hook 'systemctl reload nginx'
install -m 0644 "$SOURCE/cartoonova-storage.service" "$UNIT"
# TLS files are generated and managed by certbot, never read or printed here.
install -m 0644 "$SOURCE/nginx-cartoonova-files.conf" "$AVAILABLE"
nginx -t
systemctl daemon-reload
systemctl enable --now cartoonova-storage.service
systemctl reload nginx
systemctl is-active --quiet cartoonova-storage.service
python3 -c 'import urllib.request,urllib.error; u="https://files.cartoonova.com/v1/files/orders/"+"0"*32
try:
 urllib.request.urlopen(u,timeout=10)
 raise SystemExit("Anonymous access unexpectedly succeeded")
except urllib.error.HTTPError as e:
 assert e.code==403, "Unexpected anonymous access result"'
printf 'Cartoonova private storage active. Website uploads remain unchanged until the approved application deployment.\n'
