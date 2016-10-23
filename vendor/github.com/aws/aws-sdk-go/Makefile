LINTIGNOREDOT='awstesting/integration.+should not use dot imports'
LINTIGNOREDOC='service/[^/]+/(api|service|waiters)\.go:.+(comment on exported|should have comment or be unexported)'
LINTIGNORECONST='service/[^/]+/(api|service|waiters)\.go:.+(type|struct field|const|func) ([^ ]+) should be ([^ ]+)'
LINTIGNORESTUTTER='service/[^/]+/(api|service)\.go:.+(and that stutters)'
LINTIGNOREINFLECT='service/[^/]+/(api|service)\.go:.+method .+ should be '
LINTIGNOREINFLECTS3UPLOAD='service/s3/s3manager/upload\.go:.+struct field SSEKMSKeyId should be '
LINTIGNOREDEPS='vendor/.+\.go'

SDK_WITH_VENDOR_PKGS=$(shell go list ./... | grep -v "/vendor/src")
SDK_ONLY_PKGS=$(shell go list ./... | grep -v "/vendor/")
SDK_GO_1_4=$(shell go version | grep "go1.4")
SDK_GO_VERSION=$(shell go version | awk '''{print $$3}''' | tr -d '''\n''')

all: get-deps generate unit

help:
	@echo "Please use \`make <target>' where <target> is one of"
	@echo "  api_info                to print a list of services and versions"
	@echo "  docs                    to build SDK documentation"
	@echo "  build                   to go build the SDK"
	@echo "  unit                    to run unit tests"
	@echo "  integration             to run integration tests"
	@echo "  performance             to run performance tests"
	@echo "  verify                  to verify tests"
	@echo "  lint                    to lint the SDK"
	@echo "  vet                     to vet the SDK"
	@echo "  generate                to go generate and make services"
	@echo "  gen-test                to generate protocol tests"
	@echo "  gen-services            to generate services"
	@echo "  get-deps                to go get the SDK dependencies"
	@echo "  get-deps-tests          to get the SDK's test dependencies"
	@echo "  get-deps-verify         to get the SDK's verification dependencies"

generate: gen-test gen-endpoints gen-services

gen-test: gen-protocol-test

gen-services:
	go generate ./service

gen-protocol-test:
	go generate ./private/protocol/...

gen-endpoints:
	go generate ./private/endpoints

build:
	@echo "go build SDK and vendor packages"
	@go build ${SDK_ONLY_PKGS}

unit: get-deps-tests build verify
	@echo "go test SDK and vendor packages"
	@go test -tags $(SDK_ONLY_PKGS)

unit-with-race-cover: get-deps-tests build verify
	@echo "go test SDK and vendor packages"
	@go test -tags -race -cpu=1,2,4 $(SDK_ONLY_PKGS)

integration: get-deps-tests integ-custom smoke-tests performance

integ-custom:
	go test -tags "integration" ./awstesting/integration/customizations/...

smoke-tests: get-deps-tests
	gucumber -go-tags "integration" ./awstesting/integration/smoke

performance: get-deps-tests
	AWS_TESTING_LOG_RESULTS=${log-detailed} AWS_TESTING_REGION=$(region) AWS_TESTING_DB_TABLE=$(table) gucumber -go-tags "integration" ./awstesting/performance

sandbox-tests: sandbox-test-go14 sandbox-test-go15 sandbox-test-go15-novendorexp sandbox-test-go16 sandbox-test-go17 sandbox-test-gotip

sandbox-test-go14:
	docker build -f ./awstesting/sandbox/Dockerfile.test.go1.4 -t "aws-sdk-go-1.4" .
	docker run -t aws-sdk-go-1.4

sandbox-test-go15:
	docker build -f ./awstesting/sandbox/Dockerfile.test.go1.5 -t "aws-sdk-go-1.5" .
	docker run -t aws-sdk-go-1.5

sandbox-test-go15-novendorexp:
	docker build -f ./awstesting/sandbox/Dockerfile.test.go1.5-novendorexp -t "aws-sdk-go-1.5-novendorexp" .
	docker run -t aws-sdk-go-1.5-novendorexp

sandbox-test-go16:
	docker build -f ./awstesting/sandbox/Dockerfile.test.go1.6 -t "aws-sdk-go-1.6" .
	docker run -t aws-sdk-go-1.6

sandbox-test-go17:
	docker build -f ./awstesting/sandbox/Dockerfile.test.go1.7 -t "aws-sdk-go-1.7" .
	docker run -t aws-sdk-go-1.7

sandbox-test-gotip:
	@echo "Run make update-aws-golang-tip, if this test fails because missing aws-golang:tip container"
	docker build -f ./awstesting/sandbox/Dockerfile.test.gotip -t "aws-sdk-go-tip" .
	docker run -t aws-sdk-go-tip

update-aws-golang-tip:
	docker build -f ./awstesting/sandbox/Dockerfile.golang-tip -t "aws-golang:tip" .

verify: get-deps-verify lint vet

lint:
	@echo "go lint SDK and vendor packages"
	@lint=`if [ -z "${SDK_GO_1_4}" ]; then  golint ./...; else echo "skipping golint"; fi`; \
	lint=`echo "$$lint" | grep -E -v -e ${LINTIGNOREDOT} -e ${LINTIGNOREDOC} -e ${LINTIGNORECONST} -e ${LINTIGNORESTUTTER} -e ${LINTIGNOREINFLECT} -e ${LINTIGNOREDEPS} -e ${LINTIGNOREINFLECTS3UPLOAD}`; \
	echo "$$lint"; \
	if [ "$$lint" != "" ] && [ "$$lint" != "skipping golint" ]; then exit 1; fi

SDK_BASE_FOLDERS=$(shell ls -d */ | grep -v vendor | grep -v awsmigrate)
ifneq (,$(findstring go1.5, ${SDK_GO_VERSION}))
	GO_VET_CMD=go tool vet --all -shadow
else ifneq (,$(findstring go1.6, ${SDK_GO_VERSION}))
	GO_VET_CMD=go tool vet --all -shadow -example=false
else ifneq (,$(findstring devel, ${SDK_GO_VERSION}))
	GO_VET_CMD=go tool vet --all -shadow -tests=false
else
	GO_VET_CMD=echo skipping go vet, ${SDK_GO_VERSION}
endif

vet:
	${GO_VET_CMD} ${SDK_BASE_FOLDERS}

get-deps: get-deps-tests get-deps-verify
	@echo "go get SDK dependencies"
	@go get -v $(SDK_ONLY_PKGS)

get-deps-tests:
	@echo "go get SDK testing dependencies"
	go get github.com/gucumber/gucumber/cmd/gucumber
	go get github.com/stretchr/testify
	go get github.com/smartystreets/goconvey

get-deps-verify:
	@echo "go get SDK verification utilities"
	@if [ -z "${SDK_GO_1_4}" ]; then  go get github.com/golang/lint/golint; else echo "skipped getting golint"; fi

bench:
	@echo "go bench SDK packages"
	@go test -run NONE -bench . -benchmem -tags 'bench' $(SDK_ONLY_PKGS)

bench-protocol:
	@echo "go bench SDK protocol marshallers"
	@go test -run NONE -bench . -benchmem -tags 'bench' ./private/protocol/...

docs:
	@echo "generate SDK docs"
	rm -rf doc && bundle install && bundle exec yard
	@# This env variable, DOCS, is for internal use
	@if [ -n "$(AWS_DOC_GEN_TOOL)" ]; then echo "For internal use. Subject to change."; $(AWS_DOC_GEN_TOOL) `pwd`; fi

api_info:
	@go run private/model/cli/api-info/api-info.go
