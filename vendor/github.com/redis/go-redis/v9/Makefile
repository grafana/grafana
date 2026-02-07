GO_MOD_DIRS := $(shell find . -type f -name 'go.mod' -exec dirname {} \; | sort)
REDIS_VERSION ?= 8.2
RE_CLUSTER ?= false
RCE_DOCKER ?= true
CLIENT_LIBS_TEST_IMAGE ?= redislabs/client-libs-test:8.2.1-pre

docker.start:
	export RE_CLUSTER=$(RE_CLUSTER) && \
	export RCE_DOCKER=$(RCE_DOCKER) && \
	export REDIS_VERSION=$(REDIS_VERSION) && \
	export CLIENT_LIBS_TEST_IMAGE=$(CLIENT_LIBS_TEST_IMAGE) && \
	docker compose --profile all up -d --quiet-pull

docker.stop:
	docker compose --profile all down

test:
	$(MAKE) docker.start
	@if [ -z "$(REDIS_VERSION)" ]; then \
		echo "REDIS_VERSION not set, running all tests"; \
		$(MAKE) test.ci; \
	else \
		MAJOR_VERSION=$$(echo "$(REDIS_VERSION)" | cut -d. -f1); \
		if [ "$$MAJOR_VERSION" -ge 8 ]; then \
			echo "REDIS_VERSION $(REDIS_VERSION) >= 8, running all tests"; \
			$(MAKE) test.ci; \
		else \
			echo "REDIS_VERSION $(REDIS_VERSION) < 8, skipping vector_sets tests"; \
			$(MAKE) test.ci.skip-vectorsets; \
		fi; \
	fi
	$(MAKE) docker.stop

test.ci:
	set -e; for dir in $(GO_MOD_DIRS); do \
	  echo "go test in $${dir}"; \
	  (cd "$${dir}" && \
	    export RE_CLUSTER=$(RE_CLUSTER) && \
	    export RCE_DOCKER=$(RCE_DOCKER) && \
	    export REDIS_VERSION=$(REDIS_VERSION) && \
	    go mod tidy -compat=1.18 && \
	    go vet && \
	    go test -v -coverprofile=coverage.txt -covermode=atomic ./... -race -skip Example); \
	done
	cd internal/customvet && go build .
	go vet -vettool ./internal/customvet/customvet

test.ci.skip-vectorsets:
	set -e; for dir in $(GO_MOD_DIRS); do \
	  echo "go test in $${dir} (skipping vector sets)"; \
	  (cd "$${dir}" && \
	    export RE_CLUSTER=$(RE_CLUSTER) && \
	    export RCE_DOCKER=$(RCE_DOCKER) && \
	    export REDIS_VERSION=$(REDIS_VERSION) && \
	    go mod tidy -compat=1.18 && \
	    go vet && \
	    go test -v -coverprofile=coverage.txt -covermode=atomic ./... -race \
	      -run '^(?!.*(?:VectorSet|vectorset|ExampleClient_vectorset)).*$$' -skip Example); \
	done
	cd internal/customvet && go build .
	go vet -vettool ./internal/customvet/customvet

bench:
	export RE_CLUSTER=$(RE_CLUSTER) && \
	export RCE_DOCKER=$(RCE_DOCKER) && \
	export REDIS_VERSION=$(REDIS_VERSION) && \
	go test ./... -test.run=NONE -test.bench=. -test.benchmem -skip Example

.PHONY: all test test.ci test.ci.skip-vectorsets bench fmt

build:
	export RE_CLUSTER=$(RE_CLUSTER) && \
	export RCE_DOCKER=$(RCE_DOCKER) && \
	export REDIS_VERSION=$(REDIS_VERSION) && \
	go build .

fmt:
	gofumpt -w ./
	goimports -w  -local github.com/redis/go-redis ./

go_mod_tidy:
	set -e; for dir in $(GO_MOD_DIRS); do \
	  echo "go mod tidy in $${dir}"; \
	  (cd "$${dir}" && \
	    go get -u ./... && \
	    go mod tidy -compat=1.18); \
	done
