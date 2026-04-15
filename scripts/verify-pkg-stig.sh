#!/usr/bin/env bash
set -euo pipefail

# Verify RPM or DEB file permissions satisfy DISA-STIG requirements using
# OpenSCAP OVAL evaluation on a Linux system with oscap installed.
#
# Uses oscap oval eval (not xccdf eval) so no RHEL9 platform check is
# required — works on any Linux distro that has oscap and rpm/dpkg tools.
#
# Usage: verify-pkg-stig.sh <path-to.rpm|path-to.deb>

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "error: this script must be run on Linux" >&2
  exit 1
fi

PKG_PATH="${1:?Usage: verify-pkg-stig.sh <path-to.rpm|path-to.deb>}"

SSG_VERSION="0.1.80"
SSG_SHA512="bab6f8eb6feece70ec6d39778a20a4d9386e4a449984c0a4d5a72fdb2d1fbc2dcdb3c35f178d4f745c35df1c31a4e15920ff2c19fc2f77263844ae4910de0f3a"
SSG_URL="https://github.com/ComplianceAsCode/content/releases/download/v${SSG_VERSION}/scap-security-guide-${SSG_VERSION}.tar.gz"
SSG_DS="${SSG_DS:-/tmp/ssg-rhel9-ds.xml}"

if [[ ! -f "$SSG_DS" ]]; then
  echo "Downloading RHEL9 SCAP datastream (scap-security-guide ${SSG_VERSION})..."
  TMPDIR="$(mktemp -d)"
  trap 'rm -rf "$TMPDIR"' EXIT
  TARBALL="${TMPDIR}/ssg.tar.gz"
  curl -fsSL "$SSG_URL" -o "$TARBALL"
  echo "${SSG_SHA512}  ${TARBALL}" | sha512sum -c -
  tar -xzOf "$TARBALL" "scap-security-guide-${SSG_VERSION}/ssg-rhel9-ds.xml" > "$SSG_DS"
fi

case "$PKG_PATH" in
  *.rpm)
    rpm --upgrade --nodeps --force --ignorearch "$PKG_PATH"
    ;;
  *.deb)
    dpkg --install --force-architecture --force-depends "$PKG_PATH"
    ;;
  *)
    echo "error: unsupported package format: $PKG_PATH" >&2
    exit 1
    ;;
esac

# Datastream and OVAL component IDs within ssg-rhel9-ds.xml.
DS_ID="scap_org.open-scap_datastream_from_xccdf_ssg-rhel9-xccdf.xml"
OVAL_ID="scap_org.open-scap_cref_ssg-rhel9-oval.xml"

# Evaluate each OVAL definition directly, bypassing the XCCDF platform check.
# oscap oval eval always exits 0; detect failures by grepping output for ': false'.
FAILED=0
for DEF_ID in \
  oval:ssg-file_permissions_binary_dirs:def:1 \
  oval:ssg-file_permissions_library_dirs:def:1 \
  oval:ssg-file_ownership_binary_dirs:def:1 \
  oval:ssg-file_ownership_library_dirs:def:1 \
  oval:ssg-file_groupownership_system_commands_dirs:def:1; do
  echo "--- $DEF_ID"
  OUT="$(oscap oval eval \
    --datastream-id "$DS_ID" \
    --oval-id "$OVAL_ID" \
    --id "$DEF_ID" \
    "$SSG_DS" 2>&1)"
  echo "$OUT"
  if echo "$OUT" | grep -q ": false$"; then
    FAILED=1
  fi
done

if [[ "$FAILED" -ne 0 ]]; then
  echo "error: one or more STIG OVAL checks failed" >&2
  exit 1
fi
