package goproxy

import (
	"bufio"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/elazarl/goproxy/internal/http1parser"
	"github.com/elazarl/goproxy/internal/signer"
)

type ConnectActionLiteral int

const (
	ConnectAccept = iota
	ConnectReject
	ConnectMitm
	ConnectHijack
	ConnectHTTPMitm
	ConnectProxyAuthHijack
)

var (
	OkConnect       = &ConnectAction{Action: ConnectAccept, TLSConfig: TLSConfigFromCA(&GoproxyCa)}
	MitmConnect     = &ConnectAction{Action: ConnectMitm, TLSConfig: TLSConfigFromCA(&GoproxyCa)}
	HTTPMitmConnect = &ConnectAction{Action: ConnectHTTPMitm, TLSConfig: TLSConfigFromCA(&GoproxyCa)}
	RejectConnect   = &ConnectAction{Action: ConnectReject, TLSConfig: TLSConfigFromCA(&GoproxyCa)}
)

var _errorRespMaxLength int64 = 500

// ConnectAction enables the caller to override the standard connect flow.
// When Action is ConnectHijack, it is up to the implementer to send the
// HTTP 200, or any other valid http response back to the client from within the
// Hijack func.
type ConnectAction struct {
	Action    ConnectActionLiteral
	Hijack    func(req *http.Request, client net.Conn, ctx *ProxyCtx)
	TLSConfig func(host string, ctx *ProxyCtx) (*tls.Config, error)
}

func stripPort(s string) string {
	var ix int
	if strings.Contains(s, "[") && strings.Contains(s, "]") {
		// ipv6 address example: [2606:4700:4700::1111]:443
		// strip '[' and ']'
		s = strings.ReplaceAll(s, "[", "")
		s = strings.ReplaceAll(s, "]", "")

		ix = strings.LastIndexAny(s, ":")
		if ix == -1 {
			return s
		}
	} else {
		// ipv4
		ix = strings.IndexRune(s, ':')
		if ix == -1 {
			return s
		}
	}
	return s[:ix]
}

func (proxy *ProxyHttpServer) dial(ctx *ProxyCtx, network, addr string) (c net.Conn, err error) {
	if ctx.Dialer != nil {
		return ctx.Dialer(ctx.Req.Context(), network, addr)
	}

	if proxy.Tr != nil && proxy.Tr.DialContext != nil {
		return proxy.Tr.DialContext(ctx.Req.Context(), network, addr)
	}

	// if the user didn't specify any dialer, we just use the default one,
	// provided by net package
	return net.Dial(network, addr)
}

func (proxy *ProxyHttpServer) connectDial(ctx *ProxyCtx, network, addr string) (c net.Conn, err error) {
	if proxy.ConnectDialWithReq == nil && proxy.ConnectDial == nil {
		return proxy.dial(ctx, network, addr)
	}

	if proxy.ConnectDialWithReq != nil {
		return proxy.ConnectDialWithReq(ctx.Req, network, addr)
	}

	return proxy.ConnectDial(network, addr)
}

type halfClosable interface {
	net.Conn
	CloseWrite() error
	CloseRead() error
}

var _ halfClosable = (*net.TCPConn)(nil)

func (proxy *ProxyHttpServer) handleHttps(w http.ResponseWriter, r *http.Request) {
	ctx := &ProxyCtx{Req: r, Session: atomic.AddInt64(&proxy.sess, 1), Proxy: proxy, certStore: proxy.CertStore}

	hij, ok := w.(http.Hijacker)
	if !ok {
		panic("httpserver does not support hijacking")
	}

	proxyClient, _, e := hij.Hijack()
	if e != nil {
		panic("Cannot hijack connection " + e.Error())
	}

	ctx.Logf("Running %d CONNECT handlers", len(proxy.httpsHandlers))
	todo, host := OkConnect, r.URL.Host
	for i, h := range proxy.httpsHandlers {
		newtodo, newhost := h.HandleConnect(host, ctx)

		// If found a result, break the loop immediately
		if newtodo != nil {
			todo, host = newtodo, newhost
			ctx.Logf("on %dth handler: %v %s", i, todo, host)
			break
		}
	}
	switch todo.Action {
	case ConnectAccept:
		if !hasPort.MatchString(host) {
			host += ":80"
		}
		targetSiteCon, err := proxy.connectDial(ctx, "tcp", host)
		if err != nil {
			ctx.Warnf("Error dialing to %s: %s", host, err.Error())
			httpError(proxyClient, ctx, err)
			return
		}
		ctx.Logf("Accepting CONNECT to %s", host)
		_, _ = proxyClient.Write([]byte("HTTP/1.0 200 Connection established\r\n\r\n"))

		targetTCP, targetOK := targetSiteCon.(halfClosable)
		proxyClientTCP, clientOK := proxyClient.(halfClosable)
		if targetOK && clientOK {
			go func() {
				var wg sync.WaitGroup
				wg.Add(2)
				go copyAndClose(ctx, targetTCP, proxyClientTCP, &wg)
				go copyAndClose(ctx, proxyClientTCP, targetTCP, &wg)
				wg.Wait()
				// Make sure to close the underlying TCP socket.
				// CloseRead() and CloseWrite() keep it open until its timeout,
				// causing error when there are thousands of requests.
				proxyClientTCP.Close()
				targetTCP.Close()
			}()
		} else {
			// There is a race with the runtime here. In the case where the
			// connection to the target site times out, we cannot control which
			// io.Copy loop will receive the timeout signal first. This means
			// that in some cases the error passed to the ConnErrorHandler will
			// be the timeout error, and in other cases it will be an error raised
			// by the use of a closed network connection.
			//
			// 2020/05/28 23:42:17 [001] WARN: Error copying to client: read tcp 127.0.0.1:33742->127.0.0.1:34763: i/o timeout
			// 2020/05/28 23:42:17 [001] WARN: Error copying to client: read tcp 127.0.0.1:45145->127.0.0.1:60494: use of closed
			//                                                          network connection
			//
			// It's also not possible to synchronize these connection closures due to
			// TCP connections which are half-closed. When this happens, only the one
			// side of the connection breaks out of its io.Copy loop. The other side
			// of the connection remains open until it either times out or is reset by
			// the client.
			go func() {
				err := copyOrWarn(ctx, targetSiteCon, proxyClient)
				if err != nil && proxy.ConnectionErrHandler != nil {
					proxy.ConnectionErrHandler(proxyClient, ctx, err)
				}
				_ = targetSiteCon.Close()
			}()

			go func() {
				_ = copyOrWarn(ctx, proxyClient, targetSiteCon)
				_ = proxyClient.Close()
			}()
		}

	case ConnectHijack:
		todo.Hijack(r, proxyClient, ctx)
	case ConnectHTTPMitm:
		_, _ = proxyClient.Write([]byte("HTTP/1.0 200 OK\r\n\r\n"))
		ctx.Logf("Assuming CONNECT is plain HTTP tunneling, mitm proxying it")

		var targetSiteCon net.Conn
		var remote *bufio.Reader

		client := http1parser.NewRequestReader(proxy.PreventCanonicalization, proxyClient)
		for !client.IsEOF() {
			req, err := client.ReadRequest()
			if err != nil && !errors.Is(err, io.EOF) {
				ctx.Warnf("cannot read request of MITM HTTP client: %+#v", err)
			}
			if err != nil {
				return
			}

			if requestOk := func(req *http.Request) bool {
				// Since we handled the request parsing by our own, we manually
				// need to set a cancellable context when we finished the request
				// processing (same behaviour of the stdlib)
				requestContext, finishRequest := context.WithCancel(req.Context())
				req = req.WithContext(requestContext)
				defer finishRequest()

				// since we're converting the request, need to carry over the
				// original connecting IP as well
				req.RemoteAddr = r.RemoteAddr
				ctx.Logf("req %v", r.Host)
				ctx.Req = req

				req, resp := proxy.filterRequest(req, ctx)
				if resp == nil {
					// Establish a connection with the remote server only if the proxy
					// doesn't produce a response
					if targetSiteCon == nil {
						targetSiteCon, err = proxy.connectDial(ctx, "tcp", host)
						if err != nil {
							ctx.Warnf("Error dialing to %s: %s", host, err.Error())
							return false
						}
						remote = bufio.NewReader(targetSiteCon)
					}

					if err := req.Write(targetSiteCon); err != nil {
						httpError(proxyClient, ctx, err)
						return false
					}
					resp, err = func() (*http.Response, error) {
						defer req.Body.Close()
						return http.ReadResponse(remote, req)
					}()
					if err != nil {
						httpError(proxyClient, ctx, err)
						return false
					}
				}
				resp = proxy.filterResponse(resp, ctx)
				defer resp.Body.Close()

				err = resp.Write(proxyClient)
				if err != nil {
					httpError(proxyClient, ctx, err)
					return false
				}

				return true
			}(req); !requestOk {
				break
			}
		}
	case ConnectMitm:
		_, _ = proxyClient.Write([]byte("HTTP/1.0 200 OK\r\n\r\n"))
		ctx.Logf("Assuming CONNECT is TLS, mitm proxying it")
		// this goes in a separate goroutine, so that the net/http server won't think we're
		// still handling the request even after hijacking the connection. Those HTTP CONNECT
		// request can take forever, and the server will be stuck when "closed".
		// TODO: Allow Server.Close() mechanism to shut down this connection as nicely as possible
		tlsConfig := defaultTLSConfig
		if todo.TLSConfig != nil {
			var err error
			tlsConfig, err = todo.TLSConfig(host, ctx)
			if err != nil {
				httpError(proxyClient, ctx, err)
				return
			}
		}
		go func() {
			// TODO: cache connections to the remote website
			rawClientTls := tls.Server(proxyClient, tlsConfig)
			defer rawClientTls.Close()
			if err := rawClientTls.Handshake(); err != nil {
				ctx.Warnf("Cannot handshake client %v %v", r.Host, err)
				return
			}

			clientTlsReader := http1parser.NewRequestReader(proxy.PreventCanonicalization, rawClientTls)
			for !clientTlsReader.IsEOF() {
				req, err := clientTlsReader.ReadRequest()
				ctx := &ProxyCtx{
					Req:          req,
					Session:      atomic.AddInt64(&proxy.sess, 1),
					Proxy:        proxy,
					UserData:     ctx.UserData,
					RoundTripper: ctx.RoundTripper,
				}
				if err != nil && !errors.Is(err, io.EOF) {
					ctx.Warnf("Cannot read TLS request from mitm'd client %v %v", r.Host, err)
				}
				if err != nil {
					return
				}

				// since we're converting the request, need to carry over the
				// original connecting IP as well
				req.RemoteAddr = r.RemoteAddr
				ctx.Logf("req %v", r.Host)

				if !strings.HasPrefix(req.URL.String(), "https://") {
					req.URL, err = url.Parse("https://" + r.Host + req.URL.String())
				}

				if continueLoop := func(req *http.Request) bool {
					// Since we handled the request parsing by our own, we manually
					// need to set a cancellable context when we finished the request
					// processing (same behaviour of the stdlib)
					requestContext, finishRequest := context.WithCancel(req.Context())
					req = req.WithContext(requestContext)
					defer finishRequest()

					// Bug fix which goproxy fails to provide request
					// information URL in the context when does HTTPS MITM
					ctx.Req = req

					req, resp := proxy.filterRequest(req, ctx)
					if resp == nil {
						if req.Method == "PRI" {
							// Handle HTTP/2 connections.

							// NOTE: As of 1.22, golang's http module will not recognize or
							// parse the HTTP Body for PRI requests. This leaves the body of
							// the http2.ClientPreface ("SM\r\n\r\n") on the wire which we need
							// to clear before setting up the connection.
							reader := clientTlsReader.Reader()
							_, err := reader.Discard(6)
							if err != nil {
								ctx.Warnf("Failed to process HTTP2 client preface: %v", err)
								return false
							}
							if !proxy.AllowHTTP2 {
								ctx.Warnf("HTTP2 connection failed: disallowed")
								return false
							}
							tr := H2Transport{reader, rawClientTls, tlsConfig.Clone(), host}
							if _, err := tr.RoundTrip(req); err != nil {
								ctx.Warnf("HTTP2 connection failed: %v", err)
							} else {
								ctx.Logf("Exiting on EOF")
							}
							return false
						}
						if err != nil {
							if req.URL != nil {
								ctx.Warnf("Illegal URL %s", "https://"+r.Host+req.URL.Path)
							} else {
								ctx.Warnf("Illegal URL %s", "https://"+r.Host)
							}
							return false
						}
						if !proxy.KeepHeader {
							RemoveProxyHeaders(ctx, req)
						}
						resp, err = func() (*http.Response, error) {
							// explicitly discard request body to avoid data races in certain RoundTripper implementations
							// see https://github.com/golang/go/issues/61596#issuecomment-1652345131
							defer req.Body.Close()
							return ctx.RoundTrip(req)
						}()
						if err != nil {
							ctx.Warnf("Cannot read TLS response from mitm'd server %v", err)
							return false
						}
						ctx.Logf("resp %v", resp.Status)
					}
					resp = proxy.filterResponse(resp, ctx)
					defer resp.Body.Close()

					text := resp.Status
					statusCode := strconv.Itoa(resp.StatusCode) + " "
					text = strings.TrimPrefix(text, statusCode)
					// always use 1.1 to support chunked encoding
					if _, err := io.WriteString(rawClientTls, "HTTP/1.1"+" "+statusCode+text+"\r\n"); err != nil {
						ctx.Warnf("Cannot write TLS response HTTP status from mitm'd client: %v", err)
						return false
					}

					isWebsocket := isWebSocketHandshake(resp.Header)
					if isWebsocket || resp.Request.Method == http.MethodHead {
						// don't change Content-Length for HEAD request
					} else if (resp.StatusCode >= 100 && resp.StatusCode < 200) ||
						resp.StatusCode == http.StatusNoContent {
						// RFC7230: A server MUST NOT send a Content-Length header field in any response
						// with a status code of 1xx (Informational) or 204 (No Content)
						resp.Header.Del("Content-Length")
					} else {
						// Since we don't know the length of resp, return chunked encoded response
						// TODO: use a more reasonable scheme
						resp.Header.Del("Content-Length")
						resp.Header.Set("Transfer-Encoding", "chunked")
					}
					// Force connection close otherwise chrome will keep CONNECT tunnel open forever
					if !isWebsocket {
						resp.Header.Set("Connection", "close")
					}
					if err := resp.Header.Write(rawClientTls); err != nil {
						ctx.Warnf("Cannot write TLS response header from mitm'd client: %v", err)
						return false
					}
					if _, err = io.WriteString(rawClientTls, "\r\n"); err != nil {
						ctx.Warnf("Cannot write TLS response header end from mitm'd client: %v", err)
						return false
					}

					if isWebsocket {
						ctx.Logf("Response looks like websocket upgrade.")

						// According to resp.Body documentation:
						// As of Go 1.12, the Body will also implement io.Writer
						// on a successful "101 Switching Protocols" response,
						// as used by WebSockets and HTTP/2's "h2c" mode.
						wsConn, ok := resp.Body.(io.ReadWriter)
						if !ok {
							ctx.Warnf("Unable to use Websocket connection")
							return false
						}
						proxy.proxyWebsocket(ctx, wsConn, rawClientTls)
						// We can't reuse connection after WebSocket handshake,
						// by returning false here, the underlying connection will be closed
						return false
					}

					if resp.Request.Method == http.MethodHead ||
						(resp.StatusCode >= 100 && resp.StatusCode < 200) ||
						resp.StatusCode == http.StatusNoContent ||
						resp.StatusCode == http.StatusNotModified {
						// Don't write out a response body, when it's not allowed
						// in RFC7230
					} else {
						chunked := newChunkedWriter(rawClientTls)
						if _, err := io.Copy(chunked, resp.Body); err != nil {
							ctx.Warnf("Cannot write TLS response body from mitm'd client: %v", err)
							return false
						}
						if err := chunked.Close(); err != nil {
							ctx.Warnf("Cannot write TLS chunked EOF from mitm'd client: %v", err)
							return false
						}
						if _, err = io.WriteString(rawClientTls, "\r\n"); err != nil {
							ctx.Warnf("Cannot write TLS response chunked trailer from mitm'd client: %v", err)
							return false
						}
					}

					return true
				}(req); !continueLoop {
					return
				}
			}
			ctx.Logf("Exiting on EOF")
		}()
	case ConnectProxyAuthHijack:
		_, _ = proxyClient.Write([]byte("HTTP/1.1 407 Proxy Authentication Required\r\n"))
		todo.Hijack(r, proxyClient, ctx)
	case ConnectReject:
		if ctx.Resp != nil {
			if err := ctx.Resp.Write(proxyClient); err != nil {
				ctx.Warnf("Cannot write response that reject http CONNECT: %v", err)
			}
		}
		_ = proxyClient.Close()
	}
}

func httpError(w io.WriteCloser, ctx *ProxyCtx, err error) {
	if ctx.Proxy.ConnectionErrHandler != nil {
		ctx.Proxy.ConnectionErrHandler(w, ctx, err)
	} else {
		errorMessage := err.Error()
		errStr := fmt.Sprintf(
			"HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\nContent-Length: %d\r\n\r\n%s",
			len(errorMessage),
			errorMessage,
		)
		if _, err := io.WriteString(w, errStr); err != nil {
			ctx.Warnf("Error responding to client: %s", err)
		}
	}
	if err := w.Close(); err != nil {
		ctx.Warnf("Error closing client connection: %s", err)
	}
}

func copyOrWarn(ctx *ProxyCtx, dst io.Writer, src io.Reader) error {
	_, err := io.Copy(dst, src)
	if err != nil && errors.Is(err, net.ErrClosed) {
		// Discard closed connection errors
		err = nil
	} else if err != nil {
		ctx.Warnf("Error copying to client: %s", err)
	}
	return err
}

func copyAndClose(ctx *ProxyCtx, dst, src halfClosable, wg *sync.WaitGroup) {
	_, err := io.Copy(dst, src)
	if err != nil && !errors.Is(err, net.ErrClosed) {
		ctx.Warnf("Error copying to client: %s", err.Error())
	}

	_ = dst.CloseWrite()
	_ = src.CloseRead()
	wg.Done()
}

func dialerFromEnv(proxy *ProxyHttpServer) func(network, addr string) (net.Conn, error) {
	httpsProxy := os.Getenv("HTTPS_PROXY")
	if httpsProxy == "" {
		httpsProxy = os.Getenv("https_proxy")
	}
	if httpsProxy == "" {
		return nil
	}
	return proxy.NewConnectDialToProxy(httpsProxy)
}

func (proxy *ProxyHttpServer) NewConnectDialToProxy(httpsProxy string) func(network, addr string) (net.Conn, error) {
	return proxy.NewConnectDialToProxyWithHandler(httpsProxy, nil)
}

func (proxy *ProxyHttpServer) NewConnectDialToProxyWithHandler(
	httpsProxy string,
	connectReqHandler func(req *http.Request),
) func(network, addr string) (net.Conn, error) {
	u, err := url.Parse(httpsProxy)
	if err != nil {
		return nil
	}
	if u.Scheme == "" || u.Scheme == "http" {
		if !strings.ContainsRune(u.Host, ':') {
			u.Host += ":80"
		}
		return func(network, addr string) (net.Conn, error) {
			connectReq := &http.Request{
				Method: http.MethodConnect,
				URL:    &url.URL{Opaque: addr},
				Host:   addr,
				Header: make(http.Header),
			}
			if connectReqHandler != nil {
				connectReqHandler(connectReq)
			}
			c, err := proxy.dial(&ProxyCtx{Req: &http.Request{}}, network, u.Host)
			if err != nil {
				return nil, err
			}
			_ = connectReq.Write(c)
			// Read response.
			// Okay to use and discard buffered reader here, because
			// TLS server will not speak until spoken to.
			br := bufio.NewReader(c)
			resp, err := http.ReadResponse(br, connectReq)
			if err != nil {
				_ = c.Close()
				return nil, err
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				resp, err := io.ReadAll(io.LimitReader(resp.Body, _errorRespMaxLength))
				if err != nil {
					return nil, err
				}
				_ = c.Close()
				return nil, errors.New("proxy refused connection" + string(resp))
			}
			return c, nil
		}
	}
	if u.Scheme == "https" || u.Scheme == "wss" {
		if !strings.ContainsRune(u.Host, ':') {
			u.Host += ":443"
		}
		return func(network, addr string) (net.Conn, error) {
			ctx := &ProxyCtx{Req: &http.Request{}}
			c, err := proxy.dial(ctx, network, u.Host)
			if err != nil {
				return nil, err
			}

			c, err = proxy.initializeTLSconnection(ctx, c, proxy.Tr.TLSClientConfig, u.Host)
			if err != nil {
				return nil, err
			}

			connectReq := &http.Request{
				Method: http.MethodConnect,
				URL:    &url.URL{Opaque: addr},
				Host:   addr,
				Header: make(http.Header),
			}
			if connectReqHandler != nil {
				connectReqHandler(connectReq)
			}
			_ = connectReq.Write(c)
			// Read response.
			// Okay to use and discard buffered reader here, because
			// TLS server will not speak until spoken to.
			br := bufio.NewReader(c)
			resp, err := http.ReadResponse(br, connectReq)
			if err != nil {
				_ = c.Close()
				return nil, err
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				body, err := io.ReadAll(io.LimitReader(resp.Body, _errorRespMaxLength))
				if err != nil {
					return nil, err
				}
				_ = c.Close()
				return nil, errors.New("proxy refused connection" + string(body))
			}
			return c, nil
		}
	}
	return nil
}

func TLSConfigFromCA(ca *tls.Certificate) func(host string, ctx *ProxyCtx) (*tls.Config, error) {
	return func(host string, ctx *ProxyCtx) (*tls.Config, error) {
		var err error
		var cert *tls.Certificate

		hostname := stripPort(host)
		config := defaultTLSConfig.Clone()
		ctx.Logf("signing for %s", stripPort(host))

		genCert := func() (*tls.Certificate, error) {
			return signer.SignHost(*ca, []string{hostname})
		}
		if ctx.certStore != nil {
			cert, err = ctx.certStore.Fetch(hostname, genCert)
		} else {
			cert, err = genCert()
		}

		if err != nil {
			ctx.Warnf("Cannot sign host certificate with provided CA: %s", err)
			return nil, err
		}

		config.Certificates = append(config.Certificates, *cert)
		return config, nil
	}
}

func (proxy *ProxyHttpServer) initializeTLSconnection(
	ctx *ProxyCtx,
	targetConn net.Conn,
	tlsConfig *tls.Config,
	addr string,
) (net.Conn, error) {
	// Infer target ServerName, it's a copy of implementation inside tls.Dial()
	if tlsConfig.ServerName == "" {
		colonPos := strings.LastIndex(addr, ":")
		if colonPos == -1 {
			colonPos = len(addr)
		}
		hostname := addr[:colonPos]
		// Make a copy to avoid polluting argument or default.
		c := tlsConfig.Clone()
		c.ServerName = hostname
		tlsConfig = c
	}

	tlsConn := tls.Client(targetConn, tlsConfig)
	if err := tlsConn.HandshakeContext(ctx.Req.Context()); err != nil {
		return nil, err
	}
	return tlsConn, nil
}
