#!/bin/bash -ex

usage() {
  echo $0 tag
  exit -1
}

if [ $# -lt 1 ]; then
  usage
fi

REPOSITORY=fusebit/grafana
TAG=${1}

IMAGE=${REPOSITORY}:${TAG}
ECR_URL=public.ecr.aws/s0p5g7j3

aws ecr-public get-login-password --region us-east-1 | docker login -u AWS --password-stdin ${ECR_URL}

docker tag ${IMAGE} ${ECR_URL}/${IMAGE}
docker push ${ECR_URL}/${IMAGE}
