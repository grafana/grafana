# Grafana Plugin SDK for Go

Develop Grafana backend plugins with this Go SDK.

**Warning**: This SDK is currently in alpha and will likely have major breaking changes during early development. Please do not consider this SDK published until this warning has been removed.

## Usage

```go
package main

import (
	"context"
	"log"
	"os"

	gf "github.com/grafana/grafana-plugin-sdk-go"
)

const pluginID = "myorg-custom-datasource"

type MyDataSource struct {
	logger *log.Logger
}

func (d *MyDataSource) Query(ctx context.Context, tr gf.TimeRange, ds gf.DataSourceInfo, queries []gf.Query) ([]gf.QueryResult, error) {
	return []gf.QueryResult{}, nil
}

func main() {
	logger := log.New(os.Stderr, "", 0)

	srv := gf.NewServer()

	srv.HandleDataSource(pluginID, &MyDataSource{
		logger: logger,
	})

	if err := srv.Serve(); err != nil {
		logger.Fatal(err)
	}
}
```

## Developing

Generate Go code for Protobuf definitions:

```
make build-proto
```
