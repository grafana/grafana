artifacts_path := /tmp/artifacts

help:
	@echo 'Targets:'
	@echo '  all          - runs lint, server, coverage'
	@echo '  lint         - runs code style checks'
	@echo '  shorttest    - runs unit and integration tests'
	@echo '  test         - runs all tests, including e2e tests - requires running influxdb 2 server'
	@echo '  coverage     - runs all tests, including e2e tests, with coverage report - requires running influxdb 2 server'
	@echo '  server       - prepares InfluxDB in docker environment'

lint:
	go vet  ./...
	go install honnef.co/go/tools/cmd/staticcheck@latest  && staticcheck --checks='all' --tags e2e ./...
	go install golang.org/x/lint/golint@latest && golint ./...

shorttest:
	go test -race -v -count=1 ./...

test:
	go test -race -v -count=1 --tags e2e ./...

coverage:
	go install gotest.tools/gotestsum@latest && gotestsum --junitfile /tmp/test-results/unit-tests.xml -- -race -coverprofile=coverage.txt -covermode=atomic -coverpkg '.,./api/...,./internal/.../,./log/...' -tags e2e ./...
	if test ! -e $(artifacts_path); then mkdir $(artifacts_path);  fi
	go tool cover -html=coverage.txt -o $(artifacts_path)/coverage.html

server:
	./scripts/influxdb-restart.sh

all: 	lint server coverage	
