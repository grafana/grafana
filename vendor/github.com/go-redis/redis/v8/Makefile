all: testdeps
	go test ./...
	go test ./... -short -race
	go test ./... -run=NONE -bench=. -benchmem
	env GOOS=linux GOARCH=386 go test ./...
	go vet
	golangci-lint run

testdeps: testdata/redis/src/redis-server

bench: testdeps
	go test ./... -test.run=NONE -test.bench=. -test.benchmem

.PHONY: all test testdeps bench

testdata/redis:
	mkdir -p $@
	wget -qO- http://download.redis.io/redis-stable.tar.gz | tar xvz --strip-components=1 -C $@

testdata/redis/src/redis-server: testdata/redis
	cd $< && make all
