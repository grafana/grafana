ROOT_DIR:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
GOBIN= $(GOPATH)/bin

define go_install
    go install $(1)
endef

$(GOBIN)/golangci-lint:
	$(call go_install,github.com/golangci/golangci-lint/cmd/golangci-lint@v1.63.4)

$(GOBIN)/gotestsum:
	$(call go_install,gotest.tools/gotestsum@latest)

$(GOBIN)/mockery:
	$(call go_install,github.com/vektra/mockery/v2@v2.45)

.PHONY: install
install: $(GOBIN)/golangci-lint $(GOBIN)/gotestsum $(GOBIN)/mockery

.PHONY: clean
clean:
	rm $(GOBIN)/golangci-lint
	rm $(GOBIN)/gotestsum
	rm $(GOBIN)/mockery

.PHONY: dependencies-scan
dependencies-scan:
	@echo ">> Scanning dependencies in $(CURDIR)..."
	go list -json -m all | docker run --rm -i sonatypecommunity/nancy:latest sleuth --skip-update-check

.PHONY: lint
lint: $(GOBIN)/golangci-lint
	golangci-lint run --verbose -c $(ROOT_DIR)/.golangci.yml --fix

.PHONY: generate
generate: $(GOBIN)/mockery
	go generate ./...

.PHONY: test-%
test-%: $(GOBIN)/gotestsum
	@echo "Running $* tests..."
	gotestsum \
		--format short-verbose \
		--rerun-fails=5 \
		--packages="./..." \
		--junitfile TEST-unit.xml \
		-- \
		-v \
		-coverprofile=coverage.out \
		-timeout=30m \
		-race

.PHONY: tools
tools:
	go mod download

.PHONY: test-tools
test-tools: $(GOBIN)/gotestsum

.PHONY: tidy
tidy:
	go mod tidy

.PHONY: pre-commit
pre-commit: generate tidy lint
