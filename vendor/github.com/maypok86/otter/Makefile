.PHONY: setup
setup: deps ## Setup development environment
	cp ./scripts/pre-push.sh .git/hooks/pre-push
	chmod +x .git/hooks/pre-push

.PHONY: deps
deps: ## Install all the build and lint dependencies
	bash scripts/deps.sh

.PHONY: fmt
fmt: ## Run format tools on all go files
	gci write --skip-vendor --skip-generated \
        -s standard -s default -s "prefix(github.com/maypok86/otter)" .
	gofumpt -l -w .

.PHONY: lint
lint: ## Run all the linters
	golangci-lint run -v ./...

.PHONY: test
test: test.unit ## Run all the tests

.PHONY: test.unit
test.unit: ## Run all unit tests
	@echo 'mode: atomic' > coverage.txt
	go test -covermode=atomic -coverprofile=coverage.txt.tmp -coverpkg=./... -v -race ./...
	cat coverage.txt.tmp | grep -v -E "/generated/|/cmd/" > coverage.txt
	rm coverage.txt.tmp

.PHONY: test.32-bit
test.32-bit: ## Run tests on 32-bit arch
	GOARCH=386 go test -v ./...

.PHONY: cover
cover: test.unit ## Run all the tests and opens the coverage report
	go tool cover -html=coverage.txt

.PHONY: ci
ci: lint test ## Run all the tests and code checks

.PHONY: generate
generate: ## Generate files for the project
	go run ./cmd/generator ./internal/generated/node

.PHONY: clean
clean: ## Remove temporary files
	@go clean
	@rm -rf bin/
	@rm -rf coverage.txt lint.txt
	@echo "SUCCESS!"

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL:= help
