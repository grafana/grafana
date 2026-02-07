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
	"time"
)

// Ping to the broker.
func (c *BaseClient) Ping(ctx context.Context) error {
	c.muConnecting.RLock()
	defer c.muConnecting.RUnlock()

	sig, err := c.signaller()
	if err != nil {
		return err
	}
	chPingResp := make(chan *pktPingResp, 1)
	sig.mu.Lock()
	sig.chPingResp = chPingResp
	sig.mu.Unlock()

	pkt := pack(packetPingReq.b())

	tReq := time.Now()
	if err := c.write(pkt); err != nil {
		return wrapError(err, "sending PINGREQ")
	}
	select {
	case <-c.connClosed:
		return wrapError(ErrClosedTransport, "sending PINGREQ")
	case <-ctx.Done():
		c.storePingError()
		return wrapError(ctx.Err(), "waiting PINGRESP")
	case <-chPingResp:
		tRes := time.Now()
		c.storePingDelay(tRes.Sub(tReq))
	}
	return nil
}
