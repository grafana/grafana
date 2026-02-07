PROJECT_ROOT=github.com/uber/jaeger-client-go
export GO111MODULE=off
PACKAGES := . $(shell GO111MODULE=off go list ./... | awk -F/ 'NR>1 {print "./"$$4"/..."}' | grep -v -e ./thrift-gen/... -e ./thrift/... | sort -u)
# all .go files that don't exist in hidden directories
ALL_SRC := $(shell find . -name "*.go" | grep -v -e vendor -e thrift-gen -e ./thrift/ \
        -e ".*/\..*" \
        -e ".*/_.*" \
        -e ".*/mocks.*")

USE_DEP := true

-include crossdock/rules.mk

RACE=-race
GOTEST=go test -v $(RACE)
GOLINT=golint
GOVET=go vet
GOFMT=gofmt
FMT_LOG=fmt.log
LINT_LOG=lint.log

THRIFT_VER=0.14
THRIFT_IMG=jaegertracing/thrift:$(THRIFT_VER)
THRIFT=docker run -v "${PWD}:/data" -u ${shell id -u}:${shell id -g} $(THRIFT_IMG) thrift

PASS=$(shell printf "\033[32mPASS\033[0m")
FAIL=$(shell printf "\033[31mFAIL\033[0m")
COLORIZE=sed ''/PASS/s//$(PASS)/'' | sed ''/FAIL/s//$(FAIL)/''

.DEFAULT_GOAL := test-and-lint

.PHONY: test-and-lint
test-and-lint: test fmt lint

.PHONY: test
test:
ifeq ($(USE_DEP),true)
	dep check
endif
	bash -c "set -e; set -o pipefail; $(GOTEST) $(PACKAGES) | $(COLORIZE)"

.PHONY: fmt
fmt:
	$(GOFMT) -e -s -l -w $(ALL_SRC)
	./scripts/updateLicenses.sh

.PHONY: lint
lint: vet golint lint-fmt lint-thrift-testing

.PHONY: vet
vet:
	$(GOVET) $(PACKAGES)

.PHONY: golint
golint:
	@cat /dev/null > $(LINT_LOG)
	@$(foreach pkg, $(PACKAGES), $(GOLINT) $(pkg) | grep -v crossdock/thrift >> $(LINT_LOG) || true;)
	@[ ! -s "$(LINT_LOG)" ] || (echo "Lint Failures" | cat - $(LINT_LOG) && false)

.PHONY: lint-fmt
lint-fmt:
	@$(GOFMT) -e -s -l $(ALL_SRC) > $(FMT_LOG)
	./scripts/updateLicenses.sh >> $(FMT_LOG)
	@[ ! -s "$(FMT_LOG)" ] || (echo "go fmt or license check failures, run 'make fmt'" | cat - $(FMT_LOG) && false)

# make sure thrift/ module does not import "testing"
.PHONY: lint-thrift-testing
lint-thrift-testing:
	@cat /dev/null > $(LINT_LOG)
	@(grep -rn '"testing"' thrift | grep -v README.md > $(LINT_LOG)) || true
	@[ ! -s "$(LINT_LOG)" ] || (echo '"thrift" module must not import "testing", see issue #585' | cat - $(LINT_LOG) && false)

.PHONY: install
install:
	@echo install: USE_DEP=$(USE_DEP) USE_GLIDE=$(USE_GLIDE)
ifeq ($(USE_DEP),true)
	dep version || make install-dep
	dep ensure -vendor-only -v
endif
ifeq ($(USE_GLIDE),true)
	glide --version || go get github.com/Masterminds/glide
	glide install
endif


.PHONY: cover
cover:
	$(GOTEST) -cover -coverprofile cover.out $(PACKAGES)

.PHONY: cover-html
cover-html: cover
	go tool cover -html=cover.out -o cover.html

# This is not part of the regular test target because we don't want to slow it
# down.
.PHONY: test-examples
test-examples:
	make -C examples

.PHONY: thrift
thrift: idl-submodule thrift-compile

# TODO at the moment we're not generating tchan_*.go files
.PHONY: thrift-compile
thrift-compile: thrift-image
	docker run -v "${PWD}:/data" -u ${shell id -u}:${shell id -g} $(THRIFT_IMG) /data/scripts/gen-thrift.sh

.PHONY: idl-submodule
idl-submodule:
	git submodule init
	git submodule update

.PHONY: thrift-image
thrift-image:
	$(THRIFT) -version

.PHONY: install-dep
install-dep:
	- curl -L -s https://github.com/golang/dep/releases/download/v0.5.0/dep-linux-amd64 -o $$GOPATH/bin/dep
	- chmod +x $$GOPATH/bin/dep

.PHONY: install-ci
install-ci: install
	go get github.com/wadey/gocovmerge
	go get github.com/mattn/goveralls
	go get golang.org/x/tools/cmd/cover
	go get golang.org/x/lint/golint

.PHONY: test-ci
test-ci: cover
ifeq ($(CI_SKIP_LINT),true)
	echo 'skipping lint'
else
	make lint
endif
