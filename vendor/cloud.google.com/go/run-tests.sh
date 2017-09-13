#!/bin/bash

# Selectively run tests for this repo, based on what has changed
# in a commit. Runs short tests for the whole repo, and full tests
# for changed directories.

set -e

prefix=cloud.google.com/go

dryrun=false
if [[ $1 == "-n" ]]; then
  dryrun=true
  shift
fi

if [[ $1 == "" ]]; then
  echo >&2 "usage: $0 [-n] COMMIT"
  exit 1
fi

# Files or directories that cause all tests to run if modified.
declare -A run_all
run_all=([.travis.yml]=1 [run-tests.sh]=1)

function run {
  if $dryrun; then
    echo $*
  else
    (set -x; $*)
  fi
}


# Find all the packages that have changed in this commit.
declare -A changed_packages

for f in $(git diff-tree --no-commit-id --name-only -r $1); do
  if [[ ${run_all[$f]} == 1 ]]; then
    # This change requires a full test. Do it and exit.
    run go test -race -v $prefix/...
    exit
  fi
  # Map, e.g., "spanner/client.go" to "$prefix/spanner".
  d=$(dirname $f)
  if [[ $d == "." ]]; then
    pkg=$prefix
  else
    pkg=$prefix/$d
  fi
  changed_packages[$pkg]=1
done

echo "changed packages: ${!changed_packages[*]}"


# Reports whether its argument, a package name, depends (recursively)
# on a changed package.
function depends_on_changed_package {
  # According to go list, a package does not depend on itself, so
  # we test that separately.
  if [[ ${changed_packages[$1]} == 1 ]]; then
    return 0
  fi
  for dep in $(go list -f '{{range .Deps}}{{.}} {{end}}' $1); do
    if [[ ${changed_packages[$dep]} == 1 ]]; then
      return 0
    fi
  done
  return 1
}

# Collect the packages into two separate lists. (It is faster go test a list of
# packages than to individually go test each one.)

shorts=
fulls=
for pkg in $(go list $prefix/...); do      # for each package in the repo
  if depends_on_changed_package $pkg; then # if it depends on a changed package
    fulls="$fulls $pkg"                    # run the full test
  else                                     # otherwise
    shorts="$shorts $pkg"                  # run the short test
  fi
done
run go test -race -v -short $shorts
run go test -race -v $fulls
