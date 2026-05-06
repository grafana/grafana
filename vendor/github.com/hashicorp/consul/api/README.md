# Consul API Client

This package provides the `api` package which provides programmatic access to the full Consul API.

The full documentation is available on [Godoc](https://godoc.org/github.com/hashicorp/consul/api).

## Usage

Below is an example of using the Consul client. To run the example, you must first
[install Consul](https://developer.hashicorp.com/consul/downloads) and 
[Go](https://go.dev/doc/install).

To run the client API, create a new Go module.

```shell
go mod init consul-demo
```

Copy the example code into a file called `main.go` in the directory where the module is defined.
As seen in the example, the Consul API is often imported with the alias `capi`.

```go
package main

import (
	"fmt"

	capi "github.com/hashicorp/consul/api"
)

func main() {
	// Get a new client
	client, err := capi.NewClient(capi.DefaultConfig())
	if err != nil {
		panic(err)
	}

	// Get a handle to the KV API
	kv := client.KV()

	// PUT a new KV pair
	p := &capi.KVPair{Key: "REDIS_MAXCLIENTS", Value: []byte("1000")}
	_, err = kv.Put(p, nil)
	if err != nil {
		panic(err)
	}

	// Lookup the pair
	pair, _, err := kv.Get("REDIS_MAXCLIENTS", nil)
	if err != nil {
		panic(err)
	}
	fmt.Printf("KV: %v %s\n", pair.Key, pair.Value)
}
```

Install the Consul API dependency with `go mod tidy`.

In a separate terminal window, start a local Consul server.

```shell
consul agent -dev -node machine
```

Run the example.

```shell
go run .
```

You should get the following result printed to the terminal.

```shell
KV: REDIS_MAXCLIENTS 1000
```

After running the code, you can also view the values in the Consul UI on your local machine at http://localhost:8500/ui/dc1/kv
