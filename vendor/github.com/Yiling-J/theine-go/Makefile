.PHONY: test test-race-pool test-race-nopool testx lint bench cover

test:
	go test -race -skip=TestCacheCorrectness_ ./...

test-correct-pool:
	go test ./... -run=TestCacheCorrectness_EntryPool -count=1

test-correct-nopool:
	go test ./... -run=TestCacheCorrectness_NoPool -count=1 -race

testx:
	go test ./... -v -failfast

lint:
	golangci-lint run

cover:
	go test -timeout 2000s -race -coverprofile=cover.out -coverpkg=./... -skip=TestCacheCorrectness_ ./...
	go tool cover -html=cover.out -o cover.html
