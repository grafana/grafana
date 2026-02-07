#!/usr/bin/env bash

set -ev

go vet ./...

go install honnef.co/go/tools/cmd/staticcheck@latest
# disabled checks
#  -ST1000 missing package doc in internal packages
#  -ST1003 wrong naming convention would require breaking changes
#  -ST1012 wrong error name convention in om package would require breaking changes
#  -ST1016 violation of methods on the same type should have the same receiver name in rueidishook
#  -ST1020 violation of go doc comment on exported methods in rueidiscompat
#  -ST1021 violation of go doc comment on exported types in rueidiscompat
#  -U1000 unused check in mock package
staticcheck -checks "all,-ST1000,-ST1003,-ST1012,-ST1016,-ST1020,-ST1021,-U1000"  ./... | (grep -v "_test.go:" && exit 1 || exit 0)

trap "docker compose down -v" EXIT
docker compose up -d
sleep 5
go install gotest.tools/gotestsum@v1.10.0
gotestsum --format standard-verbose --junitfile unit-tests.xml -- -coverprofile=coverage.out -race -timeout 30m "$@"
