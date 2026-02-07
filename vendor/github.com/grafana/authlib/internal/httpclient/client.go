package httpclient

import (
	"net"
	"net/http"
	"time"
)

// New creates a new Http Client with sane config
func New() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   4 * time.Second,
				KeepAlive: 15 * time.Second,
			}).DialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			MaxIdleConns:          100,
			IdleConnTimeout:       30 * time.Second,
		},
		Timeout: 5 * time.Second,
	}
}
