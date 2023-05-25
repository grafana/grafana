#!/usr/bin/env bash
# Usage: ./verify-repos.sh [argument]
# argument is optional, but can be "beta" or a valid tag (ex: 9.4.7)
set -o pipefail

_basedir=$(dirname "$0")
cd "$_basedir" || exit

docker_build () {
	dockerfile=$1
	repo_file=$2
	package=$3
	tag=$4

  docker build -f "$dockerfile"          \
    --build-arg "REPO_CONFIG=$repo_file" \
    --build-arg "PACKAGE=$package"       \
    --tag "$tag"                         \
    --no-cache                           \
    .

    retval=$(docker run --rm "$tag" cat /usr/share/grafana/VERSION)
}

_stable_or_beta="stable"
_grafana_deb_tag="grafana"
_grafana_rpm_tag="grafana"
_grafana_enterprise_deb_tag="grafana-enterprise"
_grafana_enterprise_rpm_tag="grafana-enterprise"

# CHECK_BETA=$1
if [[ $1 == "beta" ]]; then
  _stable_or_beta="beta"
elif [[ $1 != "" ]]; then
  # Assume user is passing in version
  _version="$1"
  _grafana_deb_tag="grafana=$_version"
  _grafana_rpm_tag="grafana-$_version"
  _grafana_enterprise_deb_tag="grafana-enterprise=$_version"
  _grafana_enterprise_rpm_tag="grafana-enterprise-$_version"
fi

# Testing deb repos
docker_build "Dockerfile.deb" "deb-oss-$_stable_or_beta.list" "$_grafana_deb_tag" "gf-oss-deb-repo-test"
_oss_deb_v="$retval"

docker_build "Dockerfile.deb" "deb-ee-$_stable_or_beta.list" "$_grafana_enterprise_deb_tag" "gf-ee-deb-repo-test"
_ee_deb_v="$retval"

# Testing rpm repos
docker_build "Dockerfile.rpm" "rpm-oss-$_stable_or_beta.list" "$_grafana_rpm_tag" "gf-oss-rpm-repo-test"
_oss_rpm_v="$retval"

docker_build "Dockerfile.rpm" "rpm-ee-$_stable_or_beta.list" "$_grafana_enterprise_rpm_tag" "gf-ee-rpm-repo-test"
_ee_rpm_v="$retval"

echo Versions:
echo OSS deb = "${_oss_deb_v}"
echo OSS rpm = "${_oss_rpm_v}"
echo EE  deb = "${_ee_deb_v}"
echo EE  rpm = "${_ee_rpm_v}"
