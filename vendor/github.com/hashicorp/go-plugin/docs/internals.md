# go-plugin Internals

This section discusses the internals of how go-plugin works.

go-plugin operates by either _serving_ a plugin or being a _client_
connecting to a remote plugin. The "client" is the host process or the
process that itself uses plugins. The "server" is the plugin process.

For a server:

  1. Output handshake to stdout
  2. Wait for connection on control address
  3. Serve plugins over control address

For a client:

  1. Launch a plugin binary
  2. Read and verify handshake from plugin stdout
  3. Connect to plugin control address using desired protocol
  4. Dispense plugins using control connection

## Handshake

The handshake is the initial communication between a plugin and a host
process to determine how the host process can connect and communicate to
the plugin. This handshake is done over the plugin process's stdout.

The `go-plugin` library itself handles the handshake when using the
`Server` to serve a plugin. **You do not need to understand the internals
of the handshake,** unless you're building a go-plugin compatible plugin
in another language.

The handshake is a single line of data terminated with a newline character
`\n`. It looks like the following:

```
1|3|unix|/path/to/socket|grpc
```

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
