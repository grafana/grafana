package utils

import (
	"bytes"
	"crypto/tls"
	"io"
	"net/http"

	"github.com/elazarl/goproxy"
	"github.com/elazarl/goproxy/transport"
)

// ReadRequestBody reads the request body without closing the req.Body.
func ReadRequestBody(r *http.Request) ([]byte, error) {
	if r.Body == nil {
		return []byte{}, nil
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}
	r.Body = io.NopCloser(bytes.NewBuffer(body))
	return body, nil
}

// RoundTripper is a http.RoundTripper that can be used to proxy requests without consuming the req.Body.
func RoundTripper(req *http.Request, _ *goproxy.ProxyCtx) (resp *http.Response, err error) {
	// ignoring the G402 error here because this proxy is only used in test environments
	// nolint:gosec
	tr := transport.Transport{
		Proxy:           transport.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	buf := &bytes.Buffer{}
	tee := io.TeeReader(req.Body, buf)
	req.Body = io.NopCloser(tee)
	_, resp, err = tr.DetailedRoundTrip(req)
	if resp != nil {
		resp.Request.Body = io.NopCloser(buf)
	}
	return resp, err
}
