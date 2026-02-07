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
	"bufio"
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"runtime/trace"
	"strings"
	"sync"
	"time"

	"github.com/dolthub/vitess/go/bucketpool"
	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/sync2"
	"github.com/dolthub/vitess/go/vt/log"
	querypb "github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/sqlparser"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

const (
	// connBufferSize is how much we buffer for reading and
	// writing. It is also how much we allocate for ephemeral buffers.
	DefaultConnBufferSize = 16 * 1024
)

// Constants for how ephemeral buffers were used for reading / writing.
const (
	// ephemeralUnused means the ephemeral buffer is not in use at this
	// moment. This is the default value, and is checked so we don't
	// read or write a packet while one is already used.
	ephemeralUnused = iota

	// ephemeralWrite means we currently in process of writing from  currentEphemeralBuffer
	ephemeralWrite

	// ephemeralRead means we currently in process of reading into currentEphemeralBuffer
	ephemeralRead
)

// SingleStringElementFormatString is a template string that formats a single string element. 
const SingleStringElementFormatString = "%s"

// A Getter has a Get()
type Getter interface {
	Get() *querypb.VTGateCallerID
}

// Conn is a connection between a client and a server, using the MySQL
// binary protocol. It is built on top of an existing net.Conn, that
// has already been established.
//
// Use Connect on the client side to create a connection.
// Use NewListener to create a server side and listen for connections.
type Conn struct {
	// salt is sent by the server during initial handshake to be used for authentication
	salt []byte

	// authPluginName is the name of server's authentication plugin.
	// It is set during the initial handshake.
	authPluginName AuthMethodDescription

	// conn is the underlying network connection.
	// Calling Close() on the Conn will close this connection.
	// If there are any ongoing reads or writes, they may get interrupted.
	Conn net.Conn

	// For server-side connections, listener points to the server object.
	listener *Listener

	// ConnectionID is set:
	// - at Connect() time for clients, with the value returned by
	// the server.
	// - at accept time for the server.
	ConnectionID uint32

	// closed is set to true when Close() is called on the connection.
	closed sync2.AtomicBool

	// Capabilities is the current set of features this connection
	// is using.  It is the features that are both supported by
	// the client and the server, and currently in use.
	// It is set during the initial handshake.
	//
	// It is only used for CapabilityClientDeprecateEOF
	// and CapabilityClientFoundRows.
	Capabilities uint32

	// CharacterSet is the character set used by the other side of the
	// connection.
	// It is set during the initial handshake.
	// See the values in constants.go.
	CharacterSet uint8

	// User is the name used by the client to connect.
	// It is set during the initial handshake.
	User string

	// UserData is custom data returned by the AuthServer module.
	// It is set during the initial handshake.
	UserData Getter

	// schemaName is the default database name to use. It is set
	// during handshake, and by ComInitDb packets. Both client and
	// servers maintain it. This member is private because it's
	// non-authoritative: the client can change the schema name
	// through the 'USE' statement, which will bypass this variable.
	schemaName string

	// ServerVersion is set during Connect with the server
	// version.  It is not changed afterwards. It is unused for
	// server-side connections.
	ServerVersion string

	// flavor contains the auto-detected flavor for this client
	// connection. It is unused for server-side connections.
	flavor flavor

	// StatusFlags are the status flags we will base our returned flags on.
	// This is a bit field, with values documented in constants.go.
	// An interesting value here would be ServerStatusAutocommit.
	// It is only used by the server. These flags can be changed
	// by Handler methods.
	StatusFlags uint16

	// ClientData is a place where an application can store any
	// connection-related data. Mostly used on the server side, to
	// avoid maps indexed by ConnectionID for instance.
	ClientData interface{}

	// If set to true, disables vitess connection handling of client multi
	// statements. These are currently broken in the presence of statements
	// and a server could choose to be broken by not attempting to process
	// them at all rather than process ';'s in statement incorrectly.
	DisableClientMultiStatements bool

	// Packet encoding variables.
	bufferedReader *bufio.Reader
	bufferedWriter *bufio.Writer
	sequence       uint8

	// fields contains the fields definitions for an on-going
	// streaming query. It is set by ExecuteStreamFetch, and
	// cleared by the last FetchNext().  It is nil if no streaming
	// query is in progress.  If the streaming query returned no
	// fields, this is set to an empty array (but not nil).
	fields []*querypb.Field

	// Keep track of how and of the buffer we allocated for an
	// ephemeral packet on the read and write sides.
	// These fields are used by:
	// - startEphemeralPacket / writeEphemeralPacket methods for writes.
	// - readEphemeralPacket / recycleReadPacket methods for reads.
	currentEphemeralPolicy int
	// currentEphemeralBuffer for tracking allocated temporary buffer for writes and reads respectively.
	// It can be allocated from bufPool or heap and should be recycled in the same manner.
	currentEphemeralBuffer *[]byte

	// StatementID is the prepared statement ID.
	StatementID uint32

	// PrepareData is the map to use a prepared statement.
	PrepareData map[uint32]*PrepareData

	// cursorState represents a query which is running as a result of a
	// COM_STMT_EXECUTE.  Rows will be fetched with COM_STMT_FETCH, and
	// possibly the query will need to be terminated as a result of what
	// happens in the protocol, etc.
	// TODO: We currently only support one outstanding cursor.
	cs *cursorState
}

type cursorState struct {
	stmtID uint32

	// The goroutine which generates the results delivers |Result|s with a
	// batch of rows one at a time on the |next| channel.  As long as the
	// query has not delivered EOF, we will have pending rows, because we
	// prefetch them as soon as they are exhausted. That is, if we have 10
	// pending rows and a client fetches only 10 rows, we will block on
	// fetching more rows before ew return the currently cached 10 rows.
	// This allows us to detect EOF and correctly return CursorExhausted.
	pending *sqltypes.Result

	// The channel on which the running query is sending batched results.
	next chan *sqltypes.Result

	// The channel on which the running query will return its final error
	// status, either `nil` or an error.
	done chan error

	// A control channel on which the running query is listening. If the
	// server needs to cancel the inflight query based on what is happening
	// in the wire protocol handling, it will send on this channel and then
	// block on `done` being sent to.
	quit chan error
}

// PrepareData is a buffer used for store prepare statement metadata
type PrepareData struct {
	StatementID uint32
	PrepareStmt string
	ParamsCount uint16
	ParamsType  []int32
	ColumnNames []string
	BindVars    map[string]*querypb.BindVariable
}

// bufPool is used to allocate and free buffers in an efficient way.
var bufPool = bucketpool.New(DefaultConnBufferSize, MaxPacketSize)

// writersPool is used for pooling bufio.Writer objects.
var writersPool = sync.Pool{New: func() interface{} { return bufio.NewWriterSize(nil, DefaultConnBufferSize) }}

// newConn is an internal method to create a Conn. Used by client and server
// side for common creation code.
func newConn(conn net.Conn) *Conn {
	return &Conn{
		Conn:           conn,
		closed:         sync2.NewAtomicBool(false),
		bufferedReader: bufio.NewReaderSize(conn, DefaultConnBufferSize),
	}
}

// newServerConn should be used to create server connections.
//
// It stashes a reference to the listener to be able to determine if
// the server is shutting down, and has the ability to control buffer
// size for reads.
func newServerConn(conn net.Conn, listener *Listener) *Conn {
	c := &Conn{
		Conn:        conn,
		listener:    listener,
		closed:      sync2.NewAtomicBool(false),
		PrepareData: make(map[uint32]*PrepareData),
	}
	if listener.connReadBufferSize > 0 {
		c.bufferedReader = bufio.NewReaderSize(conn, listener.connReadBufferSize)
	}
	return c
}

// startWriterBuffering starts using buffered writes. This should
// be terminated by a call to flush.
func (c *Conn) startWriterBuffering() {
	c.bufferedWriter = writersPool.Get().(*bufio.Writer)
	c.bufferedWriter.Reset(c.Conn)
}

// FlushBuffer flushes the buffered writer used by this connection, if one is currently in use. If no
// buffering is currently in use, this method is a no-op. Our fork of Vitess typically handles flushing
// buffers in a defer function, so callers generally don't need to manually flush the connection's
// buffer. The exception is for the COM_DUMP_BINLOG_GTID command – this command leaves the connection
// for the server to continue pushing events over, and the defer function set by the connection handling
// code won't get called until the stream is closed, which could be hours or days later.
//
// TODO: The latest Vitess code uses a flush timer that periodically flushes the buffer. We should
// switch over to that since it's a cleaner solution and could potentially benefit other commands
// as well, but it's a more invasive change, so we're starting with simply allowing the caller to
// explicitly flush the buffer.
func (c *Conn) FlushBuffer() error {
	if c.bufferedWriter == nil {
		return nil
	}

	return c.bufferedWriter.Flush()
}

// flush flushes the written data to the socket.
// This must be called to terminate startBuffering.
func (c *Conn) flush(ctx context.Context) error {
	defer trace.StartRegion(ctx, "spool-results").End()

	if c.bufferedWriter == nil {
		return nil
	}

	defer func() {
		c.bufferedWriter.Reset(nil)
		writersPool.Put(c.bufferedWriter)
		c.bufferedWriter = nil
	}()

	return c.bufferedWriter.Flush()
}

// getWriter returns the current writer. It may be either
// the original connection or a wrapper.
func (c *Conn) getWriter() io.Writer {
	if c.bufferedWriter != nil {
		return c.bufferedWriter
	}
	return c.Conn
}

// getReader returns reader for connection. It can be *bufio.Reader or net.Conn
// depending on which buffer size was passed to newServerConn.
func (c *Conn) getReader() io.Reader {
	if c.bufferedReader != nil {
		return c.bufferedReader
	}
	return c.Conn
}

func (c *Conn) readHeaderFrom(ctx context.Context, r io.Reader) (int, error) {
	defer trace.StartRegion(ctx, "read-header")
	var header [4]byte
	// Note io.ReadFull will return two different types of errors:
	// 1. if the socket is already closed, and the go runtime knows it,
	//   then ReadFull will return an error (different than EOF),
	//   something like 'read: connection reset by peer'.
	// 2. if the socket is not closed while we start the read,
	//   but gets closed after the read is started, we'll get io.EOF.
	if _, err := io.ReadFull(r, header[:]); err != nil {
		// The special casing of propagating io.EOF up
		// is used by the server side only, to suppress an error
		// message if a client just disconnects.
		if err == io.EOF {
			return 0, err
		}
		if strings.HasSuffix(err.Error(), "read: connection reset by peer") {
			return 0, io.EOF
		}
		return 0, vterrors.Wrapf(err, "io.ReadFull(header size) failed")
	}

	sequence := uint8(header[3])
	if sequence != c.sequence {
		return 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "invalid sequence, expected %v got %v", c.sequence, sequence)
	}

	c.sequence++

	return int(uint32(header[0]) | uint32(header[1])<<8 | uint32(header[2])<<16), nil
}

// readEphemeralPacket attempts to read a packet into buffer from sync.Pool.  Do
// not use this method if the contents of the packet needs to be kept
// after the next readEphemeralPacket.
//
// Note if the connection is closed already, an error will be
// returned, and it may not be io.EOF. If the connection closes while
// we are stuck waiting for data, an error will also be returned, and
// it most likely will be io.EOF.
func (c *Conn) readEphemeralPacket(ctx context.Context) ([]byte, error) {
	defer trace.StartRegion(ctx, "read-ephemeral-packet")
	if c.currentEphemeralPolicy != ephemeralUnused {
		panic(vterrors.Errorf(vtrpc.Code_INTERNAL, "readEphemeralPacket: unexpected currentEphemeralPolicy: %v", c.currentEphemeralPolicy))
	}

	r := c.getReader()

	length, err := c.readHeaderFrom(ctx, r)
	if err != nil {
		return nil, err
	}

	c.currentEphemeralPolicy = ephemeralRead
	if length == 0 {
		// This can be caused by the packet after a packet of
		// exactly size MaxPacketSize.
		return nil, nil
	}

	// Use the bufPool.
	if length < MaxPacketSize {
		c.currentEphemeralBuffer = bufPool.Get(length)
		if _, err := io.ReadFull(r, *c.currentEphemeralBuffer); err != nil {
			return nil, vterrors.Wrapf(err, "io.ReadFull(packet body of length %v) failed", length)
		}
		return *c.currentEphemeralBuffer, nil
	}

	// Much slower path, revert to allocating everything from scratch.
	// We're going to concatenate a lot of data anyway, can't really
	// optimize this code path easily.
	data := make([]byte, length)
	if _, err := io.ReadFull(r, data); err != nil {
		return nil, vterrors.Wrapf(err, "io.ReadFull(packet body of length %v) failed", length)
	}
	for {
		next, err := c.readOnePacket(ctx)
		if err != nil {
			return nil, err
		}

		if len(next) == 0 {
			// Again, the packet after a packet of exactly size MaxPacketSize.
			break
		}

		data = append(data, next...)
		if len(next) < MaxPacketSize {
			break
		}
	}

	return data, nil
}

// readEphemeralPacketDirect attempts to read a packet from the socket directly.
// It needs to be used for the first handshake packet the server receives,
// so we don't buffer the SSL negotiation packet. As a shortcut, only
// packets smaller than MaxPacketSize can be read here.
// This function usually shouldn't be used - use readEphemeralPacket.
func (c *Conn) readEphemeralPacketDirect(ctx context.Context) ([]byte, error) {
	if c.currentEphemeralPolicy != ephemeralUnused {
		panic(vterrors.Errorf(vtrpc.Code_INTERNAL, "readEphemeralPacketDirect: unexpected currentEphemeralPolicy: %v", c.currentEphemeralPolicy))
	}

	var r io.Reader = c.Conn

	length, err := c.readHeaderFrom(ctx, r)
	if err != nil {
		return nil, err
	}

	c.currentEphemeralPolicy = ephemeralRead
	if length == 0 {
		// This can be caused by the packet after a packet of
		// exactly size MaxPacketSize.
		return nil, nil
	}

	if length < MaxPacketSize {
		c.currentEphemeralBuffer = bufPool.Get(length)
		if _, err := io.ReadFull(r, *c.currentEphemeralBuffer); err != nil {
			return nil, vterrors.Wrapf(err, "io.ReadFull(packet body of length %v) failed", length)
		}
		return *c.currentEphemeralBuffer, nil
	}

	return nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "readEphemeralPacketDirect doesn't support more than one packet")
}

// recycleReadPacket recycles the read packet. It needs to be called
// after readEphemeralPacket was called.
func (c *Conn) recycleReadPacket() {
	if c.currentEphemeralPolicy != ephemeralRead {
		// Programming error.
		panic(vterrors.Errorf(vtrpc.Code_INTERNAL, "trying to call recycleReadPacket while currentEphemeralPolicy is %d", c.currentEphemeralPolicy))
	}
	if c.currentEphemeralBuffer != nil {
		// We are using the pool, put the buffer back in.
		bufPool.Put(c.currentEphemeralBuffer)
		c.currentEphemeralBuffer = nil
	}
	c.currentEphemeralPolicy = ephemeralUnused
}

// readOnePacket reads a single packet into a newly allocated buffer.
func (c *Conn) readOnePacket(ctx context.Context) ([]byte, error) {
	r := c.getReader()
	length, err := c.readHeaderFrom(ctx, r)
	if err != nil {
		return nil, err
	}
	if length == 0 {
		// This can be caused by the packet after a packet of
		// exactly size MaxPacketSize.
		return nil, nil
	}

	data := make([]byte, length)
	if _, err := io.ReadFull(r, data); err != nil {
		return nil, vterrors.Wrapf(err, "io.ReadFull(packet body of length %v) failed", length)
	}
	return data, nil
}

// readPacket reads a packet from the underlying connection.
// It re-assembles packets that span more than one message.
// This method returns a generic error, not a SQLError.
func (c *Conn) readPacket(ctx context.Context) ([]byte, error) {
	// Optimize for a single packet case.
	data, err := c.readOnePacket(ctx)
	if err != nil {
		return nil, err
	}

	// This is a single packet.
	if len(data) < MaxPacketSize {
		return data, nil
	}

	// There is more than one packet, read them all.
	for {
		next, err := c.readOnePacket(ctx)
		if err != nil {
			return nil, err
		}

		if len(next) == 0 {
			// Again, the packet after a packet of exactly size MaxPacketSize.
			break
		}

		data = append(data, next...)
		if len(next) < MaxPacketSize {
			break
		}
	}

	return data, nil
}

// ReadPacket reads a packet from the underlying connection.
// it is the public API version, that returns a SQLError.
// The memory for the packet is always allocated, and it is owned by the caller
// after this function returns.
func (c *Conn) ReadPacket(ctx context.Context) ([]byte, error) {
	defer trace.StartRegion(ctx, "read-packet").End()
	result, err := c.readPacket(ctx)
	if err != nil {
		return nil, NewSQLError(CRServerLost, SSUnknownSQLState, "%v", err)
	}
	return result, err
}

// writePacket writes a packet, possibly cutting it into multiple
// chunks.  Note this is not very efficient, as the client probably
// has to build the []byte and that makes a memory copy.
// Try to use startEphemeralPacket/writeEphemeralPacket instead.
//
// This method returns a generic error, not a SQLError.
func (c *Conn) writePacket(data []byte) error {
	index := 0
	length := len(data)

	w := c.getWriter()

	for {
		// Packet length is capped to MaxPacketSize.
		packetLength := length
		if packetLength > MaxPacketSize {
			packetLength = MaxPacketSize
		}

		// Compute and write the header.
		var header [4]byte
		header[0] = byte(packetLength)
		header[1] = byte(packetLength >> 8)
		header[2] = byte(packetLength >> 16)
		header[3] = c.sequence
		if n, err := w.Write(header[:]); err != nil {
			return vterrors.Wrapf(err, "Write(header) failed")
		} else if n != 4 {
			return vterrors.Errorf(vtrpc.Code_INTERNAL, "Write(header) returned a short write: %v < 4", n)
		}

		// Write the body.
		if n, err := w.Write(data[index : index+packetLength]); err != nil {
			return vterrors.Wrapf(err, "Write(packet) failed")
		} else if n != packetLength {
			return vterrors.Errorf(vtrpc.Code_INTERNAL, "Write(packet) returned a short write: %v < %v", n, packetLength)
		}

		// Update our state.
		c.sequence++
		length -= packetLength
		if length == 0 {
			if packetLength == MaxPacketSize {
				// The packet we just sent had exactly
				// MaxPacketSize size, we need to
				// sent a zero-size packet too.
				header[0] = 0
				header[1] = 0
				header[2] = 0
				header[3] = c.sequence
				if n, err := w.Write(header[:]); err != nil {
					return vterrors.Wrapf(err, "Write(empty header) failed")
				} else if n != 4 {
					return vterrors.Errorf(vtrpc.Code_INTERNAL, "Write(empty header) returned a short write: %v < 4", n)
				}
				c.sequence++
			}
			return nil
		}
		index += packetLength
	}
}

func (c *Conn) startEphemeralPacket(length int) []byte {
	if c.currentEphemeralPolicy != ephemeralUnused {
		panic("startEphemeralPacket cannot be used while a packet is already started.")
	}

	c.currentEphemeralPolicy = ephemeralWrite
	// get buffer from pool or it'll be allocated if length is too big
	c.currentEphemeralBuffer = bufPool.Get(length)
	return *c.currentEphemeralBuffer
}

// writeEphemeralPacket writes the packet that was allocated by
// startEphemeralPacket.
func (c *Conn) writeEphemeralPacket() error {
	defer c.recycleWritePacket()

	switch c.currentEphemeralPolicy {
	case ephemeralWrite:
		if err := c.writePacket(*c.currentEphemeralBuffer); err != nil {
			return vterrors.Wrapf(err, "conn %v", c.ID())
		}
	case ephemeralUnused, ephemeralRead:
		// Programming error.
		panic(vterrors.Errorf(vtrpc.Code_INTERNAL, "conn %v: trying to call writeEphemeralPacket while currentEphemeralPolicy is %v", c.ID(), c.currentEphemeralPolicy))
	}

	return nil
}

// recycleWritePacket recycles the write packet. It needs to be called
// after writeEphemeralPacket was called.
func (c *Conn) recycleWritePacket() {
	if c.currentEphemeralPolicy != ephemeralWrite {
		// Programming error.
		panic(vterrors.Errorf(vtrpc.Code_INTERNAL, "trying to call recycleWritePacket while currentEphemeralPolicy is %d", c.currentEphemeralPolicy))
	}
	// Release our reference so the buffer can be gced
	bufPool.Put(c.currentEphemeralBuffer)
	c.currentEphemeralBuffer = nil
	c.currentEphemeralPolicy = ephemeralUnused
}

// writeComQuit writes a Quit message for the server, to indicate we
// want to close the connection.
// Client -> Server.
// Returns SQLError(CRServerGone) if it can't.
func (c *Conn) writeComQuit() error {
	// This is a new command, need to reset the sequence.
	c.sequence = 0

	data := c.startEphemeralPacket(1)
	data[0] = ComQuit
	if err := c.writeEphemeralPacket(); err != nil {
		return NewSQLError(CRServerGone, SSUnknownSQLState, SingleStringElementFormatString, err.Error())
	}
	return nil
}

// RemoteAddr returns the underlying socket RemoteAddr().
func (c *Conn) RemoteAddr() net.Addr {
	return c.Conn.RemoteAddr()
}

// ID returns the MySQL connection ID for this connection.
func (c *Conn) ID() int64 {
	return int64(c.ConnectionID)
}

// Ident returns a useful identification string for error logging
func (c *Conn) String() string {
	return fmt.Sprintf("client %v (%s)", c.ConnectionID, c.RemoteAddr().String())
}

// Close closes the connection. It can be called from a different go
// routine to interrupt the current connection.
func (c *Conn) Close() {
	if c.closed.CompareAndSwap(false, true) {
		c.Conn.Close()
	}
}

// IsClosed returns true if this connection was ever closed by the
// Close() method.  Note if the other side closes the connection, but
// Close() wasn't called, this will return false.
func (c *Conn) IsClosed() bool {
	return c.closed.Get()
}

//
// Packet writing methods, for generic packets.
//

// writeOKPacket writes an OK packet.
// Server -> Client.
// This method returns a generic error, not a SQLError.
func (c *Conn) writeOKPacket(affectedRows, lastInsertID uint64, flags uint16, warnings uint16) error {
	length := 1 + // OKPacket
		lenEncIntSize(affectedRows) +
		lenEncIntSize(lastInsertID) +
		2 + // flags
		2 // warnings
	data := c.startEphemeralPacket(length)
	pos := 0
	pos = writeByte(data, pos, OKPacket)
	pos = writeLenEncInt(data, pos, affectedRows)
	pos = writeLenEncInt(data, pos, lastInsertID)
	pos = writeUint16(data, pos, flags)
	pos = writeUint16(data, pos, warnings)

	return c.writeEphemeralPacket()
}

// writeOKPacket writes an OK packet with info string.
// Server -> Client.
// This method returns a generic error, not a SQLError.
func (c *Conn) writeOKPacketWithInfo(affectedRows, lastInsertID uint64, flags uint16, warnings uint16, info string) error {
	length := 1 + // OKPacket
		lenEncIntSize(affectedRows) +
		lenEncIntSize(lastInsertID) +
		2 + // flags
		2 + // warnings
		1 + // 1 byte before info string
		lenEOFString(info)
	data := c.startEphemeralPacket(length)
	pos := 0
	pos = writeByte(data, pos, OKPacket)
	pos = writeLenEncInt(data, pos, affectedRows)
	pos = writeLenEncInt(data, pos, lastInsertID)
	pos = writeUint16(data, pos, flags)
	pos = writeUint16(data, pos, warnings)
	pos = writeByte(data, pos, '#')
	pos = writeEOFString(data, pos, info)

	return c.writeEphemeralPacket()
}

// writeOKPacketWithEOFHeader writes an OK packet with an EOF header.
// This is used at the end of a result set if
// CapabilityClientDeprecateEOF is set.
// Server -> Client.
// This method returns a generic error, not a SQLError.
func (c *Conn) writeOKPacketWithEOFHeader(affectedRows, lastInsertID uint64, flags uint16, warnings uint16) error {
	length := 1 + // EOFPacket
		lenEncIntSize(affectedRows) +
		lenEncIntSize(lastInsertID) +
		2 + // flags
		2 // warnings
	data := c.startEphemeralPacket(length)
	pos := 0
	pos = writeByte(data, pos, EOFPacket)
	pos = writeLenEncInt(data, pos, affectedRows)
	pos = writeLenEncInt(data, pos, lastInsertID)
	pos = writeUint16(data, pos, flags)
	_ = writeUint16(data, pos, warnings)

	return c.writeEphemeralPacket()
}

// writeErrorPacket writes an error packet.
// Server -> Client.
// This method returns a generic error, not a SQLError.
func (c *Conn) writeErrorPacket(errorCode uint16, sqlState string, format string, args ...interface{}) error {
	errorMessage := fmt.Sprintf(format, args...)
	length := 1 + 2 + 1 + 5 + len(errorMessage)
	data := c.startEphemeralPacket(length)
	pos := 0
	pos = writeByte(data, pos, ErrPacket)
	pos = writeUint16(data, pos, errorCode)
	pos = writeByte(data, pos, '#')
	if sqlState == "" {
		sqlState = SSUnknownSQLState
	}
	if len(sqlState) != 5 {
		panic("sqlState has to be 5 characters long")
	}
	pos = writeEOFString(data, pos, sqlState)
	_ = writeEOFString(data, pos, errorMessage)

	return c.writeEphemeralPacket()
}

// writeErrorPacketFromError writes an error packet, from a regular error.
// See writeErrorPacket for other info.
func (c *Conn) writeErrorPacketFromError(err error) error {
	if se, ok := err.(*SQLError); ok {
		return c.writeErrorPacket(uint16(se.Num), se.State, "%v", se.Message)
	}

	return c.writeErrorPacket(ERUnknownError, SSUnknownSQLState, "unknown error: %v", err)
}

func (c *Conn) writeLoadInfilePacket(fileName string) error {
	length := 1 + len(fileName)
	data := c.startEphemeralPacket(length)
	pos := 0
	pos = writeByte(data, pos, LocalInfilePacket)
	pos = writeEOFString(data, pos, fileName)

	return c.writeEphemeralPacket()
}

// LoadInfile sends the LoadInfilePacket to the client requesting the remote
// file |file|. It returns a ReadCloser to read the contents of the remote file
// as it comes back from the client.
//
// This method should only be called from |ComQuery| and |ComMultiQuery|
// implementations within a Handler implementation.
//
// The returned |ReadCloser| uniquely owns the client communication while it is
// open. |Close| must be called on the |ReadCloser| before any results are
// streamed to the |result| callback of the |Handler|, for example.
//
// If the ReadCloser is closed before the entire file is read, the Close()
// method will block while the remainder of the file contents are read from the
// client and discarded.
func (c *Conn) LoadInfile(file string) (io.ReadCloser, error) {
	err := c.writeLoadInfilePacket(file)
	if err != nil {
		return nil, err
	}

	err = c.flush(context.Background())
	if err != nil {
		return nil, err
	}

	reader, writer := io.Pipe()
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		// Read contents from client response, write it to |writer|.
		data, err := c.readEphemeralPacket(context.Background())
		if err != nil {
			writer.CloseWithError(err)
			return
		}
		var drain bool
		for len(data) != 0 {
			if !drain {
				_, err = writer.Write(data)
			}
			if err != nil {
				// The reader was closed prematurely; drain the
				// file contents from the connection.
				drain = true
			}
			c.recycleReadPacket()
			data, err = c.readEphemeralPacket(context.Background())
			if err != nil {
				writer.CloseWithError(err)
				return
			}

		}
		c.recycleReadPacket()
		writer.Close()
	}()
	// We use finalizingReader to ensure that the call to |reader.Close()|
	// synchronizes with the goroutine responsible for reading the client
	// response. This needs to be called before a Handler implementation
	// starts returning results on the result callback.
	return &finalizingReader{
		reader,
		func() { wg.Wait() },
	}, nil
}

type finalizingReader struct {
	io.ReadCloser
	Finalize func()
}

func (r *finalizingReader) Close() error {
	err := r.ReadCloser.Close()
	r.Finalize()
	return err
}

func (c *Conn) HandleLoadDataLocalQuery(tmpdir string, tmpfileName string, file string) error {
	// First send the load infile packet and flush the connector
	err := c.writeLoadInfilePacket(file)
	if err != nil {
		return err
	}

	err = c.flush(context.Background())
	if err != nil {
		return err
	}

	fileName := filepath.Join(tmpdir, tmpfileName)

	f, err := os.Create(fileName)
	if err != nil {
		return err
	}

	defer f.Close()

	fileData, err := c.readEphemeralPacket(context.Background())
	if err != nil {
		return err
	}

	for len(fileData) != 0 {
		_, err := f.Write(fileData)
		if err != nil {
			return err
		}

		c.recycleReadPacket()

		fileData, err = c.readEphemeralPacket(context.Background())
	}

	c.recycleReadPacket()

	return nil
}

// writeEOFPacket writes an EOF packet, through the buffer, and
// doesn't flush (as it is used as part of a query result).
func (c *Conn) writeEOFPacket(flags uint16, warnings uint16) error {
	length := 5
	data := c.startEphemeralPacket(length)
	pos := 0
	pos = writeByte(data, pos, EOFPacket)
	pos = writeUint16(data, pos, warnings)
	_ = writeUint16(data, pos, flags)

	return c.writeEphemeralPacket()
}

const batchSize = 128

// handleNextCommand is called in the server loop to process
// incoming packets.
func (c *Conn) handleNextCommand(ctx context.Context, handler Handler) error {
	c.sequence = 0
	data, err := c.readEphemeralPacket(ctx)
	if err != nil {
		// Don't log EOF errors. They cause too much spam.
		// Note the EOF detection is not 100%
		// guaranteed, in the case where the client
		// connection is already closed before we call
		// 'readEphemeralPacket'.  This is a corner
		// case though, and very unlikely to happen,
		// and the only downside is we log a bit more then.
		if err != io.EOF {
			log.Errorf("Error reading packet from %s: %v", c, err)
		}
		return err
	}

	switch data[0] {
	case ComQuit:
		c.recycleReadPacket()
		return errors.New("ComQuit")
	case ComInitDB:
		db := c.parseComInitDB(data)
		c.recycleReadPacket()
		c.schemaName = db
		if err := handler.ComInitDB(c, db); err != nil {
			log.Errorf("ComInitDB failed %s: %v", c, err)

			if werr := c.writeErrorPacketFromError(err); werr != nil {
				// If we can't even write the error, we're done.
				log.Errorf("Conn %v: Error writing query error: %v", c, werr)
				return werr
			}

			return nil
		}

		if err := c.writeOKPacket(0, 0, c.StatusFlags, 0); err != nil {
			log.Errorf("Error writing ComInitDB result to %s: %v", c, err)
			return err
		}
	case ComQuery:
		// flush is called at the end of this block.
		// To simplify error handling, we do not
		// encapsulate it with a defer'd func()
		c.startWriterBuffering()

		queryStart := time.Now()
		query := c.parseComQuery(data)

		ctx, task := trace.NewTask(ctx, "ComQuery")
		trace.Log(ctx, "query", query)
		defer task.End()

		c.recycleReadPacket()

		multiStatements := !c.DisableClientMultiStatements && c.Capabilities&CapabilityClientMultiStatements != 0

		var err error

		for query, err = c.execQuery(ctx, query, handler, multiStatements); err == nil && query != ""; {
			query, err = c.execQuery(ctx, query, handler, multiStatements)
		}
		if err != nil {
			return err
		}

		timings.Record(queryTimingKey, queryStart)

		if err := c.flush(ctx); err != nil {
			log.Errorf("Conn %v: Flush() failed: %v", c.ID(), err)
			return err
		}
	case ComFieldList:
		// support for deprecated COM_FIELD_LIST command
		// https://dev.mysql.com/doc/internals/en/com-field-list.html

		// todo: support wildcard param
		table, _, err := c.parseComFieldList(data)
		c.recycleReadPacket()
		if err != nil {
			return err
		}

		sql := fmt.Sprintf("SELECT * FROM %s LIMIT 0;", formatID(table))
		err = handler.ComQuery(ctx, c, sql, func(qr *sqltypes.Result, more bool) error {
			// only send meta data, no rows
			if len(qr.Fields) == 0 {
				return NewSQLErrorFromError(errors.New("unexpected: query ended without fields and no error"))
			}

			// for COM_FIELD_LIST response, don't send the number of fields first.

			for _, field := range qr.Fields {
				if err := c.writeColumnDefinition(field, true); err != nil {
					return err
				}
			}
			return nil
		})

		if err != nil {
			if werr := c.writeErrorPacketFromError(err); werr != nil {
				// If we can't even write the error, we're done.
				log.Errorf("Error writing query error to %s: %v", c, werr)
				return werr
			}
		}
		if err := c.writeEndResult(false, 0, 0, handler.WarningCount(c)); err != nil {
			log.Errorf("Error writing result to %s: %v", c, err)
			return err
		}
	case ComPing:
		c.recycleReadPacket()
		// Return error if listener was shut down and OK otherwise
		if c.listener.isShutdown() {
			if err := c.writeErrorPacket(ERServerShutdown, SSServerShutdown, "Server shutdown in progress"); err != nil {
				log.Errorf("Error writing ComPing error to %s: %v", c, err)
				return err
			}
		} else {
			if err := c.writeOKPacket(0, 0, c.StatusFlags, 0); err != nil {
				log.Errorf("Error writing ComPing result to %s: %v", c, err)
				return err
			}
		}
	case ComSetOption:
		operation, ok := c.parseComSetOption(data)
		c.recycleReadPacket()
		if ok {
			switch operation {
			case 0:
				c.Capabilities |= CapabilityClientMultiStatements
			case 1:
				c.Capabilities &^= CapabilityClientMultiStatements
			default:
				log.Errorf("Got unhandled packet (ComSetOption default) from client %v", c.ConnectionID)
				if err := c.writeErrorPacket(ERUnknownComError, SSUnknownComError, "error handling ComSetOption packet"); err != nil {
					log.Errorf("Error writing error packet to client: %v", err)
					return err
				}
			}
			if err := c.writeEndResult(false, 0, 0, 0); err != nil {
				log.Errorf("Error writeEndResult error %v ", err)
				return err
			}
		} else {
			log.Errorf("Got unhandled packet (ComSetOption else) from client %v", c.ConnectionID)
			if err := c.writeErrorPacket(ERUnknownComError, SSUnknownComError, "error handling ComSetOption packet"); err != nil {
				log.Errorf("Error writing error packet to client: %v", err)
				return err
			}
		}
	case ComPrepare:
		query := c.parseComPrepare(data)
		c.recycleReadPacket()

		if c.cs != nil {
			log.Error("Received ComStmtPrepare with outstanding cursor")
			if werr := c.writeErrorPacket(ERUnknownComError, SSUnknownComError, "error handling ComStmtPrepare packet"); werr != nil {
				log.Errorf("Error writing error packet to client: %v", werr)
				return werr
			}
			return nil
		}

		var err error
		var statement sqlparser.Statement
		parserOptions, err := handler.ParserOptionsForConnection(c)
		if err != nil {
			log.Errorf("unable to determine parser options for current connection: %s", err.Error())
			return err
		}

		var queries []string
		if !c.DisableClientMultiStatements && c.Capabilities&CapabilityClientMultiStatements != 0 {
			queries, err = sqlparser.SplitStatementToPieces(query)
			if err != nil {
				log.Errorf("error splitting query: %v", c, err)
				if werr := c.writeErrorPacketFromError(err); werr != nil {
					// If we can't even write the error, we're done.
					log.Errorf("Error writing query error to %s: %v", c, werr)
					return werr
				}
				return nil
			}
			if len(queries) != 1 {
				err := fmt.Errorf("cannot prepare multiple statements")
				if werr := c.writeErrorPacketFromError(err); werr != nil {
					// If we can't even write the error, we're done.
					log.Errorf("Error writing query error to %s: %v", c, werr)
					return werr
				}
				return nil
			}
		} else {
			queries = []string{query}
		}

		// Populate PrepareData
		c.StatementID++
		prepare := &PrepareData{
			StatementID: c.StatementID,
			PrepareStmt: queries[0],
		}

		statement, err = sqlparser.ParseWithOptions(ctx, query, parserOptions)
		if err != nil {
			log.Errorf("Error while parsing prepared statement: %s", err.Error())
			if werr := c.writeErrorPacketFromError(err); werr != nil {
				// If we can't even write the error, we're done.
				log.Errorf("Error writing query error to %s: %v", c, werr)
				return werr
			}
			return nil
		}

		// Walk the parsed statement tree and find any SQLVal nodes that are parameterized.
		paramsCount := uint16(0)
		_ = sqlparser.Walk(func(node sqlparser.SQLNode) (bool, error) {
			switch node := node.(type) {
			case *sqlparser.SQLVal:
				if strings.HasPrefix(string(node.Val), ":v") {
					paramsCount++
				}
			}
			return true, nil
		}, statement)

		if paramsCount > 0 {
			prepare.ParamsCount = paramsCount
			prepare.ParamsType = make([]int32, paramsCount)
			prepare.BindVars = make(map[string]*querypb.BindVariable, paramsCount)
		}

		c.PrepareData[c.StatementID] = prepare

		fld, err := handler.ComPrepare(ctx, c, query, prepare)
		if err != nil {
			log.Errorf("unable to prepare query: %s", err.Error())
			if werr := c.writeErrorPacketFromError(err); werr != nil {
				// If we can't even write the error, we're done.
				log.Errorf("Error writing query error to client %v: %v", c.ConnectionID, werr)
				return werr
			}
			return nil
		}

		if err := c.writePrepare(ctx, fld, c.PrepareData[c.StatementID]); err != nil {
			return err
		}
	case ComStmtExecute:
		// outstanding cursor, error
		if c.cs != nil {
			log.Error("Received ComStmtExecute with outstanding cursor")
			if werr := c.writeErrorPacket(ERUnknownComError, SSUnknownComError, "error handling ComStmtExecute packet"); werr != nil {
				log.Errorf("Error writing error packet to client: %v", werr)
				return werr
			}
			return nil
		}

		// flush is called at the end of this block.
		// To simplify error handling, we do not
		// encapsulate it with a defer'd func()
		c.startWriterBuffering()

		stmtID, cursorType, err := c.parseComStmtExecute(c.PrepareData, data)
		c.recycleReadPacket()
		if err != nil {
			if werr := c.writeErrorPacketFromError(err); werr != nil {
				// If we can't even write the error, we're done.
				log.Errorf("Error writing query error to client %v: %v", c.ConnectionID, werr)
				return werr
			}
			return c.flush(ctx)
		}

		if stmtID != uint32(0) {
			defer func() {
				// Allocate a new bindvar map every time since VTGate.Execute() mutates it.
				prepare := c.PrepareData[stmtID]
				prepare.BindVars = make(map[string]*querypb.BindVariable, prepare.ParamsCount)
			}()
		}
		queryStart := time.Now()

		if err = c.execPrepareStatement(ctx, stmtID, cursorType, handler); err != nil {
			return err
		}

		timings.Record(queryTimingKey, queryStart)
		if err := c.flush(ctx); err != nil {
			log.Errorf("Conn %v: Flush() failed: %v", c.ID(), err)
			return err
		}
	case ComStmtSendLongData:
		stmtID, paramID, chunk, ok := c.parseComStmtSendLongData(data)
		c.recycleReadPacket()
		if !ok {
			err := fmt.Errorf("error parsing statement send long data from client %v", c.ConnectionID)
			log.Error(err.Error())
			return err
		}

		prepare, ok := c.PrepareData[stmtID]
		if !ok {
			err := fmt.Errorf("got wrong statement id from client %v, statement ID(%v) is not found from record", c.ConnectionID, stmtID)
			log.Error(err.Error())
			return err
		}

		if prepare.BindVars == nil ||
			prepare.ParamsCount == uint16(0) ||
			paramID >= prepare.ParamsCount {
			err := fmt.Errorf("invalid parameter Number from client %v, statement: %v", c.ConnectionID, prepare.PrepareStmt)
			log.Error(err.Error())
			return err
		}

		key := fmt.Sprintf("v%d", paramID+1)
		if val, ok := prepare.BindVars[key]; ok {
			val.Value = append(val.Value, chunk...)
		} else {
			prepare.BindVars[key] = sqltypes.BytesBindVariable(chunk)
		}
	case ComStmtClose:
		stmtID, ok := c.parseComStmtClose(data)
		c.recycleReadPacket()
		if ok {
			delete(c.PrepareData, stmtID)
		}
		c.discardCursor()
	case ComStmtReset:
		stmtID, ok := c.parseComStmtReset(data)
		c.recycleReadPacket()
		if !ok {
			log.Errorf("Got unhandled ComStmtReset packet from client %v", c.ConnectionID)
			if err := c.writeErrorPacket(ERUnknownComError, SSUnknownComError, "error handling ComStmtReset packet"); err != nil {
				log.Errorf("Error writing error packet to client: %v", err)
				return err
			}
		}

		prepare, ok := c.PrepareData[stmtID]
		if !ok {
			log.Errorf("Commands were executed in an improper order from client %v", c.ConnectionID)
			if werr := c.writeErrorPacket(CRCommandsOutOfSync, SSUnknownComError, "commands were executed in an improper order"); werr != nil {
				log.Errorf("Error writing error packet to client: %v", err)
				return werr
			}
		}

		if prepare.BindVars != nil {
			for k := range prepare.BindVars {
				prepare.BindVars[k] = nil
			}
		}

		c.discardCursor()

		if err := c.writeOKPacket(0, 0, c.StatusFlags, 0); err != nil {
			log.Errorf("Error writing ComStmtReset OK packet to client %v: %v", c.ConnectionID, err)
			return err
		}
	case ComStmtFetch:
		c.startWriterBuffering()
		stmtID, numRows, ok := c.parseComStmtFetch(data)
		c.recycleReadPacket()
		if !ok {
			log.Errorf("Unable to parse COM_STMT_FETCH message on connection %v", c.ConnectionID)
			if werr := c.writeErrorPacket(ERUnknownComError, SSUnknownComError,
				"unable to parse COM_STMT_FETCH message on connection %v", c.ConnectionID); werr != nil {
				log.Errorf("Error writing error packet to client: %v", werr)
				return werr
			}
			return c.flush(ctx)
		}

		// fetching from wrong statement
		if c.cs == nil || stmtID != c.cs.stmtID {
			log.Errorf("Requested stmtID does not match stmtID of open cursor. Client %v", c.ConnectionID)
			if werr := c.writeErrorPacket(ERUnknownComError, SSUnknownComError, "error handling ComStmtFetch packet"); werr != nil {
				log.Errorf("Error writing error packet to client: %v", err)
				return werr
			}
			return c.flush(ctx)
		}

		// There is always a pending result set, because we prefetch it to detect EOF.
		// When we detect EOF, we set c.cs = nil.

		for c.cs != nil && numRows != 0 {
			toSend := uint32(len(c.cs.pending.Rows))
			if toSend > numRows {
				toSend = numRows
			}
			nextRows := c.cs.pending.Rows[toSend:]
			c.cs.pending.Rows = c.cs.pending.Rows[:toSend]

			if err = c.writeBinaryRows(c.cs.pending); err != nil {
				log.Errorf("Error writing result to %s: %v", c, err)
				return err
			}
			c.cs.pending.Rows = nextRows
			numRows -= toSend
			if len(c.cs.pending.Rows) == 0 {
				var ok bool
				c.cs.pending, ok = <-c.cs.next
				if !ok {
					// Query has terminated. Check for an error.
					err := <-c.cs.done
					c.cs = nil
					if err != nil {
						// We can't send an error in the middle of a stream.
						// All we can do is abort the send, which will cause a 2013.
						log.Errorf("Error in the middle of a stream to %s: %v", c, err)
						return err
					}
				}
			}
		}

		if c.cs == nil {
			c.StatusFlags |= uint16(ServerCursorLastRowSent)
		}
		if err := c.writeEndResult(false, 0, 0, handler.WarningCount(c)); err != nil {
			log.Errorf("Error writing result to %s: %v", c, err)
			return err
		}
		if c.cs == nil {
			c.StatusFlags &= ^uint16(ServerCursorLastRowSent)
		}
		if err := c.flush(ctx); err != nil {
			log.Errorf("Conn %v: Flush() failed: %v", c.ID(), err)
			return err
		}
	case ComResetConnection:
		// Clean up and reset the connection
		c.recycleReadPacket()
		c.discardCursor()
		err = handler.ComResetConnection(c)
		if err != nil {
			log.Errorf("Error resetting connection (ID %d): %v", c.ConnectionID, err)
			c.writeErrorPacketFromError(err)
		}
		// Reset prepared statements
		c.PrepareData = make(map[uint32]*PrepareData)
		err = c.writeOKPacket(0, 0, 0, 0)
		if err != nil {
			c.writeErrorPacketFromError(err)
		}

	case ComBinlogDumpGTID:
		ok := c.handleComBinlogDumpGTID(handler, data)
		if !ok {
			return fmt.Errorf("error handling ComBinlogDumpGTID packet")
		}
		return nil

	case ComRegisterReplica:
		ok := c.handleComRegisterReplica(handler, data)
		if !ok {
			return fmt.Errorf("error handling ComRegisterReplica packet")
		}
		return nil

	default:
		log.Errorf("Got unhandled packet (default) from %s, returning error: %v", c, data)
		c.recycleReadPacket()
		if err := c.writeErrorPacket(ERUnknownComError, SSUnknownComError, "command handling not implemented yet: %v", data[0]); err != nil {
			log.Errorf("Error writing error packet to %s: %s", c, err)
			return err
		}
	}

	return nil
}

func (c *Conn) handleComRegisterReplica(handler Handler, data []byte) (kontinue bool) {
	binlogReplicaHandler, ok := handler.(BinlogReplicaHandler)
	if !ok {
		log.Warningf("received COM_REGISTER_REPLICA command, but handler does not implement BinlogReplicaHandler")
		return true
	}

	replicaHost, replicaPort, replicaUser, replicaPassword, err := c.parseComRegisterReplica(data)
	if err != nil {
		log.Errorf("conn %v: parseComRegisterReplica failed: %v", c.ID(), err)
		return false
	}

	c.recycleReadPacket()

	if err := binlogReplicaHandler.ComRegisterReplica(c, replicaHost, replicaPort, replicaUser, replicaPassword); err != nil {
		c.writeErrorPacketFromError(err)
		return false
	}

	if err := c.writeOKPacket(0, 0, c.StatusFlags, 0); err != nil {
		c.writeErrorPacketFromError(err)
	}
	return true
}

func (c *Conn) handleComBinlogDumpGTID(handler Handler, data []byte) (kontinue bool) {
	binlogReplicaHandler, ok := handler.(BinlogReplicaHandler)
	if !ok {
		log.Warningf("received BINLOG_DUMP_GTID command, but handler does not implement BinlogReplicaHandler")
		return true
	}

	kontinue = true

	c.startWriterBuffering()
	defer func() {
		if err := c.flush(context.Background()); err != nil {
			log.Errorf("conn %v: flush() failed: %v", c.ID(), err)
			kontinue = false
		}
	}()

	logFile, logPos, position, err := c.parseComBinlogDumpGTID(data)
	if err != nil {
		log.Errorf("conn %v: parseComBinlogDumpGTID failed: %v", c.ID(), err)
		return false
	}

	c.recycleReadPacket()

	if err := binlogReplicaHandler.ComBinlogDumpGTID(c, logFile, logPos, position.GTIDSet); err != nil {
		log.Error(err.Error())
		c.writeErrorPacketFromError(err)
		return false
	}
	return kontinue
}

// writeNumRows writes the specified number of rows to the handler, the end result, and flushes
func (c *Conn) writeNumRows(numRows int) (err error) {
	origRows := c.cs.pending.Rows
	c.cs.pending.Rows = c.cs.pending.Rows[:numRows]
	if err = c.writeBinaryRows(c.cs.pending); err != nil {
		log.Errorf("Error writing result to %s: %v", c, err)
		return err
	}
	c.cs.pending.Rows = origRows[numRows:]
	return nil
}

// discardCursor stops the statement execute goroutine and clears the cursor state, if it exists
func (c *Conn) discardCursor() {
	// close cursor if open with unread results
	if c.cs != nil {
		select {
		case c.cs.quit <- errors.New("cancel cursor query"):
			<-c.cs.done
		case <-c.cs.done:
		}
	}
	c.cs = nil
}

// formatID returns a quoted identifier from the one given. Adapted from ast.go
func formatID(original string) string {
	var sb strings.Builder

	sb.WriteByte('`')
	for _, c := range original {
		sb.WriteRune(c)
		if c == '`' {
			sb.WriteByte('`')
		}
	}
	sb.WriteByte('`')

	return sb.String()
}

func (c *Conn) execQuery(ctx context.Context, query string, handler Handler, multiStatements bool) (string, error) {
	defer trace.StartRegion(ctx, "query").End()

	fieldSent := false
	// sendFinished is set if the response should just be an OK packet.
	sendFinished := false

	resultsCB := func(qr *sqltypes.Result, more bool) error {
		flag := c.StatusFlags
		if more {
			flag |= ServerMoreResultsExists
		}
		if sendFinished {
			// Failsafe: Unreachable if server is well-behaved.
			return io.EOF
		}

		if !fieldSent {
			fieldSent = true

			if len(qr.Fields) == 0 {
				sendFinished = true

				// A successful callback with no fields means that this was a
				// DML or other write-only operation.
				//
				// We should not send any more packets after this, but make sure
				// to extract the affected rows and last insert id from the result
				// struct here since clients expect it.
				if qr.Info != "" {
					return c.writeOKPacketWithInfo(qr.RowsAffected, qr.InsertID, flag, handler.WarningCount(c), qr.Info)
				} else {
					return c.writeOKPacket(qr.RowsAffected, qr.InsertID, flag, handler.WarningCount(c))
				}
			}
			if err := c.writeFields(qr); err != nil {
				return err
			}
		}

		return c.writeRows(qr)
	}

	var err error
	var remainder string

	if multiStatements {
		remainder, err = handler.ComMultiQuery(ctx, c, query, resultsCB)
	} else {
		err = handler.ComQuery(ctx, c, query, resultsCB)
	}

	// If no field was sent, we expect an error.
	if !fieldSent {
		// This is just a failsafe. Should never happen.
		if err == nil || err == io.EOF {
			err = NewSQLErrorFromError(errors.New("unexpected: query ended with no results and no error"))
		}
		if werr := c.writeErrorPacketFromError(err); werr != nil {
			// If we can't even write the error, we're done.
			log.Errorf("Error writing query error to %s: %v", c, werr)
			return "", werr
		}
	} else {
		if err != nil {
			// We can't send an error in the middle of a stream.
			// All we can do is abort the send, which will cause a 2013.
			log.Errorf("Error in the middle of a stream to %s: %v", c, err)
			return "", err
		}

		// Send the end packet only sendFinished is false (results were streamed).
		// In this case the affectedRows and lastInsertID are always 0 since it
		// was a read operation.
		if !sendFinished {
			more := remainder != ""
			if err := c.writeEndResult(more, 0, 0, handler.WarningCount(c)); err != nil {
				log.Errorf("Error writing result to %s: %v", c, err)
				return "", err
			}
		}
	}

	return remainder, nil
}

// execPrepareStatement runs the query identified by the statement ID, and writes the expected packets to the connection
// If the client requests that a cursor be opened, we should only write the fields, and wait for subsequent fetch
// requests to write the rows from the result set.
func (c *Conn) execPrepareStatement(ctx context.Context, stmtID uint32, cursorType byte, handler Handler) error {
	prepare := c.PrepareData[stmtID]
	if cursorType == NoCursor || cursorType == ParameterCountAvailable {
		fieldSent := false
		sendFinished := false // sendFinished is set if the response should just be an OK packet.

		err := handler.ComStmtExecute(ctx, c, prepare, func(qr *sqltypes.Result) error {
			if sendFinished {
				// Failsafe: Unreachable if server is well-behaved.
				return io.EOF
			}

			if !fieldSent {
				fieldSent = true
				if len(qr.Fields) == 0 {
					sendFinished = true
					// We should not send any more packets after this.
					return c.writeOKPacket(qr.RowsAffected, qr.InsertID, c.StatusFlags, 0)
				}
				if err := c.writeFields(qr); err != nil {
					return err
				}
			}
			return c.writeBinaryRows(qr)
		})

		// If no field was sent, we expect an error.
		if !fieldSent {
			// This is just a failsafe. Should never happen.
			if err == nil || err == io.EOF {
				err = NewSQLErrorFromError(errors.New("unexpected: query ended with no results and no error"))
			}
			if werr := c.writeErrorPacketFromError(err); werr != nil {
				// If we can't even write the error, we're done.
				log.Errorf("Error writing query error to %s: %v", c, werr)
				return werr
			}
		} else {
			// We can't send an error in the middle of a stream.
			// All we can do is abort the send, which will cause a 2013.
			if err != nil {
				log.Errorf("Error in the middle of a stream to %s: %v", c, err)
				return err
			}

			// Send the end packet only if sendFinished is false (results were streamed).
			// In this case the affectedRows and lastInsertID are always 0 since it
			// was a read operation.
			if !sendFinished {
				if werr := c.writeEndResult(false, 0, 0, handler.WarningCount(c)); werr != nil {
					log.Errorf("Error writing result to %s: %v", c, werr)
					return werr
				}
			}
		}

		return nil
	}
	next := make(chan *sqltypes.Result)
	done, quit := make(chan error), make(chan error)

	go func() {
		var err error
		defer func() {
			// pass along error, even if there's a panic
			if r := recover(); r != nil {
				err = fmt.Errorf("panic while running query for server-side cursor: %v", r)
			}
			close(next)
			done <- err
			close(done)
		}()
		err = handler.ComStmtExecute(ctx, c, prepare, func(qr *sqltypes.Result) error {
			// block until query results are sent or receive signal to quit
			var qerr error
			select {
			case next <- qr:
			case qerr = <-quit:
			}
			return qerr
		})
	}()

	// Immediately receive the very first query result to write the fields
	qr, ok := <-next
	if !ok {
		<-done
		if werr := c.writeErrorPacket(ERUnknownError, SSUnknownSQLState, "unknown error: %v", "missing result set"); werr != nil {
			log.Errorf("Error writing query error to %s: %v", c, werr)
			return werr
		}
		return nil
	}

	if len(qr.Fields) == 0 {
		// DML or something without a result set. We do not open a cursor here.
		<-done
		return c.writeOKPacket(qr.RowsAffected, qr.InsertID, c.StatusFlags, 0)
	}
	// Open the cursor and write the fields.
	c.StatusFlags |= uint16(ServerCursorExists)
	if err := c.writeFieldsWithoutEOF(qr); err != nil {
		log.Errorf("Error writing fields to %s: %v", c, err)
		return err
	}
	// TODO: Look into whether accessing WarningCount
	// here after passing `c` to ComStmtExecute in the
	// goroutine above races.
	if werr := c.writeEndResult(false, 0, 0, handler.WarningCount(c)); werr != nil {
		log.Errorf("Error writing result to %s: %v", c, werr)
		return werr
	}
	// After writing the EOF_Packet/OK_Packet above, we
	// have told the client the cursor is open.
	c.StatusFlags &= ^uint16(ServerCursorExists)
	c.cs = &cursorState{
		stmtID:  stmtID,
		next:    next,
		done:    done,
		quit:    quit,
		pending: qr,
	}
	return nil
}

//
// Packet parsing methods, for generic packets.
//

// isEOFPacket determines whether or not a data packet is a "true" EOF. DO NOT blindly compare the
// first byte of a packet to EOFPacket as you might do for other packet types, as 0xfe is overloaded
// as a first byte.
//
// Per https://dev.mysql.com/doc/internals/en/packet-EOF_Packet.html, a packet starting with 0xfe
// but having length >= 9 (on top of 4 byte header) is not a true EOF but a LengthEncodedInteger
// (typically preceding a LengthEncodedString). Thus, all EOF checks must validate the payload size
// before exiting.
//
// More specifically, an EOF packet can have 3 different lengths (1, 5, 7) depending on the client
// flags that are set. 7 comes from server versions of 5.7.5 or greater where ClientDeprecateEOF is
// set (i.e. uses an OK packet starting with 0xfe instead of 0x00 to signal EOF). Regardless, 8 is
// an upper bound otherwise it would be ambiguous w.r.t. LengthEncodedIntegers.
//
// More docs here:
// https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_basic_response_packets.html
func isEOFPacket(data []byte) bool {
	return data[0] == EOFPacket && len(data) < 9
}

// parseEOFPacket returns the warning count and a boolean to indicate if there
// are more results to receive.
//
// Note: This is only valid on actual EOF packets and not on OK packets with the EOF
// type code set, i.e. should not be used if ClientDeprecateEOF is set.
func parseEOFPacket(data []byte) (warnings uint16, status serverStatus, err error) {
	// The warning count is in position 2 & 3
	warnings, _, _ = readUint16(data, 1)

	// The status flag is in position 4 & 5
	statusFlags, _, ok := readUint16(data, 3)
	if !ok {
		return 0, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "invalid EOF packet statusFlags: %v", data)
	}
	return warnings, serverStatus(statusFlags), nil
}

func parseOKPacket(data []byte) (uint64, uint64, serverStatus, uint16, error) {
	// We already read the type.
	pos := 1

	// Affected rows.
	affectedRows, pos, ok := readLenEncInt(data, pos)
	if !ok {
		return 0, 0, 0, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "invalid OK packet affectedRows: %v", data)
	}

	// Last Insert ID.
	lastInsertID, pos, ok := readLenEncInt(data, pos)
	if !ok {
		return 0, 0, 0, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "invalid OK packet lastInsertID: %v", data)
	}

	// Status flags.
	statusFlags, pos, ok := readUint16(data, pos)
	if !ok {
		return 0, 0, 0, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "invalid OK packet statusFlags: %v", data)
	}

	// Warnings.
	warnings, _, ok := readUint16(data, pos)
	if !ok {
		return 0, 0, 0, 0, vterrors.Errorf(vtrpc.Code_INTERNAL, "invalid OK packet warnings: %v", data)
	}

	return affectedRows, lastInsertID, serverStatus(statusFlags), warnings, nil
}

// isErrorPacket determines whether or not the packet is an error packet. Mostly here for
// consistency with isEOFPacket
func isErrorPacket(data []byte) bool {
	return data[0] == ErrPacket
}

// ParseErrorPacket parses the error packet and returns a SQLError.
func ParseErrorPacket(data []byte) error {
	// We already read the type.
	pos := 1

	// Error code is 2 bytes.
	code, pos, ok := readUint16(data, pos)
	if !ok {
		return NewSQLError(CRUnknownError, SSUnknownSQLState, "invalid error packet code: %v", data)
	}

	// '#' marker of the SQL state is 1 byte. Ignored.
	pos++

	// SQL state is 5 bytes
	sqlState, pos, ok := readBytes(data, pos, 5)
	if !ok {
		return NewSQLError(CRUnknownError, SSUnknownSQLState, "invalid error packet sqlState: %v", data)
	}

	// Human readable error message is the rest.
	msg := string(data[pos:])

	return NewSQLError(int(code), string(sqlState), "%v", msg)
}

// GetTLSClientCerts gets TLS certificates.
func (c *Conn) GetTLSClientCerts() []*x509.Certificate {
	if tlsConn, ok := c.Conn.(*tls.Conn); ok {
		return tlsConn.ConnectionState().PeerCertificates
	}
	return nil
}

// TLSEnabled returns true if this connection is using TLS.
func (c *Conn) TLSEnabled() bool {
	return c.Capabilities&CapabilityClientSSL > 0
}

// IsUnixSocket returns true if this connection is over a Unix socket.
func (c *Conn) IsUnixSocket() bool {
	_, ok := c.listener.listener.(*net.UnixListener)
	return ok
}
