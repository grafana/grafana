.DEFAULT_GOAL := test-and-lint

.PHONY: test-and-lint
test-and-lint: test lint

.PHONY: test
test:
	go test -v -cover -race ./...

.PHONY: cover
cover:
	go test -v -coverprofile=coverage.txt -covermode=atomic -race ./...

.PHONY: lint
lint:
	go fmt ./...
	golint ./...
	@# Run again with magic to exit non-zero if golint outputs anything.
	@! (golint ./... | read dummy)
	go vet ./...
