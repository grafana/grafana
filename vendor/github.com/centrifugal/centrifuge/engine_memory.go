package centrifuge

import (
	"container/heap"
	"sync"
	"time"

	"github.com/centrifugal/centrifuge/internal/memstream"
	"github.com/centrifugal/centrifuge/internal/priority"
)

// MemoryEngine is builtin default Engine which allows to run Centrifuge-based
// server without any external broker or storage. All data managed inside process
// memory.
//
// With this engine you can only run single Centrifuge node. If you need to scale
// you should consider using another engine implementation instead – for example
// Redis engine.
//
// Running single node can be sufficient for many use cases especially when you
// need maximum performance and not too many online clients. Consider configuring
// your load balancer to have one backup Centrifuge node for HA in this case.
type MemoryEngine struct {
	node         *Node
	presenceHub  *presenceHub
	historyHub   *historyHub
	eventHandler BrokerEventHandler

	// pubLocks synchronize access to publishing. We have to sync publish
	// to handle publications in the order of offset to prevent InsufficientState
	// errors.
	// TODO: maybe replace with sharded pool of workers with buffered channels.
	pubLocks map[int]*sync.Mutex
}

var _ Engine = (*MemoryEngine)(nil)

// MemoryEngineConfig is a memory engine config.
type MemoryEngineConfig struct {
	// HistoryMetaTTL sets a time of inactive stream meta information expiration.
	// Must have a reasonable value for application.
	// At moment works with seconds precision.
	// TODO v1: maybe make this channel namespace option?
	// TODO v1: since we have epoch things should also properly work without meta
	// information at all (but we loose possibility of long-term recover in stream
	// without new messages).
	HistoryMetaTTL time.Duration
}

const numPubLocks = 4096

// NewMemoryEngine initializes Memory Engine.
func NewMemoryEngine(n *Node, c MemoryEngineConfig) (*MemoryEngine, error) {
	pubLocks := make(map[int]*sync.Mutex, numPubLocks)
	for i := 0; i < numPubLocks; i++ {
		pubLocks[i] = &sync.Mutex{}
	}
	e := &MemoryEngine{
		node:        n,
		presenceHub: newPresenceHub(),
		historyHub:  newHistoryHub(c.HistoryMetaTTL),
		pubLocks:    pubLocks,
	}
	return e, nil
}

// Run runs memory engine.
func (e *MemoryEngine) Run(h BrokerEventHandler) error {
	e.eventHandler = h
	e.historyHub.runCleanups()
	return nil
}

func (e *MemoryEngine) pubLock(ch string) *sync.Mutex {
	return e.pubLocks[index(ch, numPubLocks)]
}

// Publish adds message into history hub and calls node method to handle message.
// We don't have any PUB/SUB here as Memory Engine is single node only.
func (e *MemoryEngine) Publish(ch string, data []byte, opts PublishOptions) (StreamPosition, error) {
	mu := e.pubLock(ch)
	mu.Lock()
	defer mu.Unlock()

	pub := &Publication{
		Data: data,
		Info: opts.ClientInfo,
	}
	if opts.HistorySize > 0 && opts.HistoryTTL > 0 {
		streamTop, err := e.historyHub.add(ch, pub, opts)
		if err != nil {
			return StreamPosition{}, err
		}
		pub.Offset = streamTop.Offset
		return streamTop, e.eventHandler.HandlePublication(ch, pub)
	}
	return StreamPosition{}, e.eventHandler.HandlePublication(ch, pub)
}

// PublishJoin - see engine interface description.
func (e *MemoryEngine) PublishJoin(ch string, info *ClientInfo) error {
	return e.eventHandler.HandleJoin(ch, info)
}

// PublishLeave - see engine interface description.
func (e *MemoryEngine) PublishLeave(ch string, info *ClientInfo) error {
	return e.eventHandler.HandleLeave(ch, info)
}

// PublishControl - see Engine interface description.
func (e *MemoryEngine) PublishControl(data []byte) error {
	return e.eventHandler.HandleControl(data)
}

// Subscribe is noop here.
func (e *MemoryEngine) Subscribe(_ string) error {
	return nil
}

// Unsubscribe node from channel.
func (e *MemoryEngine) Unsubscribe(_ string) error {
	return nil
}

// AddPresence - see engine interface description.
func (e *MemoryEngine) AddPresence(ch string, uid string, info *ClientInfo, _ time.Duration) error {
	return e.presenceHub.add(ch, uid, info)
}

// RemovePresence - see engine interface description.
func (e *MemoryEngine) RemovePresence(ch string, uid string) error {
	return e.presenceHub.remove(ch, uid)
}

// Presence - see engine interface description.
func (e *MemoryEngine) Presence(ch string) (map[string]*ClientInfo, error) {
	return e.presenceHub.get(ch)
}

// PresenceStats - see engine interface description.
func (e *MemoryEngine) PresenceStats(ch string) (PresenceStats, error) {
	return e.presenceHub.getStats(ch)
}

// History - see engine interface description.
func (e *MemoryEngine) History(ch string, filter HistoryFilter) ([]*Publication, StreamPosition, error) {
	return e.historyHub.get(ch, filter)
}

// RemoveHistory - see engine interface description.
func (e *MemoryEngine) RemoveHistory(ch string) error {
	return e.historyHub.remove(ch)
}

// Channels - see engine interface description.
func (e *MemoryEngine) Channels() ([]string, error) {
	return e.node.Hub().Channels(), nil
}

type presenceHub struct {
	sync.RWMutex
	presence map[string]map[string]*ClientInfo
}

func newPresenceHub() *presenceHub {
	return &presenceHub{
		presence: make(map[string]map[string]*ClientInfo),
	}
}

func (h *presenceHub) add(ch string, uid string, info *ClientInfo) error {
	h.Lock()
	defer h.Unlock()

	_, ok := h.presence[ch]
	if !ok {
		h.presence[ch] = make(map[string]*ClientInfo)
	}
	h.presence[ch][uid] = info
	return nil
}

func (h *presenceHub) remove(ch string, uid string) error {
	h.Lock()
	defer h.Unlock()

	if _, ok := h.presence[ch]; !ok {
		return nil
	}
	if _, ok := h.presence[ch][uid]; !ok {
		return nil
	}

	delete(h.presence[ch], uid)

	// clean up map if needed
	if len(h.presence[ch]) == 0 {
		delete(h.presence, ch)
	}

	return nil
}

func (h *presenceHub) get(ch string) (map[string]*ClientInfo, error) {
	h.RLock()
	defer h.RUnlock()

	presence, ok := h.presence[ch]
	if !ok {
		// return empty map
		return nil, nil
	}

	data := make(map[string]*ClientInfo, len(presence))
	for k, v := range presence {
		data[k] = v
	}
	return data, nil
}

func (h *presenceHub) getStats(ch string) (PresenceStats, error) {
	h.RLock()
	defer h.RUnlock()

	presence, ok := h.presence[ch]
	if !ok {
		// return empty map
		return PresenceStats{}, nil
	}

	numClients := len(presence)
	numUsers := 0
	uniqueUsers := map[string]struct{}{}

	for _, info := range presence {
		userID := info.UserID
		if _, ok := uniqueUsers[userID]; !ok {
			uniqueUsers[userID] = struct{}{}
			numUsers++
		}
	}

	return PresenceStats{
		NumClients: numClients,
		NumUsers:   numUsers,
	}, nil
}

type historyHub struct {
	sync.RWMutex
	streams         map[string]*memstream.Stream
	nextExpireCheck int64
	expireQueue     priority.Queue
	expires         map[string]int64
	historyMetaTTL  time.Duration
	nextRemoveCheck int64
	removeQueue     priority.Queue
	removes         map[string]int64
}

func newHistoryHub(historyMetaTTL time.Duration) *historyHub {
	return &historyHub{
		streams:        make(map[string]*memstream.Stream),
		expireQueue:    priority.MakeQueue(),
		expires:        make(map[string]int64),
		historyMetaTTL: historyMetaTTL,
		removeQueue:    priority.MakeQueue(),
		removes:        make(map[string]int64),
	}
}

func (h *historyHub) runCleanups() {
	go h.expireStreams()
	if h.historyMetaTTL > 0 {
		go h.removeStreams()
	}
}

func (h *historyHub) removeStreams() {
	var nextRemoveCheck int64
	for {
		time.Sleep(time.Second)
		h.Lock()
		if h.nextRemoveCheck == 0 || h.nextRemoveCheck > time.Now().Unix() {
			h.Unlock()
			continue
		}
		nextRemoveCheck = 0
		for h.removeQueue.Len() > 0 {
			item := heap.Pop(&h.removeQueue).(*priority.Item)
			expireAt := item.Priority
			if expireAt > time.Now().Unix() {
				heap.Push(&h.removeQueue, item)
				nextRemoveCheck = expireAt
				break
			}
			ch := item.Value
			exp, ok := h.removes[ch]
			if !ok {
				continue
			}
			if exp <= expireAt {
				delete(h.removes, ch)
				delete(h.streams, ch)
			} else {
				heap.Push(&h.removeQueue, &priority.Item{Value: ch, Priority: exp})
			}
		}
		h.nextRemoveCheck = nextRemoveCheck
		h.Unlock()
	}
}

func (h *historyHub) expireStreams() {
	var nextExpireCheck int64
	for {
		time.Sleep(time.Second)
		h.Lock()
		if h.nextExpireCheck == 0 || h.nextExpireCheck > time.Now().Unix() {
			h.Unlock()
			continue
		}
		nextExpireCheck = 0
		for h.expireQueue.Len() > 0 {
			item := heap.Pop(&h.expireQueue).(*priority.Item)
			expireAt := item.Priority
			if expireAt > time.Now().Unix() {
				heap.Push(&h.expireQueue, item)
				nextExpireCheck = expireAt
				break
			}
			ch := item.Value
			exp, ok := h.expires[ch]
			if !ok {
				continue
			}
			if exp <= expireAt {
				delete(h.expires, ch)
				if stream, ok := h.streams[ch]; ok {
					stream.Clear()
				}
			} else {
				heap.Push(&h.expireQueue, &priority.Item{Value: ch, Priority: exp})
			}
		}
		h.nextExpireCheck = nextExpireCheck
		h.Unlock()
	}
}

func (h *historyHub) add(ch string, pub *Publication, opts PublishOptions) (StreamPosition, error) {
	h.Lock()
	defer h.Unlock()

	var index uint64
	var epoch string

	expireAt := time.Now().Unix() + int64(opts.HistoryTTL.Seconds())
	if _, ok := h.expires[ch]; !ok {
		heap.Push(&h.expireQueue, &priority.Item{Value: ch, Priority: expireAt})
	}
	h.expires[ch] = expireAt
	if h.nextExpireCheck == 0 || h.nextExpireCheck > expireAt {
		h.nextExpireCheck = expireAt
	}

	if h.historyMetaTTL > 0 {
		removeAt := time.Now().Unix() + int64(h.historyMetaTTL.Seconds())
		if _, ok := h.removes[ch]; !ok {
			heap.Push(&h.removeQueue, &priority.Item{Value: ch, Priority: removeAt})
		}
		h.removes[ch] = removeAt
		if h.nextRemoveCheck == 0 || h.nextRemoveCheck > removeAt {
			h.nextRemoveCheck = removeAt
		}
	}

	if stream, ok := h.streams[ch]; ok {
		index, _ = stream.Add(pub, opts.HistorySize)
		epoch = stream.Epoch()
	} else {
		stream := memstream.New()
		index, _ = stream.Add(pub, opts.HistorySize)
		epoch = stream.Epoch()
		h.streams[ch] = stream
	}
	pub.Offset = index

	return StreamPosition{Offset: index, Epoch: epoch}, nil
}

// Lock must be held outside.
func (h *historyHub) createStream(ch string) StreamPosition {
	stream := memstream.New()
	h.streams[ch] = stream
	streamPosition := StreamPosition{}
	streamPosition.Offset = 0
	streamPosition.Epoch = stream.Epoch()
	return streamPosition
}

func getPosition(stream *memstream.Stream) StreamPosition {
	streamPosition := StreamPosition{}
	streamPosition.Offset = stream.Top()
	streamPosition.Epoch = stream.Epoch()
	return streamPosition
}

func (h *historyHub) get(ch string, filter HistoryFilter) ([]*Publication, StreamPosition, error) {
	h.Lock()
	defer h.Unlock()

	if h.historyMetaTTL > 0 {
		removeAt := time.Now().Unix() + int64(h.historyMetaTTL.Seconds())
		if _, ok := h.removes[ch]; !ok {
			heap.Push(&h.removeQueue, &priority.Item{Value: ch, Priority: removeAt})
		}
		h.removes[ch] = removeAt
		if h.nextRemoveCheck == 0 || h.nextRemoveCheck > removeAt {
			h.nextRemoveCheck = removeAt
		}
	}

	stream, ok := h.streams[ch]
	if !ok {
		return nil, h.createStream(ch), nil
	}

	if filter.Since == nil {
		if filter.Limit == 0 {
			return nil, getPosition(stream), nil
		}
		items, _, err := stream.Get(0, filter.Limit)
		if err != nil {
			return nil, StreamPosition{}, err
		}
		pubs := make([]*Publication, 0, len(items))
		for _, item := range items {
			pub := item.Value.(*Publication)
			pubs = append(pubs, pub)
		}
		return pubs, getPosition(stream), nil
	}

	since := filter.Since

	streamPosition := getPosition(stream)
	if streamPosition.Offset == since.Offset && since.Epoch == stream.Epoch() {
		return nil, streamPosition, nil
	}

	streamOffset := since.Offset + 1

	items, _, err := stream.Get(streamOffset, filter.Limit)
	if err != nil {
		return nil, StreamPosition{}, err
	}

	pubs := make([]*Publication, 0, len(items))
	for _, item := range items {
		pub := item.Value.(*Publication)
		pubs = append(pubs, pub)
	}
	return pubs, streamPosition, nil
}

func (h *historyHub) remove(ch string) error {
	h.Lock()
	defer h.Unlock()
	if stream, ok := h.streams[ch]; ok {
		stream.Clear()
	}
	return nil
}
