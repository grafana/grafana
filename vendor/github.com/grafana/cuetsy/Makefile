.PHONY: lint test static install uninstall cross
VERSION := $(shell git describe --tags --dirty --always)
BIN_DIR := $(GOPATH)/bin

lint:
	test -z $$(gofmt -s -l .)
	go vet ./...

test:
	go test -v ./...

# Compilation
LDFLAGS := '-s -w -extldflags "-static"'
static:
	CGO_ENABLED=0 go build -ldflags=${LDFLAGS} ./cmd/cuetsy

install:
	CGO_ENABLED=0 go install -ldflags=${LDFLAGS} ./cmd/cuetsy

uninstall:
	go clean -i ./cmd/cuetsy

# CI
# Export environment variables from here: https://drone.grafana.net/account
# Only Grafana employees can regenerate the CI configuration
# A temp file is created to make sure the `sign` command succeeds
# For more info: https://github.com/grafana/deployment_tools/blob/master/docs/infrastructure/drone/signing.md
drone:
	cue export ./.drone/drone.cue > .drone/drone.tmp.yml
	drone fmt --save .drone/drone.tmp.yml
	drone lint .drone/drone.tmp.yml
	drone sign --save grafana/cuetsy .drone/drone.tmp.yml
	mv .drone/drone.tmp.yml .drone/drone.yml