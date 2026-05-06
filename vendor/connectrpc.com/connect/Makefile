# See https://tech.davis-hansson.com/p/make/
SHELL := bash
.DELETE_ON_ERROR:
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := all
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules
MAKEFLAGS += --no-print-directory
BIN := .tmp/bin
export PATH := $(BIN):$(PATH)
export GOBIN := $(abspath $(BIN))
COPYRIGHT_YEARS := 2021-2024
LICENSE_IGNORE := --ignore /testdata/
BUF_VERSION := 1.47.2

.PHONY: help
help: ## Describe useful make targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "%-30s %s\n", $$1, $$2}'

.PHONY: all
all: ## Build, test, and lint (default)
	$(MAKE) test
	$(MAKE) lint

.PHONY: clean
clean: ## Delete intermediate build artifacts
	@# -X only removes untracked files, -d recurses into directories, -f actually removes files/dirs
	git clean -Xdf

.PHONY: test
test: shorttest slowtest

.PHONY: shorttest
shorttest: build ## Run unit tests
	go test -vet=off -race -cover -short ./...

.PHONY: slowtest
# Runs all tests, including known long/slow ones. The
# race detector is not used for a few reasons:
#  1. Race coverage of the short tests should be
#     adequate to catch race conditions.
#  2. It slows tests down, which is not good if we
#     know these are already slow tests.
#  3. Some of the slow tests can't repro issues and
#     find regressions as reliably with the race
#     detector enabled.
slowtest: build
	go test ./...

.PHONY: runconformance
runconformance: build ## Run conformance test suite
	cd internal/conformance && ./runconformance.sh

.PHONY: bench
bench: BENCH ?= .*
bench: build ## Run benchmarks for root package
	go test -vet=off -run '^$$' -bench '$(BENCH)' -benchmem -cpuprofile cpu.pprof -memprofile mem.pprof .

.PHONY: build
build: generate ## Build all packages
	go build ./...

.PHONY: install
install: ## Install all binaries
	go install ./...

.PHONY: lint
lint: $(BIN)/golangci-lint $(BIN)/buf ## Lint Go and protobuf
	go vet ./...
	golangci-lint run --modules-download-mode=readonly --timeout=3m0s
	buf lint
	buf format -d --exit-code

.PHONY: lintfix
lintfix: $(BIN)/golangci-lint $(BIN)/buf ## Automatically fix some lint errors
	golangci-lint run --fix --modules-download-mode=readonly --timeout=3m0s
	buf format -w

.PHONY: generate
generate: $(BIN)/buf $(BIN)/protoc-gen-go $(BIN)/protoc-gen-connect-go $(BIN)/license-header ## Regenerate code and licenses
	go mod tidy
	rm -rf internal/gen
	PATH="$(abspath $(BIN))" buf generate
	( cd cmd/protoc-gen-connect-go; ./generate.sh )
	license-header \
		--license-type apache \
		--copyright-holder "The Connect Authors" \
		--year-range "$(COPYRIGHT_YEARS)" $(LICENSE_IGNORE)

.PHONY: upgrade
upgrade: ## Upgrade dependencies
	go get -u -t ./... && go mod tidy -v

.PHONY: checkgenerate
checkgenerate:
	@# Used in CI to verify that `make generate` doesn't produce a diff.
	test -z "$$(git status --porcelain | tee /dev/stderr)"

.PHONY: $(BIN)/protoc-gen-connect-go
$(BIN)/protoc-gen-connect-go:
	@mkdir -p $(@D)
	go build -o $(@) ./cmd/protoc-gen-connect-go

$(BIN)/buf: Makefile
	@mkdir -p $(@D)
	go install github.com/bufbuild/buf/cmd/buf@v${BUF_VERSION}

$(BIN)/license-header: Makefile
	@mkdir -p $(@D)
	go install github.com/bufbuild/buf/private/pkg/licenseheader/cmd/license-header@v${BUF_VERSION}

$(BIN)/golangci-lint: Makefile
	@mkdir -p $(@D)
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.60.0

$(BIN)/protoc-gen-go: Makefile go.mod
	@mkdir -p $(@D)
	@# The version of protoc-gen-go is determined by the version in go.mod
	go install google.golang.org/protobuf/cmd/protoc-gen-go

