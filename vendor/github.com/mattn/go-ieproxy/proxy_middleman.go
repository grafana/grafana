package ieproxy

import (
	"net/http"
	"net/url"
)

// GetProxyFunc is a forwarder for the OS-Exclusive proxyMiddleman_os.go files
func GetProxyFunc() func(*http.Request) (*url.URL, error) {
	return proxyMiddleman()
}
