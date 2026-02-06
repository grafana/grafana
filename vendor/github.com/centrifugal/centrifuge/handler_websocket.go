package centrifuge

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/centrifugal/centrifuge/internal/cancelctx"
	"github.com/centrifugal/centrifuge/internal/convert"
	"github.com/centrifugal/centrifuge/internal/timers"
	"github.com/centrifugal/centrifuge/internal/websocket"

	"github.com/centrifugal/protocol"
	"github.com/maypok86/otter"
)

// WebsocketConfig represents config for WebsocketHandler.
type WebsocketConfig struct {
	// CheckOrigin func to provide custom origin check logic.
	// nil means that sameHostOriginCheck function will be used which
	// expects Origin host to match request Host.
	CheckOrigin func(r *http.Request) bool

	// ReadBufferSize is a parameter that is used for raw websocket Upgrader.
	// If set to zero reasonable default value will be used.
	ReadBufferSize int

	// WriteBufferSize is a parameter that is used for raw websocket Upgrader.
	// If set to zero reasonable default value will be used.
	WriteBufferSize int

	// UseWriteBufferPool enables using buffer pool for writes.
	UseWriteBufferPool bool

	// MessageSizeLimit sets the maximum size in bytes of allowed message from client.
	// By default, 65536 bytes (64KB) will be used.
	MessageSizeLimit int

	// WriteTimeout is maximum time of write message operation.
	// Slow client will be disconnected.
	// By default, 1 * time.Second will be used.
	WriteTimeout time.Duration

	// Compression allows enabling websocket permessage-deflate
	// compression support for raw websocket connections. It does
	// not guarantee that compression will be used - i.e. it only
	// says that server will try to negotiate it with client.
	// Note: enabling compression may lead to performance degradation.
	Compression bool

	// CompressionLevel sets a level for websocket compression.
	// See possible value description at https://golang.org/pkg/compress/flate/#NewWriter
	CompressionLevel int

	// CompressionMinSize allows setting minimal limit in bytes for
	// message to use compression when writing it into client connection.
	// By default, it's 0 - i.e. all messages will be compressed when
	// WebsocketCompression enabled and compression negotiated with client.
	CompressionMinSize int

	// CompressionPreparedMessageCacheSize when greater than zero tells Centrifuge to use
	// prepared WebSocket messages for connections with compression. This generally introduces
	// overhead but at the same time may drastically reduce compression memory and CPU spikes
	// during broadcasts. See also BenchmarkWsBroadcastCompressionCache.
	// This option is EXPERIMENTAL, do not use in production. Contact maintainers if it
	// works well for your use case, and you want to enable it in production.
	CompressionPreparedMessageCacheSize int64

	// DisableHTTP1Upgrade disables support for HTTP/1.1 Upgrade WebSocket handshakes.
	// When true, only HTTP/2 Extended CONNECT is accepted (EnableHTTP2ExtendedConnect
	// must be true, otherwise no connections will be accepted).
	DisableHTTP1Upgrade bool

	PingPongConfig
}

// WebsocketHandler handles WebSocket client connections. WebSocket protocol
// is a bidirectional connection between a client and a server for low-latency
// communication.
type WebsocketHandler struct {
	node          *Node
	upgrade       *websocket.Upgrader
	config        WebsocketConfig
	preparedCache *otter.Cache[string, *websocket.PreparedMessage]
}

var writeBufferPool = &sync.Pool{}

// NewWebsocketHandler creates new WebsocketHandler.
func NewWebsocketHandler(node *Node, config WebsocketConfig) *WebsocketHandler {
	upgrade := &websocket.Upgrader{
		ReadBufferSize:      config.ReadBufferSize,
		EnableCompression:   config.Compression,
		Subprotocols:        []string{"centrifuge-json", "centrifuge-protobuf"},
		DisableHTTP1Upgrade: config.DisableHTTP1Upgrade,
	}
	if config.UseWriteBufferPool {
		upgrade.WriteBufferPool = writeBufferPool
	} else {
		upgrade.WriteBufferSize = config.WriteBufferSize
	}
	if config.CheckOrigin != nil {
		upgrade.CheckOrigin = config.CheckOrigin
	} else {
		upgrade.CheckOrigin = sameHostOriginCheck(node)
	}

	var cache *otter.Cache[string, *websocket.PreparedMessage]
	if config.CompressionPreparedMessageCacheSize > 0 {
		c, _ := otter.MustBuilder[string, *websocket.PreparedMessage](int(config.CompressionPreparedMessageCacheSize)).
			Cost(func(key string, value *websocket.PreparedMessage) uint32 {
				return 2 * uint32(len(key))
			}).
			WithTTL(time.Second).
			Build()
		cache = &c
	}

	warnAboutIncorrectPingPongConfig(node, config.PingPongConfig, transportWebsocket)

	return &WebsocketHandler{
		node:          node,
		config:        config,
		upgrade:       upgrade,
		preparedCache: cache,
	}
}

func (s *WebsocketHandler) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	var protoType = ProtocolTypeJSON
	var useFramePingPong bool

	if r.URL.RawQuery != "" {
		query := r.URL.Query()
		if query.Get("format") == "protobuf" || query.Get("cf_protocol") == "protobuf" {
			protoType = ProtocolTypeProtobuf
		}
		if query.Get("cf_ws_frame_ping_pong") == "true" {
			// This is a way for tools like Postman, wscat and others to maintain
			// active connection to the Centrifuge-based server without the need to
			// respond to app-level pings. We rely on native websocket ping/pong
			// frames in this case.
			useFramePingPong = true
		}
	}

	compression := s.config.Compression
	compressionLevel := s.config.CompressionLevel
	compressionMinSize := s.config.CompressionMinSize
	conn, subProtocol, err := s.upgrade.Upgrade(rw, r, nil)
	if err != nil {
		s.node.logger.log(newLogEntry(LogLevelDebug, "websocket upgrade error", map[string]any{"error": err.Error()}))
		return
	}
	if subProtocol == "centrifuge-protobuf" {
		protoType = ProtocolTypeProtobuf
	}

	if compression {
		if err := conn.SetCompressionLevel(compressionLevel); err != nil {
			s.node.logger.log(newErrorLogEntry(err, "websocket error setting compression level", map[string]any{"error": err.Error()}))
		}
	}

	writeTimeout := s.config.WriteTimeout
	if writeTimeout == 0 {
		writeTimeout = 1 * time.Second
	}
	messageSizeLimit := s.config.MessageSizeLimit
	if messageSizeLimit == 0 {
		messageSizeLimit = 65536 // 64KB
	}
	if messageSizeLimit > 0 {
		conn.SetReadLimit(int64(messageSizeLimit))
	}

	if useFramePingPong {
		pongTimeout := s.config.PingPongConfig.PongTimeout
		if pongTimeout <= 0 {
			pongTimeout = defaultFramePongTimeout
		}
		pingInterval := s.config.PingPongConfig.PingInterval
		if pingInterval <= 0 {
			pingInterval = defaultFramePingInterval
		}
		pongWait := pingInterval + pongTimeout
		_ = conn.SetReadDeadline(time.Now().Add(pongWait))
		conn.SetPongHandler(func([]byte) error {
			_ = conn.SetReadDeadline(time.Now().Add(pongWait))
			return nil
		})
	}

	handleConn := func() {
		opts := websocketTransportOptions{
			pingPong:           s.config.PingPongConfig,
			writeTimeout:       writeTimeout,
			compressionMinSize: compressionMinSize,
			protoType:          protoType,
			preparedCache:      s.preparedCache,
			protoMajor:         uint8(r.ProtoMajor),
		}

		graceCh := make(chan struct{})
		transport := newWebsocketTransport(conn, opts, graceCh, useFramePingPong)

		select {
		case <-s.node.NotifyShutdown():
			_ = transport.Close(DisconnectShutdown)
			return
		default:
		}

		clientCtx := r.Context()
		if r.ProtoMajor == 1 {
			ctxCh := make(chan struct{})
			defer close(ctxCh)
			clientCtx = cancelctx.New(r.Context(), ctxCh)
		}

		c, closeFn, err := NewClient(clientCtx, s.node, transport)
		if err != nil {
			s.node.logger.log(newErrorLogEntry(err, "error creating client", map[string]any{"transport": transportWebsocket}))
			return
		}
		defer func() { _ = closeFn() }()

		if s.node.logEnabled(LogLevelDebug) {
			s.node.logger.log(newLogEntry(LogLevelDebug, "client connection established", map[string]any{"client": c.ID(), "transport": transportWebsocket}))
			defer func(started time.Time) {
				s.node.logger.log(newLogEntry(LogLevelDebug, "client connection completed", map[string]any{"client": c.ID(), "transport": transportWebsocket, "duration": time.Since(started).String()}))
			}(time.Now())
		}

		for {
			_, r, err := conn.NextReader()
			if err != nil {
				if s.node.logEnabled(LogLevelTrace) {
					s.node.logger.log(newLogEntry(LogLevelTrace, "websocket next reader error", map[string]any{"client": c.ID(), "error": err.Error()}))
				}
				break
			}
			proceed := HandleReadFrame(c, r)
			if !proceed {
				break
			}
		}

		if useFramePingPong {
			conn.SetPongHandler(nil)
		}

		_ = conn.SetReadDeadline(time.Now().Add(closeFrameWait))
		for {
			if _, _, err := conn.NextReader(); err != nil {
				close(graceCh)
				break
			}
		}
	}

	if r.ProtoMajor == 1 {
		// Separate goroutine for better GC of caller's data for HTTP/1.x.
		go handleConn()
	} else {
		// HTTP/2 and above - execute directly, otherwise underlying stream is being closed.
		handleConn()
	}
}

// HandleReadFrame is a helper to read Centrifuge commands from frame-based io.Reader and
// process them. Frame-based means that EOF treated as the end of the frame, not the entire
// connection close.
func HandleReadFrame(c *Client, r io.Reader) bool {
	protoType := c.Transport().Protocol().toProto()
	decoder := protocol.GetStreamCommandDecoder(protoType, r)
	defer protocol.PutStreamCommandDecoder(protoType, decoder)

	hadCommands := false

	for {
		cmd, cmdProtocolSize, err := decoder.Decode()
		if cmd != nil {
			hadCommands = true
			proceed := c.HandleCommand(cmd, cmdProtocolSize)
			if !proceed {
				return false
			}
		}
		if err != nil {
			if err == io.EOF {
				if !hadCommands {
					c.node.logger.log(newLogEntry(LogLevelInfo, "empty request received", map[string]any{"client": c.ID(), "user": c.UserID()}))
					c.Disconnect(DisconnectBadRequest)
					return false
				}
				break
			} else {
				c.node.logger.log(newLogEntry(LogLevelInfo, "error reading command", map[string]any{"client": c.ID(), "user": c.UserID(), "error": err.Error()}))
				c.Disconnect(DisconnectBadRequest)
				return false
			}
		}
	}
	return true
}

const (
	transportWebsocket = "websocket"
)

// websocketTransport is a wrapper struct over websocket connection to fit session
// interface so client will accept it.
type websocketTransport struct {
	mu              sync.RWMutex
	conn            *websocket.Conn
	closeCh         chan struct{}
	graceCh         chan struct{}
	opts            websocketTransportOptions
	nativePingTimer *time.Timer
	closed          bool
}

type websocketTransportOptions struct {
	protoType          ProtocolType
	pingPong           PingPongConfig
	writeTimeout       time.Duration
	compressionMinSize int
	preparedCache      *otter.Cache[string, *websocket.PreparedMessage]
	protoMajor         uint8
}

func newWebsocketTransport(conn *websocket.Conn, opts websocketTransportOptions, graceCh chan struct{}, useNativePingPong bool) *websocketTransport {
	transport := &websocketTransport{
		conn:    conn,
		closeCh: make(chan struct{}),
		graceCh: graceCh,
		opts:    opts,
	}
	if useNativePingPong {
		transport.addPing()
	}
	return transport
}

// Name returns name of transport.
func (t *websocketTransport) Name() string {
	return transportWebsocket
}

func (t *websocketTransport) AcceptProtocol() string {
	return getAcceptProtocolLabel(int8(t.opts.protoMajor))
}

// Protocol returns transport protocol.
func (t *websocketTransport) Protocol() ProtocolType {
	return t.opts.protoType
}

// ProtocolVersion returns transport ProtocolVersion.
func (t *websocketTransport) ProtocolVersion() ProtocolVersion {
	return ProtocolVersion2
}

// Unidirectional returns whether transport is unidirectional.
func (t *websocketTransport) Unidirectional() bool {
	return false
}

// Emulation ...
func (t *websocketTransport) Emulation() bool {
	return false
}

// DisabledPushFlags ...
func (t *websocketTransport) DisabledPushFlags() uint64 {
	// Websocket sends disconnects in Close frames.
	return PushFlagDisconnect
}

// PingPongConfig ...
func (t *websocketTransport) PingPongConfig() PingPongConfig {
	t.mu.RLock()
	useNativePingPong := t.nativePingTimer != nil
	t.mu.RUnlock()
	if useNativePingPong {
		return PingPongConfig{
			PingInterval: -1,
			PongTimeout:  -1,
		}
	}
	return t.opts.pingPong
}

func (t *websocketTransport) writeData(data []byte) error {
	usePreparedMessage := t.conn.IsCompressionNegotiated()
	if t.opts.compressionMinSize > 0 {
		enableCompression := len(data) > t.opts.compressionMinSize
		usePreparedMessage = enableCompression
		t.conn.EnableWriteCompression(enableCompression)
	}
	var messageType = websocket.TextMessage
	if t.Protocol() == ProtocolTypeProtobuf {
		messageType = websocket.BinaryMessage
	}
	if t.opts.writeTimeout > 0 {
		_ = t.conn.SetWriteDeadline(time.Now().Add(t.opts.writeTimeout))
	}

	if t.opts.preparedCache != nil && usePreparedMessage {
		key := convert.BytesToString(data)
		preparedMessage, ok := t.opts.preparedCache.Get(key)
		if !ok {
			var err error
			preparedMessage, err = websocket.NewPreparedMessage(messageType, data)
			if err != nil {
				return err
			}
			t.opts.preparedCache.Set(key, preparedMessage)
		}
		err := t.conn.WritePreparedMessage(preparedMessage)
		if err != nil {
			return err
		}
	} else {
		err := t.conn.WriteMessage(messageType, data)
		if err != nil {
			return err
		}
	}

	if t.opts.writeTimeout > 0 {
		_ = t.conn.SetWriteDeadline(time.Time{})
		if t.opts.protoMajor > 1 {
			// For HTTP/2 connections, we need to actually clear the deadline on the underlying
			// connection. The websocket Conn.SetWriteDeadline only sets a field, but doesn't
			// clear the deadline that was already set on the underlying net.Conn during write.
			// This is critical for HTTP/2 ResponseController where expired deadlines cannot be
			// extended and will cause the stream to fail permanently.
			_ = t.conn.NetConn().SetWriteDeadline(time.Time{})
		}
	}
	return nil
}

// Write data to transport.
func (t *websocketTransport) Write(message []byte) error {
	select {
	case <-t.closeCh:
		return nil
	default:
		protoType := t.Protocol().toProto()
		if protoType == protocol.TypeJSON {
			// Fast path for one JSON message.
			return t.writeData(message)
		}
		encoder := protocol.GetDataEncoder(protoType)
		defer protocol.PutDataEncoder(protoType, encoder)
		_ = encoder.Encode(message)
		return t.writeData(encoder.Finish())
	}
}

// WriteMany data to transport.
func (t *websocketTransport) WriteMany(messages ...[]byte) error {
	select {
	case <-t.closeCh:
		return nil
	default:
		protoType := t.Protocol().toProto()
		encoder := protocol.GetDataEncoder(protoType)
		defer protocol.PutDataEncoder(protoType, encoder)
		for i := range messages {
			_ = encoder.Encode(messages[i])
		}
		return t.writeData(encoder.Finish())
	}
}

const closeFrameWait = 5 * time.Second

// Close closes transport.
func (t *websocketTransport) Close(disconnect Disconnect) error {
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		return nil
	}
	t.closed = true
	close(t.closeCh)
	if t.nativePingTimer != nil {
		t.nativePingTimer.Stop()
	}
	t.mu.Unlock()

	if disconnect.Code != DisconnectConnectionClosed.Code {
		msg := websocket.FormatCloseMessage(int(disconnect.Code), disconnect.Reason)
		err := t.conn.WriteControl(websocket.CloseMessage, msg, time.Now().Add(time.Second))
		if err != nil {
			return t.conn.Close()
		}
		select {
		case <-t.graceCh:
		default:
			// Wait for closing handshake completion.
			tm := timers.AcquireTimer(closeFrameWait)
			select {
			case <-t.graceCh:
			case <-tm.C:
			}
			timers.ReleaseTimer(tm)
		}
		return t.conn.Close()
	}
	return t.conn.Close()
}

var (
	defaultFramePingInterval = 25 * time.Second
	defaultFramePongTimeout  = 10 * time.Second
)

func (t *websocketTransport) ping() {
	select {
	case <-t.closeCh:
		return
	default:
		pongTimeout := t.opts.pingPong.PongTimeout
		if pongTimeout <= 0 {
			pongTimeout = defaultFramePongTimeout
		}
		// It's safe to call SetReadDeadline concurrently with reader in separate goroutine.
		// According to Go docs:
		// SetReadDeadline sets the deadline for future Read calls and any currently-blocked Read call.
		_ = t.conn.SetReadDeadline(time.Now().Add(pongTimeout))
		err := t.conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(t.opts.writeTimeout))
		if err != nil {
			_ = t.Close(DisconnectWriteError)
			return
		}
		t.addPing()
	}
}

func (t *websocketTransport) addPing() {
	t.mu.Lock()
	if t.closed {
		t.mu.Unlock()
		return
	}
	pingInterval := t.opts.pingPong.PingInterval
	if pingInterval <= 0 {
		pingInterval = defaultFramePingInterval
	}
	t.nativePingTimer = time.AfterFunc(pingInterval, t.ping)
	t.mu.Unlock()
}

func sameHostOriginCheck(n *Node) func(r *http.Request) bool {
	return func(r *http.Request) bool {
		err := checkSameHost(r)
		if err != nil {
			n.logger.log(newLogEntry(LogLevelInfo, "origin check failure", map[string]any{"error": err.Error()}))
			return false
		}
		return true
	}
}

func checkSameHost(r *http.Request) error {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return nil
	}
	u, err := url.Parse(origin)
	if err != nil {
		return fmt.Errorf("failed to parse Origin header %q: %w", origin, err)
	}
	if strings.EqualFold(r.Host, u.Host) {
		return nil
	}
	return fmt.Errorf("request Origin %q is not authorized for Host %q", origin, r.Host)
}
