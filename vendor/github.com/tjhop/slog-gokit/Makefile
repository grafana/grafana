GOCMD := go
GOFMT := ${GOCMD} fmt
GOMOD := ${GOCMD} mod
GOTEST := ${GOCMD} test
GOLANGCILINT_CACHE := ${CURDIR}/.golangci-lint/build/cache

# autogenerate help messages for comment lines with 2 `#`
.PHONY: help
help: ## print this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} /^[a-z0-9A-Z_-]+:.*?##/ { printf "  \033[36m%-30s\033[0m%s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.PHONY: tidy
tidy: ## tidy modules
	${GOMOD} tidy

.PHONY: fmt
fmt: ## apply go code style formatter
	${GOFMT} -x ./...

.PHONY:	lint
lint: ## run linters
	mkdir -p ${GOLANGCILINT_CACHE} || true
	docker run --rm -v ${CURDIR}:/app -v ${GOLANGCILINT_CACHE}:/root/.cache -w /app docker.io/golangci/golangci-lint:latest golangci-lint run -v

.PHONY: test
test: ## run go tests
	${GOTEST} -race -v .
