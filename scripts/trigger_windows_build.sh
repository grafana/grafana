#!/bin/bash

_token=$1

curl \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${_token}" \
  -X POST -d '{ "accountName": "Torkeldegaard", "projectSlug": "grafana","branch": "master","environmentVariables": {}}' \
  https://ci.appveyor.com/api/builds
