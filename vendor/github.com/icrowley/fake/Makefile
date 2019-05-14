.DEFAULT_GOAL = all

numcpus  := $(shell cat /proc/cpuinfo | grep '^processor\s*:' | wc -l)
version  := $(shell git rev-list --count HEAD).$(shell git rev-parse --short HEAD)

name     := fake
package  := github.com/icrowley/$(name)

.PHONY: all
all:: dependencies

.PHONY: tools
tools::
	@if [ ! -e "$(GOPATH)"/bin/glide ]; then go get github.com/Masterminds/glide; fi
	@if [ ! -e "$(GOPATH)"/bin/godef ]; then go get github.com/rogpeppe/godef; fi
	@if [ ! -e "$(GOPATH)"/bin/gocode ]; then go get github.com/nsf/gocode; fi
	@if [ ! -e "$(GOPATH)"/bin/gometalinter ]; then go get github.com/alecthomas/gometalinter && gometalinter --install; fi
	@if [ ! -e "$(GOPATH)"/src/github.com/stretchr/testify/assert ]; then go get github.com/stretchr/testify/assert; fi

.PHONY: dependencies
dependencies:: tools
	glide install

.PHONY: clean
clean:: tools
	glide cache-clear

.PHONY: test
test:: dependencies
	go test -v \
           $(shell glide novendor)

.PHONY: bench
bench:: dependencies
	go test        \
           -bench=. -v \
           $(shell glide novendor)

.PHONY: lint
lint:: dependencies
	go vet $(shell glide novendor)
	gometalinter                     \
		--deadline=5m            \
		--concurrency=$(numcpus) \
		$(shell glide novendor)

.PHONY: check
check:: lint test
