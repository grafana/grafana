// Copyright 2019 The mqtt-go authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package mqtt

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/ioutil"
	"net"
	"net/url"
	"sync"

	"golang.org/x/net/websocket"
)

var defaultPorts = map[string]uint16{
	"mqtt":  1883,
	"mqtts": 8883,
	"wss":   443,
	"ws":    80,
}

// ErrUnsupportedProtocol means that the specified scheme in the URL is not supported.
var ErrUnsupportedProtocol = errors.New("unsupported protocol")

// Dialer is an interface to create connection.
type Dialer interface {
	DialContext(context.Context) (*BaseClient, error)
}

// DialerFunc type is an adapter to use functions as MQTT connection dialer.
type DialerFunc func(ctx context.Context) (*BaseClient, error)

// DialContext calls d().
func (d DialerFunc) DialContext(ctx context.Context) (*BaseClient, error) {
	return d(ctx)
}

// NoContextDialerIface is a Dialer interface of mqtt-go<1.14.
type NoContextDialerIface interface {
	Dial() (*BaseClient, error)
}

// NoContextDialer is a wrapper to use Dialer of mqtt-go<1.14 as mqtt-go>=1.14 Dialer.
//
// WARNING: passed context is ignored by NoContextDialer. Make sure timeout is handled inside NoContextDialer.
type NoContextDialer struct {
	NoContextDialerIface
}

// DialContext wraps Dial without context.
//
// WARNING: passed context is ignored by NoContextDialer. Make sure timeout is handled inside NoContextDialer.
func (d *NoContextDialer) DialContext(context.Context) (*BaseClient, error) {
	return d.Dial()
}

// URLDialer is a Dialer using URL string.
type URLDialer struct {
	URL     string
	Options []DialOption
}

// DialContext creates connection using its values.
func (d *URLDialer) DialContext(ctx context.Context) (*BaseClient, error) {
	return DialContext(ctx, d.URL, d.Options...)
}

// DialContext creates MQTT client using URL string.
func DialContext(ctx context.Context, urlStr string, opts ...DialOption) (*BaseClient, error) {
	u, err := url.Parse(urlStr)
	if err != nil {
		return nil, err
	}
	o := &DialOptions{
		Dialer: &net.Dialer{},
	}
	switch u.Scheme {
	case "tls", "ssl", "mqtts", "wss":
		o.TLSConfig = &tls.Config{
			ServerName: u.Hostname(),
		}
	}
	for _, opt := range opts {
		if err := opt(o); err != nil {
			return nil, err
		}
	}
	return o.dial(ctx, u)
}

// DialOption sets option for Dial.
type DialOption func(*DialOptions) error

// DialOptions stores options for Dial.
type DialOptions struct {
	Dialer        *net.Dialer
	TLSConfig     *tls.Config
	ConnState     func(ConnState, error)
	MaxPayloadLen int
}

// WithDialer sets dialer.
func WithDialer(dialer *net.Dialer) DialOption {
	return func(o *DialOptions) error {
		o.Dialer = dialer
		return nil
	}
}

// WithTLSConfig sets TLS configuration.
func WithTLSConfig(config *tls.Config) DialOption {
	return func(o *DialOptions) error {
		o.TLSConfig = config
		return nil
	}
}

// WithTLSCertFiles loads certificate files
func WithTLSCertFiles(host, caFile, certFile, privateKeyFile string) DialOption {
	return func(o *DialOptions) error {
		certpool := x509.NewCertPool()
		cas, err := ioutil.ReadFile(caFile)
		if err != nil {
			return err
		}
		certpool.AppendCertsFromPEM(cas)

		cert, err := tls.LoadX509KeyPair(certFile, privateKeyFile)
		if err != nil {
			return err
		}

		if o.TLSConfig == nil {
			o.TLSConfig = &tls.Config{}
		}
		o.TLSConfig.ServerName = host
		o.TLSConfig.RootCAs = certpool
		o.TLSConfig.Certificates = []tls.Certificate{cert}
		return nil
	}
}

// WithMaxPayloadLen sets maximum payload length of the BaseClient.
func WithMaxPayloadLen(l int) DialOption {
	return func(o *DialOptions) error {
		o.MaxPayloadLen = l
		return nil
	}
}

// WithConnStateHandler sets connection state change handler.
func WithConnStateHandler(handler func(ConnState, error)) DialOption {
	return func(o *DialOptions) error {
		o.ConnState = handler
		return nil
	}
}

func (d *DialOptions) dial(ctx context.Context, u *url.URL) (*BaseClient, error) {
	c := &BaseClient{
		ConnState:     d.ConnState,
		MaxPayloadLen: d.MaxPayloadLen,
	}

	switch u.Scheme {
	case "tcp", "mqtt", "tls", "ssl", "mqtts", "wss", "ws":
	default:
		return nil, wrapErrorf(ErrUnsupportedProtocol, "protocol %s", u.Scheme)
	}
	hostWithPort := u.Host
	if u.Port() == "" {
		if port, ok := defaultPorts[u.Scheme]; ok {
			hostWithPort += fmt.Sprintf(":%d", port)
		}
	}

	baseConn, err := d.Dialer.DialContext(ctx, "tcp", hostWithPort)
	if err != nil {
		return nil, wrapError(err, "dialing tcp")
	}
	switch u.Scheme {
	case "tcp", "mqtt":
		c.Transport = baseConn
	case "tls", "ssl", "mqtts":
		c.Transport = tls.Client(baseConn, d.TLSConfig)
	case "wss":
		baseConn = tls.Client(baseConn, d.TLSConfig)
		fallthrough
	case "ws":
		wsc, err := websocket.NewConfig(u.String(), fmt.Sprintf("https://%s", u.Host))
		if err != nil {
			return nil, wrapError(err, "configuring websocket")
		}
		wsc.Protocol = append(wsc.Protocol, "mqtt")
		wsc.TlsConfig = d.TLSConfig
		ws, err := websocket.NewClient(wsc, baseConn)
		if err != nil {
			return nil, wrapError(err, "dialing websocket")
		}
		ws.PayloadType = websocket.BinaryFrame
		c.Transport = ws
	}
	return c, nil
}

// BaseClientStoreDialer is a dialer wrapper which stores the latest BaseClient.
type BaseClientStoreDialer struct {
	// Dialer is a wrapped dialer. Valid Dialer must be set before use.
	Dialer

	mu         sync.RWMutex
	baseClient *BaseClient
}

// DialContext creates a new BaseClient.
func (d *BaseClientStoreDialer) DialContext(ctx context.Context) (*BaseClient, error) {
	cli, err := d.Dialer.DialContext(ctx)
	d.mu.Lock()
	d.baseClient = cli
	d.mu.Unlock()
	return cli, err
}

// BaseClient returns latest BaseClient created by the dialer.
// It returns nil before the first call of Dial.
func (d *BaseClientStoreDialer) BaseClient() *BaseClient {
	d.mu.RLock()
	cli := d.baseClient
	d.mu.RUnlock()
	return cli
}
