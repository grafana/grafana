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
    .

    retval=$(docker run --rm $tag cat /usr/share/grafana/VERSION)
}


# Testing deb repos
docker_build "Dockerfile.deb" "grafana.list.oss" "grafana" "gf-oss-deb-repo-test"
_oss_deb_v=$retval

docker_build "Dockerfile.deb" "grafana.list.ee" "grafana-enterprise" "gf-ee-deb-repo-test"
_ee_deb_v=$retval

# Testing rpm repos
docker_build "Dockerfile.rpm" "grafana.repo.oss" "grafana" "gf-oss-rpm-repo-test"
_oss_rpm_v=$retval

docker_build "Dockerfile.rpm" "grafana.repo.ee" "grafana-enterprise" "gf-ee-rpm-repo-test"
_ee_rpm_v=$retval

echo Versions:
echo OSS deb = ${_oss_deb_v}
echo EE  deb = ${_ee_deb_v}
echo OSS rpm = ${_oss_rpm_v}
echo EE  rpm = ${_ee_rpm_v}
