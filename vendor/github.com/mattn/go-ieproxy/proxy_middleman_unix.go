//go:build !windows && !darwin
// +build !windows,!darwin

package ieproxy

import (
	"net/http"
	"net/url"
)

func proxyMiddleman() func(req *http.Request) (i *url.URL, e error) {
	// Fallthrough to ProxyFromEnvironment on all other OSes.
	return http.ProxyFromEnvironment
}
