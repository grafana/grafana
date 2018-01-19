PROJECT_ROOT=github.com/uber/jaeger-lib
PACKAGES := $(shell glide novendor | grep -v ./thrift-gen/...)
# all .go files that don't exist in hidden directories
ALL_SRC := $(shell find . -name "*.go" | grep -v -e vendor -e thrift-gen \
        -e ".*/\..*" \
        -e ".*/_.*" \
        -e ".*/mocks.*")

export GO15VENDOREXPERIMENT=1

GOTEST=go test -v $(RACE)
GOLINT=golint
GOVET=go vet
GOFMT=gofmt
FMT_LOG=fmt.log
LINT_LOG=lint.log

THRIFT_VER=0.9.3
THRIFT_IMG=thrift:$(THRIFT_VER)
THRIFT=docker run -v "${PWD}:/data" $(THRIFT_IMG) thrift
THRIFT_GO_ARGS=thrift_import="github.com/apache/thrift/lib/go/thrift"
THRIFT_GEN_DIR=thrift-gen

PASS=$(shell printf "\033[32mPASS\033[0m")
FAIL=$(shell printf "\033[31mFAIL\033[0m")
COLORIZE=sed ''/PASS/s//$(PASS)/'' | sed ''/FAIL/s//$(FAIL)/''

.DEFAULT_GOAL := test-and-lint

.PHONY: test-and-lint
test-and-lint: test fmt lint

.PHONY: test
test:
	$(GOTEST) $(PACKAGES) | $(COLORIZE)

.PHONY: fmt
fmt:
	$(GOFMT) -e -s -l -w $(ALL_SRC)
	./scripts/updateLicenses.sh

.PHONY: lint
lint:
	$(GOVET) $(PACKAGES)
	@cat /dev/null > $(LINT_LOG)
	@$(foreach pkg, $(PACKAGES), $(GOLINT) $(pkg) | grep -v crossdock/thrift >> $(LINT_LOG) || true;)
	@[ ! -s "$(LINT_LOG)" ] || (echo "Lint Failures" | cat - $(LINT_LOG) && false)
	@$(GOFMT) -e -s -l $(ALL_SRC) > $(FMT_LOG)
	@./scripts/updateLicenses.sh >> $(FMT_LOG)
	@[ ! -s "$(FMT_LOG)" ] || (echo "go fmt or license check failures, run 'make fmt'" | cat - $(FMT_LOG) && false)


.PHONY: install
install:
	glide --version || go get github.com/Masterminds/glide
ifeq ($(USE_DEP),true)
	dep ensure
	dep status
else
	glide install
endif


.PHONY: cover
cover:
	./scripts/cover.sh $(shell go list $(PACKAGES))
	go tool cover -html=cover.out -o cover.html


idl-submodule:
	git submodule init
	git submodule update

thrift-image:
	$(THRIFT) -version

.PHONY: install-dep-ci
install-dep-ci:
	- curl -L -s https://github.com/golang/dep/releases/download/v0.3.2/dep-linux-amd64 -o $$GOPATH/bin/dep
	- chmod +x $$GOPATH/bin/dep

.PHONY: install-ci
install-ci: install
	go get github.com/wadey/gocovmerge
	go get github.com/mattn/goveralls
	go get golang.org/x/tools/cmd/cover
	go get github.com/golang/lint/golint


.PHONY: test-ci
test-ci:
	./scripts/cover.sh $(shell go list $(PACKAGES))
	make lint

.PHONY: test-only-ci
test-only-ci:
	go test -cover $(PACKAGES)
	make lint
