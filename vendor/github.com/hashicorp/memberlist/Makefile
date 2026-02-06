SHELL := bash

GOFILES ?= $(shell go list ./... | grep -v /vendor/)

default: test

test: vet subnet
	go test ./...

integ: subnet
	INTEG_TESTS=yes go test ./...

subnet:
	./test/setup_subnet.sh

cov:
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out

format:
	@echo "--> Running go fmt"
	@go fmt $(GOFILES)

vet:
	@echo "--> Running go vet"
	@go vet -tags '$(GOTAGS)' $(GOFILES); if [ $$? -eq 1 ]; then \
		echo ""; \
		echo "Vet found suspicious constructs. Please check the reported constructs"; \
		echo "and fix them if necessary before submitting the code for review."; \
		exit 1; \
	fi

.PHONY: default test integ subnet cov format vet
