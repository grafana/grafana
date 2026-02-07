include ./commons-test.mk

.PHONY: lint-all
lint-all:
	$(MAKE) lint
	$(MAKE) -C modulegen lint
	$(MAKE) -C examples lint-examples
	$(MAKE) -C modules lint-modules

.PHONY: test-all
test-all: tools test-tools test-unit

.PHONY: test-examples
test-examples:
	@echo "Running example tests..."
	$(MAKE) -C examples test

.PHONY: tidy-all
tidy-all:
	$(MAKE) tidy
	$(MAKE) -C examples tidy-examples
	$(MAKE) -C modules tidy-modules

## --------------------------------------

DOCS_CONTAINER=mkdocs-container
DOCS_IMAGE=python:3.8

.PHONY: clean-docs
clean-docs:
	@echo "Destroying docs"
	docker rm -f $(DOCS_CONTAINER) || true

.PHONY: serve-docs
serve-docs:
	docker run --rm --name $(DOCS_CONTAINER) -it -p 8000:8000 \
		-v $(PWD):/testcontainers-go \
		-w /testcontainers-go \
		$(DOCS_IMAGE) bash -c "pip install -Ur requirements.txt && mkdocs serve -f mkdocs.yml -a 0.0.0.0:8000"

## --------------------------------------

# Compose tests: Make goals to test the compose module against the latest versions of the compose and compose-go repositories.
#
# The following goals are available:
#
# - compose-clean: Clean the .build directory, and clean the go.mod and go.sum files in the testcontainers-go compose module.
# - compose-clone: Clone the compose and compose-go repositories into the .build directory.
# - compose-replace: Replace the docker/compose/v2 dependency in the testcontainers-go compose module with the local copy.
# - compose-spec-replace: Replace the compose-spec/compose-go/v2 dependency in the testcontainers-go compose module with the local copy.
# - compose-tidy: Run "go mod tidy" in the testcontainers-go compose module.
# - compose-test-all-latest: Test the testcontainers-go compose module against the latest versions of the compose and compose-go repositories.
# - compose-test-latest: Test the testcontainers-go compose module against the latest version of the compose repository, using current version of the compose-spec repository.
# - compose-test-spec-latest: Test the testcontainers-go compose module against the latest version of the compose-spec repository, using current version of the compose repository.

.PHONY: compose-clean
compose-clean:
	rm -rf .build
	cd modules/compose && git checkout -- go.mod go.sum

.PHONY: compose-clone
compose-clone: compose-clean
	mkdir .build
	git clone https://github.com/compose-spec/compose-go.git .build/compose-go & \
	git clone https://github.com/docker/compose.git .build/compose
	wait

.PHONY: compose-replace
compose-replace:
	cd modules/compose && echo "replace github.com/docker/compose/v2 => ../../.build/compose" >> go.mod

.PHONY: compose-spec-replace
compose-spec-replace:
	cd modules/compose && echo "replace github.com/compose-spec/compose-go/v2 => ../../.build/compose-go" >> go.mod

.PHONY: compose-tidy
compose-tidy:
	cd modules/compose && go mod tidy

# The following three goals are used in the GitHub Actions workflow to test the compose module against the latest versions of the compose and compose-spec repositories.
# Please update the 'docker-projects-latest' workflow if you are making any changes to these goals.

.PHONY: compose-test-all-latest
compose-test-all-latest: compose-clone compose-replace compose-spec-replace compose-tidy
	make -C modules/compose test-compose

.PHONY: compose-test-latest
compose-test-latest: compose-clone compose-replace compose-tidy
	make -C modules/compose test-compose

.PHONY: compose-test-spec-latest
compose-test-spec-latest: compose-clone compose-spec-replace compose-tidy
	make -C modules/compose test-compose
