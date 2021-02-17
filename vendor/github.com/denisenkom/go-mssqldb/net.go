package mssql

import (
	"fmt"
	"net"
	"time"
)

type timeoutConn struct {
	c             net.Conn
	timeout       time.Duration
}

func newTimeoutConn(conn net.Conn, timeout time.Duration) *timeoutConn {
	return &timeoutConn{
		c:       conn,
		timeout: timeout,
	}
}

func (c *timeoutConn) Read(b []byte) (n int, err error) {
	if c.timeout > 0 {
		err = c.c.SetDeadline(time.Now().Add(c.timeout))
		if err != nil {
			return
		}
	}
	return c.c.Read(b)
}

func (c *timeoutConn) Write(b []byte) (n int, err error) {
	if c.timeout > 0 {
		err = c.c.SetDeadline(time.Now().Add(c.timeout))
		if err != nil {
			return
		}
	}
	return c.c.Write(b)
}

func (c timeoutConn) Close() error {
	return c.c.Close()
}

func (c timeoutConn) LocalAddr() net.Addr {
	return c.c.LocalAddr()
}

func (c timeoutConn) RemoteAddr() net.Addr {
	return c.c.RemoteAddr()
}

func (c timeoutConn) SetDeadline(t time.Time) error {
	panic("Not implemented")
}

func (c timeoutConn) SetReadDeadline(t time.Time) error {
	panic("Not implemented")
}

func (c timeoutConn) SetWriteDeadline(t time.Time) error {
	panic("Not implemented")
}

// this connection is used during TLS Handshake
// TDS protocol requires TLS handshake messages to be sent inside TDS packets
type tlsHandshakeConn struct {
	buf *tdsBuffer
	packetPending bool
	continueRead  bool
}

func (c *tlsHandshakeConn) Read(b []byte) (n int, err error) {
	if c.packetPending {
		c.packetPending = false
		err = c.buf.FinishPacket()
		if err != nil {
			err = fmt.Errorf("Cannot send handshake packet: %s", err.Error())
			return
		}
		c.continueRead = false
	}
	if !c.continueRead {
		var packet packetType
		packet, err = c.buf.BeginRead()
		if err != nil {
			err = fmt.Errorf("Cannot read handshake packet: %s", err.Error())
			return
		}
		if packet != packPrelogin {
			err = fmt.Errorf("unexpected packet %d, expecting prelogin", packet)
			return
		}
		c.continueRead = true
	}
	return c.buf.Read(b)
}

func (c *tlsHandshakeConn) Write(b []byte) (n int, err error) {
	if !c.packetPending {
		c.buf.BeginPacket(packPrelogin, false)
		c.packetPending = true
	}
	return c.buf.Write(b)
}

func (c *tlsHandshakeConn) Close() error {
	panic("Not implemented")
}

func (c *tlsHandshakeConn) LocalAddr() net.Addr {
	panic("Not implemented")
}

func (c *tlsHandshakeConn) RemoteAddr() net.Addr {
	panic("Not implemented")
}

func (c *tlsHandshakeConn) SetDeadline(t time.Time) error {
	panic("Not implemented")
}

func (c *tlsHandshakeConn) SetReadDeadline(t time.Time) error {
	panic("Not implemented")
}

func (c *tlsHandshakeConn) SetWriteDeadline(t time.Time) error {
	panic("Not implemented")
}

// this connection just delegates all methods to it's wrapped connection
// it also allows switching underlying connection on the fly
// it is needed because tls.Conn does not allow switching underlying connection
type passthroughConn struct {
	c net.Conn
}

func (c passthroughConn) Read(b []byte) (n int, err error) {
	return c.c.Read(b)
}

func (c passthroughConn) Write(b []byte) (n int, err error) {
	return c.c.Write(b)
}

func (c passthroughConn) Close() error {
	return c.c.Close()
}

func (c passthroughConn) LocalAddr() net.Addr {
	panic("Not implemented")
}

func (c passthroughConn) RemoteAddr() net.Addr {
	panic("Not implemented")
}

func (c passthroughConn) SetDeadline(t time.Time) error {
	panic("Not implemented")
}

func (c passthroughConn) SetReadDeadline(t time.Time) error {
	panic("Not implemented")
}

func (c passthroughConn) SetWriteDeadline(t time.Time) error {
	panic("Not implemented")
}
