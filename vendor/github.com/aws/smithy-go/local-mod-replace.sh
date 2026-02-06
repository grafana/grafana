#1/usr/bin/env bash

PROJECT_DIR=""
SMITHY_SOURCE_DIR=$(cd `dirname $0` && pwd)

usage() {
  echo "Usage: $0 [-s SMITHY_SOURCE_DIR] [-d PROJECT_DIR]" 1>&2
  exit 1
}

while getopts "hs:d:" options; do
  case "${options}" in
  s)
    SMITHY_SOURCE_DIR=${OPTARG}
    if [ "$SMITHY_SOURCE_DIR" == "" ]; then
      echo "path to smithy-go source directory is required" || exit
      usage
    fi
    ;;
  d)
    PROJECT_DIR=${OPTARG}
    ;;
  h)
    usage
    ;;
  *)
    usage
    ;;
  esac
done

if [ "$PROJECT_DIR" != "" ]; then
  cd $PROJECT_DIR || exit
fi

go mod graph | awk '{print $1}' | cut -d '@' -f 1 | sort | uniq | grep "github.com/aws/smithy-go" | while read x; do
  repPath=${x/github.com\/aws\/smithy-go/${SMITHY_SOURCE_DIR}}
  echo -replace $x=$repPath
done | xargs go mod edit
