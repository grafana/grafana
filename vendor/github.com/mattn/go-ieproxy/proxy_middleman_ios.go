//go:build ios || iossimulator
// +build ios iossimulator

package ieproxy

import (
	"net/http"
	"net/url"
)

func proxyMiddleman() func(req *http.Request) (i *url.URL, e error) {
	// Fallthrough to ProxyFromEnvironment on all other OSes.
	return http.ProxyFromEnvironment
}
