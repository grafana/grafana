SHELL := /bin/bash -o pipefail
UNAME_OS := $(shell uname -s)
UNAME_ARCH := $(shell uname -m)

TMP_BASE := .tmp
TMP := $(TMP_BASE)/$(UNAME_OS)/$(UNAME_ARCH)
TMP_BIN = $(TMP)/bin

GOLINT_VERSION := 8f45f776aaf18cebc8d65861cc70c33c60471952
GOLINT := $(TMP_BIN)/golint
$(GOLINT):
	$(eval GOLINT_TMP := $(shell mktemp -d))
	@cd $(GOLINT_TMP); go get github.com/golang/lint/golint@$(GOLINT_VERSION)
	@rm -rf $(GOLINT_TMP)

ERRCHECK_VERSION := v1.2.0
ERRCHECK := $(TMP_BIN)/errcheck
$(ERRCHECK):
	$(eval ERRCHECK_TMP := $(shell mktemp -d))
	@cd $(ERRCHECK_TMP); go get github.com/kisielk/errcheck@$(ERRCHECK_VERSION)
	@rm -rf $(ERRCHECK_TMP)

STATICCHECK_VERSION := c2f93a96b099cbbec1de36336ab049ffa620e6d7
STATICCHECK := $(TMP_BIN)/staticcheck
$(STATICCHECK):
	$(eval STATICCHECK_TMP := $(shell mktemp -d))
	@cd $(STATICCHECK_TMP); go get honnef.co/go/tools/cmd/staticcheck@$(STATICCHECK_VERSION)
	@rm -rf $(STATICCHECK_TMP)

unexport GOPATH
export GO111MODULE := on
export GOBIN := $(abspath $(TMP_BIN))
export PATH := $(GOBIN):$(PATH)

.DEFAULT_GOAL := all

.PHONY: all
all: lint test

.PHONY: install
install:
	go install ./...

.PHONY: golint
golint: $(GOLINT)
	@# TODO: readd cmd/proto2gql when fixed
	@#for file in $(shell find . -name '*.go'); do
	for file in $(shell find . -name '*.go' | grep -v cmd/proto2gql); do \
		golint $${file}; \
		if [ -n "$$(golint $${file})" ]; then \
			exit 1; \
		fi; \
	done

.PHONY: vet
vet:
	go vet ./...

.PHONY: testdeps
errcheck: $(ERRCHECK)
	errcheck ./...

.PHONY: staticcheck
staticcheck: $(STATICCHECK)
	staticcheck -checks "all -U1000" ./...

.PHONY: lint
# TODO: readd errcheck when fixed
#lint: golint vet errcheck staticcheck
#lint: golint vet staticcheck
lint: golint vet

.PHONY: test
test:
	go test -race -coverprofile=coverage.txt -covermode=atomic ./...

.PHONY: clean
clean:
	go clean -i ./...

.PHONY: integration
integration:
	PB=y go test -cover
