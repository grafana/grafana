package goproxy

import (
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
)

// The basic proxy type. Implements http.Handler.
type ProxyHttpServer struct {
	// session variable must be aligned in i386
	// see http://golang.org/src/pkg/sync/atomic/doc.go#L41
	sess int64
	// KeepDestinationHeaders indicates the proxy should retain any headers present in the http.Response before proxying
	KeepDestinationHeaders bool
	// setting Verbose to true will log information on each request sent to the proxy
	Verbose         bool
	Logger          Logger
	NonproxyHandler http.Handler
	reqHandlers     []ReqHandler
	respHandlers    []RespHandler
	httpsHandlers   []HttpsHandler
	Tr              *http.Transport
	// ConnectionErrHandler will be invoked to return a custom response
	// to clients (written using conn parameter), when goproxy fails to connect
	// to a target proxy.
	// The error is passed as function parameter and not inside the proxy
	// context, to avoid race conditions.
	ConnectionErrHandler func(conn io.Writer, ctx *ProxyCtx, err error)
	// ConnectDial will be used to create TCP connections for CONNECT requests
	// if nil Tr.Dial will be used
	ConnectDial        func(network string, addr string) (net.Conn, error)
	ConnectDialWithReq func(req *http.Request, network string, addr string) (net.Conn, error)
	CertStore          CertStorage
	KeepHeader         bool
	AllowHTTP2         bool
	// When PreventCanonicalization is true, the header names present in
	// the request sent through the proxy are directly passed to the destination server,
	// instead of following the HTTP RFC for their canonicalization.
	// This is useful when the header name isn't treated as a case-insensitive
	// value by the target server, because they don't follow the specs.
	PreventCanonicalization bool
	// KeepAcceptEncoding, if true, prevents the proxy from dropping
	// Accept-Encoding headers from the client.
	//
	// Note that the outbound http.Transport may still choose to add
	// Accept-Encoding: gzip if the client did not explicitly send an
	// Accept-Encoding header. To disable this behavior, set
	// Tr.DisableCompression to true.
	KeepAcceptEncoding bool
}

var hasPort = regexp.MustCompile(`:\d+$`)

func copyHeaders(dst, src http.Header, keepDestHeaders bool) {
	if !keepDestHeaders {
		for k := range dst {
			dst.Del(k)
		}
	}
	for k, vs := range src {
		// direct assignment to avoid canonicalization
		dst[k] = append([]string(nil), vs...)
	}
}

func (proxy *ProxyHttpServer) filterRequest(r *http.Request, ctx *ProxyCtx) (req *http.Request, resp *http.Response) {
	req = r
	for _, h := range proxy.reqHandlers {
		req, resp = h.Handle(req, ctx)
		// non-nil resp means the handler decided to skip sending the request
		// and return canned response instead.
		if resp != nil {
			break
		}
	}
	return
}

func (proxy *ProxyHttpServer) filterResponse(respOrig *http.Response, ctx *ProxyCtx) (resp *http.Response) {
	resp = respOrig
	for _, h := range proxy.respHandlers {
		ctx.Resp = resp
		resp = h.Handle(resp, ctx)
	}
	return
}

// RemoveProxyHeaders removes all proxy headers which should not propagate to the next hop.
func RemoveProxyHeaders(ctx *ProxyCtx, r *http.Request) {
	r.RequestURI = "" // this must be reset when serving a request with the client
	ctx.Logf("Sending request %v %v", r.Method, r.URL.String())
	if !ctx.Proxy.KeepAcceptEncoding {
		// If no Accept-Encoding header exists, Transport will add the headers it can accept
		// and would wrap the response body with the relevant reader.
		r.Header.Del("Accept-Encoding")
	}
	// curl can add that, see
	// https://jdebp.eu./FGA/web-proxy-connection-header.html
	r.Header.Del("Proxy-Connection")
	r.Header.Del("Proxy-Authenticate")
	r.Header.Del("Proxy-Authorization")
	// Connection, Authenticate and Authorization are single hop Header:
	// http://www.w3.org/Protocols/rfc2616/rfc2616.txt
	// 14.10 Connection
	//   The Connection general-header field allows the sender to specify
	//   options that are desired for that particular connection and MUST NOT
	//   be communicated by proxies over further connections.

	// We need to keep "Connection: upgrade" header, since it's part of
	// the WebSocket handshake, and it won't work without it.
	// For all the other cases (close, keep-alive), we already handle them, by
	// setting the r.Close variable in the previous lines.
	if !isWebSocketHandshake(r.Header) {
		r.Header.Del("Connection")
	}
}

type flushWriter struct {
	w io.Writer
}

func (fw flushWriter) Write(p []byte) (int, error) {
	n, err := fw.w.Write(p)
	if f, ok := fw.w.(http.Flusher); ok {
		// only flush if the Writer implements the Flusher interface.
		f.Flush()
	}

	return n, err
}

// Standard net/http function. Shouldn't be used directly, http.Serve will use it.
func (proxy *ProxyHttpServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodConnect {
		proxy.handleHttps(w, r)
	} else {
		proxy.handleHttp(w, r)
	}
}

// NewProxyHttpServer creates and returns a proxy server, logging to stderr by default.
func NewProxyHttpServer() *ProxyHttpServer {
	proxy := ProxyHttpServer{
		Logger: log.New(os.Stderr, "", log.LstdFlags),
		NonproxyHandler: http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			http.Error(w, "This is a proxy server. Does not respond to non-proxy requests.", http.StatusInternalServerError)
		}),
		Tr: &http.Transport{TLSClientConfig: tlsClientSkipVerify, Proxy: http.ProxyFromEnvironment},
	}
	proxy.ConnectDial = dialerFromEnv(&proxy)
	return &proxy
}
