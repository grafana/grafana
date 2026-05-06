package centrifuge

import (
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/centrifugal/centrifuge/internal/convert"
	"github.com/centrifugal/centrifuge/internal/readerpool"
)

// SSEConfig represents config for SSEHandler.
type SSEConfig struct {
	PingPongConfig
	// MaxRequestBodySize limits initial request body size (when SSE starts with POST).
	MaxRequestBodySize int
}

// SSEHandler handles WebSocket client connections. WebSocket protocol
// is a bidirectional connection between a client and a server for low-latency
// communication.
type SSEHandler struct {
	node   *Node
	config SSEConfig
}

// NewSSEHandler creates new SSEHandler.
func NewSSEHandler(node *Node, config SSEConfig) *SSEHandler {
	return &SSEHandler{
		node:   node,
		config: config,
	}
}

// Since SSE is usually starts with a GET request (at least in browsers) we are looking
// for connect request in URL params. This should be a properly encoded command(s) in
// Centrifuge protocol.
const connectUrlParam = "cf_connect"

const defaultMaxSSEBodySize = 64 * 1024

func (h *SSEHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	_, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "expected http.ResponseWriter to be http.Flusher", http.StatusInternalServerError)
		return
	}

	var requestData []byte
	if r.Method == http.MethodGet {
		requestDataString := r.URL.Query().Get(connectUrlParam)
		if requestDataString != "" {
			requestData = []byte(requestDataString)
		} else {
			h.node.logger.log(newLogEntry(LogLevelDebug, "no connect command", map[string]any{}))
			w.WriteHeader(http.StatusBadRequest)
			return
		}
	} else if r.Method == http.MethodPost {
		maxBytesSize := h.config.MaxRequestBodySize
		if maxBytesSize == 0 {
			maxBytesSize = defaultMaxSSEBodySize
		}
		r.Body = http.MaxBytesReader(w, r.Body, int64(maxBytesSize))
		var err error
		requestData, err = io.ReadAll(r.Body)
		if err != nil {
			h.node.logger.log(newLogEntry(LogLevelInfo, "error reading sse request body", map[string]any{"error": err.Error()}))
			if len(requestData) >= maxBytesSize {
				w.WriteHeader(http.StatusRequestEntityTooLarge)
				return
			}
			w.WriteHeader(statusCodeClientConnectionClosed)
			return
		}
	} else {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	transport := newSSETransport(r, sseTransportConfig{pingPong: h.config.PingPongConfig})

	c, closeFn, err := NewClient(r.Context(), h.node, transport)
	if err != nil {
		h.node.logger.log(newErrorLogEntry(err, "error create client", map[string]any{"error": err.Error(), "transport": transportSSE}))
		return
	}
	defer func() { _ = closeFn() }()
	defer close(transport.closedCh) // need to execute this after client closeFn.

	if h.node.logEnabled(LogLevelDebug) {
		h.node.logger.log(newLogEntry(LogLevelDebug, "client connection established", map[string]any{"transport": transport.Name(), "client": c.ID()}))
		defer func(started time.Time) {
			h.node.logger.log(newLogEntry(LogLevelDebug, "client connection completed", map[string]any{"duration": time.Since(started).String(), "transport": transport.Name(), "client": c.ID()}))
		}(time.Now())
	}

	if r.ProtoMajor == 1 {
		// An endpoint MUST NOT generate an HTTP/2 message containing connection-specific header fields.
		// Source: RFC7540.
		w.Header().Set("Connection", "keep-alive")
	}
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expire", "0")
	w.WriteHeader(http.StatusOK)

	rc := http.NewResponseController(w)
	err = rc.SetWriteDeadline(time.Now().Add(streamingResponseWriteTimeout))
	if err != nil && h.node.logEnabled(LogLevelTrace) {
		h.node.logger.log(newLogEntry(LogLevelTrace, "can't set custom write deadline", map[string]any{"error": err.Error()}))
	}
	_, err = w.Write([]byte("\r\n"))
	if err != nil {
		return
	}
	_ = rc.Flush()
	_ = rc.SetWriteDeadline(time.Time{})

	reader := readerpool.GetBytesReader(requestData)
	_ = HandleReadFrame(c, reader)
	readerpool.PutBytesReader(reader)

	for {
		select {
		case <-r.Context().Done():
			return
		case <-transport.disconnectCh:
			return
		case messages, messagesOK := <-transport.messages:
			if !messagesOK {
				return
			}
			_ = rc.SetWriteDeadline(time.Now().Add(streamingResponseWriteTimeout))
			for _, msg := range messages {
				_, err := w.Write(convert.StringToBytes("data: " + convert.BytesToString(msg) + "\n\n"))
				if err != nil {
					return
				}
			}
			_ = rc.Flush()
			_ = rc.SetWriteDeadline(time.Time{})
		}
	}
}

const (
	transportSSE = "sse"
)

type sseTransport struct {
	mu           sync.Mutex
	req          *http.Request
	messages     chan [][]byte
	disconnectCh chan struct{}
	closedCh     chan struct{}
	config       sseTransportConfig
	closed       bool
}

type sseTransportConfig struct {
	pingPong PingPongConfig
}

func newSSETransport(req *http.Request, config sseTransportConfig) *sseTransport {
	return &sseTransport{
		messages:     make(chan [][]byte),
		disconnectCh: make(chan struct{}),
		closedCh:     make(chan struct{}),
		req:          req,
		config:       config,
	}
}

func (t *sseTransport) Name() string {
	return transportSSE
}

func (t *sseTransport) Protocol() ProtocolType {
	return ProtocolTypeJSON
}

// ProtocolVersion returns transport protocol version.
func (t *sseTransport) ProtocolVersion() ProtocolVersion {
	return ProtocolVersion2
}

// Unidirectional returns whether transport is unidirectional.
func (t *sseTransport) Unidirectional() bool {
	return false
}

// Emulation ...
func (t *sseTransport) Emulation() bool {
	return true
}

// DisabledPushFlags ...
func (t *sseTransport) DisabledPushFlags() uint64 {
	return 0
}

// PingPongConfig ...
func (t *sseTransport) PingPongConfig() PingPongConfig {
	return t.config.pingPong
}

func (t *sseTransport) Write(message []byte) error {
	return t.WriteMany(message)
}

func (t *sseTransport) WriteMany(messages ...[]byte) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.closed {
		return nil
	}
	select {
	case t.messages <- messages:
	case <-t.closedCh:
	}
	return nil
}

func (t *sseTransport) Close(_ Disconnect) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.closed {
		return nil
	}
	t.closed = true
	close(t.disconnectCh)
	<-t.closedCh
	return nil
}
