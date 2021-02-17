# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

EXAMPLES := $(shell ./get_main_pkgs.sh ./example)
TOOLS_MOD_DIR := ./internal/tools

# All source code and documents. Used in spell check.
ALL_DOCS := $(shell find . -name '*.md' -type f | sort)
# All directories with go.mod files related to opentelemetry library. Used for building, testing and linting.
ALL_GO_MOD_DIRS := $(filter-out $(TOOLS_MOD_DIR), $(shell find . -type f -name 'go.mod' -exec dirname {} \; | sort))
ALL_COVERAGE_MOD_DIRS := $(shell find . -type f -name 'go.mod' -exec dirname {} \; | egrep -v '^./example|^$(TOOLS_MOD_DIR)' | sort)

# Mac OS Catalina 10.5.x doesn't support 386. Hence skip 386 test
SKIP_386_TEST = false
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
	SW_VERS := $(shell sw_vers -productVersion)
	ifeq ($(shell echo $(SW_VERS) | egrep '^(10.1[5-9]|1[1-9]|[2-9])'), $(SW_VERS))
		SKIP_386_TEST = true
	endif
endif

GOTEST_MIN = go test -timeout 30s
GOTEST = $(GOTEST_MIN) -race
GOTEST_WITH_COVERAGE = $(GOTEST) -coverprofile=coverage.out -covermode=atomic -coverpkg=./...

.DEFAULT_GOAL := precommit

.PHONY: precommit

TOOLS_DIR := $(abspath ./.tools)

$(TOOLS_DIR)/golangci-lint: $(TOOLS_MOD_DIR)/go.mod $(TOOLS_MOD_DIR)/go.sum $(TOOLS_MOD_DIR)/tools.go
	cd $(TOOLS_MOD_DIR) && \
	go build -o $(TOOLS_DIR)/golangci-lint github.com/golangci/golangci-lint/cmd/golangci-lint

$(TOOLS_DIR)/misspell: $(TOOLS_MOD_DIR)/go.mod $(TOOLS_MOD_DIR)/go.sum $(TOOLS_MOD_DIR)/tools.go
	cd $(TOOLS_MOD_DIR) && \
	go build -o $(TOOLS_DIR)/misspell github.com/client9/misspell/cmd/misspell

$(TOOLS_DIR)/stringer: $(TOOLS_MOD_DIR)/go.mod $(TOOLS_MOD_DIR)/go.sum $(TOOLS_MOD_DIR)/tools.go
	cd $(TOOLS_MOD_DIR) && \
	go build -o $(TOOLS_DIR)/stringer golang.org/x/tools/cmd/stringer

$(TOOLS_DIR)/gojq: $(TOOLS_MOD_DIR)/go.mod $(TOOLS_MOD_DIR)/go.sum $(TOOLS_MOD_DIR)/tools.go
	cd $(TOOLS_MOD_DIR) && \
	go build -o $(TOOLS_DIR)/gojq github.com/itchyny/gojq/cmd/gojq

precommit: dependabot-check license-check generate build lint examples test-benchmarks test

.PHONY: test-with-coverage
test-with-coverage:
	set -e; \
	printf "" > coverage.txt; \
	for dir in $(ALL_COVERAGE_MOD_DIRS); do \
	  echo "go test ./... + coverage in $${dir}"; \
	  (cd "$${dir}" && \
	 	$(GOTEST_WITH_COVERAGE) ./... && \
		go tool cover -html=coverage.out -o coverage.html); \
      [ -f "$${dir}/coverage.out" ] && cat "$${dir}/coverage.out" >> coverage.txt; \
	done; \
	sed -i.bak -e '2,$$ { /^mode: /d; }' coverage.txt


.PHONY: ci
ci: precommit check-clean-work-tree test-with-coverage test-386

.PHONY: check-clean-work-tree
check-clean-work-tree:
	@if ! git diff --quiet; then \
	  echo; \
	  echo 'Working tree is not clean, did you forget to run "make precommit"?'; \
	  echo; \
	  git status; \
	  exit 1; \
	fi

.PHONY: build
build:
	# TODO: Fix this on windows.
	set -e; for dir in $(ALL_GO_MOD_DIRS); do \
	  echo "compiling all packages in $${dir}"; \
	  (cd "$${dir}" && \
	    go build ./... && \
	    go test -run xxxxxMatchNothingxxxxx ./... >/dev/null); \
	done

.PHONY: test
test:
	set -e; for dir in $(ALL_GO_MOD_DIRS); do \
	  echo "go test ./... + race in $${dir}"; \
	  (cd "$${dir}" && \
	    $(GOTEST) ./...); \
	done

.PHONY: test-386
test-386:
	if [ $(SKIP_386_TEST) = true ] ; then \
	  echo "skipping the test for GOARCH 386 as it is not supported on the current OS"; \
	else \
	  set -e; for dir in $(ALL_GO_MOD_DIRS); do \
	    echo "go test ./... GOARCH 386 in $${dir}"; \
	    (cd "$${dir}" && \
	      GOARCH=386 $(GOTEST_MIN) ./...); \
	  done; \
	fi

.PHONY: examples
examples:
	@set -e; for ex in $(EXAMPLES); do \
	  echo "Building $${ex}"; \
	  (cd "$${ex}" && \
	   go build .); \
	done

.PHONY: test-benchmarks
test-benchmarks:
	@set -e; for dir in $(ALL_GO_MOD_DIRS); do \
	  echo "test benchmarks in $${dir}"; \
	  (cd "$${dir}" && go test -test.benchtime=1ms -run=NONE -bench=. ./...) > /dev/null; \
	done

.PHONY: lint
lint: $(TOOLS_DIR)/golangci-lint $(TOOLS_DIR)/misspell
	set -e; for dir in $(ALL_GO_MOD_DIRS); do \
	  echo "golangci-lint in $${dir}"; \
	  (cd "$${dir}" && \
	    $(TOOLS_DIR)/golangci-lint run --fix && \
	    $(TOOLS_DIR)/golangci-lint run); \
	done
	$(TOOLS_DIR)/misspell -w $(ALL_DOCS)
	set -e; for dir in $(ALL_GO_MOD_DIRS) $(TOOLS_MOD_DIR); do \
	  echo "go mod tidy in $${dir}"; \
	  (cd "$${dir}" && \
	    go mod tidy); \
	done

generate: $(TOOLS_DIR)/stringer
	set -e; for dir in $(ALL_GO_MOD_DIRS); do \
	  echo "running generators in $${dir}"; \
	  (cd "$${dir}" && \
	    PATH="$(TOOLS_DIR):$${PATH}" go generate ./...); \
	done

.PHONY: license-check
license-check:
	@licRes=$$(for f in $$(find . -type f \( -iname '*.go' -o -iname '*.sh' \) ! -path './vendor/*' ! -path './exporters/otlp/internal/opentelemetry-proto/*') ; do \
	           awk '/Copyright The OpenTelemetry Authors|generated|GENERATED/ && NR<=3 { found=1; next } END { if (!found) print FILENAME }' $$f; \
	   done); \
	   if [ -n "$${licRes}" ]; then \
	           echo "license header checking failed:"; echo "$${licRes}"; \
	           exit 1; \
	   fi

.PHONY: dependabot-check
dependabot-check:
	@result=$$( \
		for f in $$( find . -type f -name go.mod -exec dirname {} \; | sed 's/^.\/\?/\//' ); \
			do grep -q "$$f" .github/dependabot.yml \
			|| echo "$$f"; \
		done; \
	); \
	if [ -n "$$result" ]; then \
		echo "missing go.mod dependabot check:"; echo "$$result"; \
		exit 1; \
	fi
