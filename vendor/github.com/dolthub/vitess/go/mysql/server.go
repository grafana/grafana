/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package mysql

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"strings"
	"sync/atomic"
	"time"

	"github.com/dolthub/vitess/go/netutil"
	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/stats"
	"github.com/dolthub/vitess/go/sync2"
	"github.com/dolthub/vitess/go/tb"
	"github.com/dolthub/vitess/go/vt/log"
	querypb "github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/sqlparser"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

const (
	// DefaultServerVersion is the default server version we're sending to the client.
	// Can be changed.
	DefaultServerVersion = "8.0.33"

	// timing metric keys
	connectTimingKey  = "Connect"
	queryTimingKey    = "Query"
	versionTLS10      = "TLS10"
	versionTLS11      = "TLS11"
	versionTLS12      = "TLS12"
	versionTLS13      = "TLS13"
	versionTLSUnknown = "UnknownTLSVersion"
	versionNoTLS      = "None"
)

var (
	// Metrics
	timings    = stats.NewTimings("MysqlServerTimings", "MySQL server timings", "operation")
	connCount  = stats.NewGauge("MysqlServerConnCount", "Active MySQL server connections")
	connAccept = stats.NewCounter("MysqlServerConnAccepted", "Connections accepted by MySQL server")
	connSlow   = stats.NewCounter("MysqlServerConnSlow", "Connections that took more than the configured mysql_slow_connect_warn_threshold to establish")

	connCountByTLSVer = stats.NewGaugesWithSingleLabel("MysqlServerConnCountByTLSVer", "Active MySQL server connections by TLS version", "tls")
	connCountPerUser  = stats.NewGaugesWithSingleLabel("MysqlServerConnCountPerUser", "Active MySQL server connections per user", "count")
	_                 = stats.NewGaugeFunc("MysqlServerConnCountUnauthenticated", "Active MySQL server connections that haven't authenticated yet", func() int64 {
		totalUsers := int64(0)
		for _, v := range connCountPerUser.Counts() {
			totalUsers += v
		}
		return connCount.Get() - totalUsers
	})
)

// A Handler is an interface used by Listener to send queries.
// The implementation of this interface may store data in the ClientData
// field of the Connection for its own purposes.
//
// For a given Connection, all these methods are serialized. It means
// only one of these methods will be called concurrently for a given
// Connection. So access to the Connection ClientData does not need to
// be protected by a mutex.
//
// However, each connection is using one go routine, so multiple
// Connection objects can call these concurrently, for different Connections.
type Handler interface {
	// NewConnection is called when a connection is created.
	// It is not established yet. The handler can decide to
	// set StatusFlags that will be returned by the handshake methods.
	// In particular, ServerStatusAutocommit might be set.
	NewConnection(c *Conn)

	// ConnectionClosed is called when a connection is closed.
	ConnectionClosed(c *Conn)

	// ConnectionAborted is called when a new connection cannot be fully established. For
	// example, if a client connects to the server, but fails authentication, or can't
	// negotiate an authentication handshake, this method will be called to let integrators
	// know about the failed connection attempt.
	ConnectionAborted(c *Conn, reason string) error

	// ComInitDB is called once at the beginning to set db name,
	// and subsequently for every ComInitDB event.
	ComInitDB(c *Conn, schemaName string) error

	// ComQuery is called when a connection receives a query.
	// Note the contents of the query slice may change after
	// the first call to callback. So the Handler should not
	// hang on to the byte slice.
	ComQuery(ctx context.Context, c *Conn, query string, callback ResultSpoolFn) error

	// ComMultiQuery is called when a connection receives a query and the
	// client supports MULTI_STATEMENT. It should process the first
	// statement in |query| and return the remainder. It will be called
	// multiple times until the remainder is |""|.
	ComMultiQuery(ctx context.Context, c *Conn, query string, callback ResultSpoolFn) (string, error)

	// ComPrepare is called when a connection receives a prepared
	// statement query.
	ComPrepare(ctx context.Context, c *Conn, query string, prepare *PrepareData) ([]*querypb.Field, error)

	// ComStmtExecute is called when a connection receives a statement
	// execute query.
	ComStmtExecute(ctx context.Context, c *Conn, prepare *PrepareData, callback func(*sqltypes.Result) error) error

	// WarningCount is called at the end of each query to obtain
	// the value to be returned to the client in the EOF packet.
	// Note that this will be called either in the context of the
	// ComQuery callback if the result does not contain any fields,
	// or after the last ComQuery call completes.
	WarningCount(c *Conn) uint16

	// ComResetConnection is called when a connection receives a COM_RESET_CONNECTION signal.
	// This is used to reset the session state (e.g. clearing user vars, resetting session vars, releasing
	// locks, releasing cached prepared statements, etc). One of the primary use cases for COM_RESET_CONNECTION
	// is to reset a pooled connection's session state so that it can be safely returned to the connection pool
	// and given to another application process to reuse.
	ComResetConnection(c *Conn) error

	// ParserOptionsForConnection returns any parser options that should be used for the given connection. For
	// example, if the connection has enabled ANSI_QUOTES or ANSI SQL_MODE, then the parser needs to know that
	// in order to parse queries correctly. This is primarily needed when a prepared statement request comes in,
	// and the Vitess layer needs to parse the query to identify the query parameters so that the correct response
	// packets can be sent.
	ParserOptionsForConnection(c *Conn) (sqlparser.ParserOptions, error)
}

// BinlogReplicaHandler is an extension to the Handler interface, to add support for binlog replication server commands.
type BinlogReplicaHandler interface {
	// ComRegisterReplica is called when a connection receives a ComRegisterReplica request
	ComRegisterReplica(c *Conn, replicaHost string, replicaPort uint16, replicaUser string, replicaPassword string) error

	// ComBinlogDumpGTID is called when a connection receives a ComBinlogDumpGTID request
	ComBinlogDumpGTID(c *Conn, logFile string, logPos uint64, gtidSet GTIDSet) error
}

// ResultSpoolFn is the callback function used by ComQuery and related functions to handle rows returned by a query
type ResultSpoolFn func(res *sqltypes.Result, more bool) error

// ExtendedHandler is an extension to Handler to support additional protocols on top of MySQL.
type ExtendedHandler interface {
	// ComParsedQuery is called when a connection receives a query that has already been parsed. Note the contents
	// of the query slice may change after the first call to callback. So the Handler should not hang on to the byte
	// slice.
	ComParsedQuery(ctx context.Context, c *Conn, query string, parsed sqlparser.Statement, callback ResultSpoolFn) error

	// ComPrepareParsed is called when a connection receives a prepared statement query that has already been parsed.
	ComPrepareParsed(ctx context.Context, c *Conn, query string, parsed sqlparser.Statement, prepare *PrepareData) (ParsedQuery, []*querypb.Field, error)

	// ComBind is called when a connection receives a request to bind a prepared statement to a set of values.
	ComBind(ctx context.Context, c *Conn, query string, parsedQuery ParsedQuery, prepare *PrepareData) (BoundQuery, []*querypb.Field, error)

	// ComExecuteBound is called when a connection receives a request to execute a prepared statement that has already
	// bound to a set of values.
	ComExecuteBound(ctx context.Context, c *Conn, query string, boundQuery BoundQuery, callback ResultSpoolFn) error
}

// ParsedQuery is a marker type for communication between the ExtendedHandler interface and integrators, representing a
// query plan that can be examined or executed
type ParsedQuery any

// BoundQuery is a marker type for communication between the ExtendedHandler interface and integrators, representing a
// query plan that has been bound to a set of values
type BoundQuery any

// Listener is the MySQL server protocol listener.
type Listener struct {
	// Construction parameters, set by NewListener.

	// authServer is the AuthServer object to use for authentication.
	authServer AuthServer

	// handler is the data handler.
	handler Handler

	// This is the main listener socket.
	listener net.Listener

	// Max limit for connections
	maxConns uint64

	// maxWaitConns it the number of waiting connections allowed before new connections start getting rejected.
	maxWaitConns uint32

	// maxWaitConnsTimeout is the amount of time to block a new connection before giving up and rejecting it.
	maxWaitConnsTimeout time.Duration

	// The following parameters are read by multiple connection go
	// routines.  They are not protected by a mutex, so they
	// should be set after NewListener, and not changed while
	// Accept is running.

	// ServerVersion is the version we will advertise.
	ServerVersion string

	// TLSConfig is the server TLS config. If set, we will advertise
	// that we support SSL.
	TLSConfig *tls.Config

	// AllowClearTextWithoutTLS needs to be set for the
	// mysql_clear_password authentication method to be accepted
	// by the server when TLS is not in use.
	AllowClearTextWithoutTLS sync2.AtomicBool

	// SlowConnectWarnThreshold if non-zero specifies an amount of time
	// beyond which a warning is logged to identify the slow connection
	SlowConnectWarnThreshold sync2.AtomicDuration

	// The following parameters are changed by the Accept routine.

	// Incrementing ID for connection id.
	connectionID uint32

	// Read timeout on a given connection
	connReadTimeout time.Duration
	// Write timeout on a given connection
	connWriteTimeout time.Duration
	// connReadBufferSize is size of buffer for reads from underlying connection.
	// Reads are unbuffered if it's <=0.
	connReadBufferSize int

	// shutdownCh - open channel until it's not. Used to block and handle shutdown without hanging
	shutdownCh chan struct{}

	// RequireSecureTransport configures the server to reject connections from insecure clients
	RequireSecureTransport bool
}

// NewFromListener creates a new mysql listener from an existing net.Listener
func NewFromListener(l net.Listener, authServer AuthServer, handler Handler, connReadTimeout time.Duration, connWriteTimeout time.Duration) (*Listener, error) {
	cfg := ListenerConfig{
		Listener:           l,
		AuthServer:         authServer,
		Handler:            handler,
		ConnReadTimeout:    connReadTimeout,
		ConnWriteTimeout:   connWriteTimeout,
		ConnReadBufferSize: DefaultConnBufferSize,
	}
	return NewListenerWithConfig(cfg)
}

// NewListener creates a new Listener.
func NewListener(protocol, address string, authServer AuthServer, handler Handler, connReadTimeout time.Duration, connWriteTimeout time.Duration) (*Listener, error) {
	listener, err := net.Listen(protocol, address)
	if err != nil {
		return nil, err
	}

	return NewFromListener(listener, authServer, handler, connReadTimeout, connWriteTimeout)
}

// ListenerConfig should be used with NewListenerWithConfig to specify listener parameters.
type ListenerConfig struct {
	// Protocol-Address pair and Listener are mutually exclusive parameters
	Protocol                 string
	Address                  string
	Listener                 net.Listener
	AuthServer               AuthServer
	Handler                  Handler
	ConnReadTimeout          time.Duration
	ConnWriteTimeout         time.Duration
	ConnReadBufferSize       int
	MaxConns                 uint64
	MaxWaitConns             uint32
	MaxWaitConnsTimeout      time.Duration
	AllowClearTextWithoutTLS bool
}

// NewListenerWithConfig creates new listener using provided config. There are
// no default values for config, so caller should ensure its correctness.
func NewListenerWithConfig(cfg ListenerConfig) (*Listener, error) {
	var l net.Listener
	if cfg.Listener != nil {
		l = cfg.Listener
	} else {
		listener, err := net.Listen(cfg.Protocol, cfg.Address)
		if err != nil {
			return nil, err
		}
		l = listener
	}

	return &Listener{
		authServer:               cfg.AuthServer,
		handler:                  cfg.Handler,
		listener:                 l,
		ServerVersion:            DefaultServerVersion,
		connectionID:             1,
		connReadTimeout:          cfg.ConnReadTimeout,
		connWriteTimeout:         cfg.ConnWriteTimeout,
		connReadBufferSize:       cfg.ConnReadBufferSize,
		maxConns:                 cfg.MaxConns,
		maxWaitConns:             cfg.MaxWaitConns,
		maxWaitConnsTimeout:      cfg.MaxWaitConnsTimeout,
		AllowClearTextWithoutTLS: sync2.NewAtomicBool(cfg.AllowClearTextWithoutTLS),
		shutdownCh:               make(chan struct{}),
	}, nil
}

// Addr returns the listener address.
func (l *Listener) Addr() net.Addr {
	return l.listener.Addr()
}

// Accept runs an accept loop until the listener is closed.
func (l *Listener) Accept() {
	var sem chan struct{}
	if l.maxConns > 0 {
		sem = make(chan struct{}, l.maxConns)
	}

	// don't spam the logs if we have a bunch of waiting connections come in at once
	warnOnWait := true
	var waitingConnections atomic.Int32

	accepted := func(ctx context.Context, conn net.Conn, id uint32, acceptTime time.Time) {
		connCount.Add(1)
		connAccept.Add(1)
		go func() {
			if sem != nil {
				defer func() { <-sem }()
			}
			l.handle(ctx, conn, id, acceptTime)
		}()
	}

	for {
		conn, err := l.listener.Accept()
		if err != nil {
			// Close() was probably called.
			return
		}

		acceptTime := time.Now()
		connectionID := l.connectionID
		l.connectionID++

		if sem == nil {
			accepted(context.Background(), conn, connectionID, acceptTime)
			continue
		}

		select {
		case sem <- struct{}{}:
			accepted(context.Background(), conn, connectionID, acceptTime)
			warnOnWait = true
		default:
			if warnOnWait {
				log.Warning("max connections reached. Clients waiting. Increase server max_connections")
				warnOnWait = false
			}
			waitNum := waitingConnections.Add(1)
			if uint32(waitNum) > l.maxWaitConns {
				log.Warning("max waiting connections reached. Client rejected. Increase server max_connections and back_log")
				conn.Close()
				waitingConnections.Add(-1)
				continue
			}
			go func(conn net.Conn, connectionID uint32, acceptTime time.Time) {
				select {
				case sem <- struct{}{}:
					waitingConnections.Add(-1)
					accepted(context.Background(), conn, connectionID, acceptTime)
				case <-l.shutdownCh:
					conn.Close()
					waitingConnections.Add(-1)
				case <-time.After(l.maxWaitConnsTimeout):
					conn.Close()
					waitingConnections.Add(-1)
				}
			}(conn, connectionID, acceptTime)
		}
	}
}

// handle is called in a go routine for each client connection.
// FIXME(alainjobart) handle per-connection logs in a way that makes sense.
func (l *Listener) handle(ctx context.Context, conn net.Conn, connectionID uint32, acceptTime time.Time) {
	if l.connReadTimeout != 0 || l.connWriteTimeout != 0 {
		conn = netutil.NewConnWithTimeouts(conn, l.connReadTimeout, l.connWriteTimeout)
	}
	c := newServerConn(conn, l)
	c.ConnectionID = connectionID

	// Catch panics, and close the connection in any case.
	defer func() {
		if x := recover(); x != nil {
			log.Errorf("mysql_server caught panic:\n%v\n%s", x, tb.Stack(4))
		}

		// We call flush here in case there's a premature return after
		// startWriterBuffering is called
		c.flush(ctx)

		conn.Close()
	}()

	// Tell the handler about the connection coming and going.
	l.handler.NewConnection(c)
	defer l.handler.ConnectionClosed(c)

	// Adjust the count of open connections
	defer connCount.Add(-1)

	defer c.discardCursor()

	// First build and send the server handshake packet.
	serverAuthPluginData, err := c.writeHandshakeV10(l.ServerVersion, l.authServer, l.TLSConfig != nil)
	if err != nil {
		if err != io.EOF {
			l.handleConnectionError(c, fmt.Sprintf("Cannot send HandshakeV10 packet: %v", err))
		}
		return
	}

	// Wait for the client response. This has to be a direct read,
	// so we don't buffer the TLS negotiation packets.
	response, err := c.readEphemeralPacketDirect(ctx)
	if err != nil {
		// Don't log EOF errors. They cause too much spam, same as main read loop.
		if err != io.EOF {
			l.handleConnectionWarning(c, fmt.Sprintf(
				"Cannot read client handshake response from %s: %v, "+
					"it may not be a valid MySQL client", c, err))
		}
		return
	}
	user, clientAuthMethod, clientAuthResponse, err := l.parseClientHandshakePacket(c, true, response)
	if err != nil {
		l.handleConnectionError(c, fmt.Sprintf(
			"Cannot parse client handshake response from %s: %v", c, err))
		return
	}

	c.recycleReadPacket()

	if c.TLSEnabled() {
		// SSL was enabled. We need to re-read the auth packet.
		response, err = c.readEphemeralPacket(ctx)
		if err != nil {
			l.handleConnectionError(c, fmt.Sprintf(
				"Cannot read post-SSL client handshake response from %s: %v", c, err))
			return
		}

		// Returns copies of the data, so we can recycle the buffer.
		user, clientAuthMethod, clientAuthResponse, err = l.parseClientHandshakePacket(c, false, response)
		c.recycleReadPacket()
		if err != nil {
			l.handleConnectionError(c, fmt.Sprintf(
				"Cannot parse post-SSL client handshake response from %s: %v", c, err))
			return
		}

		if con, ok := c.Conn.(*tls.Conn); ok {
			connState := con.ConnectionState()
			tlsVerStr := tlsVersionToString(connState.Version)
			if tlsVerStr != "" {
				connCountByTLSVer.Add(tlsVerStr, 1)
				defer connCountByTLSVer.Add(tlsVerStr, -1)
			}
		}
	} else {
		if l.RequireSecureTransport {
			c.writeErrorPacketFromError(vterrors.Errorf(vtrpc.Code_UNAVAILABLE, "server does not allow insecure connections, client must use SSL/TLS"))
		}
		connCountByTLSVer.Add(versionNoTLS, 1)
		defer connCountByTLSVer.Add(versionNoTLS, -1)
	}

	// See what auth method the AuthServer wants to use for that user.
	negotiatedAuthMethod, err := negotiateAuthMethod(c, l.authServer, user, clientAuthMethod)

	// We need to send down an additional packet if we either have no negotiated method
	// at all or incomplete authentication data.
	//
	// The latter case happens for example for MySQL 8.0 clients until 8.0.25 who advertise
	// support for caching_sha2_password by default but with no plugin data.
	if err != nil || (len(clientAuthResponse) == 0 && clientAuthMethod == CachingSha2Password) {
		if err != nil {
			// The client will disconnect if it doesn't understand
			// the first auth method that we send, so we only have to send the
			// first one that we allow for the user.
			for _, m := range l.authServer.AuthMethods() {
				if m.HandleUser(c, user) {
					negotiatedAuthMethod = m
					break
				}
			}
		}
		if negotiatedAuthMethod == nil {
			l.handleConnectionError(c, "No authentication methods available for authentication.")
			c.writeErrorPacket(CRServerHandshakeErr, SSUnknownSQLState, "No authentication methods available for authentication.")
			return
		}

		if !l.AllowClearTextWithoutTLS.Get() && !c.TLSEnabled() && !negotiatedAuthMethod.AllowClearTextWithoutTLS() {
			l.handleConnectionError(c, "Cannot use clear text authentication over non-SSL connections.")
			c.writeErrorPacket(CRServerHandshakeErr, SSUnknownSQLState, "Cannot use clear text authentication over non-SSL connections.")
			return
		}

		serverAuthPluginData, err = negotiatedAuthMethod.AuthPluginData()
		if err != nil {
			l.handleConnectionError(c, fmt.Sprintf("Error generating auth switch packet for %s: %v", c, err))
			return
		}

		if err := c.writeAuthSwitchRequest(string(negotiatedAuthMethod.Name()), serverAuthPluginData); err != nil {
			l.handleConnectionError(c, fmt.Sprintf("Error writing auth switch packet for %s: %v", c, err))
			return
		}

		data, err := c.readEphemeralPacket(context.Background())
		if err != nil {
			l.handleConnectionError(c, fmt.Sprintf("Error reading auth switch response for %s: %v", c, err))
			return
		}

		var ok bool
		clientAuthResponse, _, ok = readBytesCopy(data, 0, len(data))
		c.recycleReadPacket()
		if !ok {
			l.handleConnectionError(c, fmt.Sprintf("Unable to copy client auth response for %s", c))
			return
		}
	}

	userData, err := negotiatedAuthMethod.HandleAuthPluginData(c, user, serverAuthPluginData, clientAuthResponse, conn.RemoteAddr())
	if err != nil {
		l.handleConnectionWarning(c, fmt.Sprintf("Error authenticating user %s using: %s", user, negotiatedAuthMethod.Name()))
		c.writeErrorPacketFromError(err)
		return
	}
	c.User = user
	c.UserData = userData

	if c.User != "" {
		connCountPerUser.Add(c.User, 1)
		defer connCountPerUser.Add(c.User, -1)
	}

	// Set initial db name.
	if c.schemaName != "" {
		if err = l.handler.ComInitDB(c, c.schemaName); err != nil {
			log.Errorf("failed to set the database %s: %v", c, err)

			c.writeErrorPacketFromError(err)
			return
		}
	}

	// Negotiation worked, send OK packet.
	if err := c.writeOKPacket(0, 0, c.StatusFlags, 0); err != nil {
		log.Errorf("Cannot write OK packet to %s: %v", c, err)
		return
	}

	// Record how long we took to establish the connection
	timings.Record(connectTimingKey, acceptTime)

	// Log a warning if it took too long to connect
	connectTime := time.Since(acceptTime)
	if threshold := l.SlowConnectWarnThreshold.Get(); threshold != 0 && connectTime > threshold {
		connSlow.Add(1)
		log.Warningf("Slow connection from %s: %v", c, connectTime)
	}

	for {
		err := c.handleNextCommand(ctx, l.handler)
		if err != nil {
			return
		}
	}
}

// handleConnectionError logs |reason| as an error and notifies the handler that a connection has been aborted.
func (l *Listener) handleConnectionError(c *Conn, reason string) {
	log.Error(reason)
	if err := l.handler.ConnectionAborted(c, reason); err != nil {
		log.Errorf("unable to report connection aborted to handler: %s", err)
	}
}

// handleConnectionWarning logs |reason| as a warning and notifies the handler that a connection has been aborted.
func (l *Listener) handleConnectionWarning(c *Conn, reason string) {
	log.Warning(reason)
	if err := l.handler.ConnectionAborted(c, reason); err != nil {
		log.Errorf("unable to report connection aborted to handler: %s", err)
	}
}

// Close stops the listener, which prevents accept of any new connections. Existing connections won't be closed.
func (l *Listener) Close() {
	l.Shutdown()
}

// Shutdown closes listener and fails any Ping requests from existing connections.
// This can be used for graceful shutdown, to let clients know that they should reconnect to another server.
func (l *Listener) Shutdown() {
	select {
	case <-l.shutdownCh:
	default:
		close(l.shutdownCh)
		l.listener.Close()
	}
}

func (l *Listener) isShutdown() bool {
	select {
	case <-l.shutdownCh:
		return true
	default:
		return false
	}
}

// writeHandshakeV10 writes the Initial Handshake Packet, server side.
// It returns the salt data.
func (c *Conn) writeHandshakeV10(serverVersion string, authServer AuthServer, enableTLS bool) ([]byte, error) {
	capabilities := CapabilityClientLongPassword |
		CapabilityClientLongFlag |
		CapabilityClientConnectWithDB |
		CapabilityClientProtocol41 |
		CapabilityClientTransactions |
		CapabilityClientSecureConnection |
		CapabilityClientMultiStatements |
		CapabilityClientMultiResults |
		CapabilityClientPluginAuth |
		CapabilityClientPluginAuthLenencClientData |
		CapabilityClientDeprecateEOF |
		CapabilityClientConnAttr |
		CapabilityClientFoundRows |
		CapabilityClientLocalFiles
	if enableTLS {
		capabilities |= CapabilityClientSSL
	}

	// Grab the default auth method. This can only be either
	// mysql_native_password or caching_sha2_password. Both
	// need the salt as well to be present too.
	//
	// Any other auth method will cause clients to throw a
	// handshake error.
	authMethod := authServer.DefaultAuthMethodDescription()
	if authMethod != MysqlNativePassword && authMethod != CachingSha2Password {
		authMethod = MysqlNativePassword
	}

	length :=
		1 + // protocol version
			lenNullString(serverVersion) +
			4 + // connection ID
			8 + // first part of plugin auth data
			1 + // filler byte
			2 + // capability flags (lower 2 bytes)
			1 + // character set
			2 + // status flag
			2 + // capability flags (upper 2 bytes)
			1 + // length of auth plugin data
			10 + // reserved (0)
			13 + // auth-plugin-data
			lenNullString(string(authMethod)) // auth-plugin-name

	data := c.startEphemeralPacket(length)
	pos := 0

	// Protocol version.
	pos = writeByte(data, pos, protocolVersion)

	// Copy server version.
	pos = writeNullString(data, pos, serverVersion)

	// Add connectionID in.
	pos = writeUint32(data, pos, c.ConnectionID)

	// Generate the salt as the plugin data. Will be reused
	// later on if no auth method switch happens and the real
	// auth method is also mysql_native_password or caching_sha2_password.
	pluginData, err := NewSalt()
	if err != nil {
		return nil, err
	}
	// Plugin data is always defined as having a trailing NULL
	pluginData = append(pluginData, 0)

	pos += copy(data[pos:], pluginData[:8])

	// One filler byte, always 0.
	pos = writeByte(data, pos, 0)

	// Lower part of the capability flags.
	pos = writeUint16(data, pos, uint16(capabilities))

	// Character set.
	pos = writeByte(data, pos, CharacterSetUtf8)

	// Status flag.
	pos = writeUint16(data, pos, c.StatusFlags)

	// Upper part of the capability flags.
	pos = writeUint16(data, pos, uint16(capabilities>>16))

	// Length of auth plugin data.
	// Always 21 (8 + 13).
	pos = writeByte(data, pos, 21)

	// Reserved 10 bytes: all 0
	pos = writeZeroes(data, pos, 10)

	// Second part of auth plugin data.
	pos += copy(data[pos:], pluginData[8:])

	// Copy authPluginName. We always start with the first
	// registered auth method name.
	pos = writeNullString(data, pos, string(authMethod))

	// Sanity check.
	if pos != len(data) {
		return nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "error building Handshake packet: got %v bytes expected %v", pos, len(data))
	}

	if err := c.writeEphemeralPacket(); err != nil {
		if strings.HasSuffix(err.Error(), "write: connection reset by peer") {
			return nil, io.EOF
		}
		if strings.HasSuffix(err.Error(), "write: broken pipe") {
			return nil, io.EOF
		}
		return nil, err
	}

	return pluginData, nil
}

// parseClientHandshakePacket parses the handshake sent by the client.
// Returns the username, auth method, auth data, error.
// The original data is not pointed at, and can be freed.
func (l *Listener) parseClientHandshakePacket(c *Conn, firstTime bool, data []byte) (string, AuthMethodDescription, []byte, error) {
	pos := 0

	// Client flags, 4 bytes.
	clientFlags, pos, ok := readUint32(data, pos)
	if !ok {
		return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read client flags")
	}
	if clientFlags&CapabilityClientProtocol41 == 0 {
		return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: only support protocol 4.1")
	}

	// Remember a subset of the capabilities, so we can use them
	// later in the protocol. If we re-received the handshake packet
	// after SSL negotiation, do not overwrite capabilities.
	if firstTime {
		c.Capabilities = clientFlags & (CapabilityClientDeprecateEOF | CapabilityClientFoundRows)
	}

	// set connection capability for executing multi statements
	if clientFlags&CapabilityClientMultiStatements > 0 {
		c.Capabilities |= CapabilityClientMultiStatements
	}

	// Max packet size. Don't do anything with this now.
	// See doc.go for more information.
	_, pos, ok = readUint32(data, pos)
	if !ok {
		return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read maxPacketSize")
	}

	// Character set. Need to handle it.
	characterSet, pos, ok := readByte(data, pos)
	if !ok {
		return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read characterSet")
	}
	c.CharacterSet = characterSet

	// 23x reserved zero bytes.
	pos += 23

	// Check for SSL.
	if firstTime && l.TLSConfig != nil && clientFlags&CapabilityClientSSL > 0 {
		// Need to switch to TLS, and then re-read the packet.
		conn := tls.Server(c.Conn, l.TLSConfig)
		c.Conn = conn
		c.bufferedReader.Reset(conn)
		c.Capabilities |= CapabilityClientSSL
		return "", "", nil, nil
	}

	// username
	username, pos, ok := readNullString(data, pos)
	if !ok {
		return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read username")
	}

	// auth-response can have three forms.
	var authResponse []byte
	if clientFlags&CapabilityClientPluginAuthLenencClientData != 0 {
		var l uint64
		l, pos, ok = readLenEncInt(data, pos)
		if !ok {
			return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read auth-response variable length")
		}
		authResponse, pos, ok = readBytesCopy(data, pos, int(l))
		if !ok {
			return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read auth-response")
		}

	} else if clientFlags&CapabilityClientSecureConnection != 0 {
		var l byte
		l, pos, ok = readByte(data, pos)
		if !ok {
			return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read auth-response length")
		}

		authResponse, pos, ok = readBytesCopy(data, pos, int(l))
		if !ok {
			return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read auth-response")
		}
	} else {
		a := ""
		a, pos, ok = readNullString(data, pos)
		if !ok {
			return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read auth-response")
		}
		authResponse = []byte(a)
	}

	// db name.
	if clientFlags&CapabilityClientConnectWithDB != 0 {
		dbname := ""
		dbname, pos, ok = readNullString(data, pos)
		if !ok {
			return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read dbname")
		}
		c.schemaName = dbname
	}

	// authMethod (with default)
	authMethod := MysqlNativePassword
	if clientFlags&CapabilityClientPluginAuth != 0 {
		var authMethodStr string
		authMethodStr, pos, ok = readNullString(data, pos)
		if !ok {
			return "", "", nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read authMethod")
		}

		// The JDBC driver sometimes sends an empty string as the auth method when it wants to use mysql_native_password
		if authMethodStr != "" {
			authMethod = AuthMethodDescription(authMethodStr)
		}
	}

	// Decode connection attributes send by the client
	if clientFlags&CapabilityClientConnAttr != 0 {
		if _, _, err := parseConnAttrs(data, pos); err != nil {
			log.Warningf("Decode connection attributes send by the client: %v", err)
		}
	}

	return username, AuthMethodDescription(authMethod), authResponse, nil
}

func parseConnAttrs(data []byte, pos int) (map[string]string, int, error) {
	var attrLen uint64

	attrLen, pos, ok := readLenEncInt(data, pos)
	if !ok {
		return nil, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read connection attributes variable length")
	}

	var attrLenRead uint64

	attrs := make(map[string]string)

	for attrLenRead < attrLen {
		var keyLen byte
		keyLen, pos, ok = readByte(data, pos)
		if !ok {
			return nil, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read connection attribute key length")
		}
		attrLenRead += uint64(keyLen) + 1

		var connAttrKey []byte
		connAttrKey, pos, ok = readBytesCopy(data, pos, int(keyLen))
		if !ok {
			return nil, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read connection attribute key")
		}

		var valLen byte
		valLen, pos, ok = readByte(data, pos)
		if !ok {
			return nil, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read connection attribute value length")
		}
		attrLenRead += uint64(valLen) + 1

		var connAttrVal []byte
		connAttrVal, pos, ok = readBytesCopy(data, pos, int(valLen))
		if !ok {
			return nil, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "parseClientHandshakePacket: can't read connection attribute value")
		}

		attrs[string(connAttrKey[:])] = string(connAttrVal[:])
	}

	return attrs, pos, nil

}

// writeAuthSwitchRequest writes an auth switch request packet.
func (c *Conn) writeAuthSwitchRequest(pluginName string, pluginData []byte) error {
	length := 1 + // AuthSwitchRequestPacket
		len(pluginName) + 1 + // 0-terminated pluginName
		len(pluginData)

	data := c.startEphemeralPacket(length)
	pos := 0

	// Packet header.
	pos = writeByte(data, pos, AuthSwitchRequestPacket)

	// Copy server version.
	pos = writeNullString(data, pos, pluginName)

	// Copy auth data.
	pos += copy(data[pos:], pluginData)

	// Sanity check.
	if pos != len(data) {
		return vterrors.Errorf(vtrpc.Code_INTERNAL, "error building AuthSwitchRequestPacket packet: got %v bytes expected %v", pos, len(data))
	}
	return c.writeEphemeralPacket()
}

// Whenever we move to a new version of go, we will need add any new supported TLS versions here
func tlsVersionToString(version uint16) string {
	switch version {
	case tls.VersionTLS10:
		return versionTLS10
	case tls.VersionTLS11:
		return versionTLS11
	case tls.VersionTLS12:
		return versionTLS12
	case tls.VersionTLS13:
		return versionTLS13
	default:
		return versionTLSUnknown
	}
}
