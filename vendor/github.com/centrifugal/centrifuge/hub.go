package centrifuge

import (
	"context"
	"io"
	"sync"
	"time"

	"github.com/centrifugal/centrifuge/internal/convert"

	"github.com/centrifugal/protocol"
	"github.com/segmentio/encoding/json"
	fdelta "github.com/shadowspore/fossil-delta"
)

const numHubShards = 64

// Hub tracks Client connections on the current Node.
type Hub struct {
	connShards [numHubShards]*connShard
	subShards  [numHubShards]*subShard
	sessionsMu sync.RWMutex
	sessions   map[string]*Client
}

// newHub initializes Hub.
func newHub(logger *logger, metrics *metrics, maxTimeLagMilli int64) *Hub {
	h := &Hub{
		sessions: map[string]*Client{},
	}
	for i := 0; i < numHubShards; i++ {
		h.connShards[i] = newConnShard()
		h.subShards[i] = newSubShard(logger, metrics, maxTimeLagMilli)
	}
	return h
}

func (h *Hub) clientBySession(session string) (*Client, bool) {
	h.sessionsMu.RLock()
	defer h.sessionsMu.RUnlock()
	c, ok := h.sessions[session]
	return c, ok
}

// shutdown unsubscribes users from all channels and disconnects them.
func (h *Hub) shutdown(ctx context.Context) error {
	// Limit concurrency here to prevent resource usage burst on shutdown.
	sem := make(chan struct{}, hubShutdownSemaphoreSize)

	var errMu sync.Mutex
	var shutdownErr error

	var wg sync.WaitGroup
	wg.Add(numHubShards)
	for i := 0; i < numHubShards; i++ {
		go func(i int) {
			defer wg.Done()
			err := h.connShards[i].shutdown(ctx, sem)
			if err != nil {
				errMu.Lock()
				if shutdownErr == nil {
					shutdownErr = err
				}
				errMu.Unlock()
			}
		}(i)
	}
	wg.Wait()
	return shutdownErr
}

// Add connection into clientHub connections registry.
func (h *Hub) add(c *Client) {
	h.sessionsMu.Lock()
	if c.sessionID() != "" {
		h.sessions[c.sessionID()] = c
	}
	h.sessionsMu.Unlock()
	h.connShards[index(c.UserID(), numHubShards)].add(c)
}

// Remove connection from clientHub connections registry.
// Returns true if found and really removed from registry.
func (h *Hub) remove(c *Client) bool {
	h.sessionsMu.Lock()
	if c.sessionID() != "" {
		delete(h.sessions, c.sessionID())
	}
	h.sessionsMu.Unlock()
	return h.connShards[index(c.UserID(), numHubShards)].remove(c)
}

// Connections returns all user connections to the current Node.
func (h *Hub) Connections() map[string]*Client {
	connections := make(map[string]*Client)
	for _, shard := range h.connShards {
		shard.mu.RLock()
		for clientID, c := range shard.clients {
			connections[clientID] = c
		}
		shard.mu.RUnlock()
	}
	return connections
}

// UserConnections returns all user connections to the current Node.
func (h *Hub) UserConnections(userID string) map[string]*Client {
	return h.connShards[index(userID, numHubShards)].userConnections(userID)
}

func (h *Hub) refresh(userID string, clientID, sessionID string, opts ...RefreshOption) error {
	return h.connShards[index(userID, numHubShards)].refresh(userID, clientID, sessionID, opts...)
}

func (h *Hub) subscribe(userID string, ch string, clientID string, sessionID string, opts ...SubscribeOption) error {
	return h.connShards[index(userID, numHubShards)].subscribe(userID, ch, clientID, sessionID, opts...)
}

func (h *Hub) unsubscribe(userID string, ch string, unsubscribe Unsubscribe, clientID string, sessionID string) error {
	return h.connShards[index(userID, numHubShards)].unsubscribe(userID, ch, unsubscribe, clientID, sessionID)
}

func (h *Hub) disconnect(userID string, disconnect Disconnect, clientID, sessionID string, whitelist []string) error {
	return h.connShards[index(userID, numHubShards)].disconnect(userID, disconnect, clientID, sessionID, whitelist)
}

func (h *Hub) addSub(ch string, sub subInfo) (bool, error) {
	return h.subShards[index(ch, numHubShards)].addSub(ch, sub)
}

// removeSub removes connection from clientHub subscriptions registry.
func (h *Hub) removeSub(ch string, c *Client) (bool, bool) {
	return h.subShards[index(ch, numHubShards)].removeSub(ch, c)
}

// BroadcastPublication sends message to all clients subscribed on a channel on the current Node.
// Usually this is NOT what you need since in most cases you should use Node.Publish method which
// uses a Broker to deliver publications to all Nodes in a cluster and maintains publication history
// in a channel with incremental offset. By calling BroadcastPublication messages will only be sent
// to the current node subscribers without any defined offset semantics, without delta support.
func (h *Hub) BroadcastPublication(ch string, pub *Publication, sp StreamPosition) error {
	return h.broadcastPublication(ch, sp, pub, nil, nil, 0, 0)
}

func (h *Hub) broadcastPublication(
	ch string, sp StreamPosition, pub, prevPub, localPrevPub *Publication, maxBatchSize int64, maxBatchDelay time.Duration,
) error {
	return h.subShards[index(ch, numHubShards)].broadcastPublication(ch, sp, pub, prevPub, localPrevPub, maxBatchSize, maxBatchDelay)
}

// broadcastJoin sends message to all clients subscribed on channel.
func (h *Hub) broadcastJoin(ch string, info *ClientInfo, maxBatchSize int64, maxBatchDelay time.Duration) error {
	return h.subShards[index(ch, numHubShards)].broadcastJoin(ch, &protocol.Join{Info: infoToProto(info)}, maxBatchSize, maxBatchDelay)
}

func (h *Hub) broadcastLeave(ch string, info *ClientInfo, maxBatchSize int64, maxBatchDelay time.Duration) error {
	return h.subShards[index(ch, numHubShards)].broadcastLeave(ch, &protocol.Leave{Info: infoToProto(info)}, maxBatchSize, maxBatchDelay)
}

// NumSubscribers returns number of current subscribers for a given channel.
func (h *Hub) NumSubscribers(ch string) int {
	return h.subShards[index(ch, numHubShards)].NumSubscribers(ch)
}

// Channels returns a slice of all active channels.
func (h *Hub) Channels() []string {
	channels := make([]string, 0, h.NumChannels())
	for i := 0; i < numHubShards; i++ {
		channels = append(channels, h.subShards[i].Channels()...)
	}
	return channels
}

// NumClients returns total number of client connections.
func (h *Hub) NumClients() int {
	var total int
	for i := 0; i < numHubShards; i++ {
		total += h.connShards[i].NumClients()
	}
	return total
}

// NumUsers returns a number of unique users connected.
func (h *Hub) NumUsers() int {
	var total int
	for i := 0; i < numHubShards; i++ {
		// users do not overlap among shards.
		total += h.connShards[i].NumUsers()
	}
	return total
}

// NumSubscriptions returns a total number of subscriptions.
func (h *Hub) NumSubscriptions() int {
	var total int
	for i := 0; i < numHubShards; i++ {
		// users do not overlap among shards.
		total += h.subShards[i].NumSubscriptions()
	}
	return total
}

// NumChannels returns a total number of different channels.
func (h *Hub) NumChannels() int {
	var total int
	for i := 0; i < numHubShards; i++ {
		// channels do not overlap among shards.
		total += h.subShards[i].NumChannels()
	}
	return total
}

type connShard struct {
	mu sync.RWMutex
	// match client ID with actual client connection.
	clients map[string]*Client
	// registry to hold active client connections grouped by user.
	users map[string]map[string]struct{}
}

func newConnShard() *connShard {
	return &connShard{
		clients: make(map[string]*Client),
		users:   make(map[string]map[string]struct{}),
	}
}

const (
	// hubShutdownSemaphoreSize limits graceful disconnects concurrency
	// on node shutdown.
	hubShutdownSemaphoreSize = 128
)

// shutdown unsubscribes users from all channels and disconnects them.
func (h *connShard) shutdown(ctx context.Context, sem chan struct{}) error {
	advice := DisconnectShutdown
	h.mu.RLock()
	// At this moment node won't accept new client connections, so we can
	// safely copy existing clients and release lock.
	clients := make([]*Client, 0, len(h.clients))
	for _, client := range h.clients {
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

func stringInSlice(str string, slice []string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}

func (h *connShard) subscribe(user string, ch string, clientID string, sessionID string, opts ...SubscribeOption) error {
	userConnections := h.userConnections(user)

	var firstErr error
	var errMu sync.Mutex

	var wg sync.WaitGroup
	for _, c := range userConnections {
		if clientID != "" && c.ID() != clientID {
			continue
		}
		if sessionID != "" && c.sessionID() != sessionID {
			continue
		}
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			err := c.Subscribe(ch, opts...)
			errMu.Lock()
			defer errMu.Unlock()
			if err != nil && err != io.EOF && firstErr == nil {
				firstErr = err
			}
		}(c)
	}
	wg.Wait()
	return firstErr
}

func (h *connShard) refresh(user string, clientID string, sessionID string, opts ...RefreshOption) error {
	userConnections := h.userConnections(user)

	var firstErr error
	var errMu sync.Mutex

	var wg sync.WaitGroup
	for _, c := range userConnections {
		if clientID != "" && c.ID() != clientID {
			continue
		}
		if sessionID != "" && c.sessionID() != sessionID {
			continue
		}
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			err := c.Refresh(opts...)
			errMu.Lock()
			defer errMu.Unlock()
			if err != nil && err != io.EOF && firstErr == nil {
				firstErr = err
			}
		}(c)
	}
	wg.Wait()
	return firstErr
}

func (h *connShard) unsubscribe(user string, ch string, unsubscribe Unsubscribe, clientID string, sessionID string) error {
	userConnections := h.userConnections(user)

	var wg sync.WaitGroup
	for _, c := range userConnections {
		if clientID != "" && c.ID() != clientID {
			continue
		}
		if sessionID != "" && c.sessionID() != sessionID {
			continue
		}
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			c.Unsubscribe(ch, unsubscribe)
		}(c)
	}
	wg.Wait()
	return nil
}

func (h *connShard) disconnect(user string, disconnect Disconnect, clientID string, sessionID string, whitelist []string) error {
	userConnections := h.userConnections(user)

	var firstErr error
	var errMu sync.Mutex

	var wg sync.WaitGroup
	for _, c := range userConnections {
		if stringInSlice(c.ID(), whitelist) {
			continue
		}
		if clientID != "" && c.ID() != clientID {
			continue
		}
		if sessionID != "" && c.sessionID() != sessionID {
			continue
		}
		wg.Add(1)
		go func(cc *Client) {
			defer wg.Done()
			err := cc.close(disconnect)
			errMu.Lock()
			defer errMu.Unlock()
			if err != nil && err != io.EOF && firstErr == nil {
				firstErr = err
			}
		}(c)
	}
	wg.Wait()
	return firstErr
}

// userConnections returns all connections of user with specified User.
func (h *connShard) userConnections(userID string) map[string]*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	userConnections, ok := h.users[userID]
	if !ok {
		return map[string]*Client{}
	}

	connections := make(map[string]*Client, len(userConnections))
	for uid := range userConnections {
		c, ok := h.clients[uid]
		if !ok {
			continue
		}
		connections[uid] = c
	}

	return connections
}

// Add connection into clientHub connections registry.
func (h *connShard) add(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	uid := c.ID()
	user := c.UserID()

	h.clients[uid] = c

	if _, ok := h.users[user]; !ok {
		h.users[user] = make(map[string]struct{})
	}
	h.users[user][uid] = struct{}{}
}

// Remove connection from clientHub connections registry.
// Returns true if found and really removed from registry.
func (h *connShard) remove(c *Client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	uid := c.ID()
	user := c.UserID()

	delete(h.clients, uid)

	// try to find connection to delete, return early if not found.
	if _, ok := h.users[user]; !ok {
		return false
	}
	if _, ok := h.users[user][uid]; !ok {
		return false
	}

	// actually remove connection from hub.
	delete(h.users[user], uid)

	// clean up users map if it's needed.
	if len(h.users[user]) == 0 {
		delete(h.users, user)
	}

	return true
}

// NumClients returns total number of client connections.
func (h *connShard) NumClients() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	total := 0
	for _, clientConnections := range h.users {
		total += len(clientConnections)
	}
	return total
}

// NumUsers returns a number of unique users connected.
func (h *connShard) NumUsers() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.users)
}

type DeltaType string

const (
	deltaTypeNone DeltaType = ""
	// DeltaTypeFossil is Fossil delta encoding. See https://fossil-scm.org/home/doc/tip/www/delta_encoder_algorithm.wiki.
	DeltaTypeFossil DeltaType = "fossil"
)

var stringToDeltaType = map[string]DeltaType{
	"fossil": DeltaTypeFossil,
}

type subInfo struct {
	client    *Client
	deltaType DeltaType
}

type subShard struct {
	mu sync.RWMutex
	// registry to hold active subscriptions of clients to channels with some additional info.
	subs            map[string]map[string]subInfo
	maxTimeLagMilli int64
	logger          *logger
	metrics         *metrics
}

func newSubShard(logger *logger, metrics *metrics, maxTimeLagMilli int64) *subShard {
	return &subShard{
		subs:            make(map[string]map[string]subInfo),
		logger:          logger,
		metrics:         metrics,
		maxTimeLagMilli: maxTimeLagMilli,
	}
}

// addSub adds connection into clientHub subscriptions registry.
func (h *subShard) addSub(ch string, sub subInfo) (bool, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	uid := sub.client.ID()

	_, ok := h.subs[ch]
	if !ok {
		h.subs[ch] = make(map[string]subInfo)
	}
	h.subs[ch][uid] = sub
	if !ok {
		return true, nil
	}
	return false, nil
}

// removeSub removes connection from clientHub subscriptions registry.
// Returns true if channel does not have any subscribers left in first return value.
// Returns true if found and really removed from registry in second return value.
func (h *subShard) removeSub(ch string, c *Client) (bool, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()

	uid := c.ID()

	// try to find subscription to delete, return early if not found.
	if _, ok := h.subs[ch]; !ok {
		return true, false
	}
	if _, ok := h.subs[ch][uid]; !ok {
		return true, false
	}

	// actually remove subscription from hub.
	delete(h.subs[ch], uid)

	// clean up subs map if it's needed.
	if len(h.subs[ch]) == 0 {
		delete(h.subs, ch)
		return true, true
	}

	return false, true
}

type encodeError struct {
	client string
	user   string
	error  error
}

type preparedKey struct {
	ProtocolType   protocol.Type
	Unidirectional bool
	DeltaType      DeltaType
}

type preparedData struct {
	fullData        []byte
	brokerDeltaData []byte
	localDeltaData  []byte
	deltaSub        bool
}

func getDeltaPub(prevPub *Publication, fullPub *protocol.Publication, key preparedKey) *protocol.Publication {
	deltaPub := fullPub
	if prevPub != nil && key.DeltaType == DeltaTypeFossil {
		patch := fdelta.Create(prevPub.Data, fullPub.Data)
		delta := true
		deltaData := patch
		if len(patch) >= len(fullPub.Data) {
			delta = false
			deltaData = fullPub.Data
		}
		if key.ProtocolType == protocol.TypeJSON {
			deltaData = json.Escape(convert.BytesToString(deltaData))
		}
		deltaPub = &protocol.Publication{
			Offset: fullPub.Offset,
			Data:   deltaData,
			Info:   fullPub.Info,
			Tags:   fullPub.Tags,
			Delta:  delta,
		}
	} else if prevPub == nil && key.ProtocolType == protocol.TypeJSON && key.DeltaType == DeltaTypeFossil {
		// In JSON and Fossil case we need to send full state in JSON string format.
		deltaPub = &protocol.Publication{
			Offset: fullPub.Offset,
			Data:   json.Escape(convert.BytesToString(fullPub.Data)),
			Info:   fullPub.Info,
			Tags:   fullPub.Tags,
		}
	}
	return deltaPub
}

func getDeltaData(sub subInfo, key preparedKey, channel string, deltaPub *protocol.Publication, jsonEncodeErr *encodeError) ([]byte, error) {
	var deltaData []byte
	if key.ProtocolType == protocol.TypeJSON {
		if sub.client.transport.Unidirectional() {
			push := &protocol.Push{Channel: channel, Pub: deltaPub}
			var err error
			deltaData, err = protocol.DefaultJsonPushEncoder.Encode(push)
			if err != nil {
				*jsonEncodeErr = encodeError{client: sub.client.ID(), user: sub.client.UserID(), error: err}
			}
		} else {
			push := &protocol.Push{Channel: channel, Pub: deltaPub}
			var err error
			deltaData, err = protocol.DefaultJsonReplyEncoder.Encode(&protocol.Reply{Push: push})
			if err != nil {
				*jsonEncodeErr = encodeError{client: sub.client.ID(), user: sub.client.UserID(), error: err}
			}
		}
	} else if key.ProtocolType == protocol.TypeProtobuf {
		if sub.client.transport.Unidirectional() {
			push := &protocol.Push{Channel: channel, Pub: deltaPub}
			var err error
			deltaData, err = protocol.DefaultProtobufPushEncoder.Encode(push)
			if err != nil {
				return nil, err
			}
		} else {
			push := &protocol.Push{Channel: channel, Pub: deltaPub}
			var err error
			deltaData, err = protocol.DefaultProtobufReplyEncoder.Encode(&protocol.Reply{Push: push})
			if err != nil {
				return nil, err
			}
		}
	}
	return deltaData, nil
}

// broadcastPublication sends message to all clients subscribed on a channel.
func (h *subShard) broadcastPublication(channel string, sp StreamPosition, pub, prevPub, localPrevPub *Publication, maxBatchSize int64, maxBatchDelay time.Duration) error {
	pubTime := pub.Time
	// Check lag in PUB/SUB processing. We use it to notify subscribers with positioning enabled
	// about insufficient state in the stream.
	var maxLagExceeded bool
	now := time.Now()
	if pubTime > 0 {
		timeLagMilli := now.UnixMilli() - pubTime
		if h.maxTimeLagMilli > 0 && timeLagMilli > h.maxTimeLagMilli {
			maxLagExceeded = true
		}
		h.metrics.observePubSubDeliveryLag(timeLagMilli)
	}

	fullPub := pubToProto(pub)
	preparedDataByKey := make(map[preparedKey]preparedData)

	h.mu.RLock()
	defer h.mu.RUnlock()

	channelSubscribers, ok := h.subs[channel]
	if !ok {
		return nil
	}

	if pub.Channel != channel {
		fullPub.Channel = pub.Channel
	}

	var (
		jsonEncodeErr *encodeError
	)

	for _, sub := range channelSubscribers {
		key := preparedKey{
			ProtocolType:   sub.client.Transport().Protocol().toProto(),
			Unidirectional: sub.client.transport.Unidirectional(),
			DeltaType:      sub.deltaType,
		}
		prepValue, prepDataFound := preparedDataByKey[key]
		if !prepDataFound {
			var brokerDeltaPub *protocol.Publication
			if fullPub.Offset > 0 {
				brokerDeltaPub = getDeltaPub(prevPub, fullPub, key)
			}
			localDeltaPub := getDeltaPub(localPrevPub, fullPub, key)

			var brokerDeltaData []byte
			var localDeltaData []byte
			if key.DeltaType != deltaTypeNone {
				var err error
				brokerDeltaData, err = getDeltaData(sub, key, channel, brokerDeltaPub, jsonEncodeErr)
				if err != nil {
					return err
				}
				localDeltaData, err = getDeltaData(sub, key, channel, localDeltaPub, jsonEncodeErr)
				if err != nil {
					return err
				}
			}

			var fullData []byte

			if key.ProtocolType == protocol.TypeJSON {
				if sub.client.transport.Unidirectional() {
					pubToUse := fullPub
					if key.ProtocolType == protocol.TypeJSON && key.DeltaType == DeltaTypeFossil {
						pubToUse = &protocol.Publication{
							Offset:  fullPub.Offset,
							Data:    json.Escape(convert.BytesToString(fullPub.Data)),
							Info:    fullPub.Info,
							Tags:    fullPub.Tags,
							Channel: fullPub.Channel,
						}
					}
					push := &protocol.Push{Channel: channel, Pub: pubToUse}
					var err error
					fullData, err = protocol.DefaultJsonPushEncoder.Encode(push)
					if err != nil {
						jsonEncodeErr = &encodeError{client: sub.client.ID(), user: sub.client.UserID(), error: err}
					}
				} else {
					pubToUse := fullPub
					if key.ProtocolType == protocol.TypeJSON && key.DeltaType == DeltaTypeFossil {
						pubToUse = &protocol.Publication{
							Offset:  fullPub.Offset,
							Data:    json.Escape(convert.BytesToString(fullPub.Data)),
							Info:    fullPub.Info,
							Tags:    fullPub.Tags,
							Channel: fullPub.Channel,
						}
					}
					push := &protocol.Push{Channel: channel, Pub: pubToUse}
					var err error
					fullData, err = protocol.DefaultJsonReplyEncoder.Encode(&protocol.Reply{Push: push})
					if err != nil {
						jsonEncodeErr = &encodeError{client: sub.client.ID(), user: sub.client.UserID(), error: err}
					}
				}
			} else if key.ProtocolType == protocol.TypeProtobuf {
				if sub.client.transport.Unidirectional() {
					push := &protocol.Push{Channel: channel, Pub: fullPub}
					var err error
					fullData, err = protocol.DefaultProtobufPushEncoder.Encode(push)
					if err != nil {
						return err
					}
				} else {
					push := &protocol.Push{Channel: channel, Pub: fullPub}
					var err error
					fullData, err = protocol.DefaultProtobufReplyEncoder.Encode(&protocol.Reply{Push: push})
					if err != nil {
						return err
					}
				}
			}

			prepValue = preparedData{
				fullData:        fullData,
				brokerDeltaData: brokerDeltaData,
				localDeltaData:  localDeltaData,
				deltaSub:        key.DeltaType != deltaTypeNone,
			}
			preparedDataByKey[key] = prepValue
		}
		if sub.client.transport.Protocol() == ProtocolTypeJSON && jsonEncodeErr != nil {
			go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(sub.client)
			continue
		}

		_ = sub.client.writePublication(channel, fullPub, prepValue, sp, maxLagExceeded, maxBatchSize, maxBatchDelay)
	}
	if jsonEncodeErr != nil && h.logger.enabled(LogLevelWarn) {
		// Log that we had clients with inappropriate protocol, and point to the first such client.
		h.logger.log(newLogEntry(LogLevelWarn, "inappropriate protocol publication", map[string]any{
			"channel": channel,
			"user":    jsonEncodeErr.user,
			"client":  jsonEncodeErr.client,
			"error":   jsonEncodeErr.error,
		}))
	}

	h.metrics.observeBroadcastDuration(now, channel)
	return nil
}

// broadcastJoin sends message to all clients subscribed on channel.
func (h *subShard) broadcastJoin(channel string, join *protocol.Join, maxBatchSize int64, maxBatchDelay time.Duration) error {
	h.mu.RLock()
	defer h.mu.RUnlock()

	channelSubscribers, ok := h.subs[channel]
	if !ok {
		return nil
	}

	var (
		jsonReply     []byte
		protobufReply []byte

		jsonPush     []byte
		protobufPush []byte

		jsonEncodeErr *encodeError
	)

	for _, sub := range channelSubscribers {
		protoType := sub.client.Transport().Protocol().toProto()
		if protoType == protocol.TypeJSON {
			if jsonEncodeErr != nil {
				go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(sub.client)
				continue
			}
			if sub.client.transport.Unidirectional() {
				if jsonPush == nil {
					push := &protocol.Push{Channel: channel, Join: join}
					var err error
					jsonPush, err = protocol.DefaultJsonPushEncoder.Encode(push)
					if err != nil {
						jsonEncodeErr = &encodeError{client: sub.client.ID(), user: sub.client.UserID(), error: err}
						go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(sub.client)
						continue
					}
				}
				_ = sub.client.writeJoin(channel, join, jsonPush, maxBatchSize, maxBatchDelay)
			} else {
				if jsonReply == nil {
					push := &protocol.Push{Channel: channel, Join: join}
					var err error
					jsonReply, err = protocol.DefaultJsonReplyEncoder.Encode(&protocol.Reply{Push: push})
					if err != nil {
						jsonEncodeErr = &encodeError{client: sub.client.ID(), user: sub.client.UserID(), error: err}
						go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(sub.client)
						continue
					}
				}
				_ = sub.client.writeJoin(channel, join, jsonReply, maxBatchSize, maxBatchDelay)
			}
		} else if protoType == protocol.TypeProtobuf {
			if sub.client.transport.Unidirectional() {
				if protobufPush == nil {
					push := &protocol.Push{Channel: channel, Join: join}
					var err error
					protobufPush, err = protocol.DefaultProtobufPushEncoder.Encode(push)
					if err != nil {
						return err
					}
				}
				_ = sub.client.writeJoin(channel, join, protobufPush, maxBatchSize, maxBatchDelay)
			} else {
				if protobufReply == nil {
					push := &protocol.Push{Channel: channel, Join: join}
					var err error
					protobufReply, err = protocol.DefaultProtobufReplyEncoder.Encode(&protocol.Reply{Push: push})
					if err != nil {
						return err
					}
				}
				_ = sub.client.writeJoin(channel, join, protobufReply, maxBatchSize, maxBatchDelay)
			}
		}
	}
	if jsonEncodeErr != nil && h.logger.enabled(LogLevelWarn) {
		// Log that we had clients with inappropriate protocol, and point to the first such client.
		h.logger.log(newLogEntry(LogLevelWarn, "inappropriate protocol join", map[string]any{
			"channel": channel,
			"user":    jsonEncodeErr.user,
			"client":  jsonEncodeErr.client,
			"error":   jsonEncodeErr.error,
		}))
	}
	return nil
}

// broadcastLeave sends message to all clients subscribed on channel.
func (h *subShard) broadcastLeave(channel string, leave *protocol.Leave, maxBatchSize int64, maxBatchDelay time.Duration) error {
	h.mu.RLock()
	defer h.mu.RUnlock()

	channelSubscribers, ok := h.subs[channel]
	if !ok {
		return nil
	}

	var (
		jsonReply     []byte
		protobufReply []byte

		jsonPush     []byte
		protobufPush []byte

		jsonEncodeErr *encodeError
	)

	for _, sub := range channelSubscribers {
		protoType := sub.client.Transport().Protocol().toProto()
		if protoType == protocol.TypeJSON {
			if jsonEncodeErr != nil {
				go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(sub.client)
				continue
			}
			if sub.client.transport.Unidirectional() {
				if jsonPush == nil {
					push := &protocol.Push{Channel: channel, Leave: leave}
					var err error
					jsonPush, err = protocol.DefaultJsonPushEncoder.Encode(push)
					if err != nil {
						jsonEncodeErr = &encodeError{client: sub.client.ID(), user: sub.client.UserID(), error: err}
						go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(sub.client)
						continue
					}
				}
				_ = sub.client.writeLeave(channel, leave, jsonPush, maxBatchSize, maxBatchDelay)
			} else {
				if jsonReply == nil {
					push := &protocol.Push{Channel: channel, Leave: leave}
					var err error
					jsonReply, err = protocol.DefaultJsonReplyEncoder.Encode(&protocol.Reply{Push: push})
					if err != nil {
						jsonEncodeErr = &encodeError{client: sub.client.ID(), user: sub.client.UserID(), error: err}
						go func(c *Client) { c.Disconnect(DisconnectInappropriateProtocol) }(sub.client)
						continue
					}
				}
				_ = sub.client.writeLeave(channel, leave, jsonReply, maxBatchSize, maxBatchDelay)
			}
		} else if protoType == protocol.TypeProtobuf {
			if sub.client.transport.Unidirectional() {
				if protobufPush == nil {
					push := &protocol.Push{Channel: channel, Leave: leave}
					var err error
					protobufPush, err = protocol.DefaultProtobufPushEncoder.Encode(push)
					if err != nil {
						return err
					}
				}
				_ = sub.client.writeLeave(channel, leave, protobufPush, maxBatchSize, maxBatchDelay)
			} else {
				if protobufReply == nil {
					push := &protocol.Push{Channel: channel, Leave: leave}
					var err error
					protobufReply, err = protocol.DefaultProtobufReplyEncoder.Encode(&protocol.Reply{Push: push})
					if err != nil {
						return err
					}
				}
				_ = sub.client.writeLeave(channel, leave, protobufReply, maxBatchSize, maxBatchDelay)
			}
		}
	}
	if jsonEncodeErr != nil && h.logger.enabled(LogLevelWarn) {
		// Log that we had clients with inappropriate protocol, and point to the first such client.
		h.logger.log(newLogEntry(LogLevelWarn, "inappropriate protocol leave", map[string]any{
			"channel": channel,
			"user":    jsonEncodeErr.user,
			"client":  jsonEncodeErr.client,
			"error":   jsonEncodeErr.error,
		}))
	}
	return nil
}

// NumChannels returns a total number of different channels.
func (h *subShard) NumChannels() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.subs)
}

// NumSubscriptions returns total number of subscriptions.
func (h *subShard) NumSubscriptions() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	total := 0
	for _, subscriptions := range h.subs {
		total += len(subscriptions)
	}
	return total
}

// Channels returns a slice of all active channels.
func (h *subShard) Channels() []string {
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
func (h *subShard) NumSubscribers(ch string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients, ok := h.subs[ch]
	if !ok {
		return 0
	}
	return len(clients)
}
