// Copyright 2018 Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cluster

import (
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/gogo/protobuf/proto"
	"github.com/hashicorp/memberlist"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/prometheus/alertmanager/cluster/clusterpb"
)

// Channel allows clients to send messages for a specific state type that will be
// broadcasted in a best-effort manner.
type Channel struct {
	key          string
	send         func([]byte)
	peers        func() []*memberlist.Node
	sendOversize func(*memberlist.Node, []byte) error

	msgc   chan []byte
	logger log.Logger

	oversizeGossipMessageFailureTotal prometheus.Counter
	oversizeGossipMessageDroppedTotal prometheus.Counter
	oversizeGossipMessageSentTotal    prometheus.Counter
	oversizeGossipDuration            prometheus.Histogram
}

// NewChannel creates a new Channel struct, which handles sending normal and
// oversize messages to peers.
func NewChannel(
	key string,
	send func([]byte),
	peers func() []*memberlist.Node,
	sendOversize func(*memberlist.Node, []byte) error,
	logger log.Logger,
	stopc chan struct{},
	reg prometheus.Registerer,
) *Channel {
	oversizeGossipMessageFailureTotal := prometheus.NewCounter(prometheus.CounterOpts{
		Name:        "alertmanager_oversized_gossip_message_failure_total",
		Help:        "Number of oversized gossip message sends that failed.",
		ConstLabels: prometheus.Labels{"key": key},
	})
	oversizeGossipMessageSentTotal := prometheus.NewCounter(prometheus.CounterOpts{
		Name:        "alertmanager_oversized_gossip_message_sent_total",
		Help:        "Number of oversized gossip message sent.",
		ConstLabels: prometheus.Labels{"key": key},
	})
	oversizeGossipMessageDroppedTotal := prometheus.NewCounter(prometheus.CounterOpts{
		Name:        "alertmanager_oversized_gossip_message_dropped_total",
		Help:        "Number of oversized gossip messages that were dropped due to a full message queue.",
		ConstLabels: prometheus.Labels{"key": key},
	})
	oversizeGossipDuration := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:                            "alertmanager_oversize_gossip_message_duration_seconds",
		Help:                            "Duration of oversized gossip message requests.",
		ConstLabels:                     prometheus.Labels{"key": key},
		Buckets:                         prometheus.DefBuckets,
		NativeHistogramBucketFactor:     1.1,
		NativeHistogramMaxBucketNumber:  100,
		NativeHistogramMinResetDuration: 1 * time.Hour,
	})

	reg.MustRegister(oversizeGossipDuration, oversizeGossipMessageFailureTotal, oversizeGossipMessageDroppedTotal, oversizeGossipMessageSentTotal)

	c := &Channel{
		key:                               key,
		send:                              send,
		peers:                             peers,
		logger:                            logger,
		msgc:                              make(chan []byte, 200),
		sendOversize:                      sendOversize,
		oversizeGossipMessageFailureTotal: oversizeGossipMessageFailureTotal,
		oversizeGossipMessageDroppedTotal: oversizeGossipMessageDroppedTotal,
		oversizeGossipMessageSentTotal:    oversizeGossipMessageSentTotal,
		oversizeGossipDuration:            oversizeGossipDuration,
	}

	go c.handleOverSizedMessages(stopc)

	return c
}

// handleOverSizedMessages prevents memberlist from opening too many parallel
// TCP connections to its peers.
func (c *Channel) handleOverSizedMessages(stopc chan struct{}) {
	var wg sync.WaitGroup
	for {
		select {
		case b := <-c.msgc:
			for _, n := range c.peers() {
				wg.Add(1)
				go func(n *memberlist.Node) {
					defer wg.Done()
					c.oversizeGossipMessageSentTotal.Inc()
					start := time.Now()
					if err := c.sendOversize(n, b); err != nil {
						level.Debug(c.logger).Log("msg", "failed to send reliable", "key", c.key, "node", n, "err", err)
						c.oversizeGossipMessageFailureTotal.Inc()
						return
					}
					c.oversizeGossipDuration.Observe(time.Since(start).Seconds())
				}(n)
			}

			wg.Wait()
		case <-stopc:
			return
		}
	}
}

// Broadcast enqueues a message for broadcasting.
func (c *Channel) Broadcast(b []byte) {
	b, err := proto.Marshal(&clusterpb.Part{Key: c.key, Data: b})
	if err != nil {
		return
	}

	if OversizedMessage(b) {
		select {
		case c.msgc <- b:
		default:
			level.Debug(c.logger).Log("msg", "oversized gossip channel full")
			c.oversizeGossipMessageDroppedTotal.Inc()
		}
	} else {
		c.send(b)
	}
}

// OversizedMessage indicates whether or not the byte payload should be sent
// via TCP.
func OversizedMessage(b []byte) bool {
	return len(b) > MaxGossipPacketSize/2
}
