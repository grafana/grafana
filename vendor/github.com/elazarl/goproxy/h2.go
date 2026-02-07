package goproxy

import (
	"bufio"
	"crypto/tls"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"

	"golang.org/x/net/http2"
)

var ErrInvalidH2Frame = errors.New("invalid H2 frame")

// H2Transport is an implementation of RoundTripper that abstracts an entire
// HTTP/2 session, sending all client frames to the server and responses back
// to the client.
type H2Transport struct {
	ClientReader io.Reader
	ClientWriter io.Writer
	TLSConfig    *tls.Config
	Host         string
}

// RoundTrip executes an HTTP/2 session (including all contained streams).
// The request and response are ignored but any error encountered during the
// proxying from the session is returned as a result of the invocation.
func (r *H2Transport) RoundTrip(_ *http.Request) (*http.Response, error) {
	raddr := r.Host
	if !strings.Contains(raddr, ":") {
		raddr += ":443"
	}
	rawServerTLS, err := dial("tcp", raddr)
	if err != nil {
		return nil, err
	}
	defer rawServerTLS.Close()
	// Ensure that we only advertise HTTP/2 as the accepted protocol.
	r.TLSConfig.NextProtos = []string{http2.NextProtoTLS}
	// Initiate TLS and check remote host name against certificate.
	rawServerTLS = tls.Client(rawServerTLS, r.TLSConfig)
	rawTLSConn, ok := rawServerTLS.(*tls.Conn)
	if !ok {
		return nil, errors.New("invalid TLS connection")
	}
	if err = rawTLSConn.Handshake(); err != nil {
		return nil, err
	}
	if r.TLSConfig == nil || !r.TLSConfig.InsecureSkipVerify {
		if err = rawTLSConn.VerifyHostname(raddr[:strings.LastIndex(raddr, ":")]); err != nil {
			return nil, err
		}
	}
	// Send new client preface to match the one parsed in req.
	if _, err := io.WriteString(rawServerTLS, http2.ClientPreface); err != nil {
		return nil, err
	}
	serverTLSReader := bufio.NewReader(rawServerTLS)
	cToS := http2.NewFramer(rawServerTLS, r.ClientReader)
	sToC := http2.NewFramer(r.ClientWriter, serverTLSReader)
	errSToC := make(chan error)
	errCToS := make(chan error)
	go func() {
		for {
			if err := proxyFrame(sToC); err != nil {
				errSToC <- err
				break
			}
		}
	}()
	go func() {
		for {
			if err := proxyFrame(cToS); err != nil {
				errCToS <- err
				break
			}
		}
	}()
	for i := 0; i < 2; i++ {
		select {
		case err := <-errSToC:
			if !errors.Is(err, io.EOF) {
				return nil, err
			}
		case err := <-errCToS:
			if !errors.Is(err, io.EOF) {
				return nil, err
			}
		}
	}
	return nil, nil
}

func dial(network, addr string) (c net.Conn, err error) {
	addri, err := net.ResolveTCPAddr(network, addr)
	if err != nil {
		return
	}
	c, err = net.DialTCP(network, nil, addri)
	return
}

// proxyFrame reads a single frame from the Framer and, when successful, writes
// a ~identical one back to the Framer.
func proxyFrame(fr *http2.Framer) error {
	f, err := fr.ReadFrame()
	if err != nil {
		return err
	}
	switch f.Header().Type {
	case http2.FrameData:
		tf, ok := f.(*http2.DataFrame)
		if !ok {
			return ErrInvalidH2Frame
		}
		terr := fr.WriteData(tf.StreamID, tf.StreamEnded(), tf.Data())
		if terr == nil && tf.StreamEnded() {
			terr = io.EOF
		}
		return terr
	case http2.FrameHeaders:
		tf, ok := f.(*http2.HeadersFrame)
		if !ok {
			return ErrInvalidH2Frame
		}
		terr := fr.WriteHeaders(http2.HeadersFrameParam{
			StreamID:      tf.StreamID,
			BlockFragment: tf.HeaderBlockFragment(),
			EndStream:     tf.StreamEnded(),
			EndHeaders:    tf.HeadersEnded(),
			PadLength:     0,
			Priority:      tf.Priority,
		})
		if terr == nil && tf.StreamEnded() {
			terr = io.EOF
		}
		return terr
	case http2.FrameContinuation:
		tf, ok := f.(*http2.ContinuationFrame)
		if !ok {
			return ErrInvalidH2Frame
		}
		return fr.WriteContinuation(tf.StreamID, tf.HeadersEnded(), tf.HeaderBlockFragment())
	case http2.FrameGoAway:
		tf, ok := f.(*http2.GoAwayFrame)
		if !ok {
			return ErrInvalidH2Frame
		}
		return fr.WriteGoAway(tf.StreamID, tf.ErrCode, tf.DebugData())
	case http2.FramePing:
		tf, ok := f.(*http2.PingFrame)
		if !ok {
			return ErrInvalidH2Frame
		}
		return fr.WritePing(tf.IsAck(), tf.Data)
	case http2.FrameRSTStream:
		tf, ok := f.(*http2.RSTStreamFrame)
		if !ok {
			return ErrInvalidH2Frame
		}
		return fr.WriteRSTStream(tf.StreamID, tf.ErrCode)
	case http2.FrameSettings:
		tf, ok := f.(*http2.SettingsFrame)
		if !ok {
			return ErrInvalidH2Frame
		}
		if tf.IsAck() {
			return fr.WriteSettingsAck()
		}
		var settings []http2.Setting
		// NOTE: If we want to parse headers, need to handle
		// settings where s.ID == http2.SettingHeaderTableSize and
		// accordingly update the Framer options.
		for i := 0; i < tf.NumSettings(); i++ {
			settings = append(settings, tf.Setting(i))
		}
		return fr.WriteSettings(settings...)
	case http2.FrameWindowUpdate:
		tf, ok := f.(*http2.WindowUpdateFrame)
		if !ok {
			return ErrInvalidH2Frame
		}
		return fr.WriteWindowUpdate(tf.StreamID, tf.Increment)
	case http2.FramePriority:
		tf, ok := f.(*http2.PriorityFrame)
		if !ok {
			return ErrInvalidH2Frame
		}
		return fr.WritePriority(tf.StreamID, tf.PriorityParam)
	case http2.FramePushPromise:
		tf, ok := f.(*http2.PushPromiseFrame)
		if !ok {
			return ErrInvalidH2Frame
		}
		return fr.WritePushPromise(http2.PushPromiseParam{
			StreamID:      tf.StreamID,
			PromiseID:     tf.PromiseID,
			BlockFragment: tf.HeaderBlockFragment(),
			EndHeaders:    tf.HeadersEnded(),
			PadLength:     0,
		})
	default:
		return errors.New("Unsupported frame: " + string(f.Header().Type))
	}
}
