#!/bin/bash
cd `dirname $0`
DIRS=`git grep -l 'func Test' | xargs dirname | sort -u`
for DIR in $DIRS
do
	echo
	echo "dir: $DIR"
	echo "======================================"
	pushd $DIR >/dev/null
	go test -v || exit 1
	popd >/dev/null
done
