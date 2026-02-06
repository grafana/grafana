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

	if protoType == protocol.TypeJSON {
		if c.transport.Unidirectional() {
			push := &protocol.Push{Channel: channel, Pub: pub}
			var err error
			jsonPush, err := protocol.DefaultJsonPushEncoder.Encode(push)
			if err != nil {
				go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(c)
				return err
			}
			return c.writePublicationNoDelta(channel, pub, jsonPush, sp, c.node.getBatchConfig(channel))
		} else {
			push := &protocol.Push{Channel: channel, Pub: pub}
			var err error
			jsonReply, err := protocol.DefaultJsonReplyEncoder.Encode(&protocol.Reply{Push: push})
			if err != nil {
				go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(c)
				return err
			}
			return c.writePublicationNoDelta(channel, pub, jsonReply, sp, c.node.getBatchConfig(channel))
		}
	} else if protoType == protocol.TypeProtobuf {
		if c.transport.Unidirectional() {
			push := &protocol.Push{Channel: channel, Pub: pub}
			var err error
			protobufPush, err := protocol.DefaultProtobufPushEncoder.Encode(push)
			if err != nil {
				return err
			}
			return c.writePublicationNoDelta(channel, pub, protobufPush, sp, c.node.getBatchConfig(channel))
		} else {
			push := &protocol.Push{Channel: channel, Pub: pub}
			var err error
			protobufReply, err := protocol.DefaultProtobufReplyEncoder.Encode(&protocol.Reply{Push: push})
			if err != nil {
				return err
			}
			return c.writePublicationNoDelta(channel, pub, protobufReply, sp, c.node.getBatchConfig(channel))
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
	// FlushLatestPublication if true, then Centrifuge flushes only the latest publication
	// in the batch upon reaching the MaxSize or MaxDelay. Skipping on this level does
	// not work with delta compression.
	FlushLatestPublication bool
}

// channelWriter buffers queue.Item objects and flushes them after a fixed delay
// or when a specific batch size is reached.
type channelWriter struct {
	mu           sync.Mutex
	buffer       []queue.Item
	timer        *time.Timer
	flushFn      func([]queue.Item) error
	latestOnly   bool
	latestPub    queue.Item
	hasLatestPub bool
}

// newChannelWriter creates a new channelWriter with the given flush callback.
func newChannelWriter(flushFn func([]queue.Item) error) *channelWriter {
	return &channelWriter{flushFn: flushFn}
}

// close stops the timer and optionally flushes remaining items.
func (w *channelWriter) close(flushRemaining bool) {
	w.mu.Lock()
	if w.timer != nil {
		w.timer.Stop()
		w.timer = nil
	}
	if flushRemaining && (len(w.buffer) > 0 || w.hasLatestPub) {
		w.flushLocked()
	}
	w.buffer = nil
	w.hasLatestPub = false
	w.mu.Unlock()
}

// Add appends an item to the buffer or records it as the latest publication.
// It starts a delay timer if this is the first item, and flushes immediately if the batch size is reached.
func (w *channelWriter) Add(item queue.Item, config ChannelBatchConfig) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.latestOnly = config.FlushLatestPublication

	// If FlushLatestPublication is enabled and this is a publication, keep it separately
	if config.FlushLatestPublication && item.FrameType == protocol.FrameTypePushPublication {
		w.latestPub = item
		w.hasLatestPub = true
	} else {
		w.buffer = append(w.buffer, item)
	}

	// Total items count includes latestPub if present
	totalCount := len(w.buffer)
	if w.hasLatestPub {
		totalCount++
	}

	// Start timer on first item
	if config.MaxDelay > 0 && totalCount == 1 && w.timer == nil {
		w.timer = timers.AcquireTimer(config.MaxDelay)
		go w.waitTimer(w.timer)
	}

	// Flush immediately if batch size is reached
	if config.MaxSize > 0 && int64(totalCount) >= config.MaxSize {
		if w.timer != nil {
			w.timer.Stop()
			w.timer = nil // Set timer to nil so waitTimer knows it was cancelled.
		}
		w.flushLocked()
	}
}

// waitTimer waits for the timer to fire, then flushes the batch.
func (w *channelWriter) waitTimer(tm *time.Timer) {
	<-tm.C // Wait for the timer to fire.
	timers.ReleaseTimer(tm)
	w.mu.Lock()

	// If timer was stopped, do nothing
	if w.timer == nil {
		w.mu.Unlock()
		return
	}

	// Flush if any items exist
	if len(w.buffer) > 0 || w.hasLatestPub {
		w.flushLocked()
	}
	w.timer = nil // Mark the timer as no longer active.
	w.mu.Unlock()
}

// flushLocked flushes the current batch. Caller must hold the lock.
func (w *channelWriter) flushLocked() {
	// Nothing to do if no items.
	if len(w.buffer) == 0 && !w.hasLatestPub {
		return
	}

	var batch []queue.Item
	// Combine logic: if FlushLatestPublication and a latest publication exists, include all buffered items.
	// followed by that publication.
	if w.latestOnly && w.hasLatestPub {
		batch = append(batch, w.buffer...)
		batch = append(batch, w.latestPub)
	} else {
		// Otherwise, flush everything currently buffered.
		batch = w.buffer
	}

	w.buffer = w.buffer[:0]
	w.hasLatestPub = false
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
func (pcw *perChannelWriter) Add(item queue.Item, ch string, config ChannelBatchConfig) {
	w := pcw.getWriter(ch)
	w.Add(item, config)
}

// TimerCanceler is the interface returned from ScheduleTimer which allows the task to be cancelled.
// EXPERIMENTAL API.
type TimerCanceler interface {
	// Cancel the timer.
	Cancel()
}

// TimerScheduler is the interface for scheduling timers.
// EXPERIMENTAL API.
type TimerScheduler interface {
	// ScheduleTimer adds a callback for later execution. The TimerCanceler is returned.
	ScheduleTimer(duration time.Duration, callback func()) TimerCanceler
}
