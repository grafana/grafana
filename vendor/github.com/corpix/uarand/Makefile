.DEFAULT_GOAL = all

version  := $(shell git rev-list --count HEAD).$(shell git rev-parse --short HEAD)

name     := uarand
package  := github.com/corpix/$(name)

.PHONY: all
all:: useragents.go

.PHONY: test
test:
	go test -v ./...

.PHONY: lint
lint:
	go vet ./...

.PHONY: check
check: lint test

.PHONY: useragents.go
useragents.go:
	curl -Ls -H'User-Agent: gotohellwithyour403'                            \
		http://techpatterns.com/downloads/firefox/useragentswitcher.xml \
	| ./scripts/extract-user-agents                                         \
	| ./scripts/generate-useragents-go $(name)                              \
	> $@
	go fmt $@
