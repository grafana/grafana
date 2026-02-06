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
	"fmt"
	"strings"
	"sync"
	"time"
)

type reconnectClient struct {
	*RetryClient
	done         chan struct{}
	options      *ReconnectOptions
	dialer       Dialer
	disconnected chan struct{}
}

// ReconnectClient is a Client with reconnect and retry features.
type ReconnectClient interface {
	Client
	Retryer
}

// NewReconnectClient creates a MQTT client with re-connect/re-publish/re-subscribe features.
func NewReconnectClient(dialer Dialer, opts ...ReconnectOption) (ReconnectClient, error) {
	options := &ReconnectOptions{
		ReconnectWaitBase: time.Second,
		ReconnectWaitMax:  10 * time.Second,
		RetryClient:       &RetryClient{},
	}
	for _, opt := range opts {
		if err := opt(options); err != nil {
			return nil, err
		}
	}
	return &reconnectClient{
		RetryClient:  options.RetryClient,
		done:         make(chan struct{}),
		disconnected: make(chan struct{}),
		options:      options,
		dialer:       dialer,
	}, nil
}

// Connect starts connection retry loop.
// The function returns after establishing a first connection, which can be canceled by the context.
// Once after establishing the connection, the retry loop is not affected by the context.
func (c *reconnectClient) Connect(ctx context.Context, clientID string, opts ...ConnectOption) (bool, error) {
	connOptions := &ConnectOptions{}
	for _, opt := range opts {
		if err := opt(connOptions); err != nil {
			return false, err
		}
	}
	if c.options.PingInterval == time.Duration(0) {
		c.options.PingInterval = time.Duration(connOptions.KeepAlive) * time.Second
	}
	if c.options.Timeout == time.Duration(0) {
		c.options.Timeout = c.options.PingInterval
	}

	var errDial, errConnect firstError

	done := make(chan bool, 1)
	var doneOnce sync.Once
	go func(ctx context.Context) {
		defer func() {
			close(c.done)
		}()
		reconnWait := c.options.ReconnectWaitBase
		var initialized bool
		for {
			if baseCli, err := c.dialer.DialContext(ctx); err == nil {
				c.RetryClient.SetClient(ctx, baseCli)

				ctxConnect, cancelConnect := c.options.timeoutContext(ctx)

				if sessionPresent, err := c.RetryClient.Connect(ctxConnect, clientID, opts...); err == nil {
					cancelConnect()

					reconnWait = c.options.ReconnectWaitBase // Reset reconnect wait.
					doneOnce.Do(func() {
						ctx = context.Background()
						done <- sessionPresent
						close(done)
					})

					if initialized && (!sessionPresent || c.options.AlwaysResubscribe) {
						c.RetryClient.Resubscribe(ctx)
					}
					c.RetryClient.Retry(ctx)
					initialized = true

					ctxKeepAlive, cancelKeepAlive := context.WithCancel(ctx)
					if c.options.PingInterval > time.Duration(0) {
						// Start keep alive.
						go func() {
							if err := KeepAlive(
								ctxKeepAlive, baseCli,
								c.options.PingInterval,
								c.options.Timeout,
							); err != nil {
								c.Client().SetErrorOnce(err)
								// The client should close the connection if PINGRESP is not returned.
								// MQTT 3.1.1 spec. 3.1.2.10
								baseCli.Close()
							}
						}()
					}
					select {
					case <-baseCli.Done():
						cancelKeepAlive()
						if err := baseCli.Err(); err == nil {
							// Disconnected as expected; don't restart.
							return
						}
					case <-ctx.Done():
						cancelKeepAlive()
						// User cancelled; don't restart.
						return
					case <-c.disconnected:
						cancelKeepAlive()
						return
					}
				} else if err != ctxConnect.Err() {
					errConnect.Store(err) // Hold first connect error excepting context cancel.
				}
				cancelConnect()

				// Close baseCli to avoid unordered state callback
				baseCli.Close()
				// baseCli.Done() should be returned immediately if no incoming message callback is not blocked
				<-baseCli.Done()
			} else if err != ctx.Err() {
				errDial.Store(err) // Hold first dial error excepting context cancel.
			}
			select {
			case <-time.After(reconnWait):
			case <-ctx.Done():
				// User cancelled; don't restart.
				return
			case <-c.disconnected:
				return
			}
			reconnWait *= 2
			if reconnWait > c.options.ReconnectWaitMax {
				reconnWait = c.options.ReconnectWaitMax
			}
		}
	}(ctx)
	select {
	case sessionPresent := <-done:
		return sessionPresent, nil
	case <-ctx.Done():
		var actualErrs []string
		if err := errDial.Load(); err != nil {
			actualErrs = append(actualErrs, fmt.Sprintf("dial: %v", err))
		}
		if err := errConnect.Load(); err != nil {
			actualErrs = append(actualErrs, fmt.Sprintf("connect: %v", err))
		}
		var errStr string
		if len(actualErrs) > 0 {
			errStr = fmt.Sprintf(" (%s)", strings.Join(actualErrs, ", "))
		}
		return false, wrapErrorf(ctx.Err(), "establishing first connection%s", errStr)
	}
}

// Disconnect from the broker.
func (c *reconnectClient) Disconnect(ctx context.Context) error {
	close(c.disconnected)
	err := c.RetryClient.Disconnect(ctx)
	select {
	case <-c.done:
	case <-ctx.Done():
		return wrapError(ctx.Err(), "disconnecting")
	}
	return err
}

// ReconnectOptions represents options for Connect.
type ReconnectOptions struct {
	ConnectOptions    []ConnectOption
	Timeout           time.Duration
	ReconnectWaitBase time.Duration
	ReconnectWaitMax  time.Duration
	PingInterval      time.Duration
	RetryClient       *RetryClient
	AlwaysResubscribe bool
}

func (c *ReconnectOptions) timeoutContext(ctx context.Context) (context.Context, func()) {
	if c.Timeout == 0 {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, c.Timeout)
}

// ReconnectOption sets option for Connect.
type ReconnectOption func(*ReconnectOptions) error

// WithTimeout sets timeout duration of server response.
// Default value is PingInterval.
func WithTimeout(timeout time.Duration) ReconnectOption {
	return func(o *ReconnectOptions) error {
		o.Timeout = timeout
		return nil
	}
}

// WithReconnectWait sets parameters of incremental reconnect wait.
func WithReconnectWait(base, max time.Duration) ReconnectOption {
	return func(o *ReconnectOptions) error {
		o.ReconnectWaitBase = base
		o.ReconnectWaitMax = max
		return nil
	}
}

// WithPingInterval sets ping request interval.
// Default value is KeepAlive value set by ConnectOption.
func WithPingInterval(interval time.Duration) ReconnectOption {
	return func(o *ReconnectOptions) error {
		o.PingInterval = interval
		return nil
	}
}

// WithRetryClient sets RetryClient.
// Default value is zero RetryClient.
func WithRetryClient(cli *RetryClient) ReconnectOption {
	return func(o *ReconnectOptions) error {
		o.RetryClient = cli
		return nil
	}
}

// WithAlwaysResubscribe enables or disables re-subscribe on reconnect.
// Default value is false.
// This option can be used to ensure all subscriptions are restored
// even if the server is buggy.
func WithAlwaysResubscribe(always bool) ReconnectOption {
	return func(o *ReconnectOptions) error {
		o.AlwaysResubscribe = always
		return nil
	}
}
