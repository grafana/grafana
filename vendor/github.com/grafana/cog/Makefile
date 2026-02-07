# Within devbox
ifneq "$(DEVBOX_CONFIG_DIR)" ""
    RUN_DEVBOX:=
else # Normal shell
    RUN_DEVBOX:=devbox run
endif

##@ General

# The help target prints out all targets with their descriptions organized
# beneath their categories. The categories are represented by '##@' and the
# target descriptions by '##'. The awk commands is responsible for reading the
# entire set of makefiles included in this invocation, looking for lines of the
# file as xyz: ## something, and then pretty-format the target and help. Then,
# if there's a line with ##@ something, that gets pretty-printed as a category.
# More info on the usage of ANSI control characters for terminal formatting:
# https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_parameters
# More info on the awk command:
# http://linuxcommand.org/lc3_adv_awk.php

.PHONY: help
help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

.PHONY: lint
lint: dev-env-check-binaries ## Lints the code base.
	$(RUN_DEVBOX) golangci-lint run -c .golangci.yaml

.PHONY: tests
tests: dev-env-check-binaries gen-tests ## Runs the tests.
	$(RUN_DEVBOX) go test -v ./...

.PHONY: deps
deps: dev-env-check-binaries ## Installs the dependencies.
	$(RUN_DEVBOX) go mod vendor
	$(RUN_DEVBOX) pip install -qq -r requirements.txt

.PHONY: docs
docs: dev-env-check-binaries ## Generates the documentation.
	@$(RUN_DEVBOX) go run cmd/compiler-passes-docs/*
	@$(RUN_DEVBOX) go run cmd/cog-config-schemas/*
	$(RUN_DEVBOX) mkdocs build -f ./mkdocs-github.yml -d ./docs-site/

.PHONY: serve-docs
serve-docs: dev-env-check-binaries ## Builds and serves the documentation.
	$(RUN_DEVBOX) mkdocs serve -w ./docs/ -f ./mkdocs-github.yml

.PHONY: gen-sdk-dev
gen-sdk-dev: dev-env-check-binaries ## Generates a dev version of the Foundation SDK.
	rm -rf generated
	$(RUN_DEVBOX) go run cmd/cli/main.go generate \
		--config ./config/foundation_sdk.dev.yaml

.PHONY: gen-tests
gen-tests: dev-env-check-binaries ## Generates the code described by tests schemas.
	$(RUN_DEVBOX) go run ./cmd/cli/ generate \
		--config ./config/foundation_sdk.tests.yaml

.PHONY: run-go-example
run-go-example: dev-env-check-binaries ## Runs the Go example.
	$(RUN_DEVBOX) go run ./examples/_go/*

.PHONY: run-java-example
run-java-example: dev-env-check-binaries ## Runs the Java example.
	$(RUN_DEVBOX) gradle publishToMavenLocal -p generated/java
	$(RUN_DEVBOX) gradle run -p examples/java

.PHONY: run-php-example
run-php-example: dev-env-check-binaries ## Runs the PHP example.
	$(RUN_DEVBOX) composer install -d ./examples/php && \
	$(RUN_DEVBOX) php ./examples/php/index.php

.PHONY: run-ts-example
run-ts-example: dev-env-check-binaries ## Runs the Typescript example.
	$(RUN_DEVBOX) ts-node examples/typescript

.PHONY: run-python-example
run-python-example: dev-env-check-binaries ## Runs the Python example.
	$(RUN_DEVBOX) python examples/python/main.py

.PHONY: dev-env-check-binaires
dev-env-check-binaries: ## Check that the required binary are present.
	@devbox version >/dev/null 2>&1 || (echo "ERROR: devbox is required. See https://www.jetify.com/devbox/docs/quickstart/"; exit 1)
