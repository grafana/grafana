#!/bin/bash

# Strip all null values from dashboards within devenv for some particular
# schema version. Must be run from Grafana root.

# OSX users need to install GNU sed: `brew install gsed`
SED=$(command -v gsed)
SED=${SED:-"sed"}

FILES=$(grep -rl '"schemaVersion": 3[3456789]' devenv)
set -e
set -x
for DASH in ${FILES}; do echo "${DASH}"; grep -v 'null,$' "${DASH}" > "${DASH}-nulless"; mv "${DASH}-nulless" "${DASH}"; done
for DASH in ${FILES}; do grep -v 'null$' "${DASH}" > "${DASH}-nulless"; mv "${DASH}-nulless" "${DASH}"; done
# shellcheck disable=SC2016,SC2002
for DASH in ${FILES}; do cat "${DASH}" | $SED -E -n 'H; x; s:,(\s*\n\s*}):\1:; P; ${x; p}' | $SED '1 d' > "${DASH}-nulless"; mv "${DASH}-nulless" "${DASH}"; done
