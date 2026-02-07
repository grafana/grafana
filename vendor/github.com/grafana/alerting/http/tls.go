package http

import (
	"context"
	"crypto/tls"
	"net"
	"net/http"
	"time"
)

// NewTLSClient creates a new HTTP client with the provided TLS configuration or with default settings.
func NewTLSClient(tlsConfig *tls.Config, dialContextfunc func(context.Context, string, string) (net.Conn, error)) *http.Client {
	if tlsConfig == nil {
		tlsConfig = &tls.Config{
			Renegotiation: tls.RenegotiateFreelyAsClient,
		}
	}

	if dialContextfunc == nil {
		dialContextfunc = (&net.Dialer{
			Timeout: 30 * time.Second,
		}).DialContext
	}

	return &http.Client{
		Timeout: time.Second * 30,
		Transport: &http.Transport{
			TLSClientConfig:     tlsConfig,
			Proxy:               http.ProxyFromEnvironment,
			DialContext:         dialContextfunc,
			TLSHandshakeTimeout: 5 * time.Second,
			// Disable keep alive since this is always used as a short lived client
			DisableKeepAlives: true,
		},
	}
}
