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
	"errors"
)

// ProtocolLevel represents MQTT protocol level.
type ProtocolLevel byte

// ProtocolLevel values.
const (
	ProtocolLevel3 ProtocolLevel = 0x03 // MQTT 3.1
	ProtocolLevel4 ProtocolLevel = 0x04 // MQTT 3.1.1 (default)
)

type connectFlag byte

const (
	connectFlagCleanSession connectFlag = 0x02
	connectFlagWill         connectFlag = 0x04
	connectFlagWillQoS0     connectFlag = 0x00
	connectFlagWillQoS1     connectFlag = 0x08
	connectFlagWillQoS2     connectFlag = 0x10
	connectFlagWillRetain   connectFlag = 0x20
	connectFlagPassword     connectFlag = 0x40
	connectFlagUserName     connectFlag = 0x80
)

type pktConnect struct {
	ProtocolLevel ProtocolLevel
	CleanSession  bool
	KeepAlive     uint16
	ClientID      string
	UserName      string
	Password      string
	Will          *Message
}

func (p *pktConnect) Pack() []byte {
	payload := make([]byte, 0, packetBufferCap)
	payload = appendString(payload, p.ClientID)

	var flag byte
	if p.CleanSession {
		flag |= byte(connectFlagCleanSession)
	}
	if p.Will != nil {
		flag |= byte(connectFlagWill)
		switch p.Will.QoS {
		case QoS0:
			flag |= byte(connectFlagWillQoS0)
		case QoS1:
			flag |= byte(connectFlagWillQoS1)
		case QoS2:
			flag |= byte(connectFlagWillQoS2)
		}
		if p.Will.Retain {
			flag |= byte(connectFlagWillRetain)
		}
		payload = appendString(payload, p.Will.Topic)
		payload = appendBytes(payload, p.Will.Payload)
	}
	if p.UserName != "" {
		flag |= byte(connectFlagUserName)
		payload = appendString(payload, p.UserName)
	}
	if p.Password != "" {
		flag |= byte(connectFlagPassword)
		payload = appendString(payload, p.Password)
	}
	return pack(
		packetConnect.b(),
		[]byte{
			0x00, 0x04, 0x4D, 0x51, 0x54, 0x54,
			byte(p.ProtocolLevel),
			flag,
		},
		packUint16(p.KeepAlive),
		payload,
	)
}

func (c *BaseClient) init() {
	c.sig = &signaller{}
	c.mu.Lock()
	c.connClosed = make(chan struct{})
	c.mu.Unlock()
	c.initID()
}

// Connect to the broker.
func (c *BaseClient) Connect(ctx context.Context, clientID string, opts ...ConnectOption) (sessionPresent bool, err error) {
	o := &ConnectOptions{
		ProtocolLevel: ProtocolLevel4,
	}
	for _, opt := range opts {
		if err := opt(o); err != nil {
			return false, wrapError(err, "applying options")
		}
	}
	c.init()
	c.muConnecting.Lock()
	defer c.muConnecting.Unlock()

	go func() {
		err := c.serve()
		if errConn := c.Close(); errConn != nil && err == nil {
			err = errConn
		}
		c.mu.Lock()
		if c.connState != StateDisconnected {
			c.SetErrorOnce(err)
		}
		c.mu.Unlock()
		c.connStateUpdate(StateClosed)
		close(c.connClosed)
	}()

	chConnAck := make(chan *pktConnAck, 1)
	c.mu.Lock()
	c.sig.chConnAck = chConnAck
	c.mu.Unlock()

	pkt := (&pktConnect{
		ProtocolLevel: o.ProtocolLevel,
		CleanSession:  o.CleanSession,
		KeepAlive:     o.KeepAlive,
		ClientID:      clientID,
		UserName:      o.UserName,
		Password:      o.Password,
		Will:          o.Will,
	}).Pack()

	if err := c.write(pkt); err != nil {
		return false, wrapError(err, "sending CONNECT")
	}
	select {
	case <-c.connClosed:
		return false, ErrClosedTransport
	case <-ctx.Done():
		return false, wrapError(ctx.Err(), "waiting CONNACK")
	case connAck := <-chConnAck:
		if connAck.Code != ConnectionAccepted {
			return false, wrapError(&ConnectionError{
				Err:  ErrConnectionFailed,
				Code: connAck.Code,
			}, "received CONNACK")
		}
		c.connStateUpdate(StateActive)
		return connAck.SessionPresent, nil
	}
}

// ErrConnectionFailed means the connection is not established.
var ErrConnectionFailed = errors.New("connection failed")

// ConnectionError ia a error storing connection return code.
type ConnectionError struct {
	Err  error
	Code ConnectionReturnCode
}

func (e *ConnectionError) Error() string {
	return e.Code.String() + ": " + e.Err.Error()
}

// Unwrap returns base error of ConnectionError. (for Go1.13 error unwrapping.)
func (e *ConnectionError) Unwrap() error {
	return e.Err
}

// ConnectOptions represents options for Connect.
type ConnectOptions struct {
	UserName      string
	Password      string
	CleanSession  bool
	KeepAlive     uint16
	Will          *Message
	ProtocolLevel ProtocolLevel
}

// ConnectOption sets option for Connect.
type ConnectOption func(*ConnectOptions) error

// WithUserNamePassword sets plain text auth information used in Connect.
func WithUserNamePassword(userName, password string) ConnectOption {
	return func(o *ConnectOptions) error {
		o.UserName = userName
		o.Password = password
		return nil
	}
}

// WithKeepAlive sets keep alive interval in seconds.
func WithKeepAlive(interval uint16) ConnectOption {
	return func(o *ConnectOptions) error {
		o.KeepAlive = interval
		return nil
	}
}

// WithCleanSession sets clean session flag.
func WithCleanSession(cleanSession bool) ConnectOption {
	return func(o *ConnectOptions) error {
		o.CleanSession = cleanSession
		return nil
	}
}

// WithWill sets will message.
func WithWill(will *Message) ConnectOption {
	return func(o *ConnectOptions) error {
		switch will.QoS {
		case QoS0, QoS1, QoS2:
		default:
			return wrapErrorf(ErrInvalidPacket, "setting will with QoS%d", int(will.QoS))
		}
		o.Will = will
		return nil
	}
}

// WithProtocolLevel sets protocol level.
func WithProtocolLevel(level ProtocolLevel) ConnectOption {
	return func(o *ConnectOptions) error {
		o.ProtocolLevel = level
		return nil
	}
}
