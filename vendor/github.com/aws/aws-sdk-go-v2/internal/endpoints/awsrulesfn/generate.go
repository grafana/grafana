//go:build codegen
// +build codegen

package awsrulesfn

//go:generate go run -tags codegen ./internal/partition/codegen.go -model partitions.json -output partitions.go
//go:generate gofmt -w -s .
