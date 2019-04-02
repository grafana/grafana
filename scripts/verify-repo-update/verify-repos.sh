#!/usr/bin/env bash

docker_build () {
	repo_file=$1
	package=$2
	tag=$3

  docker build -f Dockerfile.deb               \
    --build-arg "REPO_CONFIG=$repo_file" \
    --build-arg "PACKAGE=$package"              \
    --tag $tag                 \
    .
}

docker_build "grafana.list.oss" "grafana" "gf-oss-deb-repo-test"
_oss_deb_v=$(docker run --rm gf-oss-deb-repo-test cat /usr/share/grafana/VERSION)

docker_build "grafana.list.ee" "grafana-enterprise" "gf-ee-deb-repo-test"
_ee_deb_v=$(docker run --rm gf-ee-deb-repo-test cat /usr/share/grafana/VERSION)

echo Versions:
echo OSS deb = ${_oss_deb_v}
echo EE  deb = ${_ee_deb_v}
