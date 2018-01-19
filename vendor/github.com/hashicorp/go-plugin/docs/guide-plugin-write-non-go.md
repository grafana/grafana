# Writing Plugins Without Go

This guide explains how to write a go-plugin compatible plugin using
a programming language other than Go. go-plugin supports plugins using
[gRPC](http://www.grpc.io). This makes it relatively simple to write plugins
using other languages!

Minimal knowledge about gRPC is assumed. We recommend reading the
[gRPC Go Tutorial](http://www.grpc.io/docs/tutorials/basic/go.html). This
alone is enough gRPC knowledge to continue.

This guide will implement the kv example in Python.
Full source code for the examples present in this guide
[is available in the examples/grpc folder](https://github.com/hashicorp/go-plugin/tree/master/examples/grpc).

## 1. Implement the Service

The first step is to implement the gRPC server for the protocol buffers
service that your plugin defines. This is a standard gRPC server.
For the KV service, the service looks like this:

```proto
service KV {
    rpc Get(GetRequest) returns (GetResponse);
    rpc Put(PutRequest) returns (Empty);
}
```

We can implement that using Python as easily as:

```python
class KVServicer(kv_pb2_grpc.KVServicer):
    """Implementation of KV service."""

    def Get(self, request, context):
        filename = "kv_"+request.key
        with open(filename, 'r') as f:
            result = kv_pb2.GetResponse()
            result.value = f.read()
            return result

    def Put(self, request, context):
        filename = "kv_"+request.key
        value = "{0}\n\nWritten from plugin-python".format(request.value)
        with open(filename, 'w') as f:
            f.write(value)

        return kv_pb2.Empty()

```

Great! With that, we have a fully functioning implementation of the service.
You can test this using standard gRPC testing mechanisms.

## 2. Serve the Service

Next, we need to create a gRPC server and serve the service we just made.

In Python:

```python
# Make the server
server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

# Add our service
kv_pb2_grpc.add_KVServicer_to_server(KVServicer(), server)

# Listen on a port
server.add_insecure_port(':1234')

# Start
server.start()
```

You can listen on any TCP address or Unix domain socket. go-plugin does
assume that connections are reliable (local), so you should not serve
your plugin across the network.

## 3. Add the gRPC Health Checking Service

go-plugin requires the
[gRPC Health Checking Service](https://github.com/grpc/grpc/blob/master/doc/health-checking.md)
to be registered on your server. You must register the status of "plugin" to be SERVING.

The health checking service is used by go-plugin to determine if everything
is healthy with the connection. If you don't implement this service, your
process may be abruptly restarted and your plugins are likely to be unreliable.

```
health = HealthServicer()
health.set("plugin", health_pb2.HealthCheckResponse.ServingStatus.Value('SERVING'))
health_pb2_grpc.add_HealthServicer_to_server(health, server)
```

## 4. Output Handshake Information

The final step is to output the handshake information to stdout. go-plugin
reads a single line from stdout to determine how to connect to your plugin,
what protocol it is using, etc.


The structure is:

```
CORE-PROTOCOL-VERSION | APP-PROTOCOL-VERSION | NETWORK-TYPE | NETWORK-ADDR | PROTOCOL
```

Where:

  * `CORE-PROTOCOL-VERSION` is the protocol version for go-plugin itself.
    The current value is `1`. Please use this value. Any other value will
    cause your plugin to not load.

  * `APP-PROTOCOL-VERSION` is the protocol version for the application data.
    This is determined by the application. You must reference the documentation
    for your application to determine the desired value.

  * `NETWORK-TYPE` and `NETWORK-ADDR` are the networking information for
    connecting to this plugin. The type must be "unix" or "tcp". The address
    is a path to the Unix socket for "unix" and an IP address for "tcp".

  * `PROTOCOL` is the named protocol that the connection will use. If this
    is omitted (older versions), this is "netrpc" for Go net/rpc. This can
    also be "grpc". This is the protocol that the plugin wants to speak to
    the host process with.

For our example that is:

```
1|1|tcp|127.0.0.1:1234|grpc
```

The only element you'll have to be careful about is the second one (the
`APP-PROTOCOL-VERISON`). This will depend on the application you're
building a plugin for. Please reference their documentation for more
information.

## 5. Done!

And we're done!

Configure the host application (the application you're writing a plugin
for) to execute your Python application. Configuring plugins is specific
to the host application.

For our example, we used an environmental variable, and it looks like this:

```sh
$ export KV_PLUGIN="python plugin.py"
```
