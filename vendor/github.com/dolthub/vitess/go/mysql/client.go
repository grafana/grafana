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
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	vtrpcpb "github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
	"github.com/dolthub/vitess/go/vt/vttls"
)

// connectResult is used by Connect.
type connectResult struct {
	c   *Conn
	err error
}

// Connect creates a connection to a server.
// It then handles the initial handshake.
//
// If context is canceled before the end of the process, this function
// will return nil, ctx.Err().
//
// FIXME(alainjobart) once we have more of a server side, add test cases
// to cover all failure scenarios.
func Connect(ctx context.Context, params *ConnParams) (*Conn, error) {
	netProto := "tcp"
	addr := ""
	if params.UnixSocket != "" {
		netProto = "unix"
		addr = params.UnixSocket
	} else {
		addr = net.JoinHostPort(params.Host, fmt.Sprintf("%v", params.Port))
	}

	// Start a background connection routine.  It first
	// establishes a network connection, returns it on the channel,
	// then starts the negotiation, and returns the result on the channel.
	// It can send on the channel, before closing it:
	// - a connectResult with an error and nothing else (when dial fails).
	// - a connectResult with a *Conn and no error, then another one
	//   with possibly an error.
	status := make(chan connectResult)
	go func() {
		defer close(status)
		var err error
		var conn net.Conn

		// Cap the Dial time with the context deadline, plus a
		// few seconds. We want to reclaim resources quickly
		// and not let this go routine stuck in Dial forever.
		//
		// We add a few seconds so we detect the context is
		// Done() before timing out the Dial. That way we'll
		// return the right error to the client (ctx.Err(), vs
		// DialTimeout() error).
		if deadline, ok := ctx.Deadline(); ok {
			timeout := time.Until(deadline) + 5*time.Second
			conn, err = net.DialTimeout(netProto, addr, timeout)
		} else {
			conn, err = net.Dial(netProto, addr)
		}
		if err != nil {
			// If we get an error, the connection to a Unix socket
			// should return a 2002, but for a TCP socket it
			// should return a 2003.
			if netProto == "tcp" {
				status <- connectResult{
					err: NewSQLError(CRConnHostError, SSUnknownSQLState, "net.Dial(%v) failed: %v", addr, err),
				}
			} else {
				status <- connectResult{
					err: NewSQLError(CRConnectionError, SSUnknownSQLState, "net.Dial(%v) to local server failed: %v", addr, err),
				}
			}
			return
		}

		// Send the connection back, so the other side can close it.
		c := newConn(conn)
		status <- connectResult{
			c: c,
		}

		// During the handshake, and if the context is
		// canceled, the connection will be closed. That will
		// make any read or write just return with an error
		// right away.
		status <- connectResult{
			err: c.clientHandshake(params),
		}
	}()

	// Wait on the context and the status, for the connection to happen.
	var c *Conn
	select {
	case <-ctx.Done():
		// The background routine may send us a few things,
		// wait for them and terminate them properly in the
		// background.
		go func() {
			dialCR := <-status // This one can take a while.
			if dialCR.err != nil {
				// Dial failed, nothing else to do.
				return
			}
			// Dial worked, close the connection, wait for the end.
			// We wait as not to leave a channel with an unread value.
			dialCR.c.Close()
			<-status
		}()
		return nil, ctx.Err()
	case cr := <-status:
		if cr.err != nil {
			// Dial failed, no connection was ever established.
			return nil, cr.err
		}

		// Dial worked, we have a connection. Keep going.
		c = cr.c
	}

	// Wait for the end of the handshake.
	select {
	case <-ctx.Done():
		// We are interrupted. Close the connection, wait for
		// the handshake to finish in the background.
		c.Close()
		go func() {
			// Since we closed the connection, this one should be fast.
			// We wait as not to leave a channel with an unread value.
			<-status
		}()
		return nil, ctx.Err()
	case cr := <-status:
		if cr.err != nil {
			c.Close()
			return nil, cr.err
		}
	}
	return c, nil
}

// Ping implements mysql ping command.
func (c *Conn) Ping() error {
	// This is a new command, need to reset the sequence.
	c.sequence = 0

	if err := c.writePacket([]byte{ComPing}); err != nil {
		return NewSQLError(CRServerGone, SSUnknownSQLState, "%v", err)
	}
	data, err := c.readEphemeralPacket(context.Background())
	if err != nil {
		return NewSQLError(CRServerLost, SSUnknownSQLState, "%v", err)
	}
	defer c.recycleReadPacket()
	switch data[0] {
	case OKPacket:
		return nil
	case ErrPacket:
		return ParseErrorPacket(data)
	}
	return vterrors.Errorf(vtrpcpb.Code_INTERNAL, "unexpected packet type: %d", data[0])
}

// parseCharacterSet parses the provided character set.
// Returns SQLError(CRCantReadCharset) if it can't.
func parseCharacterSet(cs string) (uint8, error) {
	// Check if it's empty, return utf8. This is a reasonable default.
	if cs == "" {
		return CharacterSetUtf8, nil
	}

	// Check if it's in our map.
	characterSet, ok := CharacterSetMap[strings.ToLower(cs)]
	if ok {
		return characterSet, nil
	}

	// As a fallback, try to parse a number. So we support more values.
	if i, err := strconv.ParseInt(cs, 10, 8); err == nil {
		return uint8(i), nil
	}

	// No luck.
	return 0, NewSQLError(CRCantReadCharset, SSUnknownSQLState, "failed to interpret character set '%v'. Try using an integer value if needed", cs)
}

// clientHandshake handles the client side of the handshake.
// Note the connection can be closed while this is running.
// Returns a SQLError.
func (c *Conn) clientHandshake(params *ConnParams) error {
	// Wait for the server initial handshake packet, and parse it.
	data, err := c.readPacket(context.Background())
	if err != nil {
		return NewSQLError(CRServerLost, "", "initial packet read failed: %v", err)
	}
	capabilities, salt, err := c.parseInitialHandshakePacket(data)
	if err != nil {
		return err
	}
	c.fillFlavor(params)
	c.salt = salt

	// Sanity check.
	if capabilities&CapabilityClientProtocol41 == 0 {
		return NewSQLError(CRVersionError, SSUnknownSQLState, "cannot connect to servers earlier than 4.1")
	}

	// Remember a subset of the capabilities, so we can use them
	// later in the protocol.
	c.Capabilities = 0
	if !params.DisableClientDeprecateEOF {
		c.Capabilities = capabilities & (CapabilityClientDeprecateEOF)
	}

	// Figure out the character set we want.
	charset, err := parseCharacterSet(params.Charset)
	if err != nil {
		return err
	}

	// Handle switch to SSL if necessary.
	if params.SslEnabled() {
		// If client asked for SSL, but server doesn't support it,
		// stop right here.
		if params.SslRequired() && capabilities&CapabilityClientSSL == 0 {
			return NewSQLError(CRSSLConnectionError, SSUnknownSQLState, "server doesn't support SSL but client asked for it")
		}

		// The ServerName to verify depends on what the hostname is.
		// We use the params's ServerName if specified. Otherwise:
		// - If using a socket, we use "localhost".
		// - If it is an IP address, we need to prefix it with 'IP:'.
		// - If not, we can just use it as is.
		serverName := "localhost"
		if params.ServerName != "" {
			serverName = params.ServerName
		} else if params.Host != "" {
			if net.ParseIP(params.Host) != nil {
				serverName = "IP:" + params.Host
			} else {
				serverName = params.Host
			}
		}

		tlsVersion, err := vttls.TLSVersionToNumber(params.TLSMinVersion)
		if err != nil {
			return NewSQLError(CRSSLConnectionError, SSUnknownSQLState, "error parsing minimal TLS version: %v", err)
		}

		// Build the TLS config.
		clientConfig, err := vttls.ClientConfig(params.EffectiveSslMode(), params.SslCert, params.SslKey, params.SslCa, params.SslCrl, serverName, tlsVersion)
		if err != nil {
			return NewSQLError(CRSSLConnectionError, SSUnknownSQLState, "error loading client cert and ca: %v", err)
		}

		// Send the SSLRequest packet.
		if err := c.writeSSLRequest(capabilities, charset, params); err != nil {
			return err
		}

		// Switch to SSL.
		tlsConn := tls.Client(c.Conn, clientConfig)
		err = tlsConn.Handshake()
		if err != nil {
			return err
		}

		conn := tlsConn
		c.Conn = conn
		c.bufferedReader.Reset(conn)
		c.Capabilities |= CapabilityClientSSL
	}

	// Password encryption.
	var scrambledPassword []byte
	if c.authPluginName == CachingSha2Password {
		scrambledPassword = ScrambleCachingSha2Password(salt, []byte(params.Pass))
	} else {
		scrambledPassword = ScrambleMysqlNativePassword(salt, []byte(params.Pass))
	}

	// Client Session Tracking Capability.
	if capabilities&CapabilityClientSessionTrack == CapabilityClientSessionTrack {
		// If the server also supports it, we will have enabled
		// it so we also add it to our capabilities.
		c.Capabilities |= CapabilityClientSessionTrack
	} else if params.Flags&CapabilityClientSessionTrack == CapabilityClientSessionTrack {
		// If client asked for ClientSessionTrack, but server doesn't support it,
		// stop right here.
		return NewSQLError(CRSSLConnectionError, SSUnknownSQLState, "server doesn't support ClientSessionTrack but client asked for it")
	}

	// Build and send our handshake response 41.
	// Note this one will never have SSL flag on.
	if err := c.writeHandshakeResponse41(capabilities, scrambledPassword, charset, params); err != nil {
		return err
	}

	// Read the server response.
	if err := c.handleAuthResponse(params); err != nil {
		return err
	}

	// If the server didn't support DbName in its handshake, set
	// it now. This is what the 'mysql' client does.
	if capabilities&CapabilityClientConnectWithDB == 0 && params.DbName != "" {
		// Write the packet.
		if err := c.writeComInitDB(params.DbName); err != nil {
			return err
		}

		// Wait for response, should be OK.
		response, err := c.readPacket(context.Background())
		if err != nil {
			return NewSQLError(CRServerLost, SSUnknownSQLState, "%v", err)
		}
		switch response[0] {
		case OKPacket:
			// OK packet, we are authenticated.
			return nil
		case ErrPacket:
			return ParseErrorPacket(response)
		default:
			// FIXME(alainjobart) handle extra auth cases and so on.
			return NewSQLError(CRServerHandshakeErr, SSUnknownSQLState, "initial server response is asking for more information, not implemented yet: %v", response)
		}
	}

	return nil
}

// handleAuthResponse parses server's response after client sends the password for authentication
// and handles next steps for AuthSwitchRequestPacket and AuthMoreDataPacket.
func (c *Conn) handleAuthResponse(params *ConnParams) error {
	response, err := c.readPacket(context.Background())
	if err != nil {
		return NewSQLError(CRServerLost, SSUnknownSQLState, "%v", err)
	}

	switch response[0] {
	case OKPacket:
		// OK packet, we are authenticated. Save the user, keep going.
		c.User = params.Uname
	case AuthSwitchRequestPacket:
		// Server is asking to use a different auth method
		if err = c.handleAuthSwitchPacket(params, response); err != nil {
			return err
		}
	case AuthMoreDataPacket:
		// Server is requesting more data - maybe un-scrambled password
		if err := c.handleAuthMoreDataPacket(response[1], params); err != nil {
			return err
		}
	case ErrPacket:
		return ParseErrorPacket(response)
	default:
		return NewSQLError(CRServerHandshakeErr, SSUnknownSQLState, "initial server response cannot be parsed: %v", response)
	}

	return nil
}

// handleAuthSwitchPacket scrambles password for the plugin requested by the server and retries authentication
func (c *Conn) handleAuthSwitchPacket(params *ConnParams, response []byte) error {
	var err error
	var salt []byte
	c.authPluginName, salt, err = parseAuthSwitchRequest(response)
	if err != nil {
		return NewSQLError(CRServerHandshakeErr, SSUnknownSQLState, "cannot parse auth switch request: %v", err)
	}
	if salt != nil {
		c.salt = salt
	}
	switch c.authPluginName {
	case MysqlClearPassword:
		if err := c.writeClearTextPassword(params); err != nil {
			return err
		}
	case MysqlNativePassword:
		scrambledPassword := ScrambleMysqlNativePassword(c.salt, []byte(params.Pass))
		if err := c.writeScrambledPassword(scrambledPassword); err != nil {
			return err
		}
	case CachingSha2Password:
		scrambledPassword := ScrambleCachingSha2Password(c.salt, []byte(params.Pass))
		if err := c.writeScrambledPassword(scrambledPassword); err != nil {
			return err
		}
	default:
		return NewSQLError(CRServerHandshakeErr, SSUnknownSQLState, "server asked for unsupported auth method: %v", c.authPluginName)
	}

	// The response could be an OKPacket, AuthMoreDataPacket or ErrPacket
	return c.handleAuthResponse(params)
}

// handleAuthMoreDataPacket handles response of CachingSha2Password authentication and sends full password to the
// server if requested
func (c *Conn) handleAuthMoreDataPacket(data byte, params *ConnParams) error {
	switch data {
	case CachingSha2FastAuth:
		// User credentials are verified using the cache ("Fast" path).
		// Next packet should be an OKPacket
		return c.handleAuthResponse(params)
	case CachingSha2FullAuth:
		// User credentials are not cached, we have to exchange full password.
		if c.Capabilities&CapabilityClientSSL > 0 || params.UnixSocket != "" {
			// If we are using an SSL connection or Unix socket, write clear text password
			if err := c.writeClearTextPassword(params); err != nil {
				return err
			}
		} else {
			// If we are not using an SSL connection or Unix socket, we have to fetch a public key
			// from the server to encrypt password
			pub, err := c.requestPublicKey()
			if err != nil {
				return err
			}
			// Encrypt password with public key
			enc, err := EncryptPasswordWithPublicKey(c.salt, []byte(params.Pass), pub)
			if err != nil {
				return vterrors.Errorf(vtrpcpb.Code_INTERNAL, "error encrypting password with public key: %v", err)
			}
			// Write encrypted password
			if err := c.writeScrambledPassword(enc); err != nil {
				return err
			}
		}
		// Next packet should either be an OKPacket or ErrPacket
		return c.handleAuthResponse(params)
	default:
		return NewSQLError(CRServerHandshakeErr, SSUnknownSQLState, "cannot parse AuthMoreDataPacket: %v", data)
	}
}

// parseInitialHandshakePacket parses the initial handshake from the server.
// It returns a SQLError with the right code.
func (c *Conn) parseInitialHandshakePacket(data []byte) (uint32, []byte, error) {
	pos := 0

	// Protocol version.
	pver, pos, ok := readByte(data, pos)
	if !ok {
		return 0, nil, NewSQLError(CRVersionError, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no protocol version")
	}

	// Server is allowed to immediately send ERR packet
	if pver == ErrPacket {
		errorCode, pos, _ := readUint16(data, pos)
		// Normally there would be a 1-byte sql_state_marker field and a 5-byte
		// sql_state field here, but docs say these will not be present in this case.
		errorMsg, pos, _ := readEOFString(data, pos)
		return 0, nil, NewSQLError(CRServerHandshakeErr, SSUnknownSQLState, "immediate error from server errorCode=%v errorMsg=%v", errorCode, errorMsg)
	}

	if pver != protocolVersion {
		return 0, nil, NewSQLError(CRVersionError, SSUnknownSQLState, "bad protocol version: %v", pver)
	}

	// Read the server version.
	c.ServerVersion, pos, ok = readNullString(data, pos)
	if !ok {
		return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no server version")
	}

	// Read the connection id.
	c.ConnectionID, pos, ok = readUint32(data, pos)
	if !ok {
		return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no connection id")
	}

	// Read the first part of the auth-plugin-data
	authPluginData, pos, ok := readBytes(data, pos, 8)
	if !ok {
		return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no auth-plugin-data-part-1")
	}

	// One byte filler, 0. We don't really care about the value.
	_, pos, ok = readByte(data, pos)
	if !ok {
		return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no filler")
	}

	// Lower 2 bytes of the capability flags.
	capLower, pos, ok := readUint16(data, pos)
	if !ok {
		return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no capability flags (lower 2 bytes)")
	}
	var capabilities = uint32(capLower)

	// The packet can end here.
	if pos == len(data) {
		return capabilities, authPluginData, nil
	}

	// Character set.
	characterSet, pos, ok := readByte(data, pos)
	if !ok {
		return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no character set")
	}
	c.CharacterSet = characterSet

	// Status flags. Ignored.
	_, pos, ok = readUint16(data, pos)
	if !ok {
		return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no status flags")
	}

	// Upper 2 bytes of the capability flags.
	capUpper, pos, ok := readUint16(data, pos)
	if !ok {
		return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no capability flags (upper 2 bytes)")
	}
	capabilities += uint32(capUpper) << 16

	// Length of auth-plugin-data, or 0.
	// Only with CLIENT_PLUGIN_AUTH capability.
	var authPluginDataLength byte
	if capabilities&CapabilityClientPluginAuth != 0 {
		authPluginDataLength, pos, ok = readByte(data, pos)
		if !ok {
			return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no length of auth-plugin-data")
		}
	} else {
		// One byte filler, 0. We don't really care about the value.
		_, pos, ok = readByte(data, pos)
		if !ok {
			return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no length of auth-plugin-data filler")
		}
	}

	// 10 reserved 0 bytes.
	pos += 10

	if capabilities&CapabilityClientSecureConnection != 0 {
		// The next part of the auth-plugin-data.
		// The length is max(13, length of auth-plugin-data - 8).
		l := int(authPluginDataLength) - 8
		if l > 13 {
			l = 13
		}
		var authPluginDataPart2 []byte
		authPluginDataPart2, pos, ok = readBytes(data, pos, l)
		if !ok {
			return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: packet has no auth-plugin-data-part-2")
		}

		// The last byte has to be 0, and is not part of the data.
		if authPluginDataPart2[l-1] != 0 {
			return 0, nil, NewSQLError(CRMalformedPacket, SSUnknownSQLState, "parseInitialHandshakePacket: auth-plugin-data-part-2 is not 0 terminated")
		}
		authPluginData = append(authPluginData, authPluginDataPart2[0:l-1]...)
	}

	// Auth-plugin name.
	if capabilities&CapabilityClientPluginAuth != 0 {
		authPluginName, _, ok := readNullString(data, pos)
		if !ok {
			// Fallback for versions prior to 5.5.10 and
			// 5.6.2 that don't have a null terminated string.
			authPluginName = string(data[pos : len(data)-1])
		}
		c.authPluginName = AuthMethodDescription(authPluginName)
	}

	return capabilities, authPluginData, nil
}

// writeSSLRequest writes the SSLRequest packet. It's just a truncated
// HandshakeResponse41.
func (c *Conn) writeSSLRequest(capabilities uint32, characterSet uint8, params *ConnParams) error {
	// Build our flags, with CapabilityClientSSL.
	var flags uint32 = CapabilityClientLongPassword |
		CapabilityClientLongFlag |
		CapabilityClientProtocol41 |
		CapabilityClientTransactions |
		CapabilityClientSecureConnection |
		CapabilityClientMultiStatements |
		CapabilityClientMultiResults |
		CapabilityClientPluginAuth |
		CapabilityClientPluginAuthLenencClientData |
		CapabilityClientSSL |
		// If the server supported
		// CapabilityClientDeprecateEOF, we also support it.
		c.Capabilities&CapabilityClientDeprecateEOF |
		// Pass-through ClientFoundRows flag.
		CapabilityClientFoundRows&uint32(params.Flags)

	length :=
		4 + // Client capability flags.
			4 + // Max-packet size.
			1 + // Character set.
			23 // Reserved.

	// Add the DB name if the server supports it.
	if params.DbName != "" && (capabilities&CapabilityClientConnectWithDB != 0) {
		flags |= CapabilityClientConnectWithDB
	}

	data := c.startEphemeralPacket(length)
	pos := 0

	// Client capability flags.
	pos = writeUint32(data, pos, flags)

	// Max-packet size, always 0. See doc.go.
	pos = writeZeroes(data, pos, 4)

	// Character set.
	_ = writeByte(data, pos, characterSet)

	// And send it as is.
	if err := c.writeEphemeralPacket(); err != nil {
		return NewSQLError(CRServerLost, SSUnknownSQLState, "cannot send SSLRequest: %v", err)
	}
	return nil
}

// writeHandshakeResponse41 writes the handshake response.
// Returns a SQLError.
func (c *Conn) writeHandshakeResponse41(capabilities uint32, scrambledPassword []byte, characterSet uint8, params *ConnParams) error {
	// Build our flags.
	var flags uint32 = CapabilityClientLongPassword |
		CapabilityClientLongFlag |
		CapabilityClientProtocol41 |
		CapabilityClientTransactions |
		CapabilityClientSecureConnection |
		CapabilityClientMultiStatements |
		CapabilityClientMultiResults |
		CapabilityClientPluginAuth |
		CapabilityClientPluginAuthLenencClientData |
		// If the server supported
		// CapabilityClientDeprecateEOF, we also support it.
		c.Capabilities&CapabilityClientDeprecateEOF |
		// Pass-through ClientFoundRows flag.
		CapabilityClientFoundRows&uint32(params.Flags)

	// FIXME(alainjobart) add multi statement.

	length :=
		4 + // Client capability flags.
			4 + // Max-packet size.
			1 + // Character set.
			23 + // Reserved.
			lenNullString(params.Uname) +
			// length of scrambled password is handled below.
			len(scrambledPassword) +
			21 + // "mysql_native_password" string.
			1 // terminating zero.

	// Add the DB name if the server supports it.
	if params.DbName != "" && (capabilities&CapabilityClientConnectWithDB != 0) {
		flags |= CapabilityClientConnectWithDB
		length += lenNullString(params.DbName)
	}

	if capabilities&CapabilityClientPluginAuthLenencClientData != 0 {
		length += lenEncIntSize(uint64(len(scrambledPassword)))
	} else {
		length++
	}

	data := c.startEphemeralPacket(length)
	pos := 0

	// Client capability flags.
	pos = writeUint32(data, pos, flags)

	// Max-packet size, always 0. See doc.go.
	pos = writeZeroes(data, pos, 4)

	// Character set.
	pos = writeByte(data, pos, characterSet)

	// 23 reserved bytes, all 0.
	pos = writeZeroes(data, pos, 23)

	// Username
	pos = writeNullString(data, pos, params.Uname)

	// Scrambled password.  The length is encoded as variable length if
	// CapabilityClientPluginAuthLenencClientData is set.
	if capabilities&CapabilityClientPluginAuthLenencClientData != 0 {
		pos = writeLenEncInt(data, pos, uint64(len(scrambledPassword)))
	} else {
		data[pos] = byte(len(scrambledPassword))
		pos++
	}
	pos += copy(data[pos:], scrambledPassword)

	// DbName, only if server supports it.
	if params.DbName != "" && (capabilities&CapabilityClientConnectWithDB != 0) {
		pos = writeNullString(data, pos, params.DbName)
		c.schemaName = params.DbName
	}

	// Auth plugin name
	pos = writeNullString(data, pos, string(c.authPluginName))

	// Sanity-check the length.
	if pos != len(data) {
		return NewSQLError(CRMalformedPacket, SSUnknownSQLState, "writeHandshakeResponse41: only packed %v bytes, out of %v allocated", pos, len(data))
	}

	if err := c.writeEphemeralPacket(); err != nil {
		return NewSQLError(CRServerLost, SSUnknownSQLState, "cannot send HandshakeResponse41: %v", err)
	}
	return nil
}

func parseAuthSwitchRequest(data []byte) (AuthMethodDescription, []byte, error) {
	pos := 1
	pluginName, pos, ok := readNullString(data, pos)
	if !ok {
		return "", nil, vterrors.Errorf(vtrpcpb.Code_INTERNAL, "cannot get plugin name from AuthSwitchRequest: %v", data)
	}

	// If this was a request with a salt in it, max 20 bytes
	salt := data[pos:]
	if len(salt) > 20 {
		salt = salt[:20]
	}
	return AuthMethodDescription(pluginName), salt, nil
}

// requestPublicKey requests a public key from the server
func (c *Conn) requestPublicKey() (rsaKey *rsa.PublicKey, err error) {
	// get public key from server
	data := c.startEphemeralPacket(1)
	pos := 0
	data[pos] = 0x02
	if err := c.writeEphemeralPacket(); err != nil {
		return nil, vterrors.Errorf(vtrpcpb.Code_INTERNAL, "error sending public key request packet: %v", err)
	}

	response, err := c.readPacket(context.Background())
	if err != nil {
		return nil, NewSQLError(CRServerLost, SSUnknownSQLState, "%v", err)
	}

	// Server should respond with a AuthMoreDataPacket containing the public key
	if response[0] != AuthMoreDataPacket {
		return nil, ParseErrorPacket(response)
	}

	block, _ := pem.Decode(response[1:])
	if block == nil {
		return nil, vterrors.Errorf(vtrpcpb.Code_INTERNAL, "failed to decode response from server: %v", err)
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, vterrors.Errorf(vtrpcpb.Code_INTERNAL, "failed to parse public key from server: %v", err)
	}

	return pub.(*rsa.PublicKey), nil
}

// writeClearTextPassword writes the clear text password.
// Returns a SQLError.
func (c *Conn) writeClearTextPassword(params *ConnParams) error {
	length := len(params.Pass) + 1
	data := c.startEphemeralPacket(length)
	pos := 0
	pos = writeNullString(data, pos, params.Pass)
	// Sanity check.
	if pos != len(data) {
		return vterrors.Errorf(vtrpcpb.Code_INTERNAL, "error building ClearTextPassword packet: got %v bytes expected %v", pos, len(data))
	}
	return c.writeEphemeralPacket()
}

// writeScrambledPassword writes the encrypted mysql_native_password format
// Returns a SQLError.
func (c *Conn) writeScrambledPassword(scrambledPassword []byte) error {
	data := c.startEphemeralPacket(len(scrambledPassword))
	pos := 0
	pos += copy(data[pos:], scrambledPassword)
	// Sanity check.
	if pos != len(data) {
		return vterrors.Errorf(vtrpcpb.Code_INTERNAL, "error building %v packet: got %v bytes expected %v", c.authPluginName, pos, len(data))
	}
	return c.writeEphemeralPacket()
}
