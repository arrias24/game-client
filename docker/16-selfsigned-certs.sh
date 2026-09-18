#!/bin/sh
# Certificado autofirmado para que Chrome trate la UI como secure context
# (WebRTC no arranca en http://IP). El browser va a pedir aceptar el riesgo.
set -e
CERT_DIR=/etc/nginx/certs
mkdir -p "$CERT_DIR"
if [ -f "$CERT_DIR/self.crt" ] && [ -f "$CERT_DIR/self.key" ]; then
  exit 0
fi
CN="${PUBLIC_HOST:-localhost}"
openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
  -keyout "$CERT_DIR/self.key" \
  -out "$CERT_DIR/self.crt" \
  -subj "/CN=${CN}"
