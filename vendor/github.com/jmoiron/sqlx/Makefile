.ONESHELL:
SHELL = /bin/sh
.SHELLFLAGS = -ec

BASE_PACKAGE := github.com/jmoiron/sqlx

tooling:
	go install honnef.co/go/tools/cmd/staticcheck@v0.4.7
	go install golang.org/x/vuln/cmd/govulncheck@v1.0.4
	go install golang.org/x/tools/cmd/goimports@v0.20.0

has-changes:
	git diff --exit-code --quiet HEAD --

lint:
	go vet ./...
	staticcheck -checks=all ./...

fmt:
	go list -f '{{.Dir}}' ./... | xargs -I {} goimports -local $(BASE_PACKAGE) -w {}

vuln-check:
	govulncheck ./...

test-race:
	go test -v -race -count=1 ./...

update-dependencies:
	go get -u -t -v ./...
	go mod tidy
