
CMD = jpgo


help:
	@echo "Please use \`make <target>' where <target> is one of"
	@echo "  test                    to run all the tests"
	@echo "  build                   to build the library and jp executable"
	@echo "  generate                to run codegen"

generate:
	go generate ./...

build:
	rm -f $(CMD)
	git submodule update --init --checkout --recursive --force
	go build ./...
	rm -f cmd/$(CMD)/$(CMD) && cd cmd/$(CMD)/ && go build ./...
	mv cmd/$(CMD)/$(CMD) .

test: build
	go test -v ./...

check:
	go vet ./...
	golint ./...
	golangci-lint run

htmlc:
	go test -cover -coverpkg ./... -coverprofile="/tmp/jpcov" ./... && go tool cover -html="/tmp/jpcov" && unlink /tmp/jpcov

buildfuzz:
	go-fuzz-build github.com/jmespath-community/go-jmespath/fuzz

fuzz: buildfuzz
	go-fuzz -bin=./jmespath-fuzz.zip -workdir=fuzz/testdata

bench:
	go test -bench . -cpuprofile cpu.out

pprof-cpu:
	go tool pprof ./go-jmespath.test ./cpu.out

install-dev-cmds:
	go install golang.org/x/lint/golint@latest
	go install golang.org/x/tools/cmd/stringer@latest
	command -v golangci-lint || { curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $$(go env GOPATH)/bin v1.46.2; }
