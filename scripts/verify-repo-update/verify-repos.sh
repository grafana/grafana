#!/usr/bin/env bash
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
    .
#    --no-cache                           \

    retval=$(docker run --rm "$tag" cat /usr/share/grafana/VERSION)
}

# Check args
BETA_OR_VERSION=$1;
if [[ "$#" = 1 ]]; then
  # only 1 parameter passed in, check if beta, if not, assume version tag
  if [[ $1 == "beta" ]]; then
    CHECK_BETA=true
  else
    VERSION=$1
  fi
fi

echo "CHECK_BETA is ${CHECK_BETA}"
echo "VERSION is ${VERSION}"

# CHECK_BETA=$1
if [[ $1 == "beta" ]]; then
  echo "Verifying beta debian repos"
  # Testing deb repos
#  docker_build "Dockerfile.deb" "deb-oss-beta.list" "grafana=9.4.7" "gf-oss-deb-repo-test"
#  _oss_deb_v="$retval"

#  docker_build "Dockerfile.deb" "deb-ee-beta.list" "grafana-enterprise" "gf-ee-deb-repo-test"
#  _ee_deb_v="$retval"
#
  echo "Verifying beta debian repos"
#  # Testing rpm repos
#  docker_build "Dockerfile.rpm" "rpm-oss-beta.list" "grafana" "gf-oss-rpm-repo-test"
#  _oss_rpm_v="$retval"
#
#  docker_build "Dockerfile.rpm" "rpm-ee-beta.list" "grafana-enterprise" "gf-ee-rpm-repo-test"
#  _ee_rpm_v="$retval"
#elif [[ $VERSION ]]
else
  # Testing deb repos
  docker_build "Dockerfile.deb" "deb-oss-stable.list" "grafana=9.4.7" "gf-oss-deb-repo-test"
  _oss_deb_v="$retval"

  docker_build "Dockerfile.deb" "deb-ee-stable.list" "grafana-enterprise" "gf-ee-deb-repo-test"
  _ee_deb_v="$retval"

  # Testing rpm repos
  docker_build "Dockerfile.rpm" "rpm-oss-stable.list" "grafana" "gf-oss-rpm-repo-test"
  _oss_rpm_v="$retval"

  docker_build "Dockerfile.rpm" "rpm-ee-stable.list" "grafana-enterprise" "gf-ee-rpm-repo-test"
  _ee_rpm_v="$retval"
fi

echo Versions:
echo OSS deb = "${_oss_deb_v}"
echo OSS rpm = "${_oss_rpm_v}"
echo EE  deb = "${_ee_deb_v}"
echo EE  rpm = "${_ee_rpm_v}"
