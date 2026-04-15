#!/usr/bin/env bash
set -euo pipefail

# Verify RPM file permissions satisfy DISA-STIG requirements using
# OpenSCAP on a live RHEL-family system.
#
# Must be run as root on a RHEL/Rocky Linux system with oscap and the
# scap-security-guide package installed (e.g. rockylinux:9 container).
#
# Usage: verify-rpm-stig.sh <path-to.rpm>

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "error: this script must be run on Linux" >&2
  exit 1
fi

RPM_PATH="${1:?Usage: verify-rpm-stig.sh <path-to.rpm>}"

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

# The RHEL9 SCAP platform check requires a package named 'redhat-release'.
# On Rocky Linux the package is 'rocky-release' (which provides redhat-release,
# but the OVAL rpminfo probe matches by name only). Install a stub if missing.
if ! rpm -q redhat-release &>/dev/null; then
  echo "Installing stub redhat-release for SCAP platform check..."
  SPECDIR="$(mktemp -d)"
  trap 'rm -rf "$SPECDIR"' EXIT
  mkdir -p "${SPECDIR}/SPECS" "${SPECDIR}/RPMS"
  cat > "${SPECDIR}/SPECS/redhat-release.spec" << 'EOF'
Name:    redhat-release
Version: 9
Release: 1
Summary: Red Hat Enterprise Linux release (stub for SCAP platform check)
License: GPLv2
BuildArch: noarch
%description
Stub package installed so the SCAP OVAL platform check can find
redhat-release by name on Rocky Linux and other RHEL-compatible systems.
%files
EOF
  rpmbuild --define "_topdir ${SPECDIR}" -bb "${SPECDIR}/SPECS/redhat-release.spec" 2>/dev/null
  rpm -i --nodeps "${SPECDIR}/RPMS/noarch/redhat-release-9-1.noarch.rpm"
fi

rpm --upgrade --nodeps --force "$RPM_PATH"

oscap xccdf eval \
  --profile xccdf_org.ssgproject.content_profile_stig \
  --rule xccdf_org.ssgproject.content_rule_file_permissions_binary_dirs \
  --rule xccdf_org.ssgproject.content_rule_file_permissions_library_dirs \
  "$SSG_DS"
