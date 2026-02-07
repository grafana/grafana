package controller

import (
	"net/http"
	"time"
)

func DefaultHTTPClient() *http.Client {
	netTransport := &http.Transport{
		TLSHandshakeTimeout: 10000 * time.Millisecond,
		IdleConnTimeout:     90 * time.Second,
	}

	return &http.Client{
		Timeout:   10000 * time.Millisecond,
		Transport: netTransport,
	}
}
