all: clean golang

clean:
	rm -rf go/datasource/*.pb.go

golang:
	protoc -I . datasource.proto --go_out=plugins=grpc:go/datasource/.