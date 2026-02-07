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

// Package mqtt is a thread safe and context controlled MQTT 3.1.1 client library.
package mqtt

import (
	"context"
)

// QoS represents quality of service level.
type QoS uint8

// QoS values.
const (
	QoS0             QoS = 0x00 // At most once delivery
	QoS1             QoS = 0x01 // At least once delivery
	QoS2             QoS = 0x02 // Exactly once delivery
	SubscribeFailure QoS = 0x80 // Rejected to subscribe
)

// Subscription represents MQTT subscription target.
type Subscription struct {
	Topic string
	QoS   QoS
}

// Client is the interface of MQTT client.
type Client interface {
	Connect(ctx context.Context, clientID string, opts ...ConnectOption) (sessionPresent bool, err error)
	Disconnect(ctx context.Context) error
	Publish(ctx context.Context, message *Message) error
	Subscribe(ctx context.Context, subs ...Subscription) ([]Subscription, error)
	Unsubscribe(ctx context.Context, subs ...string) error
	Ping(ctx context.Context) error
	Handle(Handler)
}

// Closer is the interface of connection closer.
type Closer interface {
	Close() error
	Done() <-chan struct{}
	Err() error
}

// ClientCloser groups Client and Closer interface
type ClientCloser interface {
	Client
	Closer
}

// HandlerFunc type is an adapter to use functions as MQTT message handler.
type HandlerFunc func(*Message)

// Serve calls h(message).
func (h HandlerFunc) Serve(message *Message) {
	h(message)
}

// Handler receives an MQTT message.
type Handler interface {
	Serve(*Message)
}

// ConnState represents the status of MQTT connection.
type ConnState int

// ConnState values.
const (
	StateNew          ConnState = iota // initial state
	StateActive                        // connected to the broker
	StateClosed                        // connection is unexpectedly closed
	StateDisconnected                  // connection is expectedly closed
)

var connStateString = map[ConnState]string{
	StateNew:          "New",
	StateActive:       "Active",
	StateClosed:       "Closed",
	StateDisconnected: "Disconnected",
}

func (s ConnState) String() string {
	if str, ok := connStateString[s]; ok {
		return str
	}
	return "Unknown"
}
