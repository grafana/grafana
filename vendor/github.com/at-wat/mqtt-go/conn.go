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
	"errors"
)

// ErrClosedTransport means that the underlying connection is closed.
var ErrClosedTransport = errors.New("read/write on closed transport")

// SetErrorOnce sets client error value if not yet set.
func (c *BaseClient) SetErrorOnce(err error) {
	c.muErr.Lock()
	if c.err == nil {
		c.err = err
	}
	c.muErr.Unlock()
}

func (c *BaseClient) connStateUpdate(newState ConnState) {
	c.mu.Lock()
	lastState := c.connState
	if c.connState != StateDisconnected {
		c.connState = newState
	}
	state := c.connState
	err := c.Err()
	c.mu.Unlock()

	if c.ConnState != nil && lastState != state {
		c.ConnState(state, err)
	}
}

// Close force closes MQTT connection.
func (c *BaseClient) Close() error {
	return c.Transport.Close()
}

// Done is a channel to signal connection close.
func (c *BaseClient) Done() <-chan struct{} {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.connClosed
}

// Err returns connection error.
func (c *BaseClient) Err() error {
	c.muErr.RLock()
	defer c.muErr.RUnlock()
	return c.err
}
