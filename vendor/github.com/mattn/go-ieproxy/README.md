# ieproxy

Go package to detect the proxy settings on Windows platform, and MacOS.

On Windows, the settings are initially attempted to be read from the [`WinHttpGetIEProxyConfigForCurrentUser` DLL call](https://docs.microsoft.com/en-us/windows/desktop/api/winhttp/nf-winhttp-winhttpgetieproxyconfigforcurrentuser), but falls back to the registry (`CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings`) in the event the DLL call fails.

On MacOS, the settings are read from [`CFNetworkCopySystemProxySettings` method of CFNetwork](https://developer.apple.com/documentation/cfnetwork/1426754-cfnetworkcopysystemproxysettings?language=objc).

For more information, take a look at the [documentation](https://godoc.org/github.com/mattn/go-ieproxy)

## Methods

You can either obtain a `net/http` compatible proxy function using `ieproxy.GetProxyFunc()`, set environment variables using `ieproxy.OverrideEnvWithStaticProxy()` (though no automatic configuration is available this way), or obtain the proxy settings via `ieproxy.GetConf()`.

| Method                                 | Supported configuration options:              |
|----------------------------------------|-----------------------------------------------|
| `ieproxy.GetProxyFunc()`               | Static, Specified script, and fully automatic |
| `ieproxy.OverrideEnvWithStaticProxy()` | Static                                        |
| `ieproxy.GetConf()`                    | Depends on how you use it                     |

## Examples

### Using GetProxyFunc():

```go
func init() {
	http.DefaultTransport.(*http.Transport).Proxy = ieproxy.GetProxyFunc()
}
```

GetProxyFunc acts as a middleman between `net/http` and `mattn/go-ieproxy` in order to select the correct proxy configuration based off the details supplied in the config.

### Using OverrideEnvWithStaticProxy():

```go
func init() {
	ieproxy.OverrideEnvWithStaticProxy()
	http.DefaultTransport.(*http.Transport).Proxy = http.ProxyFromEnvironment
}
```

OverrideEnvWithStaticProxy overrides the relevant environment variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`) with the **static, manually configured** proxy details typically found in the registry.

### Using GetConf():

```go
func main() {
	conf := ieproxy.GetConf()
	//Handle proxies how you want to.
}
```
