# PROXY protocol support

> **Note:** enabling PROXY protocol support does not break existing setups (e.g. non-PROXY connections are still accepted), however it does add a small overhead to the connection handling.
 
To enable PROXY protocol support, set `Config.ProxyProtocolEnabled` to `true` before initializing a `Server` in your application. This enables PROXY protocol for both HTTP and gRPC servers.

```go
cfg := &Config{
    ProxyProtocolEnabled: true,
    // ...
}

server := NewServer(cfg)
// ...
```

PROXY protocol is supported by using [go-proxyproto](https://github.com/pires/go-proxyproto).
Both PROXY v1 and PROXY v2 are supported out of the box.

When enabled, incoming connections are checked for the PROXY header, and if present, the connection information is updated to reflect the original source address.
Most commonly, you will use the source address via [Request.RemoteAddr](https://pkg.go.dev/net/http#Request.RemoteAddr).

```go
server.HTTP.HandleFunc("/your-endpoint", func(w http.ResponseWriter, r *http.Request) {
    ip, _, err := net.SplitHostPort(r.RemoteAddr)
    // ...
})
```
