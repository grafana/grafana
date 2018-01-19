# KV Example

This example builds a simple key/value store CLI where the mechanism
for storing and retrieving keys is pluggable. To build this example:

```sh
# This builds the main CLI
$ go build -o kv

# This builds the plugin written in Go
$ go build -o kv-go-grpc ./plugin-go-grpc

# This tells the KV binary to use the "kv-go-grpc" binary
$ export KV_PLUGIN="./kv-go-grpc"

# Read and write
$ ./kv put hello world

$ ./kv get hello
world
```

### Plugin: plugin-go-grpc

This plugin uses gRPC to serve a plugin that is written in Go:

```
# This builds the plugin written in Go
$ go build -o kv-go-grpc ./plugin-go-grpc

# This tells the KV binary to use the "kv-go-grpc" binary
$ export KV_PLUGIN="./kv-go-grpc"
```

### Plugin: plugin-go-netrpc

This plugin uses the builtin Go net/rpc mechanism to serve the plugin:

```
# This builds the plugin written in Go
$ go build -o kv-go-netrpc ./plugin-go-netrpc

# This tells the KV binary to use the "kv-go-netrpc" binary
$ export KV_PLUGIN="./kv-go-netrpc"
```

### Plugin: plugin-python

This plugin is written in Python:

```
$ export KV_PLUGIN="python plugin-python/plugin.py"
```

## Updating the Protocol

If you update the protocol buffers file, you can regenerate the file
using the following command from this directory. You do not need to run
this if you're just trying the example.

For Go:

```sh
$ protoc -I proto/ proto/kv.proto --go_out=plugins=grpc:proto/
```

For Python:

```sh
$ python -m grpc_tools.protoc -I ./proto/ --python_out=./plugin-python/ --grpc_python_out=./plugin-python/ ./proto/kv.proto
```
