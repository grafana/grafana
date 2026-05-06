package centrifuge

import (
	"errors"
	"io"
	"sync"
	"time"

	"github.com/centrifugal/centrifuge/internal/queue"
	"github.com/centrifugal/centrifuge/internal/timers"

	"github.com/centrifugal/protocol"
)

var errNoSubscription = errors.New("no subscription to a channel")

// WritePublication allows sending publications to Client subscription directly
// without HUB and Broker semantics. The possible use case is to turn subscription
// to a channel into an individual data stream.
// This API is EXPERIMENTAL and may be changed/removed.
func (c *Client) WritePublication(channel string, publication *Publication, sp StreamPosition) error {
	if !c.IsSubscribed(channel) {
		return errNoSubscription
	}

	pub := pubToProto(publication)
	protoType := c.transport.Protocol().toProto()

	maxBatchSize, maxBatchDelay := c.node.getBatchConfig(channel)

	if protoType == protocol.TypeJSON {
		if c.transport.Unidirectional() {
			push := &protocol.Push{Channel: channel, Pub: pub}
			var err error
			jsonPush, err := protocol.DefaultJsonPushEncoder.Encode(push)
			if err != nil {
				go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(c)
				return err
			}
			return c.writePublicationNoDelta(channel, pub, jsonPush, sp, maxBatchSize, maxBatchDelay)
		} else {
			push := &protocol.Push{Channel: channel, Pub: pub}
			var err error
			jsonReply, err := protocol.DefaultJsonReplyEncoder.Encode(&protocol.Reply{Push: push})
			if err != nil {
				go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(c)
				return err
			}
			return c.writePublicationNoDelta(channel, pub, jsonReply, sp, maxBatchSize, maxBatchDelay)
		}
	} else if protoType == protocol.TypeProtobuf {
		if c.transport.Unidirectional() {
			push := &protocol.Push{Channel: channel, Pub: pub}
			var err error
			protobufPush, err := protocol.DefaultProtobufPushEncoder.Encode(push)
			if err != nil {
				return err
			}
			return c.writePublicationNoDelta(channel, pub, protobufPush, sp, maxBatchSize, maxBatchDelay)
		} else {
			push := &protocol.Push{Channel: channel, Pub: pub}
			var err error
			protobufReply, err := protocol.DefaultProtobufReplyEncoder.Encode(&protocol.Reply{Push: push})
			if err != nil {
				return err
			}
			return c.writePublicationNoDelta(channel, pub, protobufReply, sp, maxBatchSize, maxBatchDelay)
		}
	}

	return errors.New("unknown protocol type")
}

// AcquireStorage returns an attached connection storage (a map) and a function to be
// called when the application finished working with the storage map. Be accurate when
// using this API – avoid acquiring storage for a long time - i.e. on the time of IO operations.
// Do the work fast and release with the updated map. The API designed this way to allow
// reading, modifying or fully overriding storage map and avoid making deep copies each time.
// Note, that if storage map has not been initialized yet - i.e. if it's nil - then it will
// be initialized to an empty map and then returned – so you never receive nil map when
// acquiring. The purpose of this map is to simplify handling user-defined state during the
// lifetime of connection. Try to keep this map reasonably small.
// This API is EXPERIMENTAL and may be changed/removed.
func (c *Client) AcquireStorage() (map[string]any, func(map[string]any)) {
	c.storageMu.Lock()
	if c.storage == nil {
		c.storage = map[string]any{}
	}
	return c.storage, func(updatedStorage map[string]any) {
		c.storage = updatedStorage
		c.storageMu.Unlock()
	}
}

// OnStateSnapshot allows settings StateSnapshotHandler.
// This API is EXPERIMENTAL and may be changed/removed.
func (c *Client) OnStateSnapshot(h StateSnapshotHandler) {
	c.eventHub.stateSnapshotHandler = h
}

// StateSnapshot allows collecting current state copy.
// Mostly useful for connection introspection from the outside.
// This API is EXPERIMENTAL and may be changed/removed.
func (c *Client) StateSnapshot() (any, error) {
	if c.eventHub.stateSnapshotHandler != nil {
		return c.eventHub.stateSnapshotHandler()
	}
	return nil, nil
}

func (c *Client) writeQueueItems(items []queue.Item) error {
	disconnect := c.messageWriter.enqueueMany(items...)
	if disconnect != nil {
		// close in goroutine to not block message broadcast.
		go func() { _ = c.close(*disconnect) }()
		return io.EOF
	}
	return nil
}

// ChannelBatchConfig allows configuring how to write push messages to a channel
// during broadcasts (applied for publication, join and leave pushes).
// This API is EXPERIMENTAL and may be changed/removed.
// If MaxSize is set to 0 then no batching by size will be performed.
// If MaxDelay is set to 0 then no batching by time will be performed.
// If both MaxSize and MaxDelay are set to 0 then no batching will be performed.
type ChannelBatchConfig struct {
	// MaxSize is the maximum number of messages to batch before flushing.
	MaxSize int64
	// MaxDelay is the maximum time to wait before flushing.
	MaxDelay time.Duration
}

// channelWriter buffers queue.Item objects and flushes them after a fixed delay
// or when a specific batch size is reached.
type channelWriter struct {
	mu      sync.Mutex
	buffer  []queue.Item
	timer   *time.Timer
	flushFn func([]queue.Item) error
}

// newChannelWriter creates a new channelWriter with the given delay and maxBatchSize.
func newChannelWriter(flushFn func([]queue.Item) error) *channelWriter {
	return &channelWriter{
		flushFn: flushFn,
	}
}

func (w *channelWriter) close(flushRemaining bool) {
	w.mu.Lock()
	if w.timer != nil {
		w.timer.Stop()
		w.timer = nil
	}
	if flushRemaining && len(w.buffer) > 0 { // If there are any buffered items, flush them.
		w.flushLocked()
	}
	w.buffer = nil
	w.mu.Unlock()
}

// Add appends an item to the buffer. It starts a delay timer if this is the first item,
// and flushes immediately if the batch size is reached.
func (w *channelWriter) Add(item queue.Item, ch string, maxBatchDelay time.Duration, maxBatchSize int64) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.buffer = append(w.buffer, item)
	if maxBatchDelay > 0 && len(w.buffer) == 1 && w.timer == nil { // Start the flush timer for the first item and if no active timer.
		w.timer = timers.AcquireTimer(maxBatchDelay)
		go w.waitTimer(w.timer, ch)
	}
	// Flush immediately if batch size is reached.
	if maxBatchSize > 0 && int64(len(w.buffer)) >= maxBatchSize {
		if w.timer != nil {
			w.timer.Stop()
			w.timer = nil // Set timer to nil so waitTimer knows it was cancelled.
		}
		w.flushLocked()
	}
}

// waitTimer waits for the timer to fire, then flushes the batch.
func (w *channelWriter) waitTimer(tm *time.Timer, ch string) {
	<-tm.C // Wait for the timer to fire.
	timers.ReleaseTimer(tm)
	w.mu.Lock()
	// Check if the timer is still active. If it’s not, it was already stopped and handled.
	if w.timer == nil {
		w.mu.Unlock()
		return
	}
	if len(w.buffer) > 0 { // If there are any items, flush the buffer.
		w.flushLocked()
	}
	w.timer = nil // Mark the timer as no longer active.
	w.mu.Unlock()
}

// flushLocked flushes the current buffer. It assumes the caller holds the lock.
func (w *channelWriter) flushLocked() {
	batch := w.buffer
	w.buffer = w.buffer[:0]
	_ = w.flushFn(batch)
}

// perChannelWriter groups items by configuration (batch size and delay).
type perChannelWriter struct {
	mu      sync.RWMutex
	writers map[string]*channelWriter
	flushFn func([]queue.Item) error
}

// newPerChannelWriter creates a new channel writer.
func newPerChannelWriter(flushFn func([]queue.Item) error) *perChannelWriter {
	return &perChannelWriter{
		writers: make(map[string]*channelWriter),
		flushFn: flushFn,
	}
}

// Close cancels all active timers in each channelWriter and discards any pending items.
func (pcw *perChannelWriter) Close(flushRemaining bool) {
	pcw.mu.Lock()
	defer pcw.mu.Unlock()
	for _, w := range pcw.writers {
		w.close(flushRemaining)
	}
}

// getWriter returns the channelWriter for the given channel's configuration,
// creating one if necessary.
func (pcw *perChannelWriter) getWriter(channel string) *channelWriter {
	pcw.mu.RLock()
	w, exists := pcw.writers[channel]
	pcw.mu.RUnlock()
	if !exists {
		pcw.mu.Lock()
		// Double-check existence after acquiring write lock.
		w, exists = pcw.writers[channel]
		if !exists {
			w = newChannelWriter(pcw.flushFn)
			pcw.writers[channel] = w
		}
		pcw.mu.Unlock()
	}
	return w
}

func (pcw *perChannelWriter) delWriter(channel string, flushRemaining bool) {
	pcw.mu.Lock()
	w, exists := pcw.writers[channel]
	if exists {
		w.close(flushRemaining)
		delete(pcw.writers, channel)
	}
	pcw.mu.Unlock()
}

// Add routes an item to its configuration-specific aggregator.
func (pcw *perChannelWriter) Add(item queue.Item, ch string, maxBatchDelay time.Duration, maxBatchSize int64) {
	w := pcw.getWriter(ch)
	w.Add(item, ch, maxBatchDelay, maxBatchSize)
}
