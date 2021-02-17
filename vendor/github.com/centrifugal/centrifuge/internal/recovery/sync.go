package recovery

import (
	"sync"
	"sync/atomic"

	"github.com/centrifugal/protocol"
)

// PubSubSync wraps logic to synchronize recovery with PUB/SUB.
type PubSubSync struct {
	subSyncMu sync.RWMutex
	subSync   map[string]*subscribeState
}

// NewPubSubSync creates new PubSubSyncer.
func NewPubSubSync() *PubSubSync {
	return &PubSubSync{
		subSync: make(map[string]*subscribeState),
	}
}

type subscribeState struct {
	// The following fields help us to synchronize PUB/SUB and history messages
	// during publication recovery process in channel.
	inSubscribe     uint32
	pubBufferMu     sync.Mutex
	pubBufferLocked bool
	pubBuffer       []*protocol.Publication
}

// SyncPublication ...
func (c *PubSubSync) SyncPublication(channel string, pub *protocol.Publication, syncedFn func()) {
	if c.isInSubscribe(channel) {
		// Client currently in process of subscribing to this channel. In this case we keep
		// publications in slice buffer. Publications from this temporary buffer will be sent in
		// subscribe reply.
		c.LockBuffer(channel)
		if c.isInSubscribe(channel) {
			// Sync point not reached yet - put Publication to tmp slice.
			c.appendPubToBuffer(channel, pub)
			c.unlockBuffer(channel)
			return
		}
		// Sync point already passed - send Publication into connection.
		c.unlockBuffer(channel)
	}
	syncedFn()
}

// StartBuffering ...
func (c *PubSubSync) StartBuffering(channel string) {
	c.subSyncMu.Lock()
	defer c.subSyncMu.Unlock()
	s := &subscribeState{}
	c.subSync[channel] = s
	atomic.StoreUint32(&s.inSubscribe, 1)
}

// StopBuffering ...
func (c *PubSubSync) StopBuffering(channel string) {
	c.subSyncMu.Lock()
	defer c.subSyncMu.Unlock()
	s, ok := c.subSync[channel]
	if !ok {
		return
	}
	atomic.StoreUint32(&s.inSubscribe, 0)
	if s.pubBufferLocked {
		s.pubBufferMu.Unlock()
	}
	delete(c.subSync, channel)
}

func (c *PubSubSync) isInSubscribe(channel string) bool {
	c.subSyncMu.RLock()
	defer c.subSyncMu.RUnlock()
	s, ok := c.subSync[channel]
	if !ok {
		return false
	}
	return atomic.LoadUint32(&s.inSubscribe) == 1
}

// LockBuffer ...
func (c *PubSubSync) LockBuffer(channel string) {
	c.subSyncMu.Lock()
	s, ok := c.subSync[channel]
	if !ok {
		c.subSyncMu.Unlock()
		return
	}
	s.pubBufferLocked = true
	c.subSyncMu.Unlock()
	s.pubBufferMu.Lock()
}

// UnlockBuffer ...
func (c *PubSubSync) unlockBuffer(channel string) {
	c.subSyncMu.Lock()
	defer c.subSyncMu.Unlock()
	s, ok := c.subSync[channel]
	if !ok {
		return
	}
	if s.pubBufferLocked {
		s.pubBufferMu.Unlock()
	}
}

func (c *PubSubSync) appendPubToBuffer(channel string, pub *protocol.Publication) {
	c.subSyncMu.RLock()
	defer c.subSyncMu.RUnlock()
	s := c.subSync[channel]
	s.pubBuffer = append(s.pubBuffer, pub)
}

// ReadBuffered ...
func (c *PubSubSync) ReadBuffered(channel string) []*protocol.Publication {
	c.subSyncMu.RLock()
	defer c.subSyncMu.RUnlock()
	s := c.subSync[channel]
	pubs := make([]*protocol.Publication, len(s.pubBuffer))
	copy(pubs, s.pubBuffer)
	s.pubBuffer = nil
	return pubs
}
