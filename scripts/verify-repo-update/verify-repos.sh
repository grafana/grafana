#!/usr/bin/env bash

docker_build () {
	dockerfile=$1
	repo_file=$2
	package=$3
	tag=$4

  docker build -f $dockerfile            \
    --build-arg "REPO_CONFIG=$repo_file" \
    --build-arg "PACKAGE=$package"       \
    --tag $tag                           \
    --no-cache                           \
    .
}


# Testing deb repos
docker_build "Dockerfile.deb" "grafana.list.oss" "grafana" "gf-oss-deb-repo-test"
_oss_deb_v=$(docker run --rm gf-oss-deb-repo-test cat /usr/share/grafana/VERSION)

docker_build "Dockerfile.deb" "grafana.list.ee" "grafana-enterprise" "gf-ee-deb-repo-test"
_ee_deb_v=$(docker run --rm gf-ee-deb-repo-test cat /usr/share/grafana/VERSION)

# Testing rpm repos
docker_build "Dockerfile.rpm" "grafana.repo.oss" "grafana" "gf-oss-rpm-repo-test"
_oss_rpm_v=$(docker run --rm gf-oss-rpm-repo-test cat /usr/share/grafana/VERSION)

docker_build "Dockerfile.rpm" "grafana.repo.ee" "grafana-enterprise" "gf-ee-rpm-repo-test"
_ee_rpm_v=$(docker run --rm gf-ee-rpm-repo-test cat /usr/share/grafana/VERSION)

echo Versions:
echo OSS deb = ${_oss_deb_v}
echo EE  deb = ${_ee_deb_v}
echo OSS rpm = ${_oss_rpm_v}
echo EE  rpm = ${_ee_rpm_v}
