#!/usr/bin/env bash
set -euo pipefail

# Verify RPM or DEB file permissions satisfy DISA-STIG requirements
# by running OpenSCAP inside a container with the package installed.
#
# For RPM: runs oscap in a UBI9 container (correct RHEL9 CPE) against the RHEL9 STIG.
# For DEB: runs oscap in an Ubuntu 22.04 container against the Ubuntu 22.04 STIG.
#
# STIG rules evaluated:
#   file_permissions_binary_dirs              /usr/sbin ≤ 0755, no g+w/o+w
#   file_permissions_library_dirs             /usr/lib  ≤ 0755, no g+w/o+w
#   file_ownership_binary_dirs                /usr/sbin owned by root
#   file_ownership_library_dirs               /usr/lib  owned by root
#   file_groupownership_system_commands_dirs  /usr/sbin group root
#
# Usage: verify-pkg-stig.sh <path-to.rpm|path-to.deb>

if ! command -v docker &>/dev/null; then
  echo "error: docker is required" >&2
  exit 1
fi

PKG_PATH="${1:?Usage: verify-pkg-stig.sh <path-to.rpm|path-to.deb>}"
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

case "$PKG_PATH" in
  *.rpm)
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
    ;;
  *.deb)
    cat > "${TMPWORK}/check.sh" <<'EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null 2>&1
apt-get install -y --no-install-recommends openscap-scanner ssg-debuntu >/dev/null 2>&1
EOF
    cat >> "${TMPWORK}/check.sh" <<EOF
dpkg-deb -x /pkgs/${PKG_FILE} /
oscap xccdf eval \\
  --profile xccdf_org.ssgproject.content_profile_stig \\
  $(printf ' %q' "${RULE_FLAGS[@]}") \\
  /usr/share/xml/scap/ssg/content/ssg-ubuntu2204-ds.xml
EOF
    docker run --rm --platform linux/amd64 \
      -v "${PKG_DIR}:/pkgs:ro" \
      -v "${TMPWORK}/check.sh:/check.sh:ro" \
      ubuntu:22.04 bash /check.sh
    ;;
  *)
    echo "error: unsupported package format: $PKG_PATH" >&2
    exit 1
    ;;
esac

echo "ok: all STIG checks passed"
