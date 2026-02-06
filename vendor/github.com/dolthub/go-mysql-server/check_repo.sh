#!/bin/bash

set -eo pipefail

go mod download golang.org/x/tools
go install golang.org/x/tools/cmd/goimports

paths=`find . -maxdepth 1 -mindepth 1 \( -name gen -prune -o -type d -print -o -type f -name '*.go' -print \)`

bad_files=$(goimports -l -local github.com/dolthub/dolt $paths)
if [ "$bad_files" != "" ]; then
    echo "ERROR: The following files do not match goimports output:"
    echo "$bad_files"
    echo
    echo "Please format the go code in the repository with 'format_repo.sh'"
    exit 1
fi

bad_files=$(find $paths -name '*.go' | while read f; do
    if [[ $(awk '/import \(/{flag=1;next}/\)/{flag=0}flag' < $f | egrep -c '$^') -gt 2 ]]; then
        echo $f
    fi
done)

if [ "$bad_files" != "" ]; then
    echo "ERROR: The following files have more than three import groups:"
    echo "$bad_files"
    echo
    echo "Please format the go code in the repository with 'format_repo.sh'"
    exit 1
fi
