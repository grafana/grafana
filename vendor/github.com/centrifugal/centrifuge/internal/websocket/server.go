// Copyright 2013 The Gorilla WebSocket Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package websocket

import (
	"bufio"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// HandshakeError describes an error with the handshake from the peer.
type HandshakeError struct {
	message string
}

func (e HandshakeError) Error() string { return e.message }

// Upgrader specifies parameters for upgrading an HTTP connection to a
// WebSocket connection.
//
// It is safe to call Upgrader's methods concurrently.
type Upgrader struct {
	// HandshakeTimeout specifies the duration for the handshake to complete.
	HandshakeTimeout time.Duration

	// ReadBufferSize and WriteBufferSize specify I/O buffer sizes in bytes. If a buffer
	// size is zero, then buffers allocated by the HTTP server are used. The
	// I/O buffer sizes do not limit the size of the messages that can be sent
	// or received.
	// The default value is 4096 bytes, 4kb.
	// For HTTP/2 connections via Extended Connect ReadBufferSize is ignored.
	ReadBufferSize, WriteBufferSize int

	// WriteBufferPool is a pool of buffers for write operations. If the value
	// is not set, then write buffers are allocated to the connection for the
	// lifetime of the connection.
	//
	// A pool is most useful when the application has a modest volume of writes
	// across a large number of connections.
	//
	// Applications should use a single pool for each unique value of
	// WriteBufferSize.
	WriteBufferPool BufferPool

	// Subprotocols specifies the server's supported protocols in order of
	// preference. If this field is not nil, then the Upgrade method negotiates a
	// subprotocol by selecting the first match in this list with a protocol
	// requested by the client. If there's no match, then no protocol is
	// negotiated (the Sec-Websocket-Protocol header is not included in the
	// handshake response).
	Subprotocols []string

	// Error specifies the function for generating HTTP error responses. If Error
	// is nil, then http.Error is used to generate the HTTP response.
	Error func(w http.ResponseWriter, r *http.Request, status int, reason error)

	// CheckOrigin returns true if the request Origin header is acceptable. If
	// CheckOrigin is nil, then a safe default is used: return false if the
	// Origin request header is present and the origin host is not equal to
	// request Host header.
	//
	// A CheckOrigin function should carefully validate the request origin to
	// prevent cross-site request forgery.
	CheckOrigin func(r *http.Request) bool

	// EnableCompression specify if the server should attempt to negotiate per
	// message compression (RFC 7692). Setting this value to true does not
	// guarantee that compression will be supported. Currently only "no context
	// takeover" modes are supported.
	EnableCompression bool

	// DisableHTTP1Upgrade disables support for HTTP/1.1 Upgrade WebSocket handshakes.
	// When true, server only accepts WebSocket connections over HTTP/2 Extended Connect
	// (for now requires GODEBUG=http2xconnect=1).
	// Experimental: This feature is experimental.
	DisableHTTP1Upgrade bool
}

func (u *Upgrader) returnError(w http.ResponseWriter, r *http.Request, status int, reason string) (*Conn, string, error) {
	err := HandshakeError{reason}
	if u.Error != nil {
		u.Error(w, r, status, err)
	} else {
		w.Header().Set("Sec-Websocket-Version", "13")
		http.Error(w, http.StatusText(status), status)
	}
	return nil, "", err
}

// checkSameOrigin returns true if the origin is not set or is equal to the request host.
func checkSameOrigin(r *http.Request) bool {
	origin := r.Header["Origin"]
	if len(origin) == 0 {
		return true
	}
	u, err := url.Parse(origin[0])
	if err != nil {
		return false
	}
	return equalASCIIFold(u.Host, r.Host)
}

func (u *Upgrader) selectSubprotocol(r *http.Request, responseHeader http.Header) string {
	if u.Subprotocols != nil {
		header := r.Header.Get("Sec-Websocket-Protocol")
		if header == "" {
			return ""
		}

		start := 0
		for i, c := range header {
			if c == ',' {
				proto := strings.TrimSpace(header[start:i])
				for _, serverProtocol := range u.Subprotocols {
					if proto == serverProtocol {
						return proto
					}
				}
				start = i + 1
			}
		}
		// Last protocol (after last comma).
		if start < len(header) {
			proto := strings.TrimSpace(header[start:])
			for _, serverProtocol := range u.Subprotocols {
				if proto == serverProtocol {
					return proto
				}
			}
		}
	} else if responseHeader != nil {
		return responseHeader.Get("Sec-Websocket-Protocol")
	}
	return ""
}

// Subprotocols returns the subprotocols requested by the client in the
// Sec-Websocket-Protocol header.
func Subprotocols(r *http.Request) []string {
	h := strings.TrimSpace(r.Header.Get("Sec-Websocket-Protocol"))
	if h == "" {
		return nil
	}
	protocols := strings.Split(h, ",")
	for i := range protocols {
		protocols[i] = strings.TrimSpace(protocols[i])
	}
	return protocols
}

// Upgrade upgrades the HTTP server connection to the WebSocket protocol.
//
// The responseHeader is included in the response to the client's upgrade
// request. Use the responseHeader to specify cookies (Set-Cookie). To specify
// subprotocols supported by the server, set Upgrader.Subprotocols directly.
//
// If the upgrade fails, then Upgrade replies to the client with an HTTP error
// response.
func (u *Upgrader) Upgrade(w http.ResponseWriter, r *http.Request, responseHeader http.Header) (*Conn, string, error) {
	var challengeKey string

	switch r.ProtoMajor {
	case 1:
		if u.DisableHTTP1Upgrade {
			return u.returnError(w, r, http.StatusBadRequest, "websocket: HTTP/1.1 Upgrade not enabled")
		}

		const badHandshake = "websocket: the client is not using the websocket protocol: "

		if !tokenListContainsValue(r.Header, "Connection", "upgrade") {
			return u.returnError(w, r, http.StatusBadRequest, badHandshake+"'upgrade' token not found in 'Connection' header")
		}

		if !tokenListContainsValue(r.Header, "Upgrade", "websocket") {
			return u.returnError(w, r, http.StatusBadRequest, badHandshake+"'websocket' token not found in 'Upgrade' header")
		}

		if r.Method != http.MethodGet {
			return u.returnError(w, r, http.StatusMethodNotAllowed, badHandshake+"request method is not GET")
		}

		if !tokenListContainsValue(r.Header, "Sec-Websocket-Version", "13") {
			return u.returnError(w, r, http.StatusBadRequest, "websocket: unsupported version: 13 not found in 'Sec-Websocket-Version' header")
		}

		challengeKey = r.Header.Get("Sec-Websocket-Key")
		if !isValidChallengeKey(challengeKey) {
			return u.returnError(w, r, http.StatusBadRequest, "websocket: not a websocket handshake: 'Sec-WebSocket-Key' header must be Base64 encoded value of 16-byte in length")
		}
	case 2:
		if r.Header.Get(":protocol") != "websocket" {
			return u.returnError(w, r, http.StatusBadRequest, "websocket: HTTP/2 Extended CONNECT requires :protocol header with 'websocket' value")
		}
		if r.Method != http.MethodConnect {
			return u.returnError(w, r, http.StatusMethodNotAllowed, "websocket: HTTP/2 handshake request method must be CONNECT")
		}
		if !tokenListContainsValue(r.Header, "Sec-Websocket-Version", "13") {
			return u.returnError(w, r, http.StatusBadRequest, "websocket: unsupported version: 13 not found in 'Sec-Websocket-Version' header")
		}
	default:
		return u.returnError(w, r, http.StatusBadRequest, "websocket: unsupported HTTP protocol version")
	}

	if _, ok := responseHeader["Sec-Websocket-Extensions"]; ok {
		return u.returnError(w, r, http.StatusInternalServerError, "websocket: application specific 'Sec-WebSocket-Extensions' headers are unsupported")
	}

	checkOrigin := u.CheckOrigin
	if checkOrigin == nil {
		checkOrigin = checkSameOrigin
	}
	if !checkOrigin(r) {
		return u.returnError(w, r, http.StatusForbidden, "websocket: request origin not allowed by Upgrader.CheckOrigin")
	}

	subprotocol := u.selectSubprotocol(r, responseHeader)

	// Negotiate PMCE.
	var compress bool
	if u.EnableCompression {
		for _, ext := range parseExtensions(r.Header) {
			if ext[""] != "permessage-deflate" {
				continue
			}
			compress = true
			break
		}
	}

	if r.ProtoMajor == 2 {
		// HTTP/2 extended CONNECT (RFC 8441).
		return u.upgradeH2(w, r, responseHeader, subprotocol, compress)
	}
	// HTTP/1.1 Upgrade (RFC 6455).
	return u.upgradeH1(w, r, responseHeader, challengeKey, subprotocol, compress)
}

// upgradeH1 handles the HTTP/1.1 Upgrade handshake.
func (u *Upgrader) upgradeH1(w http.ResponseWriter, r *http.Request, responseHeader http.Header, challengeKey, subprotocol string, compress bool) (*Conn, string, error) {
	h, ok := w.(http.Hijacker)
	if !ok {
		return u.returnError(w, r, http.StatusInternalServerError, "websocket: response does not implement http.Hijacker")
	}

	netConn, brw, err := h.Hijack()
	if err != nil {
		return u.returnError(w, r, http.StatusInternalServerError, err.Error())
	}

	if brw.Reader.Buffered() > 0 {
		_ = netConn.Close()
		return nil, "", errors.New("websocket: client sent data before handshake is complete")
	}

	var br *bufio.Reader
	if u.ReadBufferSize == 0 && brw.Reader.Size() > 256 {
		// Reuse hijacked buffered reader as connection reader.
		br = brw.Reader
	}

	buf := bufioWriterBuffer(netConn, brw.Writer)

	var writeBuf []byte
	if u.WriteBufferPool == nil && u.WriteBufferSize == 0 && len(buf) >= maxFrameHeaderSize+256 {
		// Reuse hijacked write buffer as connection buffer.
		writeBuf = buf
	}

	c := newConn(netConn, true, u.ReadBufferSize, u.WriteBufferSize, u.WriteBufferPool, br, writeBuf)

	if compress {
		c.newCompressionWriter = compressNoContextTakeover
		c.newDecompressionReader = decompressNoContextTakeover
	}

	// Use larger of hijacked buffer and connection write buffer for header.
	p := buf
	if len(c.writeBuf) > len(p) {
		p = c.writeBuf
	}
	p = p[:0]

	p = append(p, "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "...)
	p = encodeAcceptKey(challengeKey, p)

	//p = append(p, computeAcceptKey(challengeKey)...)
	p = append(p, "\r\n"...)
	if subprotocol != "" {
		p = append(p, "Sec-WebSocket-Protocol: "...)
		p = append(p, subprotocol...)
		p = append(p, "\r\n"...)
	}
	if compress {
		p = append(p, "Sec-WebSocket-Extensions: permessage-deflate; server_no_context_takeover; client_no_context_takeover\r\n"...)
	}
	for k, vs := range responseHeader {
		if k == "Sec-Websocket-Protocol" {
			continue
		}
		for _, v := range vs {
			p = append(p, k...)
			p = append(p, ": "...)
			for i := 0; i < len(v); i++ {
				b := v[i]
				if b <= 31 {
					// prevent response splitting.
					b = ' '
				}
				p = append(p, b)
			}
			p = append(p, "\r\n"...)
		}
	}
	p = append(p, "\r\n"...)

	// Clear deadlines set by HTTP server.
	_ = netConn.SetDeadline(time.Time{})

	if u.HandshakeTimeout > 0 {
		_ = netConn.SetWriteDeadline(time.Now().Add(u.HandshakeTimeout))
	}
	if _, err = netConn.Write(p); err != nil {
		_ = netConn.Close()
		return nil, "", err
	}
	if u.HandshakeTimeout > 0 {
		_ = netConn.SetWriteDeadline(time.Time{})
	}

	return c, subprotocol, nil
}

// upgradeH2 handles the HTTP/2 extended CONNECT handshake.
func (u *Upgrader) upgradeH2(w http.ResponseWriter, r *http.Request, responseHeader http.Header, subprotocol string, compress bool) (*Conn, string, error) {
	// https://www.rfc-editor.org/rfc/rfc8441.html:
	// Implementations using this extended CONNECT to bootstrap WebSockets do not do the processing of
	// the Sec-WebSocket-Key and Sec-WebSocket-Accept header fields of [RFC6455] as that functionality
	// has been superseded by the :protocol pseudo-header field.

	if subprotocol != "" {
		w.Header().Set("Sec-WebSocket-Protocol", subprotocol)
	}

	if compress {
		w.Header().Set("Sec-WebSocket-Extensions", "permessage-deflate; server_no_context_takeover; client_no_context_takeover")
	}

	// Copy additional response headers.
	for k, vs := range responseHeader {
		if k == "Sec-Websocket-Protocol" {
			continue
		}
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}

	// RFC 8441 requires a 2xx response for extended CONNECT.
	w.WriteHeader(http.StatusOK)

	// Flush the response immediately to complete the extended CONNECT
	// handshake before we start streaming on the tunnel.
	rc := http.NewResponseController(w)
	if err := rc.Flush(); err != nil {
		return nil, "", err
	}
	err := rc.SetReadDeadline(time.Time{})
	if err != nil {
		return nil, "", err
	}

	stream := &http2Stream{
		ReadCloser: r.Body,
		Writer:     w,
		rc:         rc,
	}

	// HTTP/2 stream already has internal buffering. Make small br to avoid allocating a new
	// large intermediary buffer inside newConn.
	// Small reads will be sufficient with 16 bytes buffer, for large reads our intermediary
	// buffer will be bypassed avoiding any overhead.
	// This means that for HTTP/2 it's not possible to control the read buffer size
	// via Upgrader.ReadBufferSize. For write buffers it's better to always use a pool
	// by setting Upgrader.WriteBufferPool.
	br := bufio.NewReaderSize(stream, 16)
	c := newConn(stream, true, u.ReadBufferSize, u.WriteBufferSize, u.WriteBufferPool, br, nil)
	if compress {
		c.newCompressionWriter = compressNoContextTakeover
		c.newDecompressionReader = decompressNoContextTakeover
	}

	return c, subprotocol, nil
}

// IsWebSocketUpgrade returns true if the client requested upgrade to the
// WebSocket protocol.
func IsWebSocketUpgrade(r *http.Request) bool {
	return tokenListContainsValue(r.Header, "Connection", "upgrade") &&
		tokenListContainsValue(r.Header, "Upgrade", "websocket")
}

// writeHook is an io.Writer that records the last slice passed to it vio
// io.Writer.Write.
type writeHook struct {
	p []byte
}

func (wh *writeHook) Write(p []byte) (int, error) {
	wh.p = p
	return len(p), nil
}

// bufioWriterBuffer grabs the buffer from a bufio.Writer.
func bufioWriterBuffer(originalWriter io.Writer, bw *bufio.Writer) []byte {
	// This code assumes that bufio.Writer.buf[:1] is passed to the
	// bufio.Writer's underlying writer.
	var wh writeHook
	bw.Reset(&wh)
	_ = bw.WriteByte(0)
	_ = bw.Flush()

	bw.Reset(originalWriter)

	return wh.p[:cap(wh.p)]
}
