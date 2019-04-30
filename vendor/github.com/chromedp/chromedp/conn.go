// +build !nhooyr !gobwas

package chromedp

import (
	"bytes"
	"context"
	"io"

	"github.com/chromedp/cdproto"
	"github.com/gorilla/websocket"
	"github.com/mailru/easyjson"
	"github.com/mailru/easyjson/jlexer"
	"github.com/mailru/easyjson/jwriter"
)

// Conn wraps a gorilla/websocket.Conn connection.
type Conn struct {
	conn *websocket.Conn

	// buf helps us reuse space when reading from the websocket.
	buf bytes.Buffer

	// reuse the easyjson structs to avoid allocs per Read/Write.
	lexer  jlexer.Lexer
	writer jwriter.Writer

	dbgf func(string, ...interface{})
}

// DialContext dials the specified websocket URL using gorilla/websocket.
func DialContext(ctx context.Context, urlstr string, opts ...DialOption) (*Conn, error) {
	d := &websocket.Dialer{
		ReadBufferSize:  25 * 1024 * 1024,
		WriteBufferSize: 10 * 1024 * 1024,
	}

	// connect
	conn, _, err := d.DialContext(ctx, urlstr, nil)
	if err != nil {
		return nil, err
	}

	// apply opts
	c := &Conn{
		conn: conn,
	}
	for _, o := range opts {
		o(c)
	}

	return c, nil
}

// Close satisfies the io.Closer interface.
func (c *Conn) Close() error {
	return c.conn.Close()
}

func (c *Conn) bufReadAll(r io.Reader) ([]byte, error) {
	c.buf.Reset()
	_, err := c.buf.ReadFrom(r)
	return c.buf.Bytes(), err
}

func unmarshal(lex *jlexer.Lexer, data []byte, v easyjson.Unmarshaler) error {
	*lex = jlexer.Lexer{Data: data}
	v.UnmarshalEasyJSON(lex)
	return lex.Error()
}

// Read reads the next message.
func (c *Conn) Read(_ context.Context, msg *cdproto.Message) error {
	// get websocket reader
	typ, r, err := c.conn.NextReader()
	if err != nil {
		return err
	}
	if typ != websocket.TextMessage {
		return ErrInvalidWebsocketMessage
	}

	// Unmarshal via a bytes.Buffer. Don't use UnmarshalFromReader, as that
	// uses ioutil.ReadAll, which uses a brand new bytes.Buffer each time.
	// That doesn't reuse any space.
	buf, err := c.bufReadAll(r)
	if err != nil {
		return err
	}
	if c.dbgf != nil {
		c.dbgf("<- %s", buf)
	}

	// Reuse the easyjson lexer.
	if err := unmarshal(&c.lexer, buf, msg); err != nil {
		return err
	}

	// bufReadAll uses the buffer space directly, and msg.Result is an
	// easyjson.RawMessage, so we must make a copy of those bytes to prevent
	// data races. This still allocates much less than using a new buffer
	// each time.
	msg.Result = append([]byte{}, msg.Result...)
	return nil
}

// Write writes a message.
func (c *Conn) Write(_ context.Context, msg *cdproto.Message) error {
	w, err := c.conn.NextWriter(websocket.TextMessage)
	if err != nil {
		return err
	}
	defer w.Close()

	// Reuse the easyjson writer.
	c.writer = jwriter.Writer{}

	// Perform the marshal.
	msg.MarshalEasyJSON(&c.writer)
	if err := c.writer.Error; err != nil {
		return err
	}

	// Write the bytes to the websocket.
	// BuildBytes consumes the buffer, so we can't use it as well as DumpTo.
	if c.dbgf != nil {
		buf, _ := c.writer.BuildBytes()
		c.dbgf("-> %s", buf)
		if _, err := w.Write(buf); err != nil {
			return err
		}
	} else {
		if _, err := c.writer.DumpTo(w); err != nil {
			return err
		}
	}
	return w.Close()
}

// DialOption is a dial option.
type DialOption func(*Conn)

// WithConnDebugf is a dial option to set a protocol logger.
func WithConnDebugf(f func(string, ...interface{})) DialOption {
	return func(c *Conn) {
		c.dbgf = f
	}
}
