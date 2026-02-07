GO_TEST_FLAGS ?= -race -count=1 -v -timeout=5m -json

# These are the default values for the test database. They can be overridden
DB_USER ?= dbuser
DB_PASSWORD ?= password1
DB_NAME ?= testdb
DB_POSTGRES_PORT ?= 5433
DB_MYSQL_PORT ?= 3307
DB_CLICKHOUSE_PORT ?= 9001
DB_YDB_PORT ?= 2136
DB_TURSO_PORT ?= 8080
DB_STARROCKS_PORT ?= 9030

list-build-tags:
	@echo "Available build tags:"
	@echo "$$(rg -o --trim 'no_[a-zA-Z0-9_]+' ./cmd/goose \
		--no-line-number --no-filename | sort | uniq | \
		xargs -n 4 | column -t | sed 's/^/  /')"

.PHONY: dist
dist:
	@mkdir -p ./bin
	@rm -f ./bin/*
	GOOS=darwin  GOARCH=amd64 go build -o ./bin/goose-darwin64       ./cmd/goose
	GOOS=linux   GOARCH=amd64 go build -o ./bin/goose-linux64        ./cmd/goose
	GOOS=linux   GOARCH=386   go build -o ./bin/goose-linux386       ./cmd/goose
	GOOS=windows GOARCH=amd64 go build -o ./bin/goose-windows64.exe  ./cmd/goose
	GOOS=windows GOARCH=386   go build -o ./bin/goose-windows386.exe ./cmd/goose

.PHONY: clean
clean:
	@find . -type f -name '*.FAIL' -delete

.PHONY: lint
lint: tools
	@golangci-lint run ./... --fix

.PHONY: tools
tools:
	@go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
	@go install github.com/mfridman/tparse@main

test-packages:
	go test $(GO_TEST_FLAGS) $$(go list ./... | grep -v -e /bin -e /cmd -e /examples) |\
		tparse --follow -sort=elapsed -trimpath=auto -all

test-packages-short:
	go test -test.short $(GO_TEST_FLAGS) $$(go list ./... | grep -v -e /bin -e /cmd -e /examples) |\
		tparse --follow -sort=elapsed

coverage-short:
	go test ./ -test.short $(GO_TEST_FLAGS) -cover -coverprofile=coverage.out | tparse --follow -sort=elapsed
	go tool cover -html=coverage.out

coverage:
	go test ./ $(GO_TEST_FLAGS) -cover -coverprofile=coverage.out | tparse --follow -sort=elapsed
	go tool cover -html=coverage.out

test-lock-coverage:
	go test ./internal/testing/integration/locking ./lock/internal/... -cover -coverpkg=./lock/internal/... -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html
	@echo "Lock package coverage: $$(go tool cover -func=coverage.out | tail -1 | awk '{print $$3}')"
	open coverage.html

#
# Integration-related targets
#
add-gowork:
	@[ -f go.work ] || go work init
	@[ -f go.work.sum ] || go work use -r .

remove-gowork:
	rm -rf go.work go.work.sum

upgrade-integration-deps:
	cd ./internal/testing && go get -u ./... && go mod tidy

test-postgres-long: add-gowork test-postgres
	go test $(GO_TEST_FLAGS) ./internal/testing/integration -run='(TestPostgresProviderLocking|TestPostgresSessionLocker)' |\
		tparse --follow -sort=elapsed

test-postgres: add-gowork
	go test $(GO_TEST_FLAGS) ./internal/testing/integration -run="^TestPostgres$$" | tparse --follow -sort=elapsed

test-clickhouse: add-gowork
	go test $(GO_TEST_FLAGS) ./internal/testing/integration -run='(TestClickhouse|TestClickhouseRemote)' |\
		tparse --follow -sort=elapsed

test-mysql: add-gowork
	go test $(GO_TEST_FLAGS) ./internal/testing/integration -run='TestMySQL' | tparse --follow -sort=elapsed

test-turso: add-gowork
	go test $(GO_TEST_FLAGS) ./internal/testing/integration -run='TestTurso' | tparse --follow -sort=elapsed

test-ydb: add-gowork
	go test $(GO_TEST_FLAGS) ./internal/testing/integration -run='TestYDB' | tparse --follow -sort=elapsed

test-starrocks: add-gowork
	go test $(GO_TEST_FLAGS) ./internal/testing/integration -run='TestStarrocks' | tparse --follow -sort=elapsed

test-integration: add-gowork
	go test $(GO_TEST_FLAGS) ./internal/testing/integration/... | tparse --follow -sort=elapsed -trimpath=auto -all

#
# Docker-related targets
#

docker-cleanup:
	docker stop -t=0 $$(docker ps --filter="label=goose_test" -aq)

docker-postgres:
	docker run --rm -d \
		-e POSTGRES_USER=$(DB_USER) \
		-e POSTGRES_PASSWORD=$(DB_PASSWORD) \
		-e POSTGRES_DB=$(DB_NAME) \
		-p $(DB_POSTGRES_PORT):5432 \
		-l goose_test \
		postgres:14-alpine -c log_statement=all
	echo "postgres://$(DB_USER):$(DB_PASSWORD)@localhost:$(DB_POSTGRES_PORT)/$(DB_NAME)?sslmode=disable"

docker-mysql:
	docker run --rm -d \
		-e MYSQL_ROOT_PASSWORD=rootpassword1 \
		-e MYSQL_DATABASE=$(DB_NAME) \
		-e MYSQL_USER=$(DB_USER) \
		-e MYSQL_PASSWORD=$(DB_PASSWORD) \
		-p $(DB_MYSQL_PORT):3306 \
		-l goose_test \
		mysql:8.0.31
	echo "mysql://$(DB_USER):$(DB_PASSWORD)@localhost:$(DB_MYSQL_PORT)/$(DB_NAME)?parseTime=true"

docker-clickhouse:
	docker run --rm -d \
		-e CLICKHOUSE_DB=$(DB_NAME) \
		-e CLICKHOUSE_USER=$(DB_USER) \
		-e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
		-e CLICKHOUSE_PASSWORD=$(DB_PASSWORD) \
		-p $(DB_CLICKHOUSE_PORT):9000/tcp \
		-l goose_test \
		clickhouse/clickhouse-server:23-alpine
	echo "clickhouse://$(DB_USER):$(DB_PASSWORD)@localhost:$(DB_CLICKHOUSE_PORT)/$(DB_NAME)"

docker-turso:
	docker run --rm -d \
		-p $(DB_TURSO_PORT):8080 \
		-l goose_test \
		ghcr.io/tursodatabase/libsql-server:v0.22.10
