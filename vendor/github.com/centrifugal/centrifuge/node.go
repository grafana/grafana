package centrifuge

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/centrifugal/centrifuge/internal/controlpb"
	"github.com/centrifugal/centrifuge/internal/controlproto"
	"github.com/centrifugal/centrifuge/internal/dissolve"
	"github.com/centrifugal/centrifuge/internal/nowtime"

	"github.com/FZambia/eagle"
	"github.com/centrifugal/protocol"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/sync/singleflight"
)

// Node is a heart of Centrifuge library – it keeps and manages client connections,
// maintains information about other Centrifuge nodes in cluster, keeps references
// to common things (like Broker and PresenceManager, Hub) etc.
// By default, Node uses in-memory implementations of Broker and PresenceManager -
// MemoryBroker and MemoryPresenceManager which allow running a single Node only.
// To scale use other implementations of Broker and PresenceManager like builtin
// RedisBroker and RedisPresenceManager.
type Node struct {
	mu sync.RWMutex
	// unique id for this node.
	uid string
	// startedAt is unix time of node start.
	startedAt int64
	// config for node.
	config Config
	// hub to manage client connections.
	hub *Hub
	// broker is responsible for PUB/SUB and history streaming mechanics.
	broker Broker
	// presenceManager is responsible for presence information management.
	presenceManager PresenceManager
	// nodes contains registry of known nodes.
	nodes *nodeRegistry
	// metrics registry.
	metrics *metrics
	// shutdown is a flag which is only true when node is going to shut down.
	shutdown bool
	// shutdownCh is a channel which is closed when node shutdown initiated.
	shutdownCh chan struct{}
	// clientEvents to manage event handlers attached to node.
	clientEvents *eventHub
	// logger allows to log throughout library code and proxy log entries to
	// configured log handler.
	logger *logger
	// cache control encoder in Node.
	controlEncoder controlproto.Encoder
	// cache control decoder in Node.
	controlDecoder controlproto.Decoder
	// subLocks synchronizes access to adding/removing subscriptions.
	subLocks map[int]*sync.Mutex

	metricsMu       sync.Mutex
	metricsExporter *eagle.Eagle
	metricsSnapshot *eagle.Metrics

	// subDissolver used to reliably clear unused subscriptions in Broker.
	subDissolver *dissolve.Dissolver

	// nowTimeGetter provides access to current time.
	nowTimeGetter nowtime.Getter

	surveyHandler  SurveyHandler
	surveyRegistry map[uint64]chan survey
	surveyMu       sync.RWMutex
	surveyID       uint64

	notificationHandler NotificationHandler
	nodeInfoSendHandler NodeInfoSendHandler

	emulationSurveyHandler *emulationSurveyHandler

	mediums     map[string]*channelMedium
	mediumLocks map[int]*sync.Mutex // Sharded locks for mediums map.
}

const (
	numSubLocks            = 16384
	numMediumLocks         = 16384
	numSubDissolverWorkers = 64
)

// New creates Node with provided Config.
func New(c Config) (*Node, error) {
	if c.NodeInfoMetricsAggregateInterval == 0 {
		c.NodeInfoMetricsAggregateInterval = 60 * time.Second
	}
	if c.ClientPresenceUpdateInterval == 0 {
		c.ClientPresenceUpdateInterval = 25 * time.Second
	}
	if c.ClientChannelPositionCheckDelay == 0 {
		c.ClientChannelPositionCheckDelay = 40 * time.Second
	}
	if c.ClientExpiredCloseDelay == 0 {
		c.ClientExpiredCloseDelay = 25 * time.Second
	}
	if c.ClientExpiredSubCloseDelay == 0 {
		c.ClientExpiredSubCloseDelay = 25 * time.Second
	}
	if c.ClientStaleCloseDelay == 0 {
		c.ClientStaleCloseDelay = 15 * time.Second
	}
	if c.ClientQueueMaxSize == 0 {
		c.ClientQueueMaxSize = 1048576 // 1MB by default.
	}
	if c.ClientChannelLimit == 0 {
		c.ClientChannelLimit = 128
	}
	if c.ChannelMaxLength == 0 {
		c.ChannelMaxLength = 255
	}
	if c.HistoryMetaTTL == 0 {
		c.HistoryMetaTTL = 30 * 24 * time.Hour // 30 days by default.
	}

	uidObj, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}
	uid := uidObj.String()

	subLocks := make(map[int]*sync.Mutex, numSubLocks)
	for i := 0; i < numSubLocks; i++ {
		subLocks[i] = &sync.Mutex{}
	}

	mediumLocks := make(map[int]*sync.Mutex, numMediumLocks)
	for i := 0; i < numMediumLocks; i++ {
		mediumLocks[i] = &sync.Mutex{}
	}

	if c.Name == "" {
		hostname, err := os.Hostname()
		if err != nil {
			return nil, err
		}
		c.Name = hostname
	}

	var lg *logger
	if c.LogHandler != nil {
		lg = newLogger(c.LogLevel, c.LogHandler)
	}

	n := &Node{
		uid:            uid,
		nodes:          newNodeRegistry(uid),
		config:         c,
		startedAt:      time.Now().Unix(),
		shutdownCh:     make(chan struct{}),
		logger:         lg,
		controlEncoder: controlproto.NewProtobufEncoder(),
		controlDecoder: controlproto.NewProtobufDecoder(),
		clientEvents:   &eventHub{},
		subLocks:       subLocks,
		subDissolver:   dissolve.New(numSubDissolverWorkers),
		nowTimeGetter:  nowtime.Get,
		surveyRegistry: make(map[uint64]chan survey),
		mediums:        map[string]*channelMedium{},
		mediumLocks:    mediumLocks,
	}
	n.emulationSurveyHandler = newEmulationSurveyHandler(n)

	m, err := newMetricsRegistry(c.Metrics)
	if err != nil {
		return nil, fmt.Errorf("error initializing metrics: %v", err)
	}
	n.metrics = m

	n.hub = newHub(lg, n.metrics, c.ClientChannelPositionMaxTimeLag.Milliseconds())

	b, err := NewMemoryBroker(n, MemoryBrokerConfig{})
	if err != nil {
		return nil, err
	}
	n.SetBroker(b)

	pm, err := NewMemoryPresenceManager(n, MemoryPresenceManagerConfig{})
	if err != nil {
		return nil, err
	}
	n.SetPresenceManager(pm)

	return n, nil
}

// index chooses bucket number in range [0, numBuckets).
func index(s string, numBuckets int) int {
	if numBuckets == 1 {
		return 0
	}
	hash := fnv.New64a()
	_, _ = hash.Write([]byte(s))
	return int(hash.Sum64() % uint64(numBuckets))
}

// Config returns Node's Config.
func (n *Node) Config() Config {
	return n.config
}

// ID returns unique Node identifier. This is a UUID v4 value.
func (n *Node) ID() string {
	return n.uid
}

func (n *Node) subLock(ch string) *sync.Mutex {
	return n.subLocks[index(ch, numSubLocks)]
}

func (n *Node) mediumLock(ch string) *sync.Mutex {
	return n.mediumLocks[index(ch, numMediumLocks)]
}

// SetBroker allows setting Broker implementation to use.
func (n *Node) SetBroker(b Broker) {
	n.broker = b
}

// SetPresenceManager allows setting PresenceManager to use.
func (n *Node) SetPresenceManager(m PresenceManager) {
	n.presenceManager = m
}

// Hub returns node's Hub.
func (n *Node) Hub() *Hub {
	return n.hub
}

// Run performs node startup actions. At moment must be called once on start
// after Broker set to Node.
func (n *Node) Run() error {
	if err := n.broker.Run(n); err != nil {
		return err
	}
	err := n.initMetrics()
	if err != nil {
		n.logger.log(newErrorLogEntry(err, "error on init metrics", map[string]any{"error": err.Error()}))
		return err
	}
	err = n.pubNode("")
	if err != nil {
		n.logger.log(newErrorLogEntry(err, "error publishing node control command", map[string]any{"error": err.Error()}))
		return err
	}
	go n.sendNodePing()
	go n.cleanNodeInfo()
	go n.updateMetrics()
	return n.subDissolver.Run()
}

// logEnabled allows check whether a LogLevel enabled or not.
func (n *Node) logEnabled(level LogLevel) bool {
	return n.logger.enabled(level)
}

// Shutdown sets shutdown flag to Node so handlers could stop accepting
// new requests and disconnects clients with shutdown reason.
func (n *Node) Shutdown(ctx context.Context) error {
	n.mu.Lock()
	if n.shutdown {
		n.mu.Unlock()
		return nil
	}
	n.shutdown = true
	close(n.shutdownCh)
	n.mu.Unlock()
	cmd := &controlpb.Command{
		Uid:      n.uid,
		Shutdown: &controlpb.Shutdown{},
	}
	_ = n.publishControl(cmd, "")
	if closer, ok := n.broker.(Closer); ok {
		defer func() { _ = closer.Close(ctx) }()
	}
	if n.presenceManager != nil {
		if closer, ok := n.presenceManager.(Closer); ok {
			defer func() { _ = closer.Close(ctx) }()
		}
	}
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_ = n.subDissolver.Close()
	}()
	go func() {
		defer wg.Done()
		_ = n.hub.shutdown(ctx)
	}()
	wg.Wait()
	return ctx.Err()
}

// NotifyShutdown returns a channel which will be closed on node shutdown.
func (n *Node) NotifyShutdown() chan struct{} {
	return n.shutdownCh
}

func (n *Node) updateGauges() {
	n.metrics.setNumClients(float64(n.hub.NumClients()))
	n.metrics.setNumUsers(float64(n.hub.NumUsers()))
	n.metrics.setNumSubscriptions(float64(n.hub.NumSubscriptions()))
	n.metrics.setNumChannels(float64(n.hub.NumChannels()))
	n.metrics.setNumNodes(float64(n.nodes.size()))
	version := n.config.Version
	if version == "" {
		version = "_"
	}
	n.metrics.setBuildInfo(version)
}

func (n *Node) updateMetrics() {
	n.updateGauges()
	for {
		select {
		case <-n.shutdownCh:
			return
		case <-time.After(10 * time.Second):
			n.updateGauges()
		}
	}
}

// Centrifuge library uses Prometheus metrics for instrumentation. But we also try to
// aggregate Prometheus metrics periodically and share this information between Nodes.
func (n *Node) initMetrics() error {
	if n.config.NodeInfoMetricsAggregateInterval == 0 {
		return nil
	}

	var gatherer prometheus.Gatherer
	if n.metrics.config.RegistererGatherer != nil {
		gatherer = n.metrics.config.RegistererGatherer
	} else {
		gatherer = prometheus.DefaultGatherer
	}

	metricsSink := make(chan eagle.Metrics)
	n.metricsExporter = eagle.New(eagle.Config{
		Gatherer:        gatherer,
		Interval:        n.config.NodeInfoMetricsAggregateInterval,
		Sink:            metricsSink,
		PrefixWhitelist: []string{getMetricsNamespace(n.config.Metrics)},
	})
	initialMetricsSnapshot, err := n.metricsExporter.Export()
	if err != nil {
		return err
	}
	n.metricsMu.Lock()
	n.metricsSnapshot = &initialMetricsSnapshot
	n.metricsMu.Unlock()
	go func() {
		for {
			select {
			case <-n.NotifyShutdown():
				return
			case metricsSnapshot := <-metricsSink:
				n.metricsMu.Lock()
				n.metricsSnapshot = &metricsSnapshot
				n.metricsMu.Unlock()
			}
		}
	}()
	return nil
}

func (n *Node) sendNodePing() {
	for {
		select {
		case <-n.shutdownCh:
			return
		case <-time.After(nodeInfoPublishInterval):
			err := n.pubNode("")
			if err != nil {
				n.logger.log(newErrorLogEntry(err, "error publishing node control command", map[string]any{"error": err.Error()}))
			}
		}
	}
}

func (n *Node) cleanNodeInfo() {
	for {
		select {
		case <-n.shutdownCh:
			return
		case <-time.After(nodeInfoCleanInterval):
			n.nodes.clean(nodeInfoMaxDelay)
		}
	}
}

func (n *Node) handleNotification(fromNodeID string, req *controlpb.Notification) error {
	if n.notificationHandler == nil {
		return nil
	}
	n.notificationHandler(NotificationEvent{
		FromNodeID: fromNodeID,
		Op:         req.Op,
		Data:       req.Data,
	})
	return nil
}

func (n *Node) handleSurveyRequest(fromNodeID string, req *controlpb.SurveyRequest) error {
	if n.surveyHandler == nil && n.emulationSurveyHandler == nil {
		return nil
	}
	cb := func(reply SurveyReply) {
		surveyResponse := &controlpb.SurveyResponse{
			Id:   req.Id,
			Code: reply.Code,
			Data: reply.Data,
		}
		cmd := &controlpb.Command{
			Uid:            n.uid,
			SurveyResponse: surveyResponse,
		}
		_ = n.publishControl(cmd, fromNodeID)
	}
	if req.Op == emulationOp && n.emulationSurveyHandler != nil {
		n.emulationSurveyHandler.HandleEmulation(SurveyEvent{Op: req.Op, Data: req.Data}, cb)
		return nil
	}
	if n.surveyHandler == nil {
		return nil
	}
	n.surveyHandler(SurveyEvent{Op: req.Op, Data: req.Data}, cb)
	return nil
}

func (n *Node) handleSurveyResponse(uid string, resp *controlpb.SurveyResponse) error {
	n.surveyMu.RLock()
	defer n.surveyMu.RUnlock()
	if ch, ok := n.surveyRegistry[resp.Id]; ok {
		select {
		case ch <- survey{
			UID: uid,
			Result: SurveyResult{
				Code: resp.Code,
				Data: resp.Data,
			},
		}:
		default:
			// Survey channel allocated with capacity enough to receive all survey replies,
			// default case here means that channel has no reader anymore, so it's safe to
			// skip message. This extra survey reply can come from extra node that just
			// joined.
		}
	}
	return nil
}

// SurveyResult from node.
type SurveyResult struct {
	Code uint32
	Data []byte
}

type survey struct {
	UID    string
	Result SurveyResult
}

var errSurveyHandlerNotRegistered = errors.New("no survey handler registered")

const defaultSurveyTimeout = 10 * time.Second

// Survey allows collecting data from all running Centrifuge nodes. This method publishes
// control messages, then waits for replies from all running nodes. The maximum time to wait
// can be controlled over context timeout. If provided context does not have a deadline for
// survey then this method uses default 10 seconds timeout. Keep in mind that Survey does not
// scale very well as number of Centrifuge Node grows. Though it has reasonably good performance
// to perform rare tasks even with relatively large number of nodes.
// If toNodeID is not an empty string then a survey will be sent only to the concrete node in
// a cluster, otherwise a survey sent to all running nodes. See a corresponding Node.OnSurvey
// method to handle received surveys.
// Survey ops starting with `centrifuge_` are reserved by Centrifuge library.
func (n *Node) Survey(ctx context.Context, op string, data []byte, toNodeID string) (map[string]SurveyResult, error) {
	if n.surveyHandler == nil && op != emulationOp {
		return nil, errSurveyHandlerNotRegistered
	}

	n.metrics.incActionCount("survey", "")
	started := time.Now()
	defer func() {
		n.metrics.observeSurveyDuration(op, time.Since(started))
	}()

	if _, ok := ctx.Deadline(); !ok {
		// If no timeout provided then fallback to defaultSurveyTimeout to avoid endless surveys.
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, defaultSurveyTimeout)
		defer cancel()
	}

	var numNodes int
	if toNodeID != "" {
		numNodes = 1
	} else {
		numNodes = n.nodes.size()
	}

	n.surveyMu.Lock()
	n.surveyID++
	surveyRequest := &controlpb.SurveyRequest{
		Id:   n.surveyID,
		Op:   op,
		Data: data,
	}
	surveyChan := make(chan survey, numNodes)
	n.surveyRegistry[surveyRequest.Id] = surveyChan
	n.surveyMu.Unlock()

	defer func() {
		n.surveyMu.Lock()
		defer n.surveyMu.Unlock()
		delete(n.surveyRegistry, surveyRequest.Id)
	}()

	results := map[string]SurveyResult{}

	needDistributedPublish := true

	// Invoke handler on this node since control message handler
	// ignores those sent from the current Node.
	if toNodeID == "" || toNodeID == n.ID() {
		if toNodeID == n.ID() || (toNodeID == "" && numNodes == 1) {
			needDistributedPublish = false
		}
		if op == emulationOp {
			n.emulationSurveyHandler.HandleEmulation(SurveyEvent{Op: op, Data: data}, func(reply SurveyReply) {
				surveyChan <- survey{
					UID:    n.uid,
					Result: SurveyResult(reply),
				}
			})
		} else {
			n.surveyHandler(SurveyEvent{Op: op, Data: data}, func(reply SurveyReply) {
				surveyChan <- survey{
					UID:    n.uid,
					Result: SurveyResult(reply),
				}
			})
		}
	}

	var wg sync.WaitGroup
	wg.Add(1)

	go func() {
		defer wg.Done()
		for {
			select {
			case resp := <-surveyChan:
				results[resp.UID] = resp.Result
				if len(results) == numNodes {
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	if needDistributedPublish {
		cmd := &controlpb.Command{
			Uid:           n.uid,
			SurveyRequest: surveyRequest,
		}
		err := n.publishControl(cmd, toNodeID)
		if err != nil {
			return nil, err
		}
	}

	wg.Wait()
	return results, ctx.Err()
}

// Info contains information about all known server nodes.
type Info struct {
	Nodes []NodeInfo
}

// Metrics aggregation over time interval for node.
type Metrics struct {
	Interval float64
	Items    map[string]float64
}

// NodeInfo contains information about node.
type NodeInfo struct {
	UID         string
	Name        string
	Version     string
	NumClients  uint32
	NumUsers    uint32
	NumSubs     uint32
	NumChannels uint32
	Uptime      uint32
	Metrics     *Metrics
	Data        []byte
}

// Info returns aggregated stats from all nodes.
func (n *Node) Info() (Info, error) {
	nodes := n.nodes.list()
	nodeResults := make([]NodeInfo, len(nodes))
	for i, nd := range nodes {
		info := NodeInfo{
			UID:         nd.Uid,
			Name:        nd.Name,
			Version:     nd.Version,
			NumClients:  nd.NumClients,
			NumUsers:    nd.NumUsers,
			NumSubs:     nd.NumSubs,
			NumChannels: nd.NumChannels,
			Uptime:      nd.Uptime,
			Data:        nd.Data,
		}
		if nd.Metrics != nil {
			info.Metrics = &Metrics{
				Interval: nd.Metrics.Interval,
				Items:    nd.Metrics.Items,
			}
		}
		nodeResults[i] = info
	}

	return Info{
		Nodes: nodeResults,
	}, nil
}

// handleControl handles messages from control channel - control messages used for internal
// communication between nodes to share state or proto.
func (n *Node) handleControl(data []byte) error {
	n.metrics.incMessagesReceived("control", "")

	cmd, err := n.controlDecoder.DecodeCommand(data)
	if err != nil {
		n.logger.log(newErrorLogEntry(err, "error decoding control command", map[string]any{"error": err.Error()}))
		return err
	}

	if cmd.Uid == n.uid {
		// Sent by this node.
		return nil
	}

	uid := cmd.Uid

	// control proto v2.
	if cmd.Node != nil {
		return n.nodeCmd(cmd.Node)
	} else if cmd.Shutdown != nil {
		return n.shutdownCmd(uid)
	} else if cmd.Unsubscribe != nil {
		cmd := cmd.Unsubscribe
		return n.hub.unsubscribe(cmd.User, cmd.Channel, Unsubscribe{Code: cmd.Code, Reason: cmd.Reason}, cmd.Client, cmd.Session)
	} else if cmd.Subscribe != nil {
		cmd := cmd.Subscribe
		var recoverSince *StreamPosition
		if cmd.RecoverSince != nil {
			recoverSince = &StreamPosition{Offset: cmd.RecoverSince.Offset, Epoch: cmd.RecoverSince.Epoch}
		}
		return n.hub.subscribe(cmd.User, cmd.Channel, cmd.Client, cmd.Session, WithExpireAt(cmd.ExpireAt), WithChannelInfo(cmd.ChannelInfo), WithEmitPresence(cmd.EmitPresence), WithEmitJoinLeave(cmd.EmitJoinLeave), WithPushJoinLeave(cmd.PushJoinLeave), WithPositioning(cmd.Position), WithRecovery(cmd.Recover), WithSubscribeData(cmd.Data), WithRecoverSince(recoverSince), WithSubscribeSource(uint8(cmd.Source)))
	} else if cmd.Disconnect != nil {
		cmd := cmd.Disconnect
		return n.hub.disconnect(cmd.User, Disconnect{Code: cmd.Code, Reason: cmd.Reason}, cmd.Client, cmd.Session, cmd.Whitelist)
	} else if cmd.SurveyRequest != nil {
		cmd := cmd.SurveyRequest
		return n.handleSurveyRequest(uid, cmd)
	} else if cmd.SurveyResponse != nil {
		cmd := cmd.SurveyResponse
		return n.handleSurveyResponse(uid, cmd)
	} else if cmd.Notification != nil {
		cmd := cmd.Notification
		return n.handleNotification(uid, cmd)
	} else if cmd.Refresh != nil {
		cmd := cmd.Refresh
		return n.hub.refresh(cmd.User, cmd.Client, cmd.Session, WithRefreshExpired(cmd.Expired), WithRefreshExpireAt(cmd.ExpireAt), WithRefreshInfo(cmd.Info))
	}
	n.logger.log(newErrorLogEntry(err, "unknown control command", map[string]any{"command": fmt.Sprintf("%#v", cmd)}))
	return nil
}

// handlePublication handles messages published into channel and
// coming from Broker. The goal of method is to deliver this message
// to all clients on this node currently subscribed to channel.
func (n *Node) handlePublication(ch string, sp StreamPosition, pub, prevPub, localPrevPub *Publication) error {
	n.metrics.incMessagesReceived("publication", ch)
	numSubscribers := n.hub.NumSubscribers(ch)
	hasCurrentSubscribers := numSubscribers > 0
	if !hasCurrentSubscribers {
		return nil
	}
	maxBatchSize, maxBatchDelay := n.getBatchConfig(ch)
	return n.hub.broadcastPublication(ch, sp, pub, prevPub, localPrevPub, maxBatchSize, maxBatchDelay)
}

func (n *Node) getBatchConfig(channel string) (int64, time.Duration) {
	var (
		maxBatchSize  int64
		maxBatchDelay time.Duration
	)
	if n.config.GetChannelBatchConfig != nil {
		batchConfig := n.config.GetChannelBatchConfig(channel)
		maxBatchSize, maxBatchDelay = batchConfig.MaxSize, batchConfig.MaxDelay
	}
	return maxBatchSize, maxBatchDelay
}

// handleJoin handles join messages - i.e. broadcasts it to
// interested local clients subscribed to channel.
func (n *Node) handleJoin(ch string, info *ClientInfo) error {
	n.metrics.incMessagesReceived("join", ch)
	numSubscribers := n.hub.NumSubscribers(ch)
	hasCurrentSubscribers := numSubscribers > 0
	if !hasCurrentSubscribers {
		return nil
	}
	maxBatchSize, maxBatchDelay := n.getBatchConfig(ch)
	return n.hub.broadcastJoin(ch, info, maxBatchSize, maxBatchDelay)
}

// handleLeave handles leave messages - i.e. broadcasts it to
// interested local clients subscribed to channel.
func (n *Node) handleLeave(ch string, info *ClientInfo) error {
	n.metrics.incMessagesReceived("leave", ch)
	numSubscribers := n.hub.NumSubscribers(ch)
	hasCurrentSubscribers := numSubscribers > 0
	if !hasCurrentSubscribers {
		return nil
	}
	maxBatchSize, maxBatchDelay := n.getBatchConfig(ch)
	return n.hub.broadcastLeave(ch, info, maxBatchSize, maxBatchDelay)
}

func (n *Node) publish(ch string, data []byte, opts ...PublishOption) (PublishResult, error) {
	pubOpts := &PublishOptions{}
	for _, opt := range opts {
		opt(pubOpts)
	}
	n.metrics.incMessagesSent("publication", ch)
	streamPos, fromCache, err := n.getBroker(ch).Publish(ch, data, *pubOpts)
	if err != nil {
		return PublishResult{}, err
	}
	return PublishResult{StreamPosition: streamPos, FromCache: fromCache}, nil
}

// PublishResult returned from Publish operation.
type PublishResult struct {
	StreamPosition
	FromCache bool
}

// Publish sends data to all clients subscribed on channel at this moment. All running
// nodes will receive Publication and send it to all local channel subscribers.
//
// Data expected to be valid marshaled JSON or any binary payload.
// Connections that work over JSON protocol can not handle binary payloads.
// Connections that work over Protobuf protocol can work both with JSON and binary payloads.
//
// So the rule here: if you have channel subscribers that work using JSON
// protocol then you can not publish binary data to these channel.
//
// Channels in Centrifuge are ephemeral and its settings not persisted over different
// publish operations. So if you want to have a channel with history stream behind you
// need to provide WithHistory option on every publish. To simplify working with different
// channels you can make some type of publish wrapper in your own code.
//
// The returned PublishResult contains embedded StreamPosition that describes
// position inside stream Publication was added too. For channels without history
// enabled (i.e. when Publications only sent to PUB/SUB system) StreamPosition will
// be an empty struct (i.e. PublishResult.Offset will be zero).
func (n *Node) Publish(channel string, data []byte, opts ...PublishOption) (PublishResult, error) {
	return n.publish(channel, data, opts...)
}

// publishJoin allows publishing join message into channel when someone subscribes on it
// or leave message when someone unsubscribes from channel.
func (n *Node) publishJoin(ch string, info *ClientInfo) error {
	n.metrics.incMessagesSent("join", ch)
	return n.getBroker(ch).PublishJoin(ch, info)
}

// publishLeave allows publishing join message into channel when someone subscribes on it
// or leave message when someone unsubscribes from channel.
func (n *Node) publishLeave(ch string, info *ClientInfo) error {
	n.metrics.incMessagesSent("leave", ch)
	return n.getBroker(ch).PublishLeave(ch, info)
}

var errNotificationHandlerNotRegistered = errors.New("notification handler not registered")

// Notify allows sending an asynchronous notification to all other nodes
// (or to a single specific node). Unlike Survey, it does not wait for any
// response. If toNodeID is not an empty string then a notification will
// be sent to a concrete node in cluster, otherwise a notification sent to
// all running nodes. See a corresponding Node.OnNotification method to
// handle received notifications.
func (n *Node) Notify(op string, data []byte, toNodeID string) error {
	if n.notificationHandler == nil {
		return errNotificationHandlerNotRegistered
	}

	n.metrics.incActionCount("notify", "")

	if toNodeID == "" || n.ID() == toNodeID {
		// Invoke handler on this node since control message handler
		// ignores those sent from the current Node.
		n.notificationHandler(NotificationEvent{
			FromNodeID: n.ID(),
			Op:         op,
			Data:       data,
		})
	}
	if n.ID() == toNodeID {
		// Already on this node and called notificationHandler above, no
		// need to send notification over network.
		return nil
	}
	notification := &controlpb.Notification{
		Op:   op,
		Data: data,
	}
	cmd := &controlpb.Command{
		Uid:          n.uid,
		Notification: notification,
	}
	return n.publishControl(cmd, toNodeID)
}

// publishControl publishes message into control channel so all running
// nodes will receive and handle it.
func (n *Node) publishControl(cmd *controlpb.Command, nodeID string) error {
	n.metrics.incMessagesSent("control", "")
	data, err := n.controlEncoder.EncodeCommand(cmd)
	if err != nil {
		return err
	}
	return n.broker.PublishControl(data, nodeID, "")
}

func (n *Node) getMetrics(metrics eagle.Metrics) *controlpb.Metrics {
	return &controlpb.Metrics{
		Interval: n.config.NodeInfoMetricsAggregateInterval.Seconds(),
		Items:    metrics.Flatten("."),
	}
}

// pubNode sends control message to all nodes - this message
// contains information about current node.
func (n *Node) pubNode(nodeID string) error {
	var data []byte
	if n.nodeInfoSendHandler != nil {
		reply := n.nodeInfoSendHandler()
		data = reply.Data
	}
	n.mu.RLock()
	node := &controlpb.Node{
		Uid:         n.uid,
		Name:        n.config.Name,
		Version:     n.config.Version,
		NumClients:  uint32(n.hub.NumClients()),
		NumUsers:    uint32(n.hub.NumUsers()),
		NumChannels: uint32(n.hub.NumChannels()),
		NumSubs:     uint32(n.hub.NumSubscriptions()),
		Uptime:      uint32(time.Now().Unix() - n.startedAt),
		Data:        data,
	}

	n.metricsMu.Lock()
	if n.metricsSnapshot != nil {
		node.Metrics = n.getMetrics(*n.metricsSnapshot)
	}
	// We only send metrics once when updated.
	n.metricsSnapshot = nil
	n.metricsMu.Unlock()

	n.mu.RUnlock()

	cmd := &controlpb.Command{
		Uid:  n.uid,
		Node: node,
	}

	err := n.nodeCmd(node)
	if err != nil {
		n.logger.log(newErrorLogEntry(err, "error handling node command", map[string]any{"error": err.Error()}))
	}

	return n.publishControl(cmd, nodeID)
}

func (n *Node) pubSubscribe(user string, ch string, opts SubscribeOptions) error {
	subscribe := &controlpb.Subscribe{
		User:          user,
		Channel:       ch,
		EmitPresence:  opts.EmitPresence,
		EmitJoinLeave: opts.EmitJoinLeave,
		PushJoinLeave: opts.PushJoinLeave,
		ChannelInfo:   opts.ChannelInfo,
		Position:      opts.EnablePositioning,
		Recover:       opts.EnableRecovery,
		ExpireAt:      opts.ExpireAt,
		Client:        opts.clientID,
		Session:       opts.sessionID,
		Data:          opts.Data,
		Source:        uint32(opts.Source),
	}
	if opts.RecoverSince != nil {
		subscribe.RecoverSince = &controlpb.StreamPosition{
			Offset: opts.RecoverSince.Offset,
			Epoch:  opts.RecoverSince.Epoch,
		}
	}
	cmd := &controlpb.Command{
		Uid:       n.uid,
		Subscribe: subscribe,
	}
	return n.publishControl(cmd, "")
}

func (n *Node) pubRefresh(user string, opts RefreshOptions) error {
	refresh := &controlpb.Refresh{
		User:     user,
		Expired:  opts.Expired,
		ExpireAt: opts.ExpireAt,
		Client:   opts.clientID,
		Session:  opts.sessionID,
		Info:     opts.Info,
	}
	cmd := &controlpb.Command{
		Uid:     n.uid,
		Refresh: refresh,
	}
	return n.publishControl(cmd, "")
}

// pubUnsubscribe publishes unsubscribe control message to all nodes – so all
// nodes could unsubscribe user from channel.
func (n *Node) pubUnsubscribe(user string, ch string, unsubscribe Unsubscribe, clientID, sessionID string) error {
	unsub := &controlpb.Unsubscribe{
		User:    user,
		Channel: ch,
		Code:    unsubscribe.Code,
		Reason:  unsubscribe.Reason,
		Client:  clientID,
		Session: sessionID,
	}
	cmd := &controlpb.Command{
		Uid:         n.uid,
		Unsubscribe: unsub,
	}
	return n.publishControl(cmd, "")
}

// pubDisconnect publishes disconnect control message to all nodes – so all
// nodes could disconnect user from server.
func (n *Node) pubDisconnect(user string, disconnect Disconnect, clientID string, sessionID string, whitelist []string) error {
	protoDisconnect := &controlpb.Disconnect{
		User:      user,
		Whitelist: whitelist,
		Code:      disconnect.Code,
		Reason:    disconnect.Reason,
		Client:    clientID,
		Session:   sessionID,
	}
	cmd := &controlpb.Command{
		Uid:        n.uid,
		Disconnect: protoDisconnect,
	}
	return n.publishControl(cmd, "")
}

// addClient registers authenticated connection in clientConnectionHub
// this allows to make operations with user connection on demand.
func (n *Node) addClient(c *Client) {
	n.metrics.incActionCount("add_client", "")
	n.metrics.connectionsInflight.WithLabelValues(c.transport.Name(), c.metricName, c.metricVersion).Inc()
	n.hub.add(c)
}

// removeClient removes client connection from connection registry.
func (n *Node) removeClient(c *Client) {
	n.metrics.incActionCount("remove_client", "")
	removed := n.hub.remove(c)
	if removed {
		n.metrics.connectionsInflight.WithLabelValues(c.transport.Name(), c.metricName, c.metricVersion).Dec()
	}
}

// addSubscription registers subscription of connection on channel in both
// Hub and Broker.
func (n *Node) addSubscription(ch string, sub subInfo) error {
	n.metrics.incActionCount("add_subscription", ch)
	n.metrics.subscriptionsInflight.WithLabelValues(sub.client.metricName, n.metrics.getChannelNamespaceLabel(ch)).Inc()
	mu := n.subLock(ch)
	mu.Lock()
	defer mu.Unlock()
	first, err := n.hub.addSub(ch, sub)
	if err != nil {
		return err
	}
	if first {
		if n.config.GetChannelMediumOptions != nil {
			mediumOptions := n.config.GetChannelMediumOptions(ch)
			if mediumOptions.isMediumEnabled() {
				medium, err := newChannelMedium(ch, n, mediumOptions)
				if err != nil {
					_, _ = n.hub.removeSub(ch, sub.client)
					return err
				}
				mediumMu := n.mediumLock(ch)
				mediumMu.Lock()
				n.mediums[ch] = medium
				mediumMu.Unlock()
			}
		}

		n.metrics.incActionCount("broker_subscribe", ch)
		err := n.getBroker(ch).Subscribe(ch)
		if err != nil {
			_, _ = n.hub.removeSub(ch, sub.client)
			if n.config.GetChannelMediumOptions != nil {
				mediumMu := n.mediumLock(ch)
				mediumMu.Lock()
				medium, ok := n.mediums[ch]
				if ok {
					medium.close()
					delete(n.mediums, ch)
				}
				mediumMu.Unlock()
			}
			return err
		}
	}
	return nil
}

// removeSubscription removes subscription of connection on channel
// from Hub and Broker.
func (n *Node) removeSubscription(ch string, c *Client) error {
	n.metrics.incActionCount("remove_subscription", ch)
	mu := n.subLock(ch)
	mu.Lock()
	defer mu.Unlock()
	empty, wasRemoved := n.hub.removeSub(ch, c)
	if wasRemoved {
		n.metrics.subscriptionsInflight.WithLabelValues(c.metricName, n.metrics.getChannelNamespaceLabel(ch)).Dec()
	}
	if empty {
		submittedAt := time.Now()
		_ = n.subDissolver.Submit(func() error {
			timeSpent := time.Since(submittedAt)
			if timeSpent < time.Second {
				time.Sleep(time.Second - timeSpent)
			}
			mu := n.subLock(ch)
			mu.Lock()
			defer mu.Unlock()
			empty := n.hub.NumSubscribers(ch) == 0
			if empty {
				n.metrics.incActionCount("broker_unsubscribe", ch)
				err := n.getBroker(ch).Unsubscribe(ch)
				if err != nil {
					// Cool down a bit since broker is not ready to process unsubscription.
					time.Sleep(500 * time.Millisecond)
				} else {
					if n.config.GetChannelMediumOptions != nil {
						mediumMu := n.mediumLock(ch)
						mediumMu.Lock()
						medium, ok := n.mediums[ch]
						if ok {
							medium.close()
							delete(n.mediums, ch)
						}
						mediumMu.Unlock()
					}
				}
				return err
			}
			return nil
		})
	}
	return nil
}

// nodeCmd handles node control command i.e. updates information about known nodes.
func (n *Node) nodeCmd(node *controlpb.Node) error {
	isNewNode := n.nodes.add(node)
	if isNewNode && node.Uid != n.uid {
		// New Node in cluster
		_ = n.pubNode(node.Uid)
	}
	return nil
}

// shutdownCmd handles shutdown control command sent when node leaves cluster.
func (n *Node) shutdownCmd(nodeID string) error {
	n.nodes.remove(nodeID)
	return nil
}

// Subscribe subscribes user to a channel.
// Note, that OnSubscribe event won't be called in this case
// since this is a server-side subscription. If user have been already
// subscribed to a channel then its subscription will be updated and
// subscribe notification will be sent to a client-side.
func (n *Node) Subscribe(userID string, channel string, opts ...SubscribeOption) error {
	subscribeOpts := &SubscribeOptions{}
	for _, opt := range opts {
		opt(subscribeOpts)
	}
	// Subscribe on this node.
	err := n.hub.subscribe(userID, channel, subscribeOpts.clientID, subscribeOpts.sessionID, opts...)
	if err != nil {
		return err
	}
	// Send subscribe control message to other nodes.
	return n.pubSubscribe(userID, channel, *subscribeOpts)
}

// Unsubscribe unsubscribes user from a channel.
// If a channel is empty string then user will be unsubscribed from all channels.
func (n *Node) Unsubscribe(userID string, channel string, opts ...UnsubscribeOption) error {
	unsubscribeOpts := &UnsubscribeOptions{}
	for _, opt := range opts {
		opt(unsubscribeOpts)
	}
	customUnsubscribe := unsubscribeServer
	if unsubscribeOpts.unsubscribe != nil {
		customUnsubscribe = *unsubscribeOpts.unsubscribe
	}

	// Unsubscribe on this node.
	err := n.hub.unsubscribe(userID, channel, customUnsubscribe, unsubscribeOpts.clientID, unsubscribeOpts.sessionID)
	if err != nil {
		return err
	}
	// Send unsubscribe control message to other nodes.
	return n.pubUnsubscribe(userID, channel, customUnsubscribe, unsubscribeOpts.clientID, unsubscribeOpts.sessionID)
}

// Disconnect allows closing all user connections on all nodes.
func (n *Node) Disconnect(userID string, opts ...DisconnectOption) error {
	disconnectOpts := &DisconnectOptions{}
	for _, opt := range opts {
		opt(disconnectOpts)
	}
	// Disconnect user from this node
	customDisconnect := DisconnectForceNoReconnect
	if disconnectOpts.Disconnect != nil {
		customDisconnect = *disconnectOpts.Disconnect
	}
	err := n.hub.disconnect(userID, customDisconnect, disconnectOpts.clientID, disconnectOpts.sessionID, disconnectOpts.ClientWhitelist)
	if err != nil {
		return err
	}
	// Send disconnect control message to other nodes
	return n.pubDisconnect(userID, customDisconnect, disconnectOpts.clientID, disconnectOpts.sessionID, disconnectOpts.ClientWhitelist)
}

// Refresh user connection.
// Without any options will make user connections non-expiring.
// Note, that OnRefresh event won't be called in this case
// since this is a server-side refresh.
func (n *Node) Refresh(userID string, opts ...RefreshOption) error {
	refreshOpts := &RefreshOptions{}
	for _, opt := range opts {
		opt(refreshOpts)
	}
	// Refresh on this node.
	err := n.hub.refresh(userID, refreshOpts.clientID, refreshOpts.sessionID, opts...)
	if err != nil {
		return err
	}
	// Send refresh control message to other nodes.
	return n.pubRefresh(userID, *refreshOpts)
}

func (n *Node) getPresenceManager(ch string) PresenceManager {
	if n.config.GetPresenceManager != nil {
		if presenceManager, ok := n.config.GetPresenceManager(ch); ok {
			return presenceManager
		}
	}
	if n.presenceManager == nil {
		return nil
	}
	return n.presenceManager
}

// addPresence proxies presence adding to PresenceManager.
func (n *Node) addPresence(ch string, uid string, info *ClientInfo) error {
	presenceManager := n.getPresenceManager(ch)
	if presenceManager == nil {
		return nil
	}
	n.metrics.incActionCount("add_presence", ch)
	return presenceManager.AddPresence(ch, uid, info)
}

// removePresence proxies presence removing to PresenceManager.
func (n *Node) removePresence(ch string, clientID string, userID string) error {
	presenceManager := n.getPresenceManager(ch)
	if presenceManager == nil {
		return nil
	}
	n.metrics.incActionCount("remove_presence", ch)
	return presenceManager.RemovePresence(ch, clientID, userID)
}

var (
	presenceGroup      singleflight.Group
	presenceStatsGroup singleflight.Group
	historyGroup       singleflight.Group
)

// PresenceResult wraps presence.
type PresenceResult struct {
	Presence map[string]*ClientInfo
}

func (n *Node) presence(ch string, presenceManager PresenceManager) (PresenceResult, error) {
	presence, err := presenceManager.Presence(ch)
	if err != nil {
		return PresenceResult{}, err
	}
	return PresenceResult{Presence: presence}, nil
}

// Presence returns a map with information about active clients in channel.
func (n *Node) Presence(ch string) (PresenceResult, error) {
	presenceManager := n.getPresenceManager(ch)
	if presenceManager == nil {
		return PresenceResult{}, ErrorNotAvailable
	}
	n.metrics.incActionCount("presence", ch)
	if n.config.UseSingleFlight {
		result, err, _ := presenceGroup.Do(ch, func() (any, error) {
			return n.presence(ch, presenceManager)
		})
		return result.(PresenceResult), err
	}
	return n.presence(ch, presenceManager)
}

func infoFromProto(v *protocol.ClientInfo) *ClientInfo {
	if v == nil {
		return nil
	}
	info := &ClientInfo{
		ClientID: v.GetClient(),
		UserID:   v.GetUser(),
	}
	if len(v.ConnInfo) > 0 {
		info.ConnInfo = v.ConnInfo
	}
	if len(v.ChanInfo) > 0 {
		info.ChanInfo = v.ChanInfo
	}
	return info
}

func infoToProto(v *ClientInfo) *protocol.ClientInfo {
	if v == nil {
		return nil
	}
	info := &protocol.ClientInfo{
		Client: v.ClientID,
		User:   v.UserID,
	}
	if len(v.ConnInfo) > 0 {
		info.ConnInfo = v.ConnInfo
	}
	if len(v.ChanInfo) > 0 {
		info.ChanInfo = v.ChanInfo
	}
	return info
}

func pubToProto(pub *Publication) *protocol.Publication {
	if pub == nil {
		return nil
	}
	return &protocol.Publication{
		Offset: pub.Offset,
		Data:   pub.Data,
		Info:   infoToProto(pub.Info),
		Tags:   pub.Tags,
	}
}

func pubFromProto(pub *protocol.Publication) *Publication {
	if pub == nil {
		return nil
	}
	return &Publication{
		Offset: pub.GetOffset(),
		Data:   pub.Data,
		Info:   infoFromProto(pub.GetInfo()),
		Tags:   pub.GetTags(),
		Time:   pub.Time,
	}
}

// PresenceStatsResult wraps presence stats.
type PresenceStatsResult struct {
	PresenceStats
}

func (n *Node) presenceStats(ch string, presenceManager PresenceManager) (PresenceStatsResult, error) {
	presenceStats, err := presenceManager.PresenceStats(ch)
	if err != nil {
		return PresenceStatsResult{}, err
	}
	return PresenceStatsResult{PresenceStats: presenceStats}, nil
}

// PresenceStats returns presence stats from PresenceManager.
func (n *Node) PresenceStats(ch string) (PresenceStatsResult, error) {
	presenceManager := n.getPresenceManager(ch)
	if presenceManager == nil {
		return PresenceStatsResult{}, ErrorNotAvailable
	}
	n.metrics.incActionCount("presence_stats", ch)
	if n.config.UseSingleFlight {
		result, err, _ := presenceStatsGroup.Do(ch, func() (any, error) {
			return n.presenceStats(ch, presenceManager)
		})
		return result.(PresenceStatsResult), err
	}
	return n.presenceStats(ch, presenceManager)
}

// HistoryResult contains Publications and current stream top StreamPosition.
type HistoryResult struct {
	// StreamPosition embedded here describes current stream top offset and epoch.
	StreamPosition
	// Publications extracted from history storage according to HistoryFilter.
	Publications []*Publication
}

func (n *Node) getBroker(ch string) Broker {
	if n.config.GetBroker != nil {
		if broker, ok := n.config.GetBroker(ch); ok {
			return broker
		}
	}
	return n.broker
}

func (n *Node) history(ch string, opts *HistoryOptions) (HistoryResult, error) {
	if opts.Filter.Reverse && opts.Filter.Since != nil && opts.Filter.Since.Offset == 0 {
		return HistoryResult{}, ErrorBadRequest
	}

	pubs, streamTop, err := n.getBroker(ch).History(ch, *opts)
	if err != nil {
		return HistoryResult{}, err
	}
	if opts.Filter.Since != nil {
		sinceEpoch := opts.Filter.Since.Epoch
		epochOK := sinceEpoch == "" || sinceEpoch == streamTop.Epoch
		if !epochOK {
			return HistoryResult{
				StreamPosition: streamTop,
				Publications:   pubs,
			}, ErrorUnrecoverablePosition
		}
	}
	return HistoryResult{
		StreamPosition: streamTop,
		Publications:   pubs,
	}, nil
}

// History allows extracting Publications in channel.
// The channel must belong to namespace where history is on.
func (n *Node) History(ch string, opts ...HistoryOption) (HistoryResult, error) {
	n.metrics.incActionCount("history", ch)
	historyOpts := &HistoryOptions{}
	for _, opt := range opts {
		opt(historyOpts)
	}
	if n.config.UseSingleFlight {
		var builder strings.Builder
		builder.WriteString("channel:")
		builder.WriteString(ch)
		if historyOpts.Filter.Since != nil {
			builder.WriteString(",offset:")
			builder.WriteString(strconv.FormatUint(historyOpts.Filter.Since.Offset, 10))
			builder.WriteString(",epoch:")
			builder.WriteString(historyOpts.Filter.Since.Epoch)
		}
		builder.WriteString(",limit:")
		builder.WriteString(strconv.Itoa(historyOpts.Filter.Limit))
		builder.WriteString(",reverse:")
		builder.WriteString(strconv.FormatBool(historyOpts.Filter.Reverse))
		builder.WriteString(",meta_ttl:")
		builder.WriteString(historyOpts.MetaTTL.String())
		key := builder.String()

		result, err, _ := historyGroup.Do(key, func() (any, error) {
			return n.history(ch, historyOpts)
		})
		return result.(HistoryResult), err
	}
	return n.history(ch, historyOpts)
}

// recoverHistory recovers publications since StreamPosition last seen by client.
func (n *Node) recoverHistory(ch string, since StreamPosition, historyMetaTTL time.Duration) (HistoryResult, error) {
	n.metrics.incActionCount("history_recover", ch)
	limit := NoLimit
	maxPublicationLimit := n.config.RecoveryMaxPublicationLimit
	if maxPublicationLimit > 0 {
		limit = maxPublicationLimit
	}
	return n.History(ch, WithHistoryFilter(HistoryFilter{
		Limit: limit,
		Since: &since,
	}), WithHistoryMetaTTL(historyMetaTTL))
}

// recoverCache recovers last publication in channel.
func (n *Node) recoverCache(ch string, historyMetaTTL time.Duration) (*Publication, StreamPosition, error) {
	n.metrics.incActionCount("history_recover_cache", ch)
	hr, err := n.History(ch, WithHistoryFilter(HistoryFilter{
		Limit:   1,
		Reverse: true,
	}), WithHistoryMetaTTL(historyMetaTTL))
	if err != nil {
		return nil, StreamPosition{}, err
	}
	var latestPublication *Publication
	if len(hr.Publications) > 0 {
		latestPublication = hr.Publications[0]
	}
	return latestPublication, hr.StreamPosition, nil
}

// streamTop returns current stream top StreamPosition for a channel.
func (n *Node) streamTop(ch string, historyMetaTTL time.Duration) (StreamPosition, error) {
	n.metrics.incActionCount("history_stream_top", ch)
	historyResult, err := n.History(ch, WithHistoryMetaTTL(historyMetaTTL))
	if err != nil {
		return StreamPosition{}, err
	}
	return historyResult.StreamPosition, nil
}

func (n *Node) checkPosition(ch string, clientPosition StreamPosition, historyMetaTTL time.Duration) (bool, error) {
	mu := n.subLock(ch)
	mu.Lock()
	medium, ok := n.mediums[ch]
	mu.Unlock()
	if !ok || !medium.options.SharedPositionSync {
		// No medium for channel or position sync disabled – we then check position over Broker.
		streamTop, err := n.streamTop(ch, historyMetaTTL)
		if err != nil {
			// Will be checked later.
			return false, err
		}
		return streamTop.Epoch == clientPosition.Epoch && clientPosition.Offset == streamTop.Offset, nil
	}
	validPosition := medium.CheckPosition(historyMetaTTL, clientPosition, n.config.ClientChannelPositionCheckDelay)
	return validPosition, nil
}

// RemoveHistory removes channel history.
func (n *Node) RemoveHistory(ch string) error {
	n.metrics.incActionCount("history_remove", ch)
	return n.getBroker(ch).RemoveHistory(ch)
}

type nodeRegistry struct {
	// mu allows synchronizing access to node registry.
	mu sync.RWMutex
	// currentUID keeps uid of current node
	currentUID string
	// nodes is a map with information about known nodes.
	nodes map[string]*controlpb.Node
	// updates track time we last received ping from node. Used to clean up nodes map.
	updates map[string]int64
}

func newNodeRegistry(currentUID string) *nodeRegistry {
	return &nodeRegistry{
		currentUID: currentUID,
		nodes:      make(map[string]*controlpb.Node),
		updates:    make(map[string]int64),
	}
}

func (r *nodeRegistry) list() []*controlpb.Node {
	r.mu.RLock()
	nodes := make([]*controlpb.Node, len(r.nodes))
	i := 0
	for _, info := range r.nodes {
		nodes[i] = info
		i++
	}
	r.mu.RUnlock()
	return nodes
}

func (r *nodeRegistry) size() int {
	r.mu.RLock()
	size := len(r.nodes)
	r.mu.RUnlock()
	return size
}

func (r *nodeRegistry) get(uid string) (*controlpb.Node, bool) {
	r.mu.RLock()
	info, ok := r.nodes[uid]
	r.mu.RUnlock()
	return info, ok
}

func (r *nodeRegistry) add(info *controlpb.Node) bool {
	var isNewNode bool
	r.mu.Lock()
	if node, ok := r.nodes[info.Uid]; ok {
		if info.Metrics != nil {
			r.nodes[info.Uid] = info
		} else {
			r.nodes[info.Uid] = &controlpb.Node{
				Uid:         info.Uid,
				Name:        info.Name,
				Version:     info.Version,
				NumClients:  info.NumClients,
				NumUsers:    info.NumUsers,
				NumChannels: info.NumChannels,
				Uptime:      info.Uptime,
				Data:        info.Data,
				NumSubs:     info.NumSubs,
				Metrics:     node.Metrics,
			}
		}
	} else {
		r.nodes[info.Uid] = info
		isNewNode = true
	}
	r.updates[info.Uid] = time.Now().Unix()
	r.mu.Unlock()
	return isNewNode
}

func (r *nodeRegistry) remove(uid string) {
	r.mu.Lock()
	delete(r.nodes, uid)
	delete(r.updates, uid)
	r.mu.Unlock()
}

func (r *nodeRegistry) clean(delay time.Duration) {
	r.mu.Lock()
	for uid := range r.nodes {
		if uid == r.currentUID {
			// No need to clean info for current node.
			continue
		}
		updated, ok := r.updates[uid]
		if !ok {
			// As we do all operations with nodes under lock this should never happen.
			delete(r.nodes, uid)
			continue
		}
		if time.Now().Unix()-updated > int64(delay.Seconds()) {
			// Too many seconds since this node have been last seen - remove it from map.
			delete(r.nodes, uid)
			delete(r.updates, uid)
		}
	}
	r.mu.Unlock()
}

// OnSurvey allows setting SurveyHandler. This should be done before Node.Run called.
func (n *Node) OnSurvey(handler SurveyHandler) {
	n.surveyHandler = handler
}

// OnNotification allows setting NotificationHandler. This should be done before Node.Run called.
func (n *Node) OnNotification(handler NotificationHandler) {
	n.notificationHandler = handler
}

// OnNodeInfoSend allows setting NodeInfoSendHandler. This should be done before Node.Run called.
func (n *Node) OnNodeInfoSend(handler NodeInfoSendHandler) {
	n.nodeInfoSendHandler = handler
}

// eventHub allows binding client event handlers.
// All eventHub methods are not goroutine-safe and supposed
// to be called once before Node Run called.
type eventHub struct {
	connectingHandler       ConnectingHandler
	connectHandler          ConnectHandler
	transportWriteHandler   TransportWriteHandler
	commandReadHandler      CommandReadHandler
	commandProcessedHandler CommandProcessedHandler
	cacheEmptyHandler       CacheEmptyHandler
}

// OnConnecting allows setting ConnectingHandler.
// ConnectingHandler will be called when client sends Connect command to server.
// In this handler server can reject connection or provide Credentials for it.
func (n *Node) OnConnecting(handler ConnectingHandler) {
	n.clientEvents.connectingHandler = handler
}

// OnConnect allows setting ConnectHandler.
// ConnectHandler called after client connection successfully established,
// authenticated and Connect Reply already sent to client. This is a place where
// application can start communicating with client.
func (n *Node) OnConnect(handler ConnectHandler) {
	n.clientEvents.connectHandler = handler
}

// OnTransportWrite allows setting TransportWriteHandler. This should be done before Node.Run called.
func (n *Node) OnTransportWrite(handler TransportWriteHandler) {
	n.clientEvents.transportWriteHandler = handler
}

// OnCommandRead allows setting CommandReadHandler. This should be done before Node.Run called.
func (n *Node) OnCommandRead(handler CommandReadHandler) {
	n.clientEvents.commandReadHandler = handler
}

// OnCommandProcessed allows setting CommandProcessedHandler. This should be done before Node.Run called.
func (n *Node) OnCommandProcessed(handler CommandProcessedHandler) {
	n.clientEvents.commandProcessedHandler = handler
}

// OnCacheEmpty allows setting CacheEmptyHandler.
// CacheEmptyHandler called when client subscribes on a channel with RecoveryModeCache but there is no
// cached value in channel. In response to this handler it's possible to tell Centrifuge what to do with
// subscribe request – keep it, or return error.
func (n *Node) OnCacheEmpty(h CacheEmptyHandler) {
	n.clientEvents.cacheEmptyHandler = h
}

// HandlePublication coming from Broker.
func (n *Node) HandlePublication(ch string, pub *Publication, sp StreamPosition, delta bool, prevPub *Publication) error {
	if pub == nil {
		panic("nil Publication received, this must never happen")
	}
	if n.config.GetChannelMediumOptions != nil {
		mu := n.mediumLock(ch) // Note, avoid using subLock in HandlePublication – this leads to the deadlock.
		mu.Lock()
		medium, ok := n.mediums[ch]
		mu.Unlock()
		if ok {
			medium.broadcastPublication(pub, sp, delta, prevPub)
			return nil
		}
	}
	return n.handlePublication(ch, sp, pub, prevPub, nil)
}

// HandleJoin coming from Broker.
func (n *Node) HandleJoin(ch string, info *ClientInfo) error {
	if info == nil {
		panic("nil join ClientInfo received, this must never happen")
	}
	return n.handleJoin(ch, info)
}

// HandleLeave coming from Broker.
func (n *Node) HandleLeave(ch string, info *ClientInfo) error {
	if info == nil {
		panic("nil leave ClientInfo received, this must never happen")
	}
	return n.handleLeave(ch, info)
}

// HandleControl coming from Broker.
func (n *Node) HandleControl(data []byte) error {
	return n.handleControl(data)
}
