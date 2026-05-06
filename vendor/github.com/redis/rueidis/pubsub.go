package rueidis

import (
	"sync"
	"sync/atomic"
)

// PubSubMessage represent a pubsub message from redis
type PubSubMessage struct {
	// Pattern is only available with pmessage.
	Pattern string
	// Channel is the channel the message belongs to
	Channel string
	// Message is the message content
	Message string
}

// PubSubSubscription represent a pubsub "subscribe", "unsubscribe", "psubscribe" or "punsubscribe" event.
type PubSubSubscription struct {
	// Kind is "subscribe", "unsubscribe", "psubscribe" or "punsubscribe"
	Kind string
	// Channel is the event subject.
	Channel string
	// Count is the current number of subscriptions for connection.
	Count int64
}

// PubSubHooks can be registered into DedicatedClient to process pubsub messages without using Client.Receive
type PubSubHooks struct {
	// OnMessage will be called when receiving "message" and "pmessage" event.
	OnMessage func(m PubSubMessage)
	// OnSubscription will be called when receiving "subscribe", "unsubscribe", "psubscribe" and "punsubscribe" event.
	OnSubscription func(s PubSubSubscription)
}

func (h *PubSubHooks) isZero() bool {
	return h.OnMessage == nil && h.OnSubscription == nil
}

func newSubs() *subs {
	return &subs{chs: make(map[string]chs), sub: make(map[uint64]*sub)}
}

type subs struct {
	chs map[string]chs
	sub map[uint64]*sub
	cnt uint64
	mu  sync.RWMutex
}

type chs struct {
	sub map[uint64]*sub
}

type sub struct {
	ch chan PubSubMessage
	cs []string
}

func (s *subs) Publish(channel string, msg PubSubMessage) {
	if atomic.LoadUint64(&s.cnt) != 0 {
		s.mu.RLock()
		for _, sb := range s.chs[channel].sub {
			sb.ch <- msg
		}
		s.mu.RUnlock()
	}
}

func (s *subs) Subscribe(channels []string) (ch chan PubSubMessage, cancel func()) {
	id := atomic.AddUint64(&s.cnt, 1)
	s.mu.Lock()
	if s.chs != nil {
		ch = make(chan PubSubMessage, 16)
		sb := &sub{cs: channels, ch: ch}
		s.sub[id] = sb
		for _, channel := range channels {
			c := s.chs[channel].sub
			if c == nil {
				c = make(map[uint64]*sub, 1)
				s.chs[channel] = chs{sub: c}
			}
			c[id] = sb
		}
		cancel = func() {
			go func() {
				for range ch {
				}
			}()
			s.mu.Lock()
			if s.chs != nil {
				s.remove(id)
			}
			s.mu.Unlock()
		}
	}
	s.mu.Unlock()
	return ch, cancel
}

func (s *subs) remove(id uint64) {
	if sb := s.sub[id]; sb != nil {
		for _, channel := range sb.cs {
			if c := s.chs[channel].sub; c != nil {
				delete(c, id)
			}
		}
		close(sb.ch)
		delete(s.sub, id)
	}
}

func (s *subs) Unsubscribe(channel string) {
	if atomic.LoadUint64(&s.cnt) != 0 {
		s.mu.Lock()
		for id := range s.chs[channel].sub {
			s.remove(id)
		}
		delete(s.chs, channel)
		s.mu.Unlock()
	}
}

func (s *subs) Close() {
	var sbs map[uint64]*sub
	s.mu.Lock()
	sbs = s.sub
	s.chs = nil
	s.sub = nil
	s.mu.Unlock()
	for _, sb := range sbs {
		close(sb.ch)
	}
}
