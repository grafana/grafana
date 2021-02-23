package middleware

import (
	"bufio"
	"fmt"
	"net"
	"net/http"
)

func copyHeaders(src, dest http.Header) {
	for k, v := range src {
		dest[k] = v
	}
}

// ErrorHandler lets you call an alternate http handler upon a certain response code.
// Note it will assume a 200 if the wrapped handler does not write anything
type ErrorHandler struct {
	Code    int
	Handler http.Handler
}

// Wrap implements Middleware
func (e ErrorHandler) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		i := newErrorInterceptor(w, e.Code)
		next.ServeHTTP(i, r)
		if !i.gotCode {
			i.WriteHeader(http.StatusOK)
		}
		if i.intercepted {
			e.Handler.ServeHTTP(w, r)
		}
	})
}

// errorInterceptor wraps an underlying ResponseWriter and buffers all header changes, until it knows the return code.
// It then passes everything through, unless the code matches the target code, in which case it will discard everything.
type errorInterceptor struct {
	originalWriter http.ResponseWriter
	targetCode     int
	headers        http.Header
	gotCode        bool
	intercepted    bool
}

func newErrorInterceptor(w http.ResponseWriter, code int) *errorInterceptor {
	i := errorInterceptor{originalWriter: w, targetCode: code}
	i.headers = make(http.Header)
	copyHeaders(w.Header(), i.headers)
	return &i
}

// Header implements http.ResponseWriter
func (i *errorInterceptor) Header() http.Header {
	return i.headers
}

// WriteHeader implements http.ResponseWriter
func (i *errorInterceptor) WriteHeader(code int) {
	if i.gotCode {
		panic("errorInterceptor.WriteHeader() called twice")
	}

	i.gotCode = true
	if code == i.targetCode {
		i.intercepted = true
	} else {
		copyHeaders(i.headers, i.originalWriter.Header())
		i.originalWriter.WriteHeader(code)
	}
}

// Write implements http.ResponseWriter
func (i *errorInterceptor) Write(data []byte) (int, error) {
	if !i.gotCode {
		i.WriteHeader(http.StatusOK)
	}
	if !i.intercepted {
		return i.originalWriter.Write(data)
	}
	return len(data), nil
}

// errorInterceptor also implements net.Hijacker, to let the downstream Handler
// hijack the connection. This is needed, for example, for working with websockets.
func (i *errorInterceptor) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hj, ok := i.originalWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("error interceptor: can't cast original ResponseWriter to Hijacker")
	}
	i.gotCode = true
	return hj.Hijack()
}
