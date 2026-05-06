#!/bin/bash
set -ex
openssl genrsa -aes256 -passout pass:1234 -out grafana-e2e-ca.key.pem 4096
openssl rsa -passin pass:1234 -in grafana-e2e-ca.key.pem -out grafana-e2e-ca.key.pem
openssl req -config openssl.cnf -key grafana-e2e-ca.key.pem -new -x509 -days 3650 -sha256 -extensions v3_ca -out grafana-e2e-ca.pem