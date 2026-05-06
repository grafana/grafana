.PHONY: bench realclean cover viewcover test lint

bench:
	go test -tags bench -benchmem -bench .
	@git checkout go.mod 
	@rm go.sum

realclean:
	rm coverage.out

test:
	go test -v -race ./...

cover:
	go test -v -race -coverpkg=./... -coverprofile=coverage.out ./...

viewcover:
	go tool cover -html=coverage.out

lint:
	golangci-lint run ./...

imports:
	goimports -w ./

