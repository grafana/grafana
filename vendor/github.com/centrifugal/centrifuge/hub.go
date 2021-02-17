package centrifuge

import (
	"context"
	"sync"

	"github.com/centrifugal/centrifuge/internal/clientproto"
	"github.com/centrifugal/centrifuge/internal/prepared"
	"github.com/centrifugal/centrifuge/internal/recovery"

	"github.com/centrifugal/protocol"
)

// Hub manages Client connections.
type Hub struct {
	mu sync.RWMutex
	// match client ID with actual client connection.
	conns map[string]*Client
	// registry to hold active client connections grouped by user.
	users map[string]map[string]struct{}
	// registry to hold active subscriptions of clients to channels.
	subs map[string]map[string]struct{}
}

// newHub initializes Hub.
func newHub() *Hub {
	return &Hub{
		conns: make(map[string]*Client),
		users: make(map[string]map[string]struct{}),
		subs:  make(map[string]map[string]struct{}),
	}
}

const (
	// hubShutdownSemaphoreSize limits graceful disconnects concurrency
	// on node shutdown.
	hubShutdownSemaphoreSize = 128
)

// shutdown unsubscribes users from all channels and disconnects them.
func (h *Hub) shutdown(ctx context.Context) error {
	advice := DisconnectShutdown

	// Limit concurrency here to prevent resource usage burst on shutdown.
	sem := make(chan struct{}, hubShutdownSemaphoreSize)

	h.mu.RLock()
	// At this moment node won't accept new client connections so we can
	// safely copy existing clients and release lock.
	clients := make([]*Client, 0, len(h.conns))
	for _, client := range h.conns {
		clients = append(clients, client)
	}
	h.mu.RUnlock()

	closeFinishedCh := make(chan struct{}, len(clients))
	finished := 0

	if len(clients) == 0 {
		return nil
	}

	for _, client := range clients {
		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			return ctx.Err()
		}
		go func(cc *Client) {
			defer func() { <-sem }()
			defer func() { closeFinishedCh <- struct{}{} }()
			_ = cc.close(advice)
		}(client)
	}

	for {
		select {
		case <-closeFinishedCh:
			finished++
			if finished == len(clients) {
				return nil
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (h *Hub) disconnect(user string, reconnect bool) error {
	userConnections := h.userConnections(user)
	advice := DisconnectForceNoReconnect
	if reconnect {
		advice = DisconnectForceReconnect
	}
	for _, c := range userConnections {
		go func(cc *Client) {
			_ = cc.close(advice)
		}(c)
	}
	return nil
}

func (h *Hub) unsubscribe(user string, ch string, opts ...UnsubscribeOption) error {
	userConnections := h.userConnections(user)
	for _, c := range userConnections {
		err := c.Unsubscribe(ch, opts...)
		if err != nil {
			return err
		}
	}
	return nil
}

// add adds connection into clientHub connections registry.
func (h *Hub) add(c *Client) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	uid := c.ID()
	user := c.UserID()

	h.conns[uid] = c

	if _, ok := h.users[user]; !ok {
		h.users[user] = make(map[string]struct{})
	}
	h.users[user][uid] = struct{}{}
	return nil
}

// Remove removes connection from clientHub connections registry.
func (h *Hub) remove(c *Client) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	uid := c.ID()
	user := c.UserID()

	delete(h.conns, uid)

	// try to find connection to delete, return early if not found.
	if _, ok := h.users[user]; !ok {
		return nil
	}
	if _, ok := h.users[user][uid]; !ok {
		return nil
	}

	// actually remove connection from hub.
	delete(h.users[user], uid)

	// clean up users map if it's needed.
	if len(h.users[user]) == 0 {
		delete(h.users, user)
	}

	return nil
}

// userConnections returns all connections of user with specified UserID.
func (h *Hub) userConnections(userID string) map[string]*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	userConnections, ok := h.users[userID]
	if !ok {
		return map[string]*Client{}
	}

	conns := make(map[string]*Client, len(userConnections))
	for uid := range userConnections {
		c, ok := h.conns[uid]
		if !ok {
			continue
		}
		conns[uid] = c
	}

	return conns
}

// addSub adds connection into clientHub subscriptions registry.
func (h *Hub) addSub(ch string, c *Client) (bool, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	uid := c.ID()

	h.conns[uid] = c

	_, ok := h.subs[ch]
	if !ok {
		h.subs[ch] = make(map[string]struct{})
	}
	h.subs[ch][uid] = struct{}{}
	if !ok {
		return true, nil
	}
	return false, nil
}

// removeSub removes connection from clientHub subscriptions registry.
func (h *Hub) removeSub(ch string, c *Client) (bool, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	uid := c.ID()

	// try to find subscription to delete, return early if not found.
	if _, ok := h.subs[ch]; !ok {
		return true, nil
	}
	if _, ok := h.subs[ch][uid]; !ok {
		return true, nil
	}

	// actually remove subscription from hub.
	delete(h.subs[ch], uid)

	// clean up subs map if it's needed.
	if len(h.subs[ch]) == 0 {
		delete(h.subs, ch)
		return true, nil
	}

	return false, nil
}

// broadcastPublication sends message to all clients subscribed on channel.
func (h *Hub) broadcastPublication(channel string, pub *protocol.Publication) error {
	useSeqGen := hasFlag(CompatibilityFlags, UseSeqGen)
	if useSeqGen {
		pub.Seq, pub.Gen = recovery.UnpackUint64(pub.Offset)
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	// get connections currently subscribed on channel.
	channelSubscriptions, ok := h.subs[channel]
	if !ok {
		return nil
	}

	var jsonPublicationReply *prepared.Reply
	var protobufPublicationReply *prepared.Reply
	// Iterate over channel subscribers and send message.
	for uid := range channelSubscriptions {
		c, ok := h.conns[uid]
		if !ok {
			continue
		}
		protoType := c.Transport().Protocol().toProto()
		if protoType == protocol.TypeJSON {
			if jsonPublicationReply == nil {
				// Do not send offset to clients for now.
				var offset uint64
				if useSeqGen {
					offset = pub.Offset
					pub.Offset = 0
				}
				data, err := protocol.GetPushEncoder(protoType).EncodePublication(pub)
				if err != nil {
					return err
				}
				if useSeqGen {
					pub.Offset = offset
				}
				messageBytes, err := protocol.GetPushEncoder(protoType).Encode(clientproto.NewPublicationPush(channel, data))
				if err != nil {
					return err
				}
				reply := &protocol.Reply{
					Result: messageBytes,
				}
				jsonPublicationReply = prepared.NewReply(reply, protocol.TypeJSON)
			}
			_ = c.writePublication(channel, pub, jsonPublicationReply)
		} else if protoType == protocol.TypeProtobuf {
			if protobufPublicationReply == nil {
				// Do not send offset to clients for now.
				var offset uint64
				if useSeqGen {
					offset = pub.Offset
					pub.Offset = 0
				}
				data, err := protocol.GetPushEncoder(protoType).EncodePublication(pub)
				if err != nil {
					return err
				}
				if useSeqGen {
					pub.Offset = offset
				}
				messageBytes, err := protocol.GetPushEncoder(protoType).Encode(clientproto.NewPublicationPush(channel, data))
				if err != nil {
					return err
				}
				reply := &protocol.Reply{
					Result: messageBytes,
				}
				protobufPublicationReply = prepared.NewReply(reply, protocol.TypeProtobuf)
			}
			_ = c.writePublication(channel, pub, protobufPublicationReply)
		}
	}
	return nil
}

// broadcastJoin sends message to all clients subscribed on channel.
func (h *Hub) broadcastJoin(channel string, join *protocol.Join) error {
	h.mu.RLock()
	defer h.mu.RUnlock()

	channelSubscriptions, ok := h.subs[channel]
	if !ok {
		return nil
	}

	var (
		jsonReply     *prepared.Reply
		protobufReply *prepared.Reply
	)

	for uid := range channelSubscriptions {
		c, ok := h.conns[uid]
		if !ok {
			continue
		}
		protoType := c.Transport().Protocol().toProto()
		if protoType == protocol.TypeJSON {
			if jsonReply == nil {
				data, err := protocol.GetPushEncoder(protoType).EncodeJoin(join)
				if err != nil {
					return err
				}
				messageBytes, err := protocol.GetPushEncoder(protoType).Encode(clientproto.NewJoinPush(channel, data))
				if err != nil {
					return err
				}
				reply := &protocol.Reply{
					Result: messageBytes,
				}
				jsonReply = prepared.NewReply(reply, protocol.TypeJSON)
			}
			_ = c.writeJoin(channel, jsonReply)
		} else if protoType == protocol.TypeProtobuf {
			if protobufReply == nil {
				data, err := protocol.GetPushEncoder(protoType).EncodeJoin(join)
				if err != nil {
					return err
				}
				messageBytes, err := protocol.GetPushEncoder(protoType).Encode(clientproto.NewJoinPush(channel, data))
				if err != nil {
					return err
				}
				reply := &protocol.Reply{
					Result: messageBytes,
				}
				protobufReply = prepared.NewReply(reply, protocol.TypeProtobuf)
			}
			_ = c.writeJoin(channel, protobufReply)
		}
	}
	return nil
}

// broadcastLeave sends message to all clients subscribed on channel.
func (h *Hub) broadcastLeave(channel string, leave *protocol.Leave) error {
	h.mu.RLock()
	defer h.mu.RUnlock()

	channelSubscriptions, ok := h.subs[channel]
	if !ok {
		return nil
	}

	var (
		jsonReply     *prepared.Reply
		protobufReply *prepared.Reply
	)

	for uid := range channelSubscriptions {
		c, ok := h.conns[uid]
		if !ok {
			continue
		}
		protoType := c.Transport().Protocol().toProto()
		if protoType == protocol.TypeJSON {
			if jsonReply == nil {
				data, err := protocol.GetPushEncoder(protoType).EncodeLeave(leave)
				if err != nil {
					return err
				}
				messageBytes, err := protocol.GetPushEncoder(protoType).Encode(clientproto.NewLeavePush(channel, data))
				if err != nil {
					return err
				}
				reply := &protocol.Reply{
					Result: messageBytes,
				}
				jsonReply = prepared.NewReply(reply, protocol.TypeJSON)
			}
			_ = c.writeLeave(channel, jsonReply)
		} else if protoType == protocol.TypeProtobuf {
			if protobufReply == nil {
				data, err := protocol.GetPushEncoder(protoType).EncodeLeave(leave)
				if err != nil {
					return err
				}
				messageBytes, err := protocol.GetPushEncoder(protoType).Encode(clientproto.NewLeavePush(channel, data))
				if err != nil {
					return err
				}
				reply := &protocol.Reply{
					Result: messageBytes,
				}
				protobufReply = prepared.NewReply(reply, protocol.TypeProtobuf)
			}
			_ = c.writeLeave(channel, protobufReply)
		}
	}
	return nil
}

// NumClients returns total number of client connections.
func (h *Hub) NumClients() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	total := 0
	for _, clientConnections := range h.users {
		total += len(clientConnections)
	}
	return total
}

// NumUsers returns a number of unique users connected.
func (h *Hub) NumUsers() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.users)
}

// NumChannels returns a total number of different channels.
func (h *Hub) NumChannels() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.subs)
}

// Channels returns a slice of all active channels.
func (h *Hub) Channels() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	channels := make([]string, len(h.subs))
	i := 0
	for ch := range h.subs {
		channels[i] = ch
		i++
	}
	return channels
}

// NumSubscribers returns number of current subscribers for a given channel.
func (h *Hub) NumSubscribers(ch string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	conns, ok := h.subs[ch]
	if !ok {
		return 0
	}
	return len(conns)
}
