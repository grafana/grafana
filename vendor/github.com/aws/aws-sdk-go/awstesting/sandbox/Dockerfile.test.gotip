FROM ubuntu:12.04
FROM aws-golang:tip

ADD . /go/src/github.com/aws/aws-sdk-go

WORKDIR /go/src/github.com/aws/aws-sdk-go
CMD ["make", "unit"]
