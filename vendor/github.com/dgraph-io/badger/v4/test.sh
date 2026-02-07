#!/bin/bash

set -eo pipefail

go version

# Check if Github Actions is running
if [ $CI = "true" ]; then
	# Enable code coverage
	# export because tests run in a subprocess
	export covermode="-covermode=atomic"
	export coverprofile="-coverprofile=cover_tmp.out"
	echo "mode: atomic" >>cover.out
fi

# Run `go list` BEFORE setting GOFLAGS so that the output is in the right
# format for grep.
# export packages because the test will run in a sub process.
export packages=$(go list ./... | grep "github.com/dgraph-io/badger/v4/")

tags="-tags=jemalloc"

# Compile the Badger binary
pushd badger
go build -v $tags .
popd

# Run the memory intensive tests first.
manual() {
	timeout="-timeout 2m"
	echo "==> Running package tests for $packages"
	set -e
	for pkg in $packages; do
		echo "===> Testing $pkg"
		go test $tags -timeout=25m $covermode $coverprofile -failfast -race -parallel 16 $pkg && write_coverage || return 1
	done
	echo "==> DONE package tests"

	echo "==> Running manual tests"
	# Run the special Truncate test.
	rm -rf p
	set -e
	go test $tags $timeout $covermode $coverprofile -run='TestTruncateVlogNoClose$' -failfast --manual=true && write_coverage || return 1
	truncate --size=4096 p/000000.vlog
	go test $tags $timeout $covermode $coverprofile -run='TestTruncateVlogNoClose2$' -failfast --manual=true && write_coverage || return 1
	go test $tags $timeout $covermode $coverprofile -run='TestTruncateVlogNoClose3$' -failfast --manual=true && write_coverage || return 1
	rm -rf p

	# TODO(ibrahim): Let's make these tests have Manual prefix.
	# go test $tags -run='TestManual' --manual=true --parallel=2
	# TestWriteBatch
	# TestValueGCManaged
	# TestDropPrefix
	# TestDropAllManaged
	go test $tags $timeout $covermode $coverprofile -failfast -run='TestBigKeyValuePairs$' --manual=true && write_coverage || return 1
	go test $tags $timeout $covermode $coverprofile -failfast -run='TestPushValueLogLimit' --manual=true && write_coverage || return 1
	go test $tags $timeout $covermode $coverprofile -failfast -run='TestKeyCount' --manual=true && write_coverage || return 1
	go test $tags $timeout $covermode $coverprofile -failfast -run='TestIteratePrefix' --manual=true && write_coverage || return 1
	go test $tags $timeout $covermode $coverprofile -failfast -run='TestIterateParallel' --manual=true && write_coverage || return 1
	go test $tags $timeout $covermode $coverprofile -failfast -run='TestBigStream' --manual=true && write_coverage || return 1
	go test $tags $timeout $covermode $coverprofile -failfast -run='TestGoroutineLeak' --manual=true && write_coverage || return 1
	go test $tags $timeout $covermode $coverprofile -failfast -run='TestGetMore' --manual=true && write_coverage || return 1

	echo "==> DONE manual tests"
}

root() {
	# Run the normal tests.
	# go test -timeout=25m -v -race github.com/dgraph-io/badger/v4/...

	echo "==> Running root level tests."
	go test $tags -v -race -parallel=16 -timeout=25m -failfast $covermode $coverprofile . && write_coverage || return 1
	echo "==> DONE root level tests"
}

stream() {
	set -eo pipefail
	pushd badger
	baseDir=$(mktemp -d -p .)
	./badger benchmark write -s --dir=$baseDir/test | tee $baseDir/log.txt
	./badger benchmark read --dir=$baseDir/test --full-scan | tee --append $baseDir/log.txt
	./badger benchmark read --dir=$baseDir/test -d=30s | tee --append $baseDir/log.txt
	./badger stream --dir=$baseDir/test -o "$baseDir/test2" | tee --append $baseDir/log.txt
	count=$(cat "$baseDir/log.txt" | grep "at program end: 0 B" | wc -l)
	rm -rf $baseDir
	if [ $count -ne 4 ]; then
		echo "LEAK detected in Badger stream."
		return 1
	fi
	echo "==> DONE stream test"
	popd
	return 0
}

write_coverage() {
	if [[ $CI == "true" ]]; then
		if [[ -f cover_tmp.out ]]; then
			sed -i '1d' cover_tmp.out
			cat cover_tmp.out >>cover.out && rm cover_tmp.out
		fi
	fi

}

# parallel tests currently not working
# parallel --halt now,fail=1 --progress --line-buffer ::: stream manual root
# run tests in sequence
root
stream
manual
