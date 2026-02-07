package centrifuge

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"github.com/centrifugal/centrifuge/internal/convert"
	"github.com/centrifugal/centrifuge/internal/filter"
	"github.com/centrifugal/centrifuge/internal/queue"
	"github.com/centrifugal/centrifuge/internal/recovery"
	"github.com/centrifugal/centrifuge/internal/saferand"

	"github.com/centrifugal/protocol"
	"github.com/google/uuid"
	"github.com/segmentio/encoding/json"
	fdelta "github.com/shadowspore/fossil-delta"
	"google.golang.org/protobuf/encoding/protojson"
)

// Empty Replies/Pushes for pings.
var jsonPingReply = []byte(`{}`)
var protobufPingReply []byte
var jsonPingPush = []byte(`{}`)
var protobufPingPush []byte

var randSource *saferand.Rand

func init() {
	protobufPingReply, _ = protocol.DefaultProtobufReplyEncoder.Encode(&protocol.Reply{})
	protobufPingPush, _ = protocol.DefaultProtobufPushEncoder.Encode(&protocol.Push{})
	randSource = saferand.New(time.Now().UnixNano())
}

// clientEventHub allows dealing with client event handlers.
// All its methods are not goroutine-safe and supposed to be called
// once inside Node ConnectHandler.
type clientEventHub struct {
	aliveHandler         AliveHandler
	disconnectHandler    DisconnectHandler
	subscribeHandler     SubscribeHandler
	unsubscribeHandler   UnsubscribeHandler
	publishHandler       PublishHandler
	refreshHandler       RefreshHandler
	subRefreshHandler    SubRefreshHandler
	rpcHandler           RPCHandler
	messageHandler       MessageHandler
	presenceHandler      PresenceHandler
	presenceStatsHandler PresenceStatsHandler
	historyHandler       HistoryHandler
	stateSnapshotHandler StateSnapshotHandler
}

// OnAlive allows setting AliveHandler.
// AliveHandler called periodically for active client connection.
func (c *Client) OnAlive(h AliveHandler) {
	c.eventHub.aliveHandler = h
}

// OnRefresh allows setting RefreshHandler.
// RefreshHandler called when it's time to refresh expiring client connection.
func (c *Client) OnRefresh(h RefreshHandler) {
	c.eventHub.refreshHandler = h
}

// OnDisconnect allows setting DisconnectHandler.
// DisconnectHandler called when client disconnected.
func (c *Client) OnDisconnect(h DisconnectHandler) {
	c.eventHub.disconnectHandler = h
}

// OnMessage allows setting MessageHandler.
// MessageHandler called when client sent asynchronous message.
func (c *Client) OnMessage(h MessageHandler) {
	c.eventHub.messageHandler = h
}

// OnRPC allows setting RPCHandler.
// RPCHandler will be executed on every incoming RPC call.
func (c *Client) OnRPC(h RPCHandler) {
	c.eventHub.rpcHandler = h
}

// OnSubRefresh allows setting SubRefreshHandler.
// SubRefreshHandler called when it's time to refresh client subscription.
func (c *Client) OnSubRefresh(h SubRefreshHandler) {
	c.eventHub.subRefreshHandler = h
}

// OnSubscribe allows setting SubscribeHandler.
// SubscribeHandler called when client subscribes on a channel.
func (c *Client) OnSubscribe(h SubscribeHandler) {
	c.eventHub.subscribeHandler = h
}

// OnUnsubscribe allows setting UnsubscribeHandler.
// UnsubscribeHandler called when client unsubscribes from channel.
func (c *Client) OnUnsubscribe(h UnsubscribeHandler) {
	c.eventHub.unsubscribeHandler = h
}

// OnPublish allows setting PublishHandler.
// PublishHandler called when client publishes message into channel.
func (c *Client) OnPublish(h PublishHandler) {
	c.eventHub.publishHandler = h
}

// OnPresence allows setting PresenceHandler.
// PresenceHandler called when Presence request from client received.
// At this moment you can only return a custom error or disconnect client.
func (c *Client) OnPresence(h PresenceHandler) {
	c.eventHub.presenceHandler = h
}

// OnPresenceStats allows settings PresenceStatsHandler.
// PresenceStatsHandler called when Presence Stats request from client received.
// At this moment you can only return a custom error or disconnect client.
func (c *Client) OnPresenceStats(h PresenceStatsHandler) {
	c.eventHub.presenceStatsHandler = h
}

// OnHistory allows settings HistoryHandler.
// HistoryHandler called when History request from client received.
// At this moment you can only return a custom error or disconnect client.
func (c *Client) OnHistory(h HistoryHandler) {
	c.eventHub.historyHandler = h
}

const (
	// flagSubscribed will be set upon successful Subscription to a channel.
	// Until that moment channel exists in client Channels map only to track
	// duplicate subscription requests.
	flagSubscribed uint8 = 1 << iota
	flagEmitPresence
	flagEmitJoinLeave
	flagPushJoinLeave
	flagPositioning
	flagServerSide
	flagClientSideRefresh
	flagDeltaAllowed
)

// ChannelContext contains extra context for channel connection subscribed to.
// Note: this struct is aligned to consume less memory.
type ChannelContext struct {
	subscribingCh     chan struct{}
	info              []byte
	streamPosition    StreamPosition
	expireAt          int64
	positionCheckTime int64
	metaTTLSeconds    int64
	flags             uint8
	// Source is a source of subscription application can set in SubscribeHandler.
	Source uint8
}

func channelHasFlag(flags, flag uint8) bool {
	return flags&flag != 0
}

type timerOp uint8

const (
	timerOpStale    timerOp = 1
	timerOpPresence timerOp = 2
	timerOpExpire   timerOp = 3
	timerOpPing     timerOp = 4
	timerOpPong     timerOp = 5
)

type status uint8

const (
	statusConnecting status = 1
	statusConnected  status = 2
	statusClosed     status = 3
)

// ConnectRequest can be used in a unidirectional connection case to
// pass initial connection information from a client-side.
type ConnectRequest struct {
	// Token is an optional token from a client.
	Token string
	// Data is an optional custom data from a client.
	Data []byte
	// Name of a client.
	Name string
	// Version of a client.
	Version string
	// Subs is a map with channel subscription state (for recovery on connect).
	Subs map[string]SubscribeRequest
	// Headers represent headers which may be used for headers emulation feature.
	Headers map[string]string
}

// SubscribeRequest contains state of subscription to a channel.
type SubscribeRequest struct {
	// Recover enables publication recovery for a channel.
	Recover bool
	// Epoch last seen by a client.
	Epoch string
	// Offset last seen by a client.
	Offset uint64
}

func (r *ConnectRequest) toProto() *protocol.ConnectRequest {
	if r == nil {
		return nil
	}
	req := &protocol.ConnectRequest{
		Token:   r.Token,
		Data:    r.Data,
		Name:    r.Name,
		Version: r.Version,
		Headers: r.Headers,
	}
	if len(r.Subs) > 0 {
		subs := make(map[string]*protocol.SubscribeRequest, len(r.Subs))
		for k, v := range r.Subs {
			subs[k] = &protocol.SubscribeRequest{
				Recover: v.Recover,
				Epoch:   v.Epoch,
				Offset:  v.Offset,
			}
		}
		req.Subs = subs
	}
	return req
}

// Client represents client connection to server.
type Client struct {
	mu                sync.RWMutex
	connectMu         sync.Mutex // allows syncing connect with disconnect.
	presenceMu        sync.Mutex // allows syncing presence routine with client closing.
	ctx               context.Context
	transport         Transport
	node              *Node
	exp               int64
	channels          map[string]ChannelContext
	messageWriter     *writer
	perChannelWriter  *perChannelWriter
	pubSubSync        *recovery.PubSubSync
	uid               string
	session           string
	user              string
	info              []byte
	storage           map[string]any
	storageMu         sync.Mutex
	metricName        string // Make a unique.Handle.
	metricVersion     string // Make a unique.Handle.
	authenticated     bool
	clientSideRefresh bool
	status            status
	timerOp           timerOp
	nextPresence      int64
	nextExpire        int64
	nextPing          int64
	nextPong          int64
	lastSeen          int64
	lastPing          int64
	pingInterval      time.Duration
	pongTimeout       time.Duration
	eventHub          *clientEventHub
	timer             *time.Timer
	timerCanceler     TimerCanceler // TimerCanceler if TimerScheduler is used.
	startWriterOnce   sync.Once
	pingPongLatency   atomic.Int64
	connectedAtMS     int64
	replyWithoutQueue bool
	unusable          bool
}

// ClientCloseFunc must be called on Transport handler close to clean up Client.
type ClientCloseFunc func() error

// NewClient initializes new Client.
func NewClient(ctx context.Context, n *Node, t Transport) (*Client, ClientCloseFunc, error) {
	uidObject, err := uuid.NewRandom()
	if err != nil {
		return nil, nil, err
	}
	uid := uidObject.String()

	var session string
	if t.Unidirectional() || t.Emulation() {
		sessionObject, err := uuid.NewRandom()
		if err != nil {
			return nil, nil, err
		}
		session = sessionObject.String()
	}

	client := &Client{
		ctx:           ctx,
		uid:           uid,
		session:       session,
		node:          n,
		transport:     t,
		channels:      make(map[string]ChannelContext),
		pubSubSync:    recovery.NewPubSubSync(),
		status:        statusConnecting,
		eventHub:      &clientEventHub{},
		connectedAtMS: time.Now().UnixMilli(),
	}
	client.pingPongLatency.Store(-1)

	staleCloseDelay := n.config.ClientStaleCloseDelay
	if staleCloseDelay > 0 {
		client.mu.Lock()
		client.timerOp = timerOpStale
		if client.node.timerScheduler != nil {
			client.timerCanceler = client.node.timerScheduler.ScheduleTimer(staleCloseDelay, client.onTimerOp)
		} else {
			client.timer = time.AfterFunc(staleCloseDelay, client.onTimerOp)
		}
		client.mu.Unlock()
	}
	return client, func() error { return client.close(DisconnectConnectionClosed) }, nil
}

var defaultUniErrorCodeToDisconnect = map[uint32]Disconnect{
	ErrorExpired.Code:          DisconnectExpired,
	ErrorTokenExpired.Code:     DisconnectExpired,
	ErrorTooManyRequests.Code:  DisconnectTooManyRequests,
	ErrorPermissionDenied.Code: DisconnectPermissionDenied,
}

func (c *Client) extractUnidirectionalDisconnect(err error) Disconnect {
	disconnect, ok := disconnectFromError(err)
	if ok {
		return *disconnect
	}
	var clientErr *Error
	if errors.As(err, &clientErr) {
		if c.node.config.UnidirectionalCodeToDisconnect != nil {
			if d, found := c.node.config.UnidirectionalCodeToDisconnect[clientErr.Code]; found {
				return d
			}
		}
		if d, found := defaultUniErrorCodeToDisconnect[clientErr.Code]; found {
			return d
		}
		return DisconnectServerError
	}
	return DisconnectServerError
}

// Connect supposed to be called only from a unidirectional transport layer
// to pass initial information about connection and thus initiate Node.OnConnecting
// event. Bidirectional transport initiate connecting workflow automatically
// since client passes Connect command upon successful connection establishment
// with a server. If there is an error during connect method processing Centrifuge
// extracts Disconnect from it and closes the connection with that Disconnect message.
func (c *Client) Connect(req ConnectRequest) {
	c.ProtocolConnect(req.toProto())
}

// ConnectNoErrorToDisconnect is the same as Client.Connect but does not try to extract
// Disconnect code from the error returned by the connect logic, instead it just returns
// the error to the caller. This error must be handled by the caller on the Transport level,
// and the connection must be closed on Transport level upon receiving an error.
func (c *Client) ConnectNoErrorToDisconnect(req ConnectRequest) error {
	return c.ProtocolConnectNoErrorToDisconnect(req.toProto())
}

// ProtocolConnect accepts protocol.ConnectRequest directly. It adds dependency to protocol package,
// so prefer using Connect or ConnectNoErrorToDisconnect methods until necessary.
func (c *Client) ProtocolConnect(req *protocol.ConnectRequest) {
	// unidirectionalConnect never returns errors when errorToDisconnect is true.
	_ = c.unidirectionalConnect(req, req.SizeVT(), true)
}

// ProtocolConnectNoErrorToDisconnect accepts protocol.ConnectRequest directly. It adds dependency to
// protocol package, so prefer ConnectNoErrorToDisconnect methods until necessary.
func (c *Client) ProtocolConnectNoErrorToDisconnect(req *protocol.ConnectRequest) error {
	return c.unidirectionalConnect(req, req.SizeVT(), false)
}

func (c *Client) getDisconnectPushReply(d Disconnect) ([]byte, error) {
	disconnect := &protocol.Disconnect{
		Code:   d.Code,
		Reason: d.Reason,
	}
	push := &protocol.Push{
		Disconnect: disconnect,
	}
	if c.node.logEnabled(LogLevelTrace) {
		c.traceOutPush(push)
	}
	return c.encodeReply(&protocol.Reply{
		Push: push,
	})
}

func hasFlag(flags, flag uint64) bool {
	return flags&flag != 0
}

func (c *Client) issueCommandReadEvent(cmd *protocol.Command, size int) error {
	if c.node.clientEvents.commandReadHandler != nil {
		return c.node.clientEvents.commandReadHandler(c, CommandReadEvent{
			Command:     cmd,
			CommandSize: size,
		})
	}
	return nil
}

func (c *Client) issueCommandProcessedEvent(event CommandProcessedEvent) {
	if c.node.clientEvents.commandProcessedHandler != nil {
		c.node.clientEvents.commandProcessedHandler(c, event)
	}
}

func (c *Client) unidirectionalConnect(connectRequest *protocol.ConnectRequest, connectCmdSize int, errorToDisconnect bool) error {
	started := time.Now()

	var cmd *protocol.Command

	if c.node.logEnabled(LogLevelTrace) {
		cmd = &protocol.Command{Id: 1, Connect: connectRequest}
		c.traceInCmd(cmd)
	}

	if c.node.clientEvents.commandReadHandler != nil {
		cmd = &protocol.Command{Id: 1, Connect: connectRequest}
		err := c.issueCommandReadEvent(cmd, connectCmdSize)
		if err != nil {
			if c.node.clientEvents.commandProcessedHandler != nil {
				c.handleCommandFinished(cmd, protocol.FrameTypeConnect, err, nil, started, "")
			}
			if errorToDisconnect {
				d := c.extractUnidirectionalDisconnect(err)
				go func() { _ = c.close(d) }()
				return nil
			}
			return err
		}
	}
	err := c.connectCmd(connectRequest, nil, time.Time{}, nil)
	if err != nil {
		if c.node.clientEvents.commandProcessedHandler != nil {
			c.handleCommandFinished(cmd, protocol.FrameTypeConnect, err, nil, started, "")
		}
		if errorToDisconnect {
			d := c.extractUnidirectionalDisconnect(err)
			go func() { _ = c.close(d) }()
			return nil
		}
		return err
	}
	if c.node.clientEvents.commandProcessedHandler != nil {
		c.handleCommandFinished(cmd, protocol.FrameTypeConnect, nil, nil, started, "")
	}
	c.triggerConnect()
	c.scheduleOnConnectTimers()
	return nil
}

func (c *Client) onTimerOp() {
	c.mu.Lock()
	if c.status == statusClosed {
		c.mu.Unlock()
		return
	}
	op := c.timerOp
	c.mu.Unlock()
	switch op {
	case timerOpStale:
		c.closeStale()
	case timerOpPresence:
		c.updatePresence()
	case timerOpExpire:
		c.expire()
	case timerOpPing:
		c.sendPing()
	case timerOpPong:
		c.checkPong()
	}
}

// Lock must be held outside.
func (c *Client) scheduleNextTimer() {
	if c.status == statusClosed {
		return
	}
	c.stopTimer() // Cancel any existing timer.
	var minEventTime int64
	var nextTimerOp timerOp
	var needTimer bool
	if c.nextExpire > 0 {
		nextTimerOp = timerOpExpire
		minEventTime = c.nextExpire
		needTimer = true
	}
	if c.nextPresence > 0 && (minEventTime == 0 || c.nextPresence < minEventTime) {
		nextTimerOp = timerOpPresence
		minEventTime = c.nextPresence
		needTimer = true
	}
	if c.nextPing > 0 && (minEventTime == 0 || c.nextPing < minEventTime) {
		nextTimerOp = timerOpPing
		minEventTime = c.nextPing
		needTimer = true
	}
	if c.nextPong > 0 && (minEventTime == 0 || c.nextPong < minEventTime) {
		nextTimerOp = timerOpPong
		minEventTime = c.nextPong
		needTimer = true
	}
	if needTimer {
		c.timerOp = nextTimerOp
		afterDuration := time.Duration(minEventTime-time.Now().UnixNano()) * time.Nanosecond
		if c.node.timerScheduler != nil {
			c.timerCanceler = c.node.timerScheduler.ScheduleTimer(afterDuration, c.onTimerOp)
		} else {
			if c.timer != nil {
				c.timer.Reset(afterDuration)
			} else {
				c.timer = time.AfterFunc(afterDuration, c.onTimerOp)
			}
		}
	}
}

// Lock must be held outside.
func (c *Client) stopTimer() {
	if c.node.timerScheduler != nil {
		if c.timerCanceler != nil {
			c.timerCanceler.Cancel()
			c.timerCanceler = nil
		}
	} else if c.timer != nil {
		c.timer.Stop()
	}
}

func getPingData(uni bool, protoType ProtocolType) []byte {
	if uni {
		if protoType == ProtocolTypeJSON {
			return jsonPingPush
		} else {
			return protobufPingPush
		}
	} else {
		if protoType == ProtocolTypeJSON {
			return jsonPingReply
		} else {
			return protobufPingReply
		}
	}
}

func (c *Client) sendPing() {
	c.mu.Lock()
	c.lastPing = time.Now().UnixNano()
	c.mu.Unlock()
	unidirectional := c.transport.Unidirectional()
	_ = c.writeEncodedPushData(getPingData(unidirectional, c.transport.Protocol()), "", protocol.FrameTypeServerPing, ChannelBatchConfig{})
	if c.node.logEnabled(LogLevelTrace) {
		c.traceOutReply(emptyReply)
	}
	c.mu.Lock()
	if c.pongTimeout > 0 && !unidirectional {
		c.nextPong = time.Now().Add(c.pongTimeout).UnixNano()
	}
	c.addPingUpdate(false, true)
	c.mu.Unlock()
}

func (c *Client) checkPong() {
	c.mu.RLock()
	lastPing := c.lastPing
	if lastPing < 0 {
		lastPing = -lastPing
	}
	lastSeen := c.lastSeen
	c.mu.RUnlock()
	if lastSeen < lastPing {
		go func() { c.Disconnect(DisconnectNoPong) }()
		return
	}
	diff := lastSeen - lastPing
	c.node.metrics.observePingPongDuration(time.Duration(diff)*time.Nanosecond, c.transport.Name())
	c.pingPongLatency.Store(diff)
	c.mu.Lock()
	c.nextPong = 0
	c.scheduleNextTimer()
	c.mu.Unlock()
}

// Lock must be held outside.
func (c *Client) addPingUpdate(isFirst bool, scheduleNext bool) {
	delay := c.pingInterval
	if isFirst {
		// Send first ping in random interval between PingInterval/2 and PingInterval to
		// spread ping-pongs in time (useful when many connections reconnect
		// almost immediately).
		pingNanoseconds := c.pingInterval.Nanoseconds()
		delay = time.Duration(pingNanoseconds/2) + time.Duration(randSource.Int63n(pingNanoseconds/2))*time.Nanosecond
	}
	c.nextPing = time.Now().Add(delay).UnixNano()
	if scheduleNext {
		c.scheduleNextTimer()
	}
}

// Lock must be held outside.
func (c *Client) addPresenceUpdate(isFirst bool, scheduleNext bool) {
	delay := c.node.config.ClientPresenceUpdateInterval
	if isFirst {
		// Spread in time first presence update.
		intervalNanoseconds := c.node.config.ClientPresenceUpdateInterval.Nanoseconds()
		delay = time.Duration(intervalNanoseconds/2) + time.Duration(randSource.Int63n(intervalNanoseconds/2))*time.Nanosecond
	}
	c.nextPresence = time.Now().Add(delay).UnixNano()
	if scheduleNext {
		c.scheduleNextTimer()
	}
}

// Lock must be held outside.
func (c *Client) addExpireUpdate(after time.Duration, scheduleNext bool) {
	c.nextExpire = time.Now().Add(after).UnixNano()
	if scheduleNext {
		c.scheduleNextTimer()
	}
}

// closeStale closes connection if it's not authenticated yet, or it's
// unusable but still not closed. At moment used to close client connections
// which have not sent valid connect command in a reasonable time interval after
// establishing connection with a server.
func (c *Client) closeStale() {
	c.mu.RLock()
	authenticated := c.authenticated
	unusable := c.unusable
	closed := c.status == statusClosed
	c.mu.RUnlock()
	if (!authenticated || unusable) && !closed {
		_ = c.close(DisconnectStale)
	}
}

func (c *Client) writeEncodedPushData(data []byte, ch string, frameType protocol.FrameType, batchConfig ChannelBatchConfig) error {
	item := queue.Item{
		Data:      data,
		FrameType: frameType,
	}
	if c.node.config.Metrics.GetChannelNamespaceLabel != nil {
		item.Channel = ch
	}
	if ch != "" && (batchConfig.MaxSize > 0 || batchConfig.MaxDelay > 0) &&
		(item.FrameType == protocol.FrameTypePushPublication ||
			item.FrameType == protocol.FrameTypePushJoin ||
			item.FrameType == protocol.FrameTypePushLeave) {
		// Per channel writer helps to batch messages on the channel level working as
		// an intermediary buffer before client's connection writer.
		c.perChannelWriter.Add(item, ch, batchConfig)
		return nil
	}
	disconnect := c.messageWriter.enqueue(item)
	if disconnect != nil {
		// close in goroutine to not block message broadcast.
		go func() { _ = c.close(*disconnect) }()
		return io.EOF
	}
	return nil
}

// updateChannelPresence updates client presence info for channel so it
// won't expire until client disconnect.
func (c *Client) updateChannelPresence(ch string, chCtx ChannelContext) error {
	if !channelHasFlag(chCtx.flags, flagEmitPresence) {
		return nil
	}
	c.mu.RLock()
	if _, ok := c.channels[ch]; !ok {
		c.mu.RUnlock()
		return nil
	}
	c.mu.RUnlock()
	return c.node.addPresence(ch, c.uid, &ClientInfo{
		ClientID: c.uid,
		UserID:   c.user,
		ConnInfo: c.info,
		ChanInfo: chCtx.info,
	})
}

// Context returns client Context. This context will be canceled
// as soon as client connection closes.
func (c *Client) Context() context.Context {
	return c.ctx
}

func (c *Client) checkSubscriptionExpiration(channel string, channelContext ChannelContext, delay time.Duration, resultCB func(bool)) {
	nowUnix := c.node.nowTimeGetter().Unix()
	expireAt := channelContext.expireAt
	clientSideRefresh := channelHasFlag(channelContext.flags, flagClientSideRefresh)
	if expireAt > 0 && nowUnix > expireAt+int64(delay.Seconds()) {
		// Subscription expired.
		if clientSideRefresh || c.eventHub.subRefreshHandler == nil {
			// The only way subscription could be refreshed in this case is via
			// SUB_REFRESH command sent from client but looks like that command
			// with new refreshed token have not been received in configured window.
			resultCB(false)
			return
		}
		cb := func(reply SubRefreshReply, err error) {
			if err != nil {
				resultCB(false)
				return
			}
			newExpireAt := min(reply.ExpireAt, nowUnix+maxTTLSeconds)
			if reply.Expired || (newExpireAt > 0 && newExpireAt < nowUnix) {
				resultCB(false)
				return
			}
			c.mu.Lock()
			if ctx, ok := c.channels[channel]; ok {
				if len(reply.Info) > 0 {
					ctx.info = reply.Info
				}
				ctx.expireAt = newExpireAt
				c.channels[channel] = ctx
			}
			c.mu.Unlock()
			resultCB(true)
		}
		// Give subscription a chance to be refreshed via SubRefreshHandler.
		event := SubRefreshEvent{Channel: channel}
		c.eventHub.subRefreshHandler(event, cb)
		return
	}
	resultCB(true)
}

// updatePresence used for various periodic actions we need to do with client connections.
func (c *Client) updatePresence() {
	c.presenceMu.Lock()
	defer c.presenceMu.Unlock()
	config := c.node.config
	c.mu.Lock()
	unusable := c.unusable
	if c.status == statusClosed {
		c.mu.Unlock()
		return
	}
	channels := make(map[string]ChannelContext, len(c.channels))
	for channel, channelContext := range c.channels {
		if !channelHasFlag(channelContext.flags, flagSubscribed) {
			continue
		}
		channels[channel] = channelContext
	}
	c.mu.Unlock()

	if unusable {
		go c.closeStale()
		return
	}

	if c.eventHub.aliveHandler != nil {
		c.eventHub.aliveHandler()
	}

	for channel, channelContext := range channels {
		err := c.updateChannelPresence(channel, channelContext)
		if err != nil {
			c.node.logger.log(newErrorLogEntry(err, "error updating presence for channel", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
		}

		c.checkSubscriptionExpiration(channel, channelContext, config.ClientExpiredSubCloseDelay, func(result bool) {
			if !result {
				serverSide := channelHasFlag(channelContext.flags, flagServerSide)
				if c.isAsyncUnsubscribe(serverSide) {
					go func(ch string) { c.handleAsyncUnsubscribe(ch, unsubscribeExpired) }(channel)
				} else {
					go func() { _ = c.close(DisconnectSubExpired) }()
				}
			}
		})

		checkDelay := config.ClientChannelPositionCheckDelay
		if checkDelay > 0 && !c.checkPosition(checkDelay, channel, channelContext) {
			serverSide := channelHasFlag(channelContext.flags, flagServerSide)
			if c.node.logger.enabled(LogLevelDebug) {
				c.node.logger.log(newLogEntry(LogLevelDebug, "client insufficient state from periodic check", map[string]any{"channel": channel, "user": c.user, "client": c.uid}))
			}
			if c.isAsyncUnsubscribe(serverSide) {
				go func(ch string) { c.handleAsyncUnsubscribe(ch, unsubscribeInsufficientState) }(channel)
				continue
			} else {
				go func() { c.handleInsufficientStateDisconnect() }()
				// No need to proceed after close.
				return
			}
		}
	}
	c.mu.Lock()
	c.addPresenceUpdate(false, true)
	c.mu.Unlock()
}

func (c *Client) checkPosition(checkDelay time.Duration, ch string, chCtx ChannelContext) bool {
	if !channelHasFlag(chCtx.flags, flagPositioning) {
		return true
	}
	nowUnix := c.node.nowTimeGetter().Unix()

	needCheckPosition := nowUnix-chCtx.positionCheckTime > int64(checkDelay.Seconds())
	if !needCheckPosition {
		return true
	}

	var historyMetaTTL time.Duration
	if chCtx.metaTTLSeconds > 0 {
		historyMetaTTL = time.Duration(chCtx.metaTTLSeconds) * time.Second
	}

	c.mu.Lock()
	if c.status == statusClosed {
		c.mu.Unlock()
		return true
	}
	chCtx, ok := c.channels[ch]
	if !ok || !channelHasFlag(chCtx.flags, flagSubscribed) {
		c.mu.Unlock()
		return true
	}
	position := chCtx.streamPosition
	c.mu.Unlock()

	validPosition, err := c.node.checkPosition(ch, position, historyMetaTTL)
	if err != nil {
		// Check later.
		return true
	}
	if validPosition {
		c.mu.Lock()
		if chContext, ok := c.channels[ch]; ok {
			chContext.positionCheckTime = nowUnix
			c.channels[ch] = chContext
		}
		c.mu.Unlock()
	}
	return validPosition
}

// ID returns unique client connection id.
func (c *Client) ID() string {
	return c.uid
}

// sessionID returns unique client session id. Session ID is not shared to other
// connections in any way.
func (c *Client) sessionID() string {
	return c.session
}

// UserID returns user id associated with client connection.
func (c *Client) UserID() string {
	return c.user
}

// Info returns connection info.
func (c *Client) Info() []byte {
	c.mu.Lock()
	info := make([]byte, len(c.info))
	copy(info, c.info)
	c.mu.Unlock()
	return info
}

// ConnectedAtMS returns timestamp in milliseconds when client connected.
func (c *Client) ConnectedAtMS() int64 {
	return c.connectedAtMS
}

// LatestPingPongLatency returns latest ping-pong latency duration. It may be not
// available if no ping-pong messages were exchanged yet, or in case of unidirectional
// transport. In that case second return value will be false.
func (c *Client) LatestPingPongLatency() (time.Duration, bool) {
	val := c.pingPongLatency.Load()
	if val < 0 {
		// If ping-pong latency is negative then it means that we have not sent
		// any ping yet, and thus we do not have any latency info. Or in case of
		// unidirectional connection we do not have this info also.
		return 0, false
	}
	return time.Duration(c.pingPongLatency.Load()) * time.Nanosecond, true
}

// Transport returns client connection transport information.
func (c *Client) Transport() TransportInfo {
	return c.transport
}

// Channels returns a slice of channels client connection currently subscribed to.
func (c *Client) Channels() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	channels := make([]string, 0, len(c.channels))
	for ch, ctx := range c.channels {
		if !channelHasFlag(ctx.flags, flagSubscribed) {
			continue
		}
		channels = append(channels, ch)
	}
	return channels
}

// ChannelsWithContext returns a map of channels client connection currently subscribed to
// with a ChannelContext.
func (c *Client) ChannelsWithContext() map[string]ChannelContext {
	c.mu.RLock()
	defer c.mu.RUnlock()
	channels := make(map[string]ChannelContext, len(c.channels))
	for ch, ctx := range c.channels {
		if !channelHasFlag(ctx.flags, flagSubscribed) {
			continue
		}
		channels[ch] = ctx
	}
	return channels
}

// IsSubscribed returns true if client subscribed to a channel.
func (c *Client) IsSubscribed(ch string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	ctx, ok := c.channels[ch]
	return ok && channelHasFlag(ctx.flags, flagSubscribed)
}

// Send data to client. This sends an asynchronous message – data will be
// just written to connection. on client side this message can be handled
// with Message handler.
func (c *Client) Send(data []byte) error {
	if hasFlag(c.transport.DisabledPushFlags(), PushFlagMessage) {
		return nil
	}
	replyData, err := c.getSendPushReply(data)
	if err != nil {
		return err
	}
	return c.writeEncodedPushData(replyData, "", protocol.FrameTypePushMessage, ChannelBatchConfig{})
}

func (c *Client) encodeReply(reply *protocol.Reply) ([]byte, error) {
	protoType := c.transport.Protocol().toProto()
	if c.transport.Unidirectional() {
		encoder := protocol.GetPushEncoder(protoType)
		return encoder.Encode(reply.Push)
	} else {
		encoder := protocol.GetReplyEncoder(protoType)
		return encoder.Encode(reply)
	}
}

func (c *Client) getSendPushReply(data []byte) ([]byte, error) {
	p := &protocol.Message{
		Data: data,
	}
	return c.encodeReply(&protocol.Reply{
		Push: &protocol.Push{
			Message: p,
		},
	})
}

// Unsubscribe allows unsubscribing client from channel.
func (c *Client) Unsubscribe(ch string, unsubscribe ...Unsubscribe) {
	if len(unsubscribe) > 1 {
		panic("Client.Unsubscribe called with more than 1 unsubscribe argument")
	}
	c.mu.RLock()
	if c.status == statusClosed {
		c.mu.RUnlock()
		return
	}
	c.mu.RUnlock()

	unsub := unsubscribeServer
	if len(unsubscribe) > 0 {
		unsub = unsubscribe[0]
	}

	err := c.unsubscribe(ch, unsub, nil)
	if err != nil {
		c.node.logger.log(newErrorLogEntry(err, "error unsubscribe", map[string]any{"channel": ch, "user": c.user, "client": c.uid, "error": err.Error()}))
		go c.Disconnect(DisconnectServerError)
		return
	}
	_ = c.sendUnsubscribe(ch, unsub)
}

func (c *Client) sendUnsubscribe(ch string, unsub Unsubscribe) error {
	if hasFlag(c.transport.DisabledPushFlags(), PushFlagUnsubscribe) {
		return nil
	}
	replyData, err := c.getUnsubscribePushReply(ch, unsub)
	if err != nil {
		return err
	}
	_ = c.writeEncodedPushData(replyData, ch, protocol.FrameTypePushUnsubscribe, ChannelBatchConfig{})
	c.node.metrics.incServerUnsubscribe(unsub.Code, ch)
	return nil
}

func (c *Client) getUnsubscribePushReply(ch string, unsub Unsubscribe) ([]byte, error) {
	p := &protocol.Unsubscribe{
		Code:   unsub.Code,
		Reason: unsub.Reason,
	}
	return c.encodeReply(&protocol.Reply{
		Push: &protocol.Push{
			Channel:     ch,
			Unsubscribe: p,
		},
	})
}

// Disconnect client connection with specific disconnect code and reason.
// If zero args or nil passed then DisconnectForceNoReconnect is used.
//
// This method internally creates a new goroutine at the moment to do
// closing stuff. An extra goroutine is required to solve disconnect
// and alive callback ordering/sync problems. Will be a noop if client
// already closed. As this method runs a separate goroutine client
// connection will be closed eventually (i.e. not immediately).
func (c *Client) Disconnect(disconnect ...Disconnect) {
	if len(disconnect) > 1 {
		panic("Client.Disconnect called with more than 1 argument")
	}
	go func() {
		if len(disconnect) == 0 {
			_ = c.close(DisconnectForceNoReconnect)
		} else {
			_ = c.close(disconnect[0])
		}
	}()
}

func (c *Client) close(disconnect Disconnect) error {
	c.startWriter(0, 0, 0)
	c.presenceMu.Lock()
	defer c.presenceMu.Unlock()
	c.connectMu.Lock()
	defer c.connectMu.Unlock()
	c.mu.Lock()
	if c.status == statusClosed {
		c.mu.Unlock()
		return nil
	}
	prevStatus := c.status
	c.status = statusClosed

	c.stopTimer()

	channels := make(map[string]ChannelContext, len(c.channels))
	for channel, channelContext := range c.channels {
		channels[channel] = channelContext
	}
	c.mu.Unlock()

	// Unsubscribe from all channels.
	for channel := range channels {
		err := c.unsubscribe(channel, unsubscribeDisconnect, &disconnect)
		if err != nil {
			c.node.logger.log(newErrorLogEntry(err, "error unsubscribing client from channel", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
		}
	}

	c.mu.RLock()
	authenticated := c.authenticated
	c.mu.RUnlock()

	if authenticated {
		c.node.removeClient(c)
	}

	if disconnect.Code != DisconnectConnectionClosed.Code && !hasFlag(c.transport.DisabledPushFlags(), PushFlagDisconnect) {
		if replyData, err := c.getDisconnectPushReply(disconnect); err == nil {
			_ = c.writeEncodedPushData(replyData, "", protocol.FrameTypePushDisconnect, ChannelBatchConfig{})
		}
	}

	// close writer and send messages remaining in writer queue if any.
	flushRemaining := disconnect.Code != DisconnectConnectionClosed.Code && disconnect.Code != DisconnectSlow.Code
	if c.perChannelWriter != nil {
		c.perChannelWriter.Close(flushRemaining)
	}
	_ = c.messageWriter.close(flushRemaining)

	_ = c.transport.Close(disconnect)

	if disconnect.Code != DisconnectConnectionClosed.Code {
		c.node.logger.log(newLogEntry(LogLevelDebug, "closing client connection", map[string]any{"client": c.uid, "user": c.user, "reason": disconnect.Reason}))
	}
	if disconnect.Code != DisconnectConnectionClosed.Code {
		c.node.metrics.incServerDisconnect(disconnect.Code)
	}
	if c.eventHub.disconnectHandler != nil && prevStatus == statusConnected {
		c.eventHub.disconnectHandler(DisconnectEvent{
			Disconnect: disconnect,
		})
	}
	return nil
}

func (c *Client) traceInCmd(cmd *protocol.Command) {
	c.mu.RLock()
	user := c.user
	c.mu.RUnlock()
	jsonBytes, err := json.Marshal(cmd)
	if err != nil {
		jsonBytes, _ = protojson.Marshal(cmd)
	}
	c.node.logger.log(newLogEntry(LogLevelTrace, "<-in--", map[string]any{"client": c.ID(), "user": user, "command": string(jsonBytes)}))
}

func (c *Client) traceOutReply(rep *protocol.Reply) {
	c.mu.RLock()
	user := c.user
	c.mu.RUnlock()
	jsonBytes, err := json.Marshal(rep)
	if err != nil {
		jsonBytes, _ = protojson.Marshal(rep)
	}
	c.node.logger.log(newLogEntry(LogLevelTrace, "-out->", map[string]any{"client": c.ID(), "user": user, "reply": string(jsonBytes)}))
}

func (c *Client) traceOutPush(push *protocol.Push) {
	c.mu.RLock()
	user := c.user
	c.mu.RUnlock()
	jsonBytes, err := json.Marshal(push)
	if err != nil {
		jsonBytes, _ = protojson.Marshal(push)
	}
	c.node.logger.log(newLogEntry(LogLevelTrace, "-out->", map[string]any{"client": c.ID(), "user": user, "push": string(jsonBytes)}))
}

// Lock must be held outside.
func (c *Client) clientInfo(ch string) *ClientInfo {
	var channelInfo protocol.Raw
	channelContext, ok := c.channels[ch]
	if ok && channelHasFlag(channelContext.flags, flagSubscribed) {
		channelInfo = channelContext.info
	}
	return &ClientInfo{
		ClientID: c.uid,
		UserID:   c.user,
		ConnInfo: c.info,
		ChanInfo: channelInfo,
	}
}

const redacted = "<REDACTED>"

func redactCommand(cmd *protocol.Command) *protocol.Command {
	if cmd.Connect != nil && cmd.Connect.Token != "" {
		cmd.Connect.Token = redacted
	}
	if cmd.Connect != nil && len(cmd.Connect.Headers) > 0 {
		for k := range cmd.Connect.Headers {
			cmd.Connect.Headers[k] = redacted
		}
	}
	if cmd.Subscribe != nil && cmd.Subscribe.Token != "" {
		cmd.Subscribe.Token = redacted
	}
	if cmd.Refresh != nil && cmd.Refresh.Token != "" {
		cmd.Refresh.Token = redacted
	}
	if cmd.SubRefresh != nil && cmd.SubRefresh.Token != "" {
		cmd.SubRefresh.Token = redacted
	}

	return cmd
}

// HandleCommand processes a single protocol.Command. Supposed to be called only
// from a transport connection reader.
func (c *Client) HandleCommand(cmd *protocol.Command, cmdProtocolSize int) bool {
	c.mu.Lock()
	if c.status == statusClosed {
		c.mu.Unlock()
		return false
	}
	unusable := c.unusable
	c.mu.Unlock()

	if unusable {
		go func() { _ = c.close(DisconnectBadRequest) }()
		return false
	}

	if c.node.logEnabled(LogLevelTrace) {
		c.traceInCmd(cmd)
	}

	select {
	case <-c.ctx.Done():
		return false
	default:
	}

	disconnect, proceed := c.dispatchCommand(cmd, cmdProtocolSize)

	select {
	case <-c.ctx.Done():
		return false
	default:
	}
	if disconnect != nil {
		if disconnect.Code != DisconnectConnectionClosed.Code {
			c.node.logger.log(newLogEntry(LogLevelInfo, "disconnect after handling command", map[string]any{"command": fmt.Sprintf("%v", redactCommand(cmd)), "client": c.ID(), "user": c.UserID(), "reason": disconnect.Reason}))
		}
		go func() { _ = c.close(*disconnect) }()
		return false
	}
	return proceed
}

// isPong is a helper method to check whether the command from the client
// is a pong to server ping. It's actually an empty command.
func isPong(cmd *protocol.Command) bool {
	return cmd.Id == 0 && cmd.Send == nil
}

func (c *Client) handleCommandFinished(cmd *protocol.Command, frameType protocol.FrameType, err error, reply *protocol.Reply, started time.Time, ch string) {
	defer func() {
		c.node.metrics.observeCommandDuration(frameType, time.Since(started), ch)
	}()
	if c.node.clientEvents.commandProcessedHandler != nil {
		event := newCommandProcessedEvent(cmd, err, reply, started)
		c.issueCommandProcessedEvent(event)
	}
}

func (c *Client) handleCommandDispatchError(ch string, cmd *protocol.Command, frameType protocol.FrameType, err error, started time.Time) (*Disconnect, bool) {
	defer func() {
		c.node.metrics.observeCommandDuration(frameType, time.Since(started), ch)
	}()
	disconnect, ok := disconnectFromError(err)
	if ok {
		if c.node.clientEvents.commandProcessedHandler != nil {
			event := newCommandProcessedEvent(cmd, err, nil, started)
			c.issueCommandProcessedEvent(event)
		}
		return disconnect, false
	}
	if cmd.Connect != nil {
		c.mu.Lock()
		c.unusable = true
		c.mu.Unlock()
	}
	errorReply := &protocol.Reply{Error: toClientErr(err).toProto()}
	c.writeError(ch, frameType, cmd, errorReply, nil)
	if c.node.clientEvents.commandProcessedHandler != nil {
		event := newCommandProcessedEvent(cmd, err, errorReply, started)
		c.issueCommandProcessedEvent(event)
	}
	return nil, cmd.Connect == nil
}

func (c *Client) dispatchCommand(cmd *protocol.Command, cmdSize int) (*Disconnect, bool) {
	c.mu.Lock()
	if c.status == statusClosed {
		c.mu.Unlock()
		return nil, false
	}
	c.mu.Unlock()
	isConnect := cmd.Connect != nil
	if !c.authenticated && !isConnect {
		if c.node.logEnabled(LogLevelDebug) {
			c.node.logger.log(newLogEntry(LogLevelDebug, "unexpected frame before connect", map[string]any{"client": c.ID()}))
		}
		return &DisconnectBadRequest, false
	}

	var metricChannel string
	var frameType protocol.FrameType
	defer func() {
		c.node.metrics.incTransportMessagesReceived(c.transport.Name(), frameType, metricChannel, cmdSize)
	}()

	if isPong(cmd) {
		frameType = protocol.FrameTypeClientPong
		c.mu.Lock()
		if c.status == statusClosed {
			c.mu.Unlock()
			return nil, false
		}
		if c.lastPing <= 0 {
			// No ping was issued, unnecessary pong.
			c.mu.Unlock()
			if c.node.logEnabled(LogLevelDebug) {
				c.node.logger.log(newLogEntry(LogLevelDebug, "disconnect client due to unnecessary pong", map[string]any{"client": c.ID(), "user": c.UserID()}))
			}
			return &DisconnectBadRequest, false
		}
		// upon receiving pong we change a sign of lastPing value. This way we can handle
		// unnecessary pongs sent by the client and still use lastPing value in Client.checkPong.
		c.lastPing = -c.lastPing
		c.lastSeen = time.Now().UnixNano()
		c.mu.Unlock()
		return nil, true
	}

	if cmd.Id == 0 && cmd.Send == nil {
		// Now as pong processed make sure that command has id > 0 (except Send).
		return &DisconnectBadRequest, false
	}

	started := time.Now()

	if cmd.Connect != nil {
		frameType = protocol.FrameTypeConnect
	} else if cmd.Subscribe != nil {
		metricChannel = cmd.Subscribe.Channel
		frameType = protocol.FrameTypeSubscribe
	} else if cmd.Unsubscribe != nil {
		metricChannel = cmd.Unsubscribe.Channel
		frameType = protocol.FrameTypeUnsubscribe
	} else if cmd.Publish != nil {
		metricChannel = cmd.Publish.Channel
		frameType = protocol.FrameTypePublish
	} else if cmd.Presence != nil {
		metricChannel = cmd.Presence.Channel
		frameType = protocol.FrameTypePresence
	} else if cmd.PresenceStats != nil {
		metricChannel = cmd.PresenceStats.Channel
		frameType = protocol.FrameTypePresenceStats
	} else if cmd.History != nil {
		metricChannel = cmd.History.Channel
		frameType = protocol.FrameTypeHistory
	} else if cmd.Rpc != nil {
		frameType = protocol.FrameTypeRPC
	} else if cmd.Send != nil {
		frameType = protocol.FrameTypeSend
	} else if cmd.Refresh != nil {
		frameType = protocol.FrameTypeRefresh
	} else if cmd.SubRefresh != nil {
		metricChannel = cmd.SubRefresh.Channel
		frameType = protocol.FrameTypeSubRefresh
	} else {
		return &DisconnectBadRequest, false
	}

	var handleErr error

	handleErr = c.issueCommandReadEvent(cmd, cmdSize)
	if handleErr != nil {
		return c.handleCommandDispatchError(metricChannel, cmd, frameType, handleErr, started)
	}

	if cmd.Connect != nil {
		handleErr = c.handleConnect(cmd.Connect, cmd, started, nil)
	} else if cmd.Ping != nil {
		handleErr = c.handlePing(cmd, started, nil)
	} else if cmd.Subscribe != nil {
		handleErr = c.handleSubscribe(cmd.Subscribe, cmd, started, nil)
	} else if cmd.Unsubscribe != nil {
		handleErr = c.handleUnsubscribe(cmd.Unsubscribe, cmd, started, nil)
	} else if cmd.Publish != nil {
		handleErr = c.handlePublish(cmd.Publish, cmd, started, nil)
	} else if cmd.Presence != nil {
		handleErr = c.handlePresence(cmd.Presence, cmd, started, nil)
	} else if cmd.PresenceStats != nil {
		handleErr = c.handlePresenceStats(cmd.PresenceStats, cmd, started, nil)
	} else if cmd.History != nil {
		handleErr = c.handleHistory(cmd.History, cmd, started, nil)
	} else if cmd.Rpc != nil {
		handleErr = c.handleRPC(cmd.Rpc, cmd, started, nil)
	} else if cmd.Send != nil {
		handleErr = c.handleSend(cmd.Send, cmd, started)
	} else if cmd.Refresh != nil {
		handleErr = c.handleRefresh(cmd.Refresh, cmd, started, nil)
	} else if cmd.SubRefresh != nil {
		handleErr = c.handleSubRefresh(cmd.SubRefresh, cmd, started, nil)
	} else {
		return &DisconnectBadRequest, false
	}
	if handleErr != nil {
		return c.handleCommandDispatchError(metricChannel, cmd, frameType, handleErr, started)
	}
	return nil, true
}

func (c *Client) writeEncodedCommandReply(ch string, frameType protocol.FrameType, cmd *protocol.Command, rep *protocol.Reply, rw *replyWriter) {
	rep.Id = cmd.Id
	if rep.Error != nil {
		if c.node.logEnabled(LogLevelInfo) {
			c.node.logger.log(newLogEntry(LogLevelInfo, "client command error", map[string]any{"reply": fmt.Sprintf("%v", rep), "command": fmt.Sprintf("%v", redactCommand(cmd)), "client": c.ID(), "user": c.UserID(), "error": rep.Error.Message, "code": rep.Error.Code}))
		}
		c.node.metrics.incReplyError(frameType, rep.Error.Code, ch)
	}

	protoType := c.transport.Protocol().toProto()
	replyEncoder := protocol.GetReplyEncoder(protoType)

	replyData, err := replyEncoder.Encode(rep)
	if err != nil {
		c.node.logger.log(newErrorLogEntry(err, "error encoding reply", map[string]any{"reply": fmt.Sprintf("%v", rep), "client": c.ID(), "user": c.UserID(), "error": err.Error()}))
		go func() { _ = c.close(DisconnectInappropriateProtocol) }()
		return
	}

	// Note: avoid adding *Reply to item since it's pooled.
	item := queue.Item{
		Data:      replyData,
		FrameType: frameType,
	}
	if ch != "" && c.node.config.Metrics.GetChannelNamespaceLabel != nil {
		item.Channel = ch
	}

	if c.replyWithoutQueue {
		err = c.messageWriter.config.WriteFn(item)
		if err != nil {
			go func() { _ = c.close(DisconnectWriteError) }()
		}
	} else {
		disconnect := c.messageWriter.enqueue(item)
		if disconnect != nil {
			go func() { _ = c.close(*disconnect) }()
		}
	}
	if rw != nil {
		rw.write(rep)
	}
	if c.node.logEnabled(LogLevelTrace) {
		c.traceOutReply(rep)
	}
}

func (c *Client) checkExpired() {
	c.mu.RLock()
	closed := c.status == statusClosed
	clientSideRefresh := c.clientSideRefresh
	exp := c.exp
	c.mu.RUnlock()
	if closed || exp == 0 {
		return
	}
	now := time.Now().Unix()
	ttl := exp - now

	if !clientSideRefresh && c.eventHub.refreshHandler != nil {
		if ttl > 0 {
			c.mu.Lock()
			if c.status != statusClosed {
				c.addExpireUpdate(time.Duration(ttl)*time.Second, true)
			}
			c.mu.Unlock()
		}
	}

	if ttl > 0 {
		// Connection was successfully refreshed.
		return
	}

	_ = c.close(DisconnectExpired)
}

// A protection against too long connection and subscription TTL which is likely
// a bug and may result into overflow of time.Duration type usage (~292 years max in Go).
// It's possible to go without expiration at all rather than having longer TTL.
const maxTTLSeconds = 365 * 24 * 3600

func (c *Client) expire() {
	c.mu.RLock()
	closed := c.status == statusClosed
	clientSideRefresh := c.clientSideRefresh
	exp := c.exp
	c.mu.RUnlock()
	if closed || exp == 0 {
		return
	}
	if !clientSideRefresh && c.eventHub.refreshHandler != nil {
		cb := func(reply RefreshReply, err error) {
			if err != nil {
				disconnect, ok := disconnectFromError(err)
				if ok {
					_ = c.close(*disconnect)
					return
				}
				c.node.logger.log(newErrorLogEntry(err, "unexpected error from refresh handler", map[string]any{"user": c.user, "client": c.uid, "error": err.Error()}))
				_ = c.close(DisconnectServerError)
				return
			}
			if reply.Expired {
				_ = c.close(DisconnectExpired)
				return
			}
			nowUnix := time.Now().Unix()
			expireAt := min(reply.ExpireAt, nowUnix+maxTTLSeconds)
			if expireAt > 0 {
				c.mu.Lock()
				c.exp = expireAt
				if reply.Info != nil {
					c.info = reply.Info
				}
				c.mu.Unlock()
			}
			c.checkExpired()
		}
		c.eventHub.refreshHandler(RefreshEvent{}, cb)
	} else {
		c.checkExpired()
	}
}

func (c *Client) handleConnect(req *protocol.ConnectRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	err := c.connectCmd(req, cmd, started, rw)
	if err != nil {
		return err
	}
	c.triggerConnect()
	c.scheduleOnConnectTimers()
	return nil
}

func (c *Client) triggerConnect() {
	c.connectMu.Lock()
	defer c.connectMu.Unlock()
	if c.status != statusConnecting {
		return
	}
	if c.node.clientEvents.connectHandler == nil {
		c.status = statusConnected
		return
	}
	c.node.clientEvents.connectHandler(c)
	c.status = statusConnected
}

func (c *Client) scheduleOnConnectTimers() {
	// Make presence and refresh handlers always run after client connect event.
	c.mu.Lock()
	c.addPresenceUpdate(true, false)
	if c.exp > 0 {
		expireAfter := time.Duration(c.exp-time.Now().Unix()) * time.Second
		if c.clientSideRefresh {
			conf := c.node.config
			expireAfter += conf.ClientExpiredCloseDelay
		}
		c.addExpireUpdate(expireAfter, false)
	}
	if c.pingInterval > 0 {
		c.addPingUpdate(true, false)
	}
	// Only schedule next timer once here after setting required points in time for ops.
	c.scheduleNextTimer()
	c.mu.Unlock()
}

func (c *Client) Refresh(opts ...RefreshOption) error {
	refreshOptions := &RefreshOptions{}
	for _, opt := range opts {
		opt(refreshOptions)
	}
	if refreshOptions.Expired {
		go func() { _ = c.close(DisconnectExpired) }()
		return nil
	}

	nowUnix := time.Now().Unix()
	expireAt := min(refreshOptions.ExpireAt, nowUnix+maxTTLSeconds)
	info := refreshOptions.Info

	res := &protocol.Refresh{
		Expires: expireAt > 0,
	}

	ttl := expireAt - nowUnix

	if ttl > 0 {
		res.Ttl = uint32(ttl)
	}

	if expireAt > 0 {
		// connection check enabled
		if ttl > 0 {
			// connection refreshed, update client timestamp and set new expiration timeout
			c.mu.Lock()
			c.exp = expireAt
			if len(info) > 0 {
				c.info = info
			}
			duration := time.Duration(ttl)*time.Second + c.node.config.ClientExpiredCloseDelay
			c.addExpireUpdate(duration, true)
			c.mu.Unlock()
		} else {
			go func() { _ = c.close(DisconnectExpired) }()
			return nil
		}
	} else {
		c.mu.Lock()
		c.exp = 0
		c.mu.Unlock()
	}

	replyData, err := c.getRefreshPushReply(res)
	if err != nil {
		return err
	}
	return c.writeEncodedPushData(replyData, "", protocol.FrameTypePushRefresh, ChannelBatchConfig{})
}

func (c *Client) getRefreshPushReply(res *protocol.Refresh) ([]byte, error) {
	return c.encodeReply(&protocol.Reply{
		Push: &protocol.Push{
			Refresh: res,
		},
	})
}

func (c *Client) releaseRefreshCommandReply(reply *protocol.Reply) {
	protocol.ReplyPool.ReleaseRefreshReply(reply)
}

func (c *Client) getRefreshCommandReply(res *protocol.RefreshResult) (*protocol.Reply, error) {
	return protocol.ReplyPool.AcquireRefreshReply(res), nil
}

func (c *Client) handleRefresh(req *protocol.RefreshRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	if c.eventHub.refreshHandler == nil {
		return ErrorNotAvailable
	}

	if req.Token == "" {
		return c.logDisconnectBadRequest("client token required to refresh")
	}

	c.mu.RLock()
	clientSideRefresh := c.clientSideRefresh
	c.mu.RUnlock()

	if !clientSideRefresh {
		// Client not supposed to send refresh command in case of server-side refresh mechanism.
		return c.logDisconnectBadRequest("server-side refresh expected")
	}

	event := RefreshEvent{
		ClientSideRefresh: true,
		Token:             req.Token,
	}

	cb := func(reply RefreshReply, err error) {
		if err != nil {
			c.writeDisconnectOrErrorFlush("", protocol.FrameTypeRefresh, cmd, err, started, rw)
			return
		}

		if reply.Expired {
			c.writeDisconnectOrErrorFlush("", protocol.FrameTypeRefresh, cmd, DisconnectExpired, started, rw)
			return
		}

		nowUnix := time.Now().Unix()
		expireAt := min(reply.ExpireAt, nowUnix+maxTTLSeconds)
		info := reply.Info

		res := &protocol.RefreshResult{
			Expires: expireAt > 0,
		}

		ttl := expireAt - nowUnix

		if ttl > 0 {
			res.Ttl = uint32(ttl)
		}

		if expireAt > 0 {
			// connection check enabled
			if ttl > 0 {
				// connection refreshed, update client timestamp and set new expiration timeout
				c.mu.Lock()
				c.exp = expireAt
				if len(info) > 0 {
					c.info = info
				}
				duration := time.Duration(ttl)*time.Second + c.node.config.ClientExpiredCloseDelay
				c.addExpireUpdate(duration, true)
				c.mu.Unlock()
			} else {
				c.writeDisconnectOrErrorFlush("", protocol.FrameTypeRefresh, cmd, ErrorExpired, started, rw)
				return
			}
		}

		protoReply, err := c.getRefreshCommandReply(res)
		if err != nil {
			c.logWriteInternalErrorFlush("", protocol.FrameTypeRefresh, cmd, err, "error encoding refresh", started, rw)
			return
		}
		c.writeEncodedCommandReply("", protocol.FrameTypeRefresh, cmd, protoReply, rw)
		c.handleCommandFinished(cmd, protocol.FrameTypeRefresh, nil, protoReply, started, "")
		c.releaseRefreshCommandReply(protoReply)
	}

	c.eventHub.refreshHandler(event, cb)
	return nil
}

// onSubscribeError cleans up a channel from client channels if an error during subscribe happened.
// Channel kept in a map during subscribe request to check for duplicate subscription attempts.
func (c *Client) onSubscribeError(channel string) {
	c.mu.Lock()
	chCtx, ok := c.channels[channel]
	subscribingCh := chCtx.subscribingCh
	delete(c.channels, channel)
	c.mu.Unlock()
	if ok {
		_ = c.node.removeSubscription(channel, c)
		if subscribingCh != nil {
			close(chCtx.subscribingCh)
		}
	}
}

func (c *Client) handleSubscribe(req *protocol.SubscribeRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	if c.eventHub.subscribeHandler == nil {
		return ErrorNotAvailable
	}

	if req.Channel == "" {
		return c.logDisconnectBadRequest("channel required for subscribe")
	}

	if req.Delta != "" {
		_, ok := stringToDeltaType[req.Delta]
		if !ok {
			return c.logDisconnectBadRequest("unknown delta type in subscribe request: " + req.Delta)
		}
	}

	replyError, disconnect := c.validateSubscribeRequest(req)
	if disconnect != nil || replyError != nil {
		if disconnect != nil {
			return *disconnect
		}
		return replyError
	}

	event := SubscribeEvent{
		Channel:     req.Channel,
		Token:       req.Token,
		Data:        req.Data,
		Positioned:  req.Positioned,
		Recoverable: req.Recoverable,
		JoinLeave:   req.JoinLeave,
	}

	cb := func(reply SubscribeReply, err error) {
		if reply.SubscriptionReady != nil {
			defer close(reply.SubscriptionReady)
		}

		if err != nil {
			c.onSubscribeError(req.Channel)
			c.writeDisconnectOrErrorFlush(req.Channel, protocol.FrameTypeSubscribe, cmd, err, started, rw)
			return
		}

		ctx := c.subscribeCmd(req, reply, cmd, false, started, rw)
		if ctx.disconnect != nil {
			c.onSubscribeError(req.Channel)
			c.writeDisconnectOrErrorFlush(req.Channel, protocol.FrameTypeSubscribe, cmd, ctx.disconnect, started, rw)
			return
		}
		if ctx.err != nil {
			c.onSubscribeError(req.Channel)
			c.writeDisconnectOrErrorFlush(req.Channel, protocol.FrameTypeSubscribe, cmd, ctx.err, started, rw)
			return
		}

		if channelHasFlag(ctx.channelContext.flags, flagEmitJoinLeave) && ctx.clientInfo != nil {
			go func() { _ = c.node.publishJoin(req.Channel, ctx.clientInfo) }()
		}
	}
	c.eventHub.subscribeHandler(event, cb)
	return nil
}

func (c *Client) getSubscribedChannelContext(channel string) (ChannelContext, bool) {
	c.mu.RLock()
	ctx, okChannel := c.channels[channel]
	c.mu.RUnlock()
	if !okChannel || !channelHasFlag(ctx.flags, flagSubscribed) {
		return ChannelContext{}, false
	}
	return ctx, true
}

func (c *Client) handleSubRefresh(req *protocol.SubRefreshRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	if c.eventHub.subRefreshHandler == nil {
		return ErrorNotAvailable
	}

	channel := req.Channel
	if channel == "" {
		return c.logDisconnectBadRequest("channel required for sub refresh")
	}

	ctx, okChannel := c.getSubscribedChannelContext(channel)
	if !okChannel {
		// Must be subscribed to refresh subscription.
		return ErrorPermissionDenied
	}

	clientSideRefresh := channelHasFlag(ctx.flags, flagClientSideRefresh)
	if !clientSideRefresh {
		// Client not supposed to send sub refresh command in case of server-side
		// subscription refresh mechanism.
		return c.logDisconnectBadRequest("server-side sub refresh expected")
	}

	if req.Token == "" {
		c.node.logger.log(newLogEntry(LogLevelInfo, "subscription refresh token required", map[string]any{"channel": req.Channel, "client": c.uid, "user": c.UserID()}))
		return ErrorBadRequest
	}

	event := SubRefreshEvent{
		ClientSideRefresh: true,
		Channel:           req.Channel,
		Token:             req.Token,
	}

	cb := func(reply SubRefreshReply, err error) {
		if err != nil {
			c.writeDisconnectOrErrorFlush(req.Channel, protocol.FrameTypeSubRefresh, cmd, err, started, rw)
			return
		}

		res := &protocol.SubRefreshResult{}

		nowUnix := time.Now().Unix()
		expireAt := min(reply.ExpireAt, nowUnix+maxTTLSeconds)
		if expireAt > 0 {
			res.Expires = true

			if expireAt < nowUnix {
				c.writeDisconnectOrErrorFlush(req.Channel, protocol.FrameTypeSubRefresh, cmd, ErrorExpired, started, rw)
				return
			}
			res.Ttl = uint32(expireAt - nowUnix)
		}

		c.mu.Lock()
		channelContext, okChan := c.channels[channel]
		if okChan && channelHasFlag(channelContext.flags, flagSubscribed) {
			channelContext.info = reply.Info
			channelContext.expireAt = expireAt
			c.channels[channel] = channelContext
		}
		c.mu.Unlock()

		protoReply, err := c.getSubRefreshCommandReply(res)
		if err != nil {
			c.logWriteInternalErrorFlush(channel, protocol.FrameTypeSubRefresh, cmd, err, "error encoding sub refresh", started, rw)
			return
		}

		c.writeEncodedCommandReply(channel, protocol.FrameTypeSubRefresh, cmd, protoReply, rw)
		c.handleCommandFinished(cmd, protocol.FrameTypeSubRefresh, nil, protoReply, started, channel)
		c.releaseSubRefreshCommandReply(protoReply)
	}

	c.eventHub.subRefreshHandler(event, cb)
	return nil
}

func (c *Client) releaseSubRefreshCommandReply(reply *protocol.Reply) {
	protocol.ReplyPool.ReleaseSubRefreshReply(reply)
}

func (c *Client) getSubRefreshCommandReply(res *protocol.SubRefreshResult) (*protocol.Reply, error) {
	return protocol.ReplyPool.AcquireSubRefreshReply(res), nil
}

func (c *Client) handleUnsubscribe(req *protocol.UnsubscribeRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	channel := req.Channel
	if channel == "" {
		return c.logDisconnectBadRequest("channel required for unsubscribe")
	}

	if err := c.unsubscribe(channel, unsubscribeClient, nil); err != nil {
		return err
	}

	protoReply, err := c.getUnsubscribeCommandReply(&protocol.UnsubscribeResult{})
	if err != nil {
		c.node.logger.log(newErrorLogEntry(err, "error encoding unsubscribe", map[string]any{"error": err.Error()}))
		return DisconnectServerError
	}
	c.writeEncodedCommandReply(channel, protocol.FrameTypeUnsubscribe, cmd, protoReply, rw)
	c.handleCommandFinished(cmd, protocol.FrameTypeUnsubscribe, nil, protoReply, started, channel)
	c.releaseUnsubscribeCommandReply(protoReply)
	return nil
}

func (c *Client) releaseUnsubscribeCommandReply(reply *protocol.Reply) {
	protocol.ReplyPool.ReleaseUnsubscribeReply(reply)
}

func (c *Client) getUnsubscribeCommandReply(res *protocol.UnsubscribeResult) (*protocol.Reply, error) {
	return protocol.ReplyPool.AcquireUnsubscribeReply(res), nil
}

func (c *Client) handlePublish(req *protocol.PublishRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	if c.eventHub.publishHandler == nil {
		return ErrorNotAvailable
	}

	channel := req.Channel
	data := req.Data

	if channel == "" || len(data) == 0 {
		return c.logDisconnectBadRequest("channel and data required for publish")
	}

	c.mu.RLock()
	info := c.clientInfo(channel)
	c.mu.RUnlock()

	event := PublishEvent{
		Channel:    channel,
		Data:       data,
		ClientInfo: info,
	}

	cb := func(reply PublishReply, err error) {
		if err != nil {
			c.writeDisconnectOrErrorFlush(channel, protocol.FrameTypePublish, cmd, err, started, rw)
			return
		}

		if reply.Result == nil {
			_, err := c.node.Publish(
				event.Channel, event.Data,
				WithHistory(reply.Options.HistorySize, reply.Options.HistoryTTL, reply.Options.HistoryMetaTTL),
				WithClientInfo(reply.Options.ClientInfo),
			)
			if err != nil {
				c.logWriteInternalErrorFlush(channel, protocol.FrameTypePublish, cmd, err, "error publish", started, rw)
				return
			}
		}

		res := &protocol.PublishResult{}
		protoReply, err := c.getPublishCommandReply(res)
		if err != nil {
			c.logWriteInternalErrorFlush(channel, protocol.FrameTypePublish, cmd, err, "error encoding publish", started, rw)
			return
		}
		c.writeEncodedCommandReply(channel, protocol.FrameTypePublish, cmd, protoReply, rw)
		c.handleCommandFinished(cmd, protocol.FrameTypePublish, nil, protoReply, started, channel)
		c.releasePublishCommandReply(protoReply)
	}

	c.eventHub.publishHandler(event, cb)
	return nil
}

func (c *Client) releasePublishCommandReply(reply *protocol.Reply) {
	protocol.ReplyPool.ReleasePublishReply(reply)
}

func (c *Client) getPublishCommandReply(res *protocol.PublishResult) (*protocol.Reply, error) {
	return protocol.ReplyPool.AcquirePublishReply(res), nil
}

func (c *Client) handlePresence(req *protocol.PresenceRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	if c.eventHub.presenceHandler == nil {
		return ErrorNotAvailable
	}

	channel := req.Channel
	if channel == "" {
		return c.logDisconnectBadRequest("channel required for presence")
	}

	event := PresenceEvent{
		Channel: channel,
	}

	cb := func(reply PresenceReply, err error) {
		if err != nil {
			c.writeDisconnectOrErrorFlush(channel, protocol.FrameTypePresence, cmd, err, started, rw)
			return
		}

		var presence map[string]*ClientInfo
		if reply.Result == nil {
			result, err := c.node.Presence(event.Channel)
			if err != nil {
				c.logWriteInternalErrorFlush(channel, protocol.FrameTypePresence, cmd, err, "error getting presence", started, rw)
				return
			}
			presence = result.Presence
		} else {
			presence = reply.Result.Presence
		}

		protoPresence := make(map[string]*protocol.ClientInfo, len(presence))
		for k, v := range presence {
			protoPresence[k] = infoToProto(v)
		}

		protoReply, err := c.getPresenceCommandReply(&protocol.PresenceResult{
			Presence: protoPresence,
		})
		if err != nil {
			c.logWriteInternalErrorFlush(channel, protocol.FrameTypePresence, cmd, err, "error encoding presence", started, rw)
			return
		}
		c.writeEncodedCommandReply(channel, protocol.FrameTypePresence, cmd, protoReply, rw)
		c.handleCommandFinished(cmd, protocol.FrameTypePresence, nil, protoReply, started, channel)
		c.releasePresenceCommandReply(protoReply)
	}

	c.eventHub.presenceHandler(event, cb)
	return nil
}

func (c *Client) releasePresenceCommandReply(reply *protocol.Reply) {
	protocol.ReplyPool.ReleasePresenceReply(reply)
}

func (c *Client) getPresenceCommandReply(res *protocol.PresenceResult) (*protocol.Reply, error) {
	return protocol.ReplyPool.AcquirePresenceReply(res), nil
}

func (c *Client) handlePresenceStats(req *protocol.PresenceStatsRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	if c.eventHub.presenceStatsHandler == nil {
		return ErrorNotAvailable
	}

	channel := req.Channel
	if channel == "" {
		return c.logDisconnectBadRequest("channel required for presence stats")
	}

	event := PresenceStatsEvent{
		Channel: channel,
	}

	cb := func(reply PresenceStatsReply, err error) {
		if err != nil {
			c.writeDisconnectOrErrorFlush(channel, protocol.FrameTypePresenceStats, cmd, err, started, rw)
			return
		}

		var presenceStats PresenceStats
		if reply.Result == nil {
			result, err := c.node.PresenceStats(event.Channel)
			if err != nil {
				c.logWriteInternalErrorFlush(channel, protocol.FrameTypePresenceStats, cmd, err, "error getting presence stats", started, rw)
				return
			}
			presenceStats = result.PresenceStats
		} else {
			presenceStats = reply.Result.PresenceStats
		}

		protoReply, err := c.getPresenceStatsCommandReply(&protocol.PresenceStatsResult{
			NumClients: uint32(presenceStats.NumClients),
			NumUsers:   uint32(presenceStats.NumUsers),
		})
		if err != nil {
			c.logWriteInternalErrorFlush(channel, protocol.FrameTypePresence, cmd, err, "error encoding presence stats", started, rw)
			return
		}
		c.writeEncodedCommandReply(channel, protocol.FrameTypePresenceStats, cmd, protoReply, rw)
		c.handleCommandFinished(cmd, protocol.FrameTypePresenceStats, nil, protoReply, started, channel)
		c.releasePresenceStatsCommandReply(protoReply)
	}

	c.eventHub.presenceStatsHandler(event, cb)
	return nil
}

func (c *Client) releasePresenceStatsCommandReply(reply *protocol.Reply) {
	protocol.ReplyPool.ReleasePresenceStatsReply(reply)
}

func (c *Client) getPresenceStatsCommandReply(res *protocol.PresenceStatsResult) (*protocol.Reply, error) {
	return protocol.ReplyPool.AcquirePresenceStatsReply(res), nil
}

func (c *Client) handleHistory(req *protocol.HistoryRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	if c.eventHub.historyHandler == nil {
		return ErrorNotAvailable
	}

	channel := req.Channel
	if channel == "" {
		return c.logDisconnectBadRequest("channel required for history")
	}

	var historyFilter HistoryFilter
	if req.Since != nil {
		historyFilter.Since = &StreamPosition{
			Offset: req.Since.Offset,
			Epoch:  req.Since.Epoch,
		}
	}
	historyFilter.Limit = int(req.Limit)

	maxPublicationLimit := c.node.config.HistoryMaxPublicationLimit
	if maxPublicationLimit > 0 && (historyFilter.Limit < 0 || historyFilter.Limit > maxPublicationLimit) {
		historyFilter.Limit = maxPublicationLimit
	}

	historyFilter.Reverse = req.Reverse

	event := HistoryEvent{
		Channel: channel,
		Filter:  historyFilter,
	}

	cb := func(reply HistoryReply, err error) {
		if err != nil {
			c.writeDisconnectOrErrorFlush(channel, protocol.FrameTypeHistory, cmd, err, started, rw)
			return
		}

		var pubs []*Publication
		var offset uint64
		var epoch string
		if reply.Result == nil {
			result, err := c.node.History(event.Channel,
				WithHistoryFilter(event.Filter),
			)
			if err != nil {
				c.logWriteInternalErrorFlush(channel, protocol.FrameTypeHistory, cmd, err, "error getting history", started, rw)
				return
			}
			pubs = result.Publications
			offset = result.Offset
			epoch = result.Epoch
		} else {
			pubs = reply.Result.Publications
			offset = reply.Result.Offset
			epoch = reply.Result.Epoch
		}

		protoPubs := make([]*protocol.Publication, 0, len(pubs))
		for _, pub := range pubs {
			protoPub := pubToProto(pub)
			protoPubs = append(protoPubs, protoPub)
		}

		protoReply, err := c.getHistoryCommandReply(&protocol.HistoryResult{
			Publications: protoPubs,
			Offset:       offset,
			Epoch:        epoch,
		})
		if err != nil {
			c.logWriteInternalErrorFlush(channel, protocol.FrameTypeHistory, cmd, err, "error encoding history", started, rw)
			return
		}
		c.writeEncodedCommandReply(channel, protocol.FrameTypeHistory, cmd, protoReply, rw)
		c.handleCommandFinished(cmd, protocol.FrameTypeHistory, nil, protoReply, started, channel)
		c.releaseHistoryCommandReply(protoReply)
	}

	c.eventHub.historyHandler(event, cb)
	return nil
}

func (c *Client) releaseHistoryCommandReply(reply *protocol.Reply) {
	protocol.ReplyPool.ReleaseHistoryReply(reply)
}

func (c *Client) getHistoryCommandReply(res *protocol.HistoryResult) (*protocol.Reply, error) {
	return protocol.ReplyPool.AcquireHistoryReply(res), nil
}

var emptyReply = &protocol.Reply{}

func (c *Client) handlePing(_ *protocol.Command, _ time.Time, _ *replyWriter) error {
	// Ping not supported by protocol v2 at the moment. Supporting it requires adding
	// ping method to SDKs first. But nobody asked yet.
	return ErrorNotAvailable
}

func (c *Client) writeError(ch string, frameType protocol.FrameType, cmd *protocol.Command, errorReply *protocol.Reply, rw *replyWriter) {
	c.writeEncodedCommandReply(ch, frameType, cmd, errorReply, rw)
}

func (c *Client) writeDisconnectOrErrorFlush(ch string, frameType protocol.FrameType, cmd *protocol.Command, err error, started time.Time, rw *replyWriter) {
	defer func() {
		c.node.metrics.observeCommandDuration(frameType, time.Since(started), ch)
	}()
	disconnect, ok := disconnectFromError(err)
	if ok {
		go func() { _ = c.close(*disconnect) }()
		if c.node.clientEvents.commandProcessedHandler != nil {
			event := newCommandProcessedEvent(cmd, err, nil, started)
			c.issueCommandProcessedEvent(event)
		}
		return
	}
	errorReply := &protocol.Reply{Error: toClientErr(err).toProto()}
	c.writeError(ch, frameType, cmd, errorReply, rw)
	if c.node.clientEvents.commandProcessedHandler != nil {
		event := newCommandProcessedEvent(cmd, err, errorReply, started)
		c.issueCommandProcessedEvent(event)
	}
}

type replyWriter struct {
	write func(*protocol.Reply)
}

func (c *Client) handleRPC(req *protocol.RPCRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	if c.eventHub.rpcHandler == nil {
		return ErrorNotAvailable
	}

	event := RPCEvent{
		Method: req.Method,
		Data:   req.Data,
	}

	cb := func(reply RPCReply, err error) {
		if err != nil {
			c.writeDisconnectOrErrorFlush("", protocol.FrameTypeRPC, cmd, err, started, rw)
			return
		}
		result := &protocol.RPCResult{
			Data: reply.Data,
		}
		protoReply, err := c.getRPCCommandReply(result)
		if err != nil {
			c.logWriteInternalErrorFlush("", protocol.FrameTypeRPC, cmd, err, "error encoding rpc", started, rw)
			return
		}
		c.writeEncodedCommandReply("", protocol.FrameTypeRPC, cmd, protoReply, rw)
		c.handleCommandFinished(cmd, protocol.FrameTypeRPC, nil, protoReply, started, "")
		c.releaseRPCCommandReply(protoReply)
	}

	c.eventHub.rpcHandler(event, cb)
	return nil
}

func (c *Client) releaseRPCCommandReply(r *protocol.Reply) {
	protocol.ReplyPool.ReleaseRPCReply(r)
}

func (c *Client) getRPCCommandReply(res *protocol.RPCResult) (*protocol.Reply, error) {
	return protocol.ReplyPool.AcquireRPCReply(res), nil
}

func (c *Client) handleSend(req *protocol.SendRequest, cmd *protocol.Command, started time.Time) error {
	// Send handler is a bit special since it's a one way command: client does not expect any reply.
	if c.eventHub.messageHandler == nil {
		c.node.metrics.observeCommandDuration(protocol.FrameTypeSend, time.Since(started), "")
		// Return DisconnectNotAvailable here since otherwise client won't even know
		// server does not have asynchronous message handler set.
		return DisconnectNotAvailable
	}
	c.eventHub.messageHandler(MessageEvent{
		Data: req.Data,
	})
	c.handleCommandFinished(cmd, protocol.FrameTypeSend, nil, nil, started, "")
	return nil
}

func (c *Client) unlockServerSideSubscriptions(subCtxMap map[string]subscribeContext) {
	for channel := range subCtxMap {
		c.pubSubSync.StopBuffering(channel)
	}
}

// isInTest may be true during Centrifuge test run. We use it to inject code required to
// cover various edge case scenarios.
var isInTest = false

const (
	testChannelRedisClientSubscribeRecoveryDeadlock1 = "TestRedisClientSubscribeRecoveryDeadlock1"
	testChannelRedisClientSubscribeRecoveryDeadlock2 = "TestRedisClientSubscribeRecoveryDeadlock2"
)

// connectCmd handles connect command from client - client must send connect
// command immediately after establishing connection with server.
func (c *Client) connectCmd(req *protocol.ConnectRequest, cmd *protocol.Command, started time.Time, rw *replyWriter) error {
	var metricClientName string
	if req.Name != "" {
		metricClientName = "unregistered"
		if slices.Contains(c.node.config.Metrics.RegisteredClientNames, req.Name) {
			metricClientName = req.Name
		}
	}
	var metricClientVersion string
	if req.Version != "" {
		metricClientVersion = "unregistered"
		if c.node.config.Metrics.CheckRegisteredClientVersion != nil && c.node.config.Metrics.CheckRegisteredClientVersion(req.Name, req.Version) {
			metricClientVersion = req.Version
		}
	}
	c.mu.RLock()
	authenticated := c.authenticated
	closed := c.status == statusClosed
	c.mu.RUnlock()

	if closed {
		return DisconnectConnectionClosed
	}

	if authenticated {
		return c.logDisconnectBadRequest("client already authenticated")
	}

	config := c.node.config
	version := config.Version
	userConnectionLimit := config.UserConnectionLimit
	channelLimit := config.ClientChannelLimit

	var (
		credentials       *Credentials
		authData          protocol.Raw
		subscriptions     map[string]SubscribeOptions
		clientSideRefresh bool
	)

	if c.node.clientEvents.connectingHandler != nil {
		e := ConnectEvent{
			ClientID:  c.ID(),
			Data:      req.Data,
			Token:     req.Token,
			Name:      req.Name,
			Version:   req.Version,
			Transport: c.transport,
			Headers:   req.Headers,
		}
		if len(req.Subs) > 0 {
			channels := make([]string, 0, len(req.Subs))
			for ch := range req.Subs {
				channels = append(channels, ch)
			}
			e.Channels = channels
		}
		reply, err := c.node.clientEvents.connectingHandler(c.ctx, e)
		if err != nil {
			c.startWriter(0, 0, 0)
			return err
		}
		if reply.PingPongConfig != nil {
			c.pingInterval, c.pongTimeout = getPingPongPeriodValues(*reply.PingPongConfig)
		} else {
			c.pingInterval, c.pongTimeout = getPingPongPeriodValues(c.transport.PingPongConfig())
		}
		c.replyWithoutQueue = reply.ReplyWithoutQueue
		c.startWriter(reply.WriteDelay, reply.MaxMessagesInFrame, reply.QueueInitialCap)

		if reply.Credentials != nil {
			credentials = reply.Credentials
		}
		c.storage = reply.Storage
		if reply.Context != nil {
			c.mu.Lock()
			c.ctx = reply.Context
			c.mu.Unlock()
		}
		if reply.Data != nil {
			authData = reply.Data
		}
		clientSideRefresh = reply.ClientSideRefresh
		if len(reply.Subscriptions) > 0 {
			subscriptions = make(map[string]SubscribeOptions, len(reply.Subscriptions))
			for ch, opts := range reply.Subscriptions {
				if ch == "" {
					continue
				}
				subscriptions[ch] = opts
			}
		}
	} else {
		c.startWriter(0, 0, 0)
		c.pingInterval, c.pongTimeout = getPingPongPeriodValues(c.transport.PingPongConfig())
	}

	if channelLimit > 0 && len(subscriptions) > channelLimit {
		return DisconnectChannelLimit
	}

	if credentials == nil {
		// Try to find Credentials in context.
		if cred, ok := GetCredentials(c.ctx); ok {
			credentials = cred
		}
	}

	var (
		expires bool
		ttl     uint32
	)

	c.mu.Lock()
	c.clientSideRefresh = clientSideRefresh
	c.mu.Unlock()

	if credentials == nil {
		return c.logDisconnectBadRequest("client credentials not found")
	}

	c.mu.Lock()
	c.user = credentials.UserID
	c.info = credentials.Info
	c.exp = min(credentials.ExpireAt, time.Now().Unix()+maxTTLSeconds)

	user := c.user
	exp := c.exp
	closed = c.status == statusClosed
	c.mu.Unlock()

	if closed {
		return DisconnectConnectionClosed
	}

	if c.node.logEnabled(LogLevelDebug) {
		c.node.logger.log(newLogEntry(LogLevelDebug, "client authenticated", map[string]any{"client": c.uid, "user": c.user}))
	}

	if userConnectionLimit > 0 && user != "" && len(c.node.hub.UserConnections(user)) >= userConnectionLimit {
		c.node.logger.log(newLogEntry(LogLevelInfo, "limit of connections for user reached", map[string]any{"user": user, "client": c.uid, "limit": userConnectionLimit}))
		return DisconnectConnectionLimit
	}

	c.mu.RLock()
	if exp > 0 {
		expires = true
		now := time.Now().Unix()
		if exp < now {
			c.mu.RUnlock()
			c.node.logger.log(newLogEntry(LogLevelInfo, "connection expiration must be greater than now", map[string]any{"client": c.uid, "user": c.UserID()}))
			return ErrorExpired
		}
		ttl = uint32(exp - now)
	}
	c.mu.RUnlock()

	res := &protocol.ConnectResult{}
	res.Version = version
	res.Expires = expires
	res.Ttl = ttl

	if c.pingInterval > 0 {
		res.Ping = uint32(c.pingInterval.Seconds())
	}
	if !c.transport.Unidirectional() && c.pongTimeout > 0 {
		res.Pong = true
	}

	if c.transport.Unidirectional() || c.transport.Emulation() {
		res.Session = c.session
	}
	if c.transport.Emulation() {
		res.Node = c.node.ID()
	}
	if c.node.config.ClientConnectIncludeServerTime {
		res.Time = time.Now().UnixMilli()
	}

	// Client successfully connected.
	c.mu.Lock()
	if c.status == statusClosed {
		c.mu.Unlock()
		return DisconnectConnectionClosed
	}
	c.authenticated = true
	c.metricName = metricClientName
	c.metricVersion = metricClientVersion
	c.node.addClient(c)
	c.mu.Unlock()

	if !clientSideRefresh {
		// Server will do refresh itself.
		res.Expires = false
		res.Ttl = 0
	}

	res.Client = c.uid
	if authData != nil {
		res.Data = authData
	}

	var subCtxMap map[string]subscribeContext
	if len(subscriptions) > 0 {
		var subMu sync.Mutex
		subCtxMap = make(map[string]subscribeContext, len(subscriptions))
		subs := make(map[string]*protocol.SubscribeResult, len(subscriptions))
		var subDisconnect *Disconnect
		var subError *Error
		var wg sync.WaitGroup

		wg.Add(len(subscriptions))
		for ch, opts := range subscriptions {
			go func(ch string, opts SubscribeOptions) {
				defer wg.Done()
				subCmd := &protocol.SubscribeRequest{
					Channel: ch,
				}
				if subReq, ok := req.Subs[ch]; ok {
					subCmd.Recover = subReq.Recover
					subCmd.Offset = subReq.Offset
					subCmd.Epoch = subReq.Epoch
					subCmd.Delta = subReq.Delta
				}
				if isInTest && ch == testChannelRedisClientSubscribeRecoveryDeadlock2 { // Only for tests.
					select {
					case <-time.After(time.Second):
					case <-c.Context().Done():
					}
				}
				subCtx := c.subscribeCmd(subCmd, SubscribeReply{Options: opts}, nil, true, started, nil)
				subMu.Lock()
				subs[ch] = subCtx.result
				subCtxMap[ch] = subCtx
				if subCtx.disconnect != nil {
					subDisconnect = subCtx.disconnect
				}
				if subCtx.err != nil {
					subError = subCtx.err
				}
				subMu.Unlock()
			}(ch, opts)
		}
		wg.Wait()

		if subDisconnect != nil || subError != nil {
			c.unlockServerSideSubscriptions(subCtxMap)
			for channel := range subCtxMap {
				c.onSubscribeError(channel)
			}
			if subDisconnect != nil {
				return subDisconnect
			}
			return subError
		}
		res.Subs = subs
	}

	if c.transport.Unidirectional() {
		if !hasFlag(c.transport.DisabledPushFlags(), PushFlagConnect) {
			protoReply, err := c.getConnectPushReply(res)
			if err != nil {
				c.unlockServerSideSubscriptions(subCtxMap)
				c.node.logger.log(newErrorLogEntry(err, "error encoding connect", map[string]any{"error": err.Error()}))
				return DisconnectServerError
			}
			encoder := protocol.GetPushEncoder(c.transport.Protocol().toProto())
			data, err := encoder.Encode(protoReply.Push)
			if err != nil {
				c.node.logger.log(newErrorLogEntry(err, "error encoding connect push", map[string]any{"push": fmt.Sprintf("%v", protoReply.Push), "client": c.ID(), "user": c.UserID(), "error": err.Error()}))
				go func() { _ = c.close(DisconnectInappropriateProtocol) }()
			} else {
				if err = c.writeEncodedPushData(data, "", protocol.FrameTypePushConnect, ChannelBatchConfig{}); err == nil {
					if rw != nil {
						rw.write(protoReply)
					}
					if c.node.logEnabled(LogLevelTrace) {
						c.traceOutPush(&protocol.Push{Connect: protoReply.Push.Connect})
					}
				}
			}
		}
	} else {
		protoReply, err := c.getConnectCommandReply(res)
		if err != nil {
			c.unlockServerSideSubscriptions(subCtxMap)
			c.node.logger.log(newErrorLogEntry(err, "error encoding connect", map[string]any{"error": err.Error()}))
			return DisconnectServerError
		}
		c.writeEncodedCommandReply("", protocol.FrameTypeConnect, cmd, protoReply, rw)
		defer c.releaseConnectCommandReply(protoReply)
		defer c.handleCommandFinished(cmd, protocol.FrameTypeConnect, nil, protoReply, started, "")
	}

	c.mu.Lock()
	for channel, subCtx := range subCtxMap {
		c.channels[channel] = subCtx.channelContext
	}
	c.mu.Unlock()

	c.unlockServerSideSubscriptions(subCtxMap)

	if len(subCtxMap) > 0 {
		for channel, subCtx := range subCtxMap {
			go func(channel string, subCtx subscribeContext) {
				if channelHasFlag(subCtx.channelContext.flags, flagEmitJoinLeave) && subCtx.clientInfo != nil {
					_ = c.node.publishJoin(channel, subCtx.clientInfo)
				}
			}(channel, subCtx)
		}
	}

	return nil
}

func (c *Client) getConnectPushReply(res *protocol.ConnectResult) (*protocol.Reply, error) {
	p := &protocol.Connect{
		Version: res.GetVersion(),
		Client:  res.GetClient(),
		Data:    res.Data,
		Subs:    res.Subs,
		Expires: res.Expires,
		Ttl:     res.Ttl,
		Ping:    res.Ping,
		Pong:    res.Pong,
		Session: res.Session,
		Node:    res.Node,
		Time:    res.Time,
	}
	return &protocol.Reply{
		Push: &protocol.Push{
			Connect: p,
		},
	}, nil
}

func (c *Client) startWriter(batchDelay time.Duration, maxMessagesInFrame int, queueInitialCap int) {
	c.startWriterOnce.Do(func() {
		var writeMu sync.Mutex
		messageWriterConf := writerConfig{
			MaxQueueSize: c.node.config.ClientQueueMaxSize,
			WriteFn: func(item queue.Item) error {
				c.node.metrics.incTransportMessagesSent(c.transport.Name(), item.FrameType, item.Channel, len(item.Data))

				if c.node.clientEvents.transportWriteHandler != nil {
					pass := c.node.clientEvents.transportWriteHandler(c, TransportWriteEvent(item))
					if !pass {
						return nil
					}
				}
				writeMu.Lock()
				defer writeMu.Unlock()
				if err := c.transport.Write(item.Data); err != nil {
					if c.node.logger.enabled(LogLevelTrace) {
						c.node.logger.log(newLogEntry(LogLevelTrace, "client write failed", map[string]any{"client": c.uid, "user": c.user, "error": err.Error()}))
					}
					disconnect, ok := disconnectFromError(err)
					if ok {
						go func() { _ = c.close(*disconnect) }()
					} else {
						go func() { _ = c.close(DisconnectWriteError) }()
					}
					return err
				}
				return nil
			},
			WriteManyFn: func(items ...queue.Item) error {
				messages := make([][]byte, 0, len(items))
				for i := 0; i < len(items); i++ {
					if c.node.clientEvents.transportWriteHandler != nil {
						pass := c.node.clientEvents.transportWriteHandler(c, TransportWriteEvent(items[i]))
						if !pass {
							continue
						}
					}
					messages = append(messages, items[i].Data)
					c.node.metrics.incTransportMessagesSent(c.transport.Name(), items[i].FrameType, items[i].Channel, len(items[i].Data))
				}
				writeMu.Lock()
				defer writeMu.Unlock()
				if err := c.transport.WriteMany(messages...); err != nil {
					if c.node.logger.enabled(LogLevelTrace) {
						c.node.logger.log(newLogEntry(LogLevelTrace, "client write failed", map[string]any{"client": c.uid, "user": c.user, "error": err.Error()}))
					}
					disconnect, ok := disconnectFromError(err)
					if ok {
						go func() { _ = c.close(*disconnect) }()
					} else {
						go func() { _ = c.close(DisconnectWriteError) }()
					}
					return err
				}
				return nil
			},
		}

		c.messageWriter = newWriter(messageWriterConf, queueInitialCap)
		go c.messageWriter.run(batchDelay, maxMessagesInFrame)
		if c.node.config.GetChannelBatchConfig != nil {
			c.perChannelWriter = newPerChannelWriter(c.writeQueueItems)
		}
	})
}

func (c *Client) releaseConnectCommandReply(reply *protocol.Reply) {
	protocol.ReplyPool.ReleaseConnectReply(reply)
}

func (c *Client) getConnectCommandReply(res *protocol.ConnectResult) (*protocol.Reply, error) {
	return protocol.ReplyPool.AcquireConnectReply(res), nil
}

// Subscribe client to a channel.
func (c *Client) Subscribe(channel string, opts ...SubscribeOption) error {
	if channel == "" {
		return fmt.Errorf("channel is empty")
	}
	channelLimit := c.node.config.ClientChannelLimit
	c.mu.RLock()
	numChannels := len(c.channels)
	c.mu.RUnlock()
	if channelLimit > 0 && numChannels >= channelLimit {
		go func() { _ = c.close(DisconnectChannelLimit) }()
		return nil
	}

	subCmd := &protocol.SubscribeRequest{
		Channel: channel,
	}
	subscribeOpts := &SubscribeOptions{}
	for _, opt := range opts {
		opt(subscribeOpts)
	}
	if subscribeOpts.RecoverSince != nil {
		subCmd.Recover = true
		subCmd.Offset = subscribeOpts.RecoverSince.Offset
		subCmd.Epoch = subscribeOpts.RecoverSince.Epoch
	}
	subCtx := c.subscribeCmd(subCmd, SubscribeReply{
		Options: *subscribeOpts,
	}, nil, true, time.Time{}, nil)
	if subCtx.disconnect != nil {
		c.onSubscribeError(subCmd.Channel)
		return subCtx.disconnect
	}
	if subCtx.err != nil {
		c.onSubscribeError(subCmd.Channel)
		return subCtx.err
	}
	defer c.pubSubSync.StopBuffering(channel)
	c.mu.Lock()
	c.channels[channel] = subCtx.channelContext
	c.mu.Unlock()
	if hasFlag(c.transport.DisabledPushFlags(), PushFlagSubscribe) {
		return nil
	}
	replyData, err := c.getSubscribePushReply(channel, subCtx.result)
	if err != nil {
		return err
	}
	err = c.writeEncodedPushData(replyData, channel, protocol.FrameTypePushSubscribe, ChannelBatchConfig{})
	if err != nil {
		return err
	}
	if channelHasFlag(subCtx.channelContext.flags, flagEmitJoinLeave) && subCtx.clientInfo != nil {
		_ = c.node.publishJoin(channel, subCtx.clientInfo)
	}
	return nil
}

func (c *Client) getSubscribePushReply(channel string, res *protocol.SubscribeResult) ([]byte, error) {
	sub := &protocol.Subscribe{
		Offset:      res.GetOffset(),
		Epoch:       res.GetEpoch(),
		Recoverable: res.GetRecoverable(),
		Positioned:  res.GetPositioned(),
		Data:        res.Data,
	}
	push := &protocol.Push{
		Channel:   channel,
		Subscribe: sub,
	}
	if c.node.logEnabled(LogLevelTrace) {
		c.traceOutPush(push)
	}
	return c.encodeReply(&protocol.Reply{
		Push: push,
	})
}

func (c *Client) validateSubscribeRequest(cmd *protocol.SubscribeRequest) (*Error, *Disconnect) {
	channel := cmd.Channel
	if channel == "" {
		c.node.logger.log(newLogEntry(LogLevelInfo, "channel required for subscribe", map[string]any{"user": c.user, "client": c.uid}))
		return nil, &DisconnectBadRequest
	}

	config := c.node.config
	channelMaxLength := config.ChannelMaxLength
	channelLimit := config.ClientChannelLimit

	if channelMaxLength > 0 && len(channel) > channelMaxLength {
		c.node.logger.log(newLogEntry(LogLevelInfo, "channel too long", map[string]any{"max": channelMaxLength, "channel": channel, "user": c.user, "client": c.uid}))
		return ErrorBadRequest, nil
	}

	c.mu.Lock()
	numChannels := len(c.channels)
	_, ok := c.channels[channel]
	if ok {
		c.mu.Unlock()
		c.node.logger.log(newLogEntry(LogLevelInfo, "client already subscribed on channel", map[string]any{"channel": channel, "user": c.user, "client": c.uid}))
		return ErrorAlreadySubscribed, nil
	}
	if channelLimit > 0 && numChannels >= channelLimit {
		c.mu.Unlock()
		c.node.logger.log(newLogEntry(LogLevelInfo, "maximum limit of channels per client reached", map[string]any{"limit": channelLimit, "user": c.user, "client": c.uid}))
		return ErrorLimitExceeded, nil
	}
	// Put channel to a map to track duplicate subscriptions. This channel should
	// be removed from a map upon an error during subscribe. Also initialize subscribingCh
	// which is used to sync unsubscribe requests with inflight subscriptions (useful when
	// subscribe is performed in a separate goroutine).
	c.channels[channel] = ChannelContext{
		subscribingCh: make(chan struct{}),
	}
	c.mu.Unlock()

	return nil, nil
}

func errorDisconnectContext(replyError *Error, disconnect *Disconnect) subscribeContext {
	ctx := subscribeContext{}
	if disconnect != nil {
		ctx.disconnect = disconnect
		return ctx
	}
	ctx.err = replyError
	return ctx
}

type subscribeContext struct {
	result         *protocol.SubscribeResult
	clientInfo     *ClientInfo
	err            *Error
	disconnect     *Disconnect
	channelContext ChannelContext
}

func isStreamRecovered(
	historyResult HistoryResult, cmdOffset uint64, cmdEpoch string, tf *tagsFilter,
) ([]*protocol.Publication, bool) {
	latestOffset := historyResult.Offset
	latestEpoch := historyResult.Epoch

	if cmdEpoch != "" && latestEpoch != cmdEpoch {
		// Epochs do not match, cannot recover.
		return nil, false
	}

	var recovered bool
	if len(historyResult.Publications) == 0 {
		recovered = latestOffset == cmdOffset
	} else {
		nextOffset := cmdOffset + 1
		recovered = historyResult.Publications[0].Offset == nextOffset &&
			historyResult.Publications[len(historyResult.Publications)-1].Offset == latestOffset
	}
	if !recovered {
		return nil, false
	}

	recoveredPubs := make([]*protocol.Publication, 0, len(historyResult.Publications))
	for _, pub := range historyResult.Publications {
		if tf != nil {
			match, _ := filter.Match(tf.filter, pub.Tags)
			if !match {
				continue
			}
		}
		protoPub := pubToProto(pub)
		recoveredPubs = append(recoveredPubs, protoPub)
	}

	return recoveredPubs, recovered
}

func isCacheRecovered(
	latestPub *Publication, recoveredPub *Publication, currentSP StreamPosition, cmdOffset uint64, cmdEpoch string,
) ([]*protocol.Publication, bool) {
	latestOffset := currentSP.Offset
	latestEpoch := currentSP.Epoch

	// Check if client state matches current state.
	clientHasSameState := cmdOffset > 0 && cmdOffset == latestOffset && cmdEpoch == latestEpoch

	if latestPub == nil {
		return nil, clientHasSameState
	}

	recovered := latestPub.Offset == latestOffset
	if recovered && !clientHasSameState {
		return []*protocol.Publication{pubToProto(recoveredPub)}, true
	}

	return nil, recovered
}

const (
	subscriptionFlagChannelCompression = 1 << iota
)

// subscribeCmd handles subscribe command - clients send this when subscribe
// on channel, if channel is private then we must validate provided sign here before
// actually subscribe client on channel. Optionally we can send missed messages to
// client if it provided last message id seen in channel.
func (c *Client) subscribeCmd(req *protocol.SubscribeRequest, reply SubscribeReply, cmd *protocol.Command, serverSide bool, started time.Time, rw *replyWriter) subscribeContext {
	ctx := subscribeContext{}

	res := &protocol.SubscribeResult{}

	if reply.Options.ExpireAt > 0 {
		ttl := reply.Options.ExpireAt - time.Now().Unix()
		if ttl <= 0 {
			c.node.logger.log(newLogEntry(LogLevelInfo, "subscription expiration must be greater than now", map[string]any{"client": c.uid, "user": c.UserID()}))
			return errorDisconnectContext(ErrorExpired, nil)
		}
		if reply.ClientSideRefresh {
			res.Expires = true
			res.Ttl = uint32(ttl)
		}
	}

	if reply.Options.Data != nil {
		res.Data = reply.Options.Data
	}

	channel := req.Channel

	info := &ClientInfo{
		ClientID: c.uid,
		UserID:   c.user,
		ConnInfo: c.info,
		ChanInfo: reply.Options.ChannelInfo,
	}

	useID := reply.Options.AllowChannelCompaction && req.Flag&subscriptionFlagChannelCompression != 0
	sub := subInfo{client: c, deltaType: deltaTypeNone, useID: useID}
	if req.Tf != nil {
		if !reply.Options.AllowTagsFilter {
			c.node.logger.log(newLogEntry(LogLevelInfo, "tags filter not allowed", map[string]any{"channel": channel, "user": c.user, "client": c.uid}))
			return errorDisconnectContext(ErrorBadRequest, nil)
		}
		if err := filter.Validate(req.Tf); err != nil {
			c.node.logger.log(newLogEntry(LogLevelInfo, "invalid tags filter", map[string]any{"channel": channel, "user": c.user, "client": c.uid}))
			return errorDisconnectContext(ErrorBadRequest, nil)
		}
		sub.tagsFilter = &tagsFilter{
			filter: req.Tf,
			hash:   filter.Hash(req.Tf),
		}
	}

	needPubSubSync := reply.Options.EnablePositioning || reply.Options.EnableRecovery
	if needPubSubSync {
		// Start syncing recovery and PUB/SUB.
		// The important thing is to call StopBuffering for this channel
		// after response with Publications written to connection.
		c.pubSubSync.StartBuffering(channel)
	}

	if req.Delta != "" {
		dt := DeltaType(req.Delta)
		if slices.Contains(reply.Options.AllowedDeltaTypes, dt) {
			res.Delta = true
			sub.deltaType = dt
		}
	}

	if !serverSide {
		c.mu.Lock()
		_, ok := c.channels[channel]
		if !ok || c.status == statusClosed {
			c.mu.Unlock()
			c.pubSubSync.StopBuffering(channel)
			c.node.logger.log(newLogEntry(LogLevelInfo, "client closed or unsubscribed before adding subscription", map[string]any{"channel": channel, "user": c.user, "client": c.uid}))
			ctx.disconnect = &DisconnectServerError
			return ctx
		}
		c.mu.Unlock()
	}
	chanID, err := c.node.addSubscription(channel, sub)
	if err != nil {
		c.node.logger.log(newErrorLogEntry(err, "error adding subscription", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
		c.pubSubSync.StopBuffering(channel)
		var clientErr *Error
		if errors.As(err, &clientErr) && !errors.Is(clientErr, ErrorInternal) {
			return errorDisconnectContext(clientErr, nil)
		}
		ctx.disconnect = &DisconnectServerError
		return ctx
	}
	if chanID > 0 {
		res.Id = chanID
	}
	if !serverSide {
		c.mu.Lock()
		_, ok := c.channels[channel]
		if !ok || c.status == statusClosed {
			c.mu.Unlock()
			c.pubSubSync.StopBuffering(channel)
			c.node.logger.log(newErrorLogEntry(err, "client closed or unsubscribed after adding subscription", map[string]any{"channel": channel, "user": c.user, "client": c.uid}))
			ctx.disconnect = &DisconnectServerError
			return ctx
		}
		c.mu.Unlock()
	}

	if reply.Options.EmitPresence {
		err = c.node.addPresence(channel, c.uid, info)
		if err != nil {
			c.node.logger.log(newErrorLogEntry(err, "error adding presence", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
			c.pubSubSync.StopBuffering(channel)
			ctx.disconnect = &DisconnectServerError
			return ctx
		}
	}

	var (
		latestOffset  uint64
		latestEpoch   string
		recoveredPubs []*protocol.Publication
		maxSeenOffset uint64
	)

	if reply.Options.EnablePositioning || reply.Options.EnableRecovery {
		handleErr := func(err error) subscribeContext {
			c.pubSubSync.StopBuffering(channel)
			var clientErr *Error
			if errors.As(err, &clientErr) && !errors.Is(clientErr, ErrorInternal) {
				return errorDisconnectContext(clientErr, nil)
			}
			ctx.disconnect = &DisconnectServerError
			return ctx
		}

		res.Positioned = true
		if reply.Options.EnableRecovery {
			res.Recoverable = true
		}

		if reply.Options.EnableRecovery && req.Recover {
			cmdOffset := req.Offset
			cmdEpoch := req.Epoch
			recoveryMode := reply.Options.RecoveryMode

			// Client provided subscribe request with recover flag on. Try to recover missed
			// publications automatically from history (we assume here that the history configured wisely).

			if recoveryMode == RecoveryModeCache {
				var latestPub *Publication
				var recoveredPub *Publication
				var currentSP StreamPosition
				latestPub, recoveredPub, currentSP, err = c.node.recoverCache(channel, reply.Options.HistoryMetaTTL, sub.tagsFilter)
				if err != nil {
					c.node.logger.log(newErrorLogEntry(err, "error on cache recover", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
					return handleErr(err)
				}
				latestOffset = currentSP.Offset
				latestEpoch = currentSP.Epoch
				var recovered bool
				recoveredPubs, recovered = isCacheRecovered(latestPub, recoveredPub, currentSP, cmdOffset, cmdEpoch)
				res.Recovered = recovered
				if latestPub == nil && c.node.clientEvents.cacheEmptyHandler != nil {
					cacheReply, err := c.node.clientEvents.cacheEmptyHandler(CacheEmptyEvent{Channel: channel})
					if err != nil {
						c.node.logger.log(newErrorLogEntry(err, "error on cache empty", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
						return handleErr(err)
					}
					if cacheReply.Populated && !recovered {
						// One more chance to recover in case we know cache was populated.
						latestPub, recoveredPub, currentSP, err = c.node.recoverCache(channel, reply.Options.HistoryMetaTTL, sub.tagsFilter)
						if err != nil {
							c.node.logger.log(newErrorLogEntry(err, "error on populated cache recover", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
							return handleErr(err)
						}
						latestOffset = currentSP.Offset
						latestEpoch = currentSP.Epoch
						recoveredPubs, recovered = isCacheRecovered(latestPub, recoveredPub, currentSP, cmdOffset, cmdEpoch)
						res.Recovered = recovered
						c.node.metrics.incRecover(res.Recovered, channel, len(recoveredPubs) > 0)
						if res.Recovered {
							c.node.metrics.observeRecoveredPublications(len(recoveredPubs), channel)
						}
					} else {
						c.node.metrics.incRecover(res.Recovered, channel, len(recoveredPubs) > 0)
						if res.Recovered {
							c.node.metrics.observeRecoveredPublications(len(recoveredPubs), channel)
						}
					}
				} else {
					c.node.metrics.incRecover(res.Recovered, channel, len(recoveredPubs) > 0)
					if res.Recovered {
						c.node.metrics.observeRecoveredPublications(len(recoveredPubs), channel)
					}
				}
			} else {
				historyResult, err := c.node.recoverHistory(channel, StreamPosition{Offset: cmdOffset, Epoch: cmdEpoch}, reply.Options.HistoryMetaTTL)
				if err != nil {
					if errors.Is(err, ErrorUnrecoverablePosition) {
						// Result contains stream position in case of ErrorUnrecoverablePosition
						// during recovery.
						latestOffset = historyResult.Offset
						latestEpoch = historyResult.Epoch
						res.Recovered = false
						c.node.metrics.incRecover(res.Recovered, channel, false)
					} else {
						c.node.logger.log(newErrorLogEntry(err, "error on recover", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
						return handleErr(err)
					}
				} else {
					latestOffset = historyResult.Offset
					latestEpoch = historyResult.Epoch
					var recovered bool
					recoveredPubs, recovered = isStreamRecovered(historyResult, cmdOffset, cmdEpoch, sub.tagsFilter)
					res.Recovered = recovered
					c.node.metrics.incRecover(res.Recovered, channel, len(recoveredPubs) > 0)
					if res.Recovered {
						c.node.metrics.observeRecoveredPublications(len(recoveredPubs), channel)
					}
				}
			}
		} else {
			streamTop, err := c.node.streamTop(channel, reply.Options.HistoryMetaTTL)
			if err != nil {
				c.node.logger.log(newErrorLogEntry(err, "error getting stream state for channel", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
				return handleErr(err)
			}
			latestOffset = streamTop.Offset
			latestEpoch = streamTop.Epoch
		}

		res.Epoch = latestEpoch
		res.Offset = latestOffset

		bufferedPubs := c.pubSubSync.LockBufferAndReadBuffered(channel)
		var okMerge bool
		recoveredPubs, maxSeenOffset, okMerge = recovery.MergePublications(recoveredPubs, bufferedPubs)
		if !okMerge {
			c.pubSubSync.StopBuffering(channel)
			ctx.disconnect = &DisconnectInsufficientState
			return ctx
		}
		if reply.Options.RecoveryMode == RecoveryModeCache && len(recoveredPubs) > 1 && req.Delta == "" {
			// In RecoveryModeCache case client is only interested in last message. So if delta encoding is
			// not used then we can only send the last publication.
			recoveredPubs = recoveredPubs[len(recoveredPubs)-1:]
		}
	}

	if len(recoveredPubs) > 0 {
		lastPubOffset := recoveredPubs[len(recoveredPubs)-1].Offset
		if lastPubOffset > res.Offset {
			// There can be a case when recovery returned a limited set of publications
			// thus last publication offset will be smaller than history current offset.
			// In this case res.Recovered will be false. So we take a maximum here.
			latestOffset = lastPubOffset
			res.Offset = latestOffset
		}
	}

	if maxSeenOffset > latestOffset {
		// Some entries could be filtered, but it's normal so we put max seen offset as the latest.
		latestOffset = maxSeenOffset
		res.Offset = latestOffset
	}

	var channelFlags uint8

	if res.Recovered {
		// Only append recovered publications in case continuity in a channel can be achieved.
		if res.Delta && req.Delta == string(DeltaTypeFossil) {
			res.Publications = c.makeRecoveredPubsDeltaFossil(recoveredPubs)
			// Allow delta for the following real-time publications since recovery is successful
			// and makeRecoveredPubsDeltaFossil already created publication with base data if required.
			channelFlags |= flagDeltaAllowed
		} else {
			res.Publications = recoveredPubs
		}
		// In case of successful recovery attach stream offset from request to subscribe response.
		// This simplifies client implementation as it doesn't need to distinguish between cases when
		// subscribe response has recovered publications, or it has no recovered publications.
		// Valid stream position will be then caught up upon processing publications.
		res.Offset = req.Offset
	}
	res.WasRecovering = req.Recover

	if !serverSide {
		// Write subscription reply only if initiated by client.
		protoReply, err := c.getSubscribeCommandReply(res)
		if err != nil {
			c.node.logger.log(newErrorLogEntry(err, "error encoding subscribe", map[string]any{"error": err.Error()}))
			c.pubSubSync.StopBuffering(channel) // Will be called later in case of server side sub.
			ctx.disconnect = &DisconnectServerError
			return ctx
		}

		// Need to flush data from writer so subscription response is
		// sent before any subscription publication.
		c.writeEncodedCommandReply(channel, protocol.FrameTypeSubscribe, cmd, protoReply, rw)
		defer c.releaseSubscribeCommandReply(protoReply)
		defer c.handleCommandFinished(cmd, protocol.FrameTypeSubscribe, nil, protoReply, started, "")
	}

	channelFlags |= flagSubscribed
	if serverSide {
		channelFlags |= flagServerSide
	}
	if reply.ClientSideRefresh {
		channelFlags |= flagClientSideRefresh
	}
	if reply.Options.EnablePositioning || reply.Options.EnableRecovery {
		channelFlags |= flagPositioning
	}
	if reply.Options.EmitPresence {
		channelFlags |= flagEmitPresence
	}
	if reply.Options.EmitJoinLeave {
		channelFlags |= flagEmitJoinLeave
	}
	if reply.Options.PushJoinLeave {
		channelFlags |= flagPushJoinLeave
	}

	channelContext := ChannelContext{
		info:     reply.Options.ChannelInfo,
		flags:    channelFlags,
		expireAt: reply.Options.ExpireAt,
		streamPosition: StreamPosition{
			Offset: latestOffset,
			Epoch:  latestEpoch,
		},
		metaTTLSeconds: int64(reply.Options.HistoryMetaTTL.Seconds()),
		Source:         reply.Options.Source,
	}
	if reply.Options.EnableRecovery || reply.Options.EnablePositioning {
		channelContext.positionCheckTime = time.Now().Unix()
	}

	if !serverSide {
		// In case of server-side sub this will be done later by the caller.
		c.mu.Lock()
		if chCtx, ok := c.channels[channel]; ok { // Move subscribingCh from existing channel context to the new one.
			channelContext.subscribingCh = chCtx.subscribingCh
		}
		c.channels[channel] = channelContext
		c.mu.Unlock()
		defer func() {
			c.mu.Lock()
			defer c.mu.Unlock()
			chCtx, ok := c.channels[channel]
			if ok && chCtx.subscribingCh != nil {
				close(chCtx.subscribingCh)
				chCtx.subscribingCh = nil
				c.channels[channel] = chCtx
			}
		}()
		// Stop syncing recovery and PUB/SUB.
		// In case of server side subscription we will do this later.
		c.pubSubSync.StopBuffering(channel)
	}

	if c.node.logger.enabled(LogLevelDebug) {
		c.node.logger.log(newLogEntry(LogLevelDebug, "client subscribed to channel", map[string]any{"client": c.uid, "user": c.user, "channel": req.Channel}))
	}

	ctx.result = res
	ctx.clientInfo = info
	ctx.channelContext = channelContext
	return ctx
}

func (c *Client) makeRecoveredPubsDeltaFossil(recoveredPubs []*protocol.Publication) []*protocol.Publication {
	if len(recoveredPubs) == 0 {
		return nil
	}
	prevPub := recoveredPubs[0]
	if c.transport.Protocol() == ProtocolTypeJSON {
		// For JSON case we need to use JSON string (js) for data.
		pub := &protocol.Publication{
			Offset: prevPub.Offset,
			Info:   prevPub.Info,
			Tags:   prevPub.Tags,
			Data:   json.Escape(convert.BytesToString(prevPub.Data)),
			Delta:  false,
		}
		recoveredPubs[0] = pub
	}
	// Probably during recovery we should not make deltas? This is something to investigate, in
	// RecoveryModeCache case this won't be used since there is only one publication max recovered.
	if len(recoveredPubs) > 1 {
		for i, pub := range recoveredPubs[1:] {
			patch := fdelta.Create(prevPub.Data, pub.Data)
			delta := true
			deltaData := patch
			if len(patch) >= len(pub.Data) {
				delta = false
				deltaData = pub.Data
			}
			if c.transport.Protocol() == ProtocolTypeJSON {
				deltaData = json.Escape(convert.BytesToString(deltaData))
			}
			deltaPub := &protocol.Publication{
				Offset: pub.Offset,
				Data:   deltaData,
				Info:   pub.Info,
				Tags:   pub.Tags,
				Delta:  delta,
			}
			prevPub = recoveredPubs[i+1]
			recoveredPubs[i+1] = deltaPub
		}
	}
	return recoveredPubs
}

func (c *Client) releaseSubscribeCommandReply(reply *protocol.Reply) {
	protocol.ReplyPool.ReleaseSubscribeReply(reply)
}

func (c *Client) getSubscribeCommandReply(res *protocol.SubscribeResult) (*protocol.Reply, error) {
	return protocol.ReplyPool.AcquireSubscribeReply(res), nil
}

func (c *Client) handleInsufficientState(ch string, serverSide bool) {
	if c.isAsyncUnsubscribe(serverSide) {
		c.handleAsyncUnsubscribe(ch, unsubscribeInsufficientState)
	} else {
		c.handleInsufficientStateDisconnect()
	}
}

func (c *Client) isAsyncUnsubscribe(serverSide bool) bool {
	return !serverSide
}

func (c *Client) handleInsufficientStateDisconnect() {
	_ = c.close(DisconnectInsufficientState)
}

func (c *Client) handleAsyncUnsubscribe(ch string, unsub Unsubscribe) {
	err := c.unsubscribe(ch, unsub, nil)
	if err != nil {
		c.node.logger.log(newErrorLogEntry(err, "error async unsubscribing", map[string]any{"channel": ch, "user": c.user, "client": c.uid, "error": err.Error()}))
		_ = c.close(DisconnectServerError)
		return
	}
	err = c.sendUnsubscribe(ch, unsub)
	if err != nil {
		_ = c.close(DisconnectWriteError)
		return
	}
}

func (c *Client) writePublicationUpdatePosition(
	ch string, pub *protocol.Publication, prep preparedData, sp StreamPosition, maxLagExceeded bool,
	batchConfig ChannelBatchConfig,
) error {
	c.mu.Lock()
	channelContext, ok := c.channels[ch]
	if !ok || !channelHasFlag(channelContext.flags, flagSubscribed) {
		c.mu.Unlock()
		return nil
	}
	deltaAllowed := channelHasFlag(channelContext.flags, flagDeltaAllowed)
	if !channelHasFlag(channelContext.flags, flagPositioning) {
		// Publication with Offset, but client does not use positioning.
		if hasFlag(c.transport.DisabledPushFlags(), PushFlagPublication) {
			c.mu.Unlock()
			return nil
		}
		c.mu.Unlock()
		if pub.Offset == math.MaxUint64 {
			// This is a special pub to trigger insufficient state. Noop in non-positioning case.
			return nil
		}

		// For non-positioning case, if publication should be filtered, skip it
		if prep.wasFiltered && !prep.deltaSub {
			return nil
		}

		if prep.deltaSub {
			if deltaAllowed {
				return c.writeEncodedPushData(prep.localDeltaData, ch, protocol.FrameTypePushPublication, batchConfig)
			}
			c.mu.Lock()
			if chCtx, chCtxOK := c.channels[ch]; chCtxOK {
				chCtx.flags |= flagDeltaAllowed
				c.channels[ch] = chCtx
			}
			c.mu.Unlock()
		}

		if c.node.logEnabled(LogLevelTrace) {
			c.traceOutPush(&protocol.Push{Channel: ch, Pub: pub})
		}
		return c.writeEncodedPushData(prep.fullData, ch, protocol.FrameTypePushPublication, batchConfig)
	}
	serverSide := channelHasFlag(channelContext.flags, flagServerSide)
	currentPositionOffset := channelContext.streamPosition.Offset
	nextExpectedOffset := currentPositionOffset + 1
	pubOffset := pub.Offset
	pubEpoch := sp.Epoch
	if maxLagExceeded {
		// PUB/SUB lag is too big.
		// We can introduce an option to mark connection with insufficient state flag instead
		// of disconnecting it immediately. In that case connection will eventually reconnect
		// due to periodic sync. While connection channel is in the insufficient state we must
		// skip publications coming to it. This mode may be useful to spread the resubscribe load.
		if c.node.logger.enabled(LogLevelDebug) {
			c.node.logger.log(newLogEntry(LogLevelDebug, "client insufficient state (lag)", map[string]any{"channel": ch, "user": c.user, "client": c.uid}))
		}
		// Tell client about insufficient state, can reconnect/resubscribe to recover the state.
		go func() { c.handleInsufficientState(ch, serverSide) }()
		c.mu.Unlock()
		return nil
	}
	if pubEpoch != channelContext.streamPosition.Epoch {
		// Wrong stream epoch is always a signal of insufficient state.
		// We can introduce an option to mark connection with insufficient state flag instead
		// of disconnecting it immediately. In that case connection will eventually reconnect
		// due to periodic sync. While connection channel is in the insufficient state we must
		// skip publications coming to it. This mode may be useful to spread the resubscribe load.
		if c.node.logger.enabled(LogLevelDebug) {
			c.node.logger.log(newLogEntry(LogLevelDebug, "client insufficient state (epoch)", map[string]any{"channel": ch, "user": c.user, "client": c.uid, "epoch": pubEpoch, "expectedEpoch": channelContext.streamPosition.Epoch}))
		}
		// Tell client about insufficient state, can reconnect/resubscribe to recover the state.
		go func() { c.handleInsufficientState(ch, serverSide) }()
		c.mu.Unlock()
		return nil
	}
	if pubOffset > nextExpectedOffset {
		// Missed message detected.
		// We can introduce an option to mark connection with insufficient state flag instead
		// of disconnecting it immediately. In that case connection will eventually reconnect
		// due to periodic sync. While connection channel is in the insufficient state we must
		// skip publications coming to it. This mode may be useful to spread the resubscribe load.
		if c.node.logger.enabled(LogLevelDebug) {
			c.node.logger.log(newLogEntry(LogLevelDebug, "client insufficient state (offset)", map[string]any{"channel": ch, "user": c.user, "client": c.uid, "offset": pubOffset, "expectedOffset": nextExpectedOffset}))
		}
		// Tell client about insufficient state, can reconnect/resubscribe to recover the state.
		go func() { c.handleInsufficientState(ch, serverSide) }()
		c.mu.Unlock()
		return nil
	} else if pubOffset < nextExpectedOffset {
		// Epoch is correct, but due to the lag in PUB/SUB processing we received non-actual update
		// here. Safe to just skip for the subscriber.
		c.mu.Unlock()
		return nil
	}
	channelContext.positionCheckTime = time.Now().Unix()
	channelContext.streamPosition.Offset = pub.Offset
	c.channels[ch] = channelContext
	c.mu.Unlock()
	if hasFlag(c.transport.DisabledPushFlags(), PushFlagPublication) {
		return nil
	}

	// If publication should be filtered, skip sending it but keep the offset updated
	if prep.wasFiltered && !prep.deltaSub {
		return nil
	}
	if prep.deltaSub {
		if deltaAllowed {
			if c.node.logEnabled(LogLevelTrace) {
				c.traceOutPush(&protocol.Push{Channel: ch, Pub: pub})
			}
			return c.writeEncodedPushData(prep.brokerDeltaData, ch, protocol.FrameTypePushPublication, batchConfig)
		}
		c.mu.Lock()
		if chCtx, chCtxOK := c.channels[ch]; chCtxOK {
			chCtx.flags |= flagDeltaAllowed
			c.channels[ch] = chCtx
		}
		c.mu.Unlock()
	}

	if c.node.logEnabled(LogLevelTrace) {
		c.traceOutPush(&protocol.Push{Channel: ch, Pub: pub})
	}
	return c.writeEncodedPushData(prep.fullData, ch, protocol.FrameTypePushPublication, batchConfig)
}

func (c *Client) writePublicationNoDelta(ch string, pub *protocol.Publication, data []byte, sp StreamPosition, batchConfig ChannelBatchConfig) error {
	return c.writePublication(
		ch, pub, preparedData{
			fullData: data, brokerDeltaData: nil, localDeltaData: nil, deltaSub: false, wasFiltered: false,
		},
		sp, false, batchConfig)
}

func (c *Client) writePublication(ch string, pub *protocol.Publication, prep preparedData, sp StreamPosition, maxLagExceeded bool, batchConfig ChannelBatchConfig) error {
	if pub.Offset == 0 {
		if hasFlag(c.transport.DisabledPushFlags(), PushFlagPublication) {
			return nil
		}

		// For publications without offset, if filtering is needed, we can skip them
		// early since there's no position tracking to maintain.
		if prep.wasFiltered && !prep.deltaSub {
			return nil
		}

		if prep.deltaSub {
			// For this path (no Offset) delta may come from channel medium layer, so that we can use it
			// here if allowed for the connection.
			c.mu.RLock()
			channelContext, ok := c.channels[ch]
			if !ok {
				c.mu.RUnlock()
				return nil
			}
			deltaAllowed := channelHasFlag(channelContext.flags, flagDeltaAllowed)
			c.mu.RUnlock()

			if deltaAllowed {
				if c.node.logEnabled(LogLevelTrace) {
					c.traceOutPush(&protocol.Push{Channel: ch, Pub: pub})
				}
				return c.writeEncodedPushData(prep.localDeltaData, ch, protocol.FrameTypePushPublication, batchConfig)
			}
			c.mu.Lock()
			if chCtx, chCtxOK := c.channels[ch]; chCtxOK {
				chCtx.flags |= flagDeltaAllowed
				c.channels[ch] = chCtx
			}
			c.mu.Unlock()
		}

		if c.node.logEnabled(LogLevelTrace) {
			c.traceOutPush(&protocol.Push{Channel: ch, Pub: pub})
		}
		return c.writeEncodedPushData(prep.fullData, ch, protocol.FrameTypePushPublication, batchConfig)
	}
	syncPub := pub
	if prep.wasFiltered {
		syncPub = prep.filteredPub
	}
	c.pubSubSync.SyncPublication(ch, syncPub, func() {
		_ = c.writePublicationUpdatePosition(ch, pub, prep, sp, maxLagExceeded, batchConfig)
	})
	return nil
}

func (c *Client) writeJoin(ch string, join *protocol.Join, data []byte, batchConfig ChannelBatchConfig) error {
	if c.node.logEnabled(LogLevelTrace) {
		c.traceOutPush(&protocol.Push{Channel: ch, Join: join})
	}
	if hasFlag(c.transport.DisabledPushFlags(), PushFlagJoin) {
		return nil
	}
	c.mu.RLock()
	channelContext, ok := c.channels[ch]
	if !ok || !channelHasFlag(channelContext.flags, flagSubscribed) {
		c.mu.RUnlock()
		return nil
	}
	if !channelHasFlag(channelContext.flags, flagPushJoinLeave) {
		c.mu.RUnlock()
		return nil
	}
	c.mu.RUnlock()
	return c.writeEncodedPushData(data, ch, protocol.FrameTypePushJoin, batchConfig)
}

func (c *Client) writeLeave(ch string, leave *protocol.Leave, data []byte, batchConfig ChannelBatchConfig) error {
	if c.node.logEnabled(LogLevelTrace) {
		c.traceOutPush(&protocol.Push{Channel: ch, Leave: leave})
	}
	if hasFlag(c.transport.DisabledPushFlags(), PushFlagLeave) {
		return nil
	}
	c.mu.RLock()
	channelContext, ok := c.channels[ch]
	if !ok || !channelHasFlag(channelContext.flags, flagSubscribed) {
		c.mu.RUnlock()
		return nil
	}
	if !channelHasFlag(channelContext.flags, flagPushJoinLeave) {
		c.mu.RUnlock()
		return nil
	}
	c.mu.RUnlock()
	return c.writeEncodedPushData(data, ch, protocol.FrameTypePushLeave, batchConfig)
}

// Lock must be held outside.
func (c *Client) unsubscribe(channel string, unsubscribe Unsubscribe, disconnect *Disconnect) error {
	c.mu.RLock()
	info := c.clientInfo(channel)
	chCtx, ok := c.channels[channel]
	subscribingCh := chCtx.subscribingCh
	isSubscribed := channelHasFlag(chCtx.flags, flagSubscribed)
	serverSide := channelHasFlag(chCtx.flags, flagServerSide)
	c.mu.RUnlock()
	if !ok {
		return nil
	}

	if !serverSide && !isSubscribed && subscribingCh != nil {
		// If client is not yet subscribed on a client-side channel, and subscribe
		// command is in progress - we need to wait for it to finish before proceeding.
		// We hang no longer than maxWaitTimeout here, if timeout happens - it's a signal
		// of server malfunction since long subscribes should not happen. In this case,
		// we disconnect client to let it re-init the state from scratch.
		maxWaitTimeout := 5 * time.Second
		select {
		case <-subscribingCh:
			c.mu.RLock()
			chCtx, ok = c.channels[channel]
			c.mu.RUnlock()
			if !ok {
				return nil
			}
		case <-time.After(maxWaitTimeout):
			c.mu.Lock()
			currentChCtx, ok := c.channels[channel]
			if ok && currentChCtx.subscribingCh != nil {
				close(currentChCtx.subscribingCh)
				currentChCtx.subscribingCh = nil
				c.channels[channel] = currentChCtx
			}
			c.mu.Unlock()
			go func() {
				_ = c.close(DisconnectServerError)
			}()
			c.node.logger.log(newLogEntry(LogLevelInfo, "timeout waiting for subscribe to finish", map[string]any{"channel": channel, "user": c.user, "client": c.uid}))
			return nil
		}
	}

	c.mu.Lock()
	currentChCtx, ok := c.channels[channel]
	if ok && currentChCtx.subscribingCh != nil {
		close(currentChCtx.subscribingCh)
	}
	delete(c.channels, channel)
	if disconnect == nil && c.perChannelWriter != nil {
		c.perChannelWriter.delWriter(channel, false)
	}
	c.mu.Unlock()

	if channelHasFlag(chCtx.flags, flagEmitPresence) && channelHasFlag(chCtx.flags, flagSubscribed) {
		err := c.node.removePresence(channel, c.uid, c.user)
		if err != nil {
			c.node.logger.log(newErrorLogEntry(err, "error removing channel presence", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
		}
	}

	if channelHasFlag(chCtx.flags, flagEmitJoinLeave) && channelHasFlag(chCtx.flags, flagSubscribed) {
		_ = c.node.publishLeave(channel, info)
	}

	if err := c.node.removeSubscription(channel, c); err != nil {
		c.node.logger.log(newErrorLogEntry(err, "error removing subscription", map[string]any{"channel": channel, "user": c.user, "client": c.uid, "error": err.Error()}))
		return err
	}

	if channelHasFlag(chCtx.flags, flagSubscribed) {
		if c.eventHub.unsubscribeHandler != nil {
			c.eventHub.unsubscribeHandler(UnsubscribeEvent{
				Channel:     channel,
				ServerSide:  serverSide,
				Unsubscribe: unsubscribe,
				Disconnect:  disconnect,
			})
		}
	}

	if c.node.logger.enabled(LogLevelDebug) {
		c.node.logger.log(newLogEntry(LogLevelDebug, "client unsubscribed from channel", map[string]any{"channel": channel, "user": c.user, "client": c.uid}))
	}

	return nil
}

func (c *Client) logDisconnectBadRequest(message string) error {
	c.node.logger.log(newLogEntry(LogLevelInfo, message, map[string]any{"user": c.user, "client": c.uid}))
	return DisconnectBadRequest
}

func (c *Client) logWriteInternalErrorFlush(ch string, frameType protocol.FrameType, cmd *protocol.Command, err error, message string, started time.Time, rw *replyWriter) {
	defer func() {
		c.node.metrics.observeCommandDuration(frameType, time.Since(started), ch)
	}()
	var clientErr *Error
	if errors.As(err, &clientErr) {
		errorReply := &protocol.Reply{Error: clientErr.toProto()}
		c.writeError(ch, frameType, cmd, errorReply, rw)
		return
	}
	c.node.logger.log(newErrorLogEntry(err, message, map[string]any{"error": err.Error()}))

	errorReply := &protocol.Reply{Error: ErrorInternal.toProto()}
	c.writeError(ch, frameType, cmd, errorReply, rw)
	if c.node.clientEvents.commandProcessedHandler != nil {
		event := newCommandProcessedEvent(cmd, nil, errorReply, started)
		c.issueCommandProcessedEvent(event)
	}
}

func toClientErr(err error) *Error {
	var clientErr *Error
	if errors.As(err, &clientErr) {
		return clientErr
	}
	return ErrorInternal
}

func disconnectFromError(err error) (*Disconnect, bool) {
	var disconnect *Disconnect
	if errors.As(err, &disconnect) {
		return disconnect, true
	}
	var disconnectValue Disconnect
	if errors.As(err, &disconnectValue) {
		return &disconnectValue, true
	}
	return nil, false
}
