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
	c.subSyncMu.Lock()
	s, ok := c.subSync[channel]
	if !ok {
		c.subSyncMu.Unlock()
		syncedFn()
		return
	}
	c.subSyncMu.Unlock()

	if atomic.LoadUint32(&s.inSubscribe) == 1 {
		// client currently in process of subscribing to the channel. In this case we keep
		// publications in a slice buffer. Publications from this temporary buffer will be sent in
		// subscribe reply.
		s.pubBufferMu.Lock()
		if atomic.LoadUint32(&s.inSubscribe) == 1 {
			// Sync point not reached yet - put Publication to tmp slice.
			s.pubBuffer = append(s.pubBuffer, pub)
			s.pubBufferMu.Unlock()
			return
		}
		// Sync point already passed - send Publication into connection.
		s.pubBufferMu.Unlock()
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

func (c *PubSubSync) LockBufferAndReadBuffered(channel string) []*protocol.Publication {
	c.subSyncMu.Lock()
	s, ok := c.subSync[channel]
	if !ok {
		c.subSyncMu.Unlock()
		return nil
	}
	s.pubBufferLocked = true
	c.subSyncMu.Unlock()
	s.pubBufferMu.Lock() // Since this point and until StopBuffering pubBufferMu will be locked so that SyncPublication waits till pubBufferMu unlocking.
	pubs := make([]*protocol.Publication, len(s.pubBuffer))
	copy(pubs, s.pubBuffer)
	s.pubBuffer = nil
	return pubs
}
