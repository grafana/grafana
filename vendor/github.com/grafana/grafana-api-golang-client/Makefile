.PHONY: drone, test

drone:
	drone jsonnet --stream --format --source .drone/drone.jsonnet --target .drone/drone.yml
	drone lint .drone/drone.yml
	drone sign --save grafana/grafana-api-golang-client .drone/drone.yml

test:
	go version
	go run github.com/golangci/golangci-lint/cmd/golangci-lint@v1.55.1 run ./...
	go test -cover -race -vet all -mod readonly ./...

