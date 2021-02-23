package proxyutil

import (
	"net"
	"net/http"
)

// PrepareProxyRequest prepares a request for being proxied.
// Removes X-Forwarded-Host, X-Forwarded-Port, X-Forwarded-Proto headers.
// Set X-Forwarded-For headers.
func PrepareProxyRequest(req *http.Request) {
	req.Header.Del("X-Forwarded-Host")
	req.Header.Del("X-Forwarded-Port")
	req.Header.Del("X-Forwarded-Proto")

	if req.RemoteAddr != "" {
		remoteAddr, _, err := net.SplitHostPort(req.RemoteAddr)
		if err != nil {
			remoteAddr = req.RemoteAddr
		}
		if req.Header.Get("X-Forwarded-For") != "" {
			req.Header.Set("X-Forwarded-For", req.Header.Get("X-Forwarded-For")+", "+remoteAddr)
		} else {
			req.Header.Set("X-Forwarded-For", remoteAddr)
		}
	}
}

// ClearCookieHeader clear cookie header, except for cookies specified to be kept.
func ClearCookieHeader(req *http.Request, keepCookiesNames []string) {
	var keepCookies []*http.Cookie
	for _, c := range req.Cookies() {
		for _, v := range keepCookiesNames {
			if c.Name == v {
				keepCookies = append(keepCookies, c)
			}
		}
	}

	req.Header.Del("Cookie")
	for _, c := range keepCookies {
		req.AddCookie(c)
	}
}
