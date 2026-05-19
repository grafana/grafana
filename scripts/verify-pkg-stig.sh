#!/usr/bin/env bash
set -euo pipefail

# Verify RPM file permissions satisfy DISA-STIG requirements by running
# OpenSCAP in a UBI9 container (correct RHEL9 CPE) against the RHEL9 STIG benchmark.
#
# STIG rules evaluated:
#   file_permissions_binary_dirs              /usr/sbin ≤ 0755, no g+w/o+w
#   file_permissions_library_dirs             /usr/lib  ≤ 0755, no g+w/o+w
#   file_ownership_binary_dirs                /usr/sbin owned by root
#   file_ownership_library_dirs               /usr/lib  owned by root
#   file_groupownership_system_commands_dirs  /usr/sbin group root
#
# Usage: verify-pkg-stig.sh <path-to.rpm>

if ! command -v docker &>/dev/null; then
  echo "error: docker is required" >&2
  exit 1
fi

PKG_PATH="${1:?Usage: verify-pkg-stig.sh <path-to.rpm>}"

case "$PKG_PATH" in
  *.rpm) ;;
  *) echo "error: unsupported package format (only RPM supported): $PKG_PATH" >&2; exit 1 ;;
esac

PKG_ABS=$(realpath "$PKG_PATH")
PKG_DIR=$(dirname "$PKG_ABS")
PKG_FILE=$(basename "$PKG_ABS")

TMPWORK=$(mktemp -d)
trap 'rm -rf "${TMPWORK}"' EXIT

RULE_FLAGS=(
  --rule xccdf_org.ssgproject.content_rule_file_permissions_binary_dirs
  --rule xccdf_org.ssgproject.content_rule_file_permissions_library_dirs
  --rule xccdf_org.ssgproject.content_rule_file_ownership_binary_dirs
  --rule xccdf_org.ssgproject.content_rule_file_ownership_library_dirs
  --rule xccdf_org.ssgproject.content_rule_file_groupownership_system_commands_dirs
)

# Fetch the RHEL9 SSG datastream from a Rocky Linux 9 image (where scap-security-guide
# is available in the default repos). UBI9 lacks this package but has the correct RHEL9
# CPE required for the STIG platform check to pass, so we mount the file in at runtime.
SSG_DS="${TMPWORK}/ssg-rhel9-ds.xml"
echo "Fetching RHEL9 SSG datastream..."
docker run --rm --platform linux/amd64 \
  --entrypoint bash \
  rockylinux:9 -c \
  'dnf install -y --quiet scap-security-guide >/dev/null 2>&1
   cat /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml' \
  > "${SSG_DS}"

cat > "${TMPWORK}/check.sh" <<EOF
set -euo pipefail
dnf install -y --quiet openscap-scanner >/dev/null 2>&1
rpm -i --nodeps /pkgs/${PKG_FILE}
oscap xccdf eval \\
  --profile xccdf_org.ssgproject.content_profile_stig \\
  $(printf ' %q' "${RULE_FLAGS[@]}") \\
  /ssg-rhel9-ds.xml
EOF

docker run --rm --platform linux/amd64 \
  -v "${PKG_DIR}:/pkgs:ro" \
  -v "${SSG_DS}:/ssg-rhel9-ds.xml:ro" \
  -v "${TMPWORK}/check.sh:/check.sh:ro" \
  registry.access.redhat.com/ubi9/ubi bash /check.sh

echo "ok: all STIG checks passed"
