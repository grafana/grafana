GO_MOD_DIRS := $(shell find . -type f -name 'go.mod' -exec dirname {} \; | sort)

docker.start:
	docker compose --profile all up -d --quiet-pull

docker.stop:
	docker compose --profile all down

test:
	$(MAKE) docker.start
	$(MAKE) test.ci
	$(MAKE) docker.stop

test.ci:
	set -e; for dir in $(GO_MOD_DIRS); do \
	  echo "go test in $${dir}"; \
	  (cd "$${dir}" && \
	    go mod tidy -compat=1.18 && \
	    go vet && \
	    go test -v -coverprofile=coverage.txt -covermode=atomic ./... -race); \
	done
	cd internal/customvet && go build .
	go vet -vettool ./internal/customvet/customvet

bench:
	go test ./... -test.run=NONE -test.bench=. -test.benchmem

.PHONY: all test bench fmt

build:
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
