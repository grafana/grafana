package centrifuge

import (
	"context"
	"sync"
)

// MemoryPresenceManager is builtin default PresenceManager which allows running
// Centrifuge-based server without any external storage. All data managed inside process
// memory.
//
// With this PresenceManager you can only run single Centrifuge node. If you need to scale
// you should consider using another PresenceManager implementation instead – for example
// RedisPresenceManager.
//
// Running single node can be sufficient for many use cases especially when you
// need maximum performance and not too many online clients. Consider configuring
// your load balancer to have one backup Centrifuge node for HA in this case.
type MemoryPresenceManager struct {
	node        *Node
	config      MemoryPresenceManagerConfig
	presenceHub *presenceHub
}

var _ PresenceManager = (*MemoryPresenceManager)(nil)

// MemoryPresenceManagerConfig is a MemoryPresenceManager config.
type MemoryPresenceManagerConfig struct{}

// NewMemoryPresenceManager initializes MemoryPresenceManager.
func NewMemoryPresenceManager(n *Node, c MemoryPresenceManagerConfig) (*MemoryPresenceManager, error) {
	return &MemoryPresenceManager{
		node:        n,
		config:      c,
		presenceHub: newPresenceHub(),
	}, nil
}

// AddPresence - see PresenceManager interface description.
func (m *MemoryPresenceManager) AddPresence(ch string, uid string, info *ClientInfo) error {
	return m.presenceHub.add(ch, uid, info)
}

// RemovePresence - see PresenceManager interface description.
func (m *MemoryPresenceManager) RemovePresence(ch string, clientID string, _ string) error {
	return m.presenceHub.remove(ch, clientID)
}

// Presence - see PresenceManager interface description.
func (m *MemoryPresenceManager) Presence(ch string) (map[string]*ClientInfo, error) {
	return m.presenceHub.get(ch)
}

// PresenceStats - see PresenceManager interface description.
func (m *MemoryPresenceManager) PresenceStats(ch string) (PresenceStats, error) {
	return m.presenceHub.getStats(ch)
}

// Close is noop for now.
func (m *MemoryPresenceManager) Close(_ context.Context) error {
	return nil
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
