package memberlist

import (
	"bytes"
	"context"
	crypto_rand "crypto/rand"
	"encoding/binary"
	"errors"
	"flag"
	"fmt"
	"math"
	math_rand "math/rand"
	"strings"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/golang/snappy"
	"github.com/hashicorp/memberlist"
	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/atomic"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/kv/codec"
	"github.com/grafana/dskit/services"
)

const (
	maxCasRetries              = 10          // max retries in CAS operation
	noChangeDetectedRetrySleep = time.Second // how long to sleep after no change was detected in CAS
	notifyMsgQueueSize         = 1024        // size of buffered channels to handle memberlist messages
	watchPrefixBufferSize      = 128         // size of buffered channel for the WatchPrefix function
)

// Client implements kv.Client interface, by using memberlist.KV
type Client struct {
	kv    *KV // reference to singleton memberlist-based KV
	codec codec.Codec
}

// NewClient creates new client instance. Supplied codec must already be registered in KV.
func NewClient(kv *KV, codec codec.Codec) (*Client, error) {
	c := kv.GetCodec(codec.CodecID())
	if c == nil {
		return nil, fmt.Errorf("codec not registered in KV: %s", codec.CodecID())
	}

	return &Client{
		kv:    kv,
		codec: codec,
	}, nil
}

// List is part of kv.Client interface.
func (c *Client) List(ctx context.Context, prefix string) ([]string, error) {
	err := c.awaitKVRunningOrStopping(ctx)
	if err != nil {
		return nil, err
	}

	return c.kv.List(prefix), nil
}

// Get is part of kv.Client interface.
func (c *Client) Get(ctx context.Context, key string) (interface{}, error) {
	err := c.awaitKVRunningOrStopping(ctx)
	if err != nil {
		return nil, err
	}

	return c.kv.Get(key, c.codec)
}

// Delete is part of kv.Client interface.
func (c *Client) Delete(ctx context.Context, key string) error {
	err := c.awaitKVRunningOrStopping(ctx)
	if err != nil {
		return err
	}

	return c.kv.Delete(key)
}

// CAS is part of kv.Client interface
func (c *Client) CAS(ctx context.Context, key string, f func(in interface{}) (out interface{}, retry bool, err error)) error {
	err := c.awaitKVRunningOrStopping(ctx)
	if err != nil {
		return err
	}

	return c.kv.CAS(ctx, key, c.codec, f)
}

// WatchKey is part of kv.Client interface.
func (c *Client) WatchKey(ctx context.Context, key string, f func(interface{}) bool) {
	err := c.awaitKVRunningOrStopping(ctx)
	if err != nil {
		return
	}

	c.kv.WatchKey(ctx, key, c.codec, f)
}

// WatchPrefix calls f whenever any value stored under prefix changes.
// Part of kv.Client interface.
func (c *Client) WatchPrefix(ctx context.Context, prefix string, f func(string, interface{}) bool) {
	err := c.awaitKVRunningOrStopping(ctx)
	if err != nil {
		return
	}

	c.kv.WatchPrefix(ctx, prefix, c.codec, f)
}

// We want to use KV in Running and Stopping states.
func (c *Client) awaitKVRunningOrStopping(ctx context.Context) error {
	s := c.kv.State()
	switch s {
	case services.Running, services.Stopping:
		return nil
	case services.New, services.Starting:
		err := c.kv.AwaitRunning(ctx)
		if ns := c.kv.State(); ns == services.Stopping {
			return nil
		}
		return err
	default:
		return fmt.Errorf("unexpected state: %v", s)
	}
}

// KVConfig is a config for memberlist.KV
type KVConfig struct {
	// Memberlist options.
	NodeName            string        `yaml:"node_name" category:"advanced"`
	RandomizeNodeName   bool          `yaml:"randomize_node_name" category:"advanced"`
	StreamTimeout       time.Duration `yaml:"stream_timeout" category:"advanced"`
	RetransmitMult      int           `yaml:"retransmit_factor" category:"advanced"`
	PushPullInterval    time.Duration `yaml:"pull_push_interval" category:"advanced"`
	GossipInterval      time.Duration `yaml:"gossip_interval" category:"advanced"`
	GossipNodes         int           `yaml:"gossip_nodes" category:"advanced"`
	GossipToTheDeadTime time.Duration `yaml:"gossip_to_dead_nodes_time" category:"advanced"`
	DeadNodeReclaimTime time.Duration `yaml:"dead_node_reclaim_time" category:"advanced"`
	EnableCompression   bool          `yaml:"compression_enabled" category:"advanced"`
	NotifyInterval      time.Duration `yaml:"notify_interval" category:"advanced"`

	// ip:port to advertise other cluster members. Used for NAT traversal
	AdvertiseAddr string `yaml:"advertise_addr"`
	AdvertisePort int    `yaml:"advertise_port"`

	ClusterLabel                     string `yaml:"cluster_label" category:"advanced"`
	ClusterLabelVerificationDisabled bool   `yaml:"cluster_label_verification_disabled" category:"advanced"`

	// List of members to join
	JoinMembers          flagext.StringSlice `yaml:"join_members"`
	MinJoinBackoff       time.Duration       `yaml:"min_join_backoff" category:"advanced"`
	MaxJoinBackoff       time.Duration       `yaml:"max_join_backoff" category:"advanced"`
	MaxJoinRetries       int                 `yaml:"max_join_retries" category:"advanced"`
	AbortIfFastJoinFails bool                `yaml:"abort_if_cluster_fast_join_fails" category:"advanced"`
	AbortIfJoinFails     bool                `yaml:"abort_if_cluster_join_fails"`
	RejoinInterval       time.Duration       `yaml:"rejoin_interval" category:"advanced"`

	// Remove LEFT ingesters from ring after this timeout.
	LeftIngestersTimeout   time.Duration `yaml:"left_ingesters_timeout" category:"advanced"`
	ObsoleteEntriesTimeout time.Duration `yaml:"obsolete_entries_timeout" category:"experimental"`

	// Timeout used when leaving the memberlist cluster.
	LeaveTimeout                              time.Duration `yaml:"leave_timeout" category:"advanced"`
	BroadcastTimeoutForLocalUpdatesOnShutdown time.Duration `yaml:"broadcast_timeout_for_local_updates_on_shutdown" category:"advanced"`

	// How much space to use to keep received and sent messages in memory (for troubleshooting).
	MessageHistoryBufferBytes int `yaml:"message_history_buffer_bytes" category:"advanced"`

	// Size of the buffer for key watchers.
	WatchPrefixBufferSize int `yaml:"watch_prefix_buffer_size" category:"advanced"`

	TCPTransport TCPTransportConfig `yaml:",inline"`

	// Zone-aware routing configuration.
	ZoneAwareRouting ZoneAwareRoutingConfig `yaml:"zone_aware_routing"`

	MetricsNamespace string `yaml:"-"`

	// Codecs to register. Codecs need to be registered before joining other members.
	Codecs []codec.Codec `yaml:"-"`

	// The backoff configuration used by retries when discovering memberlist members via DNS.
	// This useful to override it in tests.
	discoverMembersBackoff backoff.Config `yaml:"-"`

	// Hooks used for testing.
	beforeJoinMembersOnStartupHook func(_ context.Context)
}

// RegisterFlagsWithPrefix registers flags.
func (cfg *KVConfig) RegisterFlagsWithPrefix(f *flag.FlagSet, prefix string) {
	mlDefaults := defaultMemberlistConfig()

	// "Defaults to hostname" -- memberlist sets it to hostname by default.
	f.StringVar(&cfg.NodeName, prefix+"memberlist.nodename", "", "Name of the node in memberlist cluster. Defaults to hostname.") // memberlist.DefaultLANConfig will put hostname here.
	f.BoolVar(&cfg.RandomizeNodeName, prefix+"memberlist.randomize-node-name", true, "Add random suffix to the node name.")
	f.DurationVar(&cfg.StreamTimeout, prefix+"memberlist.stream-timeout", 2*time.Second, "The timeout for establishing a connection with a remote node, and for read/write operations.")
	f.IntVar(&cfg.RetransmitMult, prefix+"memberlist.retransmit-factor", mlDefaults.RetransmitMult, "Multiplication factor used when sending out messages (factor * log(N+1)).")
	f.Var(&cfg.JoinMembers, prefix+"memberlist.join", "Other cluster members to join. Can be specified multiple times. It can be an IP, hostname or an entry specified in the DNS Service Discovery format.")
	f.DurationVar(&cfg.MinJoinBackoff, prefix+"memberlist.min-join-backoff", 1*time.Second, "Min backoff duration to join other cluster members.")
	f.DurationVar(&cfg.MaxJoinBackoff, prefix+"memberlist.max-join-backoff", 1*time.Minute, "Max backoff duration to join other cluster members.")
	f.IntVar(&cfg.MaxJoinRetries, prefix+"memberlist.max-join-retries", 10, "Max number of retries to join other cluster members.")
	f.BoolVar(&cfg.AbortIfFastJoinFails, prefix+"memberlist.abort-if-fast-join-fails", false, "Abort if this node fails the fast memberlist cluster joining procedure at startup. When enabled, it's guaranteed that other services, depending on memberlist, have an updated view over the cluster state when they're started.")
	f.BoolVar(&cfg.AbortIfJoinFails, prefix+"memberlist.abort-if-join-fails", cfg.AbortIfJoinFails, "Abort if this node fails to join memberlist cluster at startup. When enabled, it's not guaranteed that other services are started only after the cluster state has been successfully updated; use 'abort-if-fast-join-fails' instead.")
	f.DurationVar(&cfg.RejoinInterval, prefix+"memberlist.rejoin-interval", 0, "If not 0, how often to rejoin the cluster. Occasional rejoin can help to fix the cluster split issue, and is harmless otherwise. For example when using only few components as a seed nodes (via -memberlist.join), then it's recommended to use rejoin. If -memberlist.join points to dynamic service that resolves to all gossiping nodes (eg. Kubernetes headless service), then rejoin is not needed.")
	f.DurationVar(&cfg.LeftIngestersTimeout, prefix+"memberlist.left-ingesters-timeout", 5*time.Minute, "How long to keep LEFT ingesters in the ring.")
	f.DurationVar(&cfg.ObsoleteEntriesTimeout, prefix+"memberlist.obsolete-entries-timeout", mlDefaults.PushPullInterval, "How long to keep obsolete entries in the KV store.")
	f.DurationVar(&cfg.LeaveTimeout, prefix+"memberlist.leave-timeout", 20*time.Second, "Timeout for leaving memberlist cluster.")
	f.DurationVar(&cfg.GossipInterval, prefix+"memberlist.gossip-interval", mlDefaults.GossipInterval, "How often to gossip.")
	f.IntVar(&cfg.GossipNodes, prefix+"memberlist.gossip-nodes", mlDefaults.GossipNodes, "How many nodes to gossip to.")
	f.DurationVar(&cfg.PushPullInterval, prefix+"memberlist.pullpush-interval", mlDefaults.PushPullInterval, "How often to use pull/push sync.")
	f.DurationVar(&cfg.GossipToTheDeadTime, prefix+"memberlist.gossip-to-dead-nodes-time", mlDefaults.GossipToTheDeadTime, "How long to keep gossiping to dead nodes, to give them chance to refute their death.")
	f.DurationVar(&cfg.DeadNodeReclaimTime, prefix+"memberlist.dead-node-reclaim-time", mlDefaults.DeadNodeReclaimTime, "How soon can dead node's name be reclaimed with new address. 0 to disable.")
	f.IntVar(&cfg.MessageHistoryBufferBytes, prefix+"memberlist.message-history-buffer-bytes", 0, "How much space to use for keeping received and sent messages in memory for troubleshooting (two buffers). 0 to disable.")
	f.BoolVar(&cfg.EnableCompression, prefix+"memberlist.compression-enabled", mlDefaults.EnableCompression, "Enable message compression. This can be used to reduce bandwidth usage at the cost of slightly more CPU utilization.")
	f.DurationVar(&cfg.NotifyInterval, prefix+"memberlist.notify-interval", 0, "How frequently to notify watchers when a key changes. Can reduce CPU activity in large memberlist deployments. 0 to notify without delay.")
	f.StringVar(&cfg.AdvertiseAddr, prefix+"memberlist.advertise-addr", mlDefaults.AdvertiseAddr, "Gossip address to advertise to other members in the cluster. Used for NAT traversal.")
	f.IntVar(&cfg.AdvertisePort, prefix+"memberlist.advertise-port", mlDefaults.AdvertisePort, "Gossip port to advertise to other members in the cluster. Used for NAT traversal.")
	f.StringVar(&cfg.ClusterLabel, prefix+"memberlist.cluster-label", mlDefaults.Label, "The cluster label is an optional string to include in outbound packets and gossip streams. Other members in the memberlist cluster will discard any message whose label doesn't match the configured one, unless the 'cluster-label-verification-disabled' configuration option is set to true.")
	f.BoolVar(&cfg.ClusterLabelVerificationDisabled, prefix+"memberlist.cluster-label-verification-disabled", mlDefaults.SkipInboundLabelCheck, "When true, memberlist doesn't verify that inbound packets and gossip streams have the cluster label matching the configured one. This verification should be disabled while rolling out the change to the configured cluster label in a live memberlist cluster.")
	f.DurationVar(&cfg.BroadcastTimeoutForLocalUpdatesOnShutdown, prefix+"memberlist.broadcast-timeout-for-local-updates-on-shutdown", 10*time.Second, "Timeout for broadcasting all remaining locally-generated updates to other nodes when shutting down. Only used if there are nodes left in the memberlist cluster, and only applies to locally-generated updates, not to broadcast messages that are result of incoming gossip updates. 0 = no timeout, wait until all locally-generated updates are sent.")
	f.IntVar(&cfg.WatchPrefixBufferSize, prefix+"memberlist.watch-prefix-buffer-size", watchPrefixBufferSize, "Size of the buffered channel for the WatchPrefix function.")

	cfg.TCPTransport.RegisterFlagsWithPrefix(f, prefix)
	cfg.ZoneAwareRouting.RegisterFlagsWithPrefix(f, prefix+"memberlist.zone-aware-routing.")

	cfg.discoverMembersBackoff = backoff.Config{
		MinBackoff: 100 * time.Millisecond,
		MaxBackoff: 5 * time.Second,
		MaxRetries: 10,
	}
}

func (cfg *KVConfig) RegisterFlags(f *flag.FlagSet) {
	cfg.RegisterFlagsWithPrefix(f, "")
}

// Validate validates the KV configuration.
func (cfg *KVConfig) Validate() error {
	return cfg.ZoneAwareRouting.Validate()
}

func generateRandomSuffix(logger log.Logger) string {
	suffix := make([]byte, 4)
	_, err := crypto_rand.Read(suffix)
	if err != nil {
		level.Error(logger).Log("msg", "failed to generate random suffix", "err", err)
		return "error"
	}
	return fmt.Sprintf("%2x", suffix)
}

// KV implements Key-Value store on top of memberlist library. KV store has API similar to kv.Client,
// except methods also need explicit codec for each operation.
// KV is a Service. It needs to be started first, and is only usable once it enters Running state.
// If joining of the cluster if configured, it is done in Running state, and if join fails and Abort flag is set, service
// fails.
type KV struct {
	services.NamedService

	cfg        KVConfig
	logger     log.Logger
	registerer prometheus.Registerer

	// dns discovery provider
	provider DNSProvider

	// Protects access to memberlist and broadcast queues.
	delegateReady    atomic.Bool
	memberlist       *memberlist.Memberlist
	localBroadcasts  *memberlist.TransmitLimitedQueue // queue for messages generated locally
	gossipBroadcasts *memberlist.TransmitLimitedQueue // queue for messages that we forward from other nodes

	// Node metadata for zone-aware routing (nil if zone-aware routing is disabled).
	nodeMeta []byte

	// KV Store.
	storeMu sync.RWMutex
	store   map[string]ValueDesc

	// Codec registry
	codecs map[string]codec.Codec

	// Key watchers
	watchersMu     sync.Mutex
	watchers       map[string][]chan string
	prefixWatchers map[string][]chan string

	// Delayed notifications for watchers
	notifMu          sync.Mutex
	keyNotifications map[string]struct{}

	// Buffers with sent and received messages. Used for troubleshooting only.
	// New messages are appended, old messages (based on configured size limit) removed from the front.
	messagesMu           sync.Mutex
	sentMessages         []Message
	sentMessagesSize     int
	receivedMessages     []Message
	receivedMessagesSize int
	messageCounter       int // Used to give each message in the sentMessages and receivedMessages a unique ID, for UI.

	// Per-key value update workers
	workersMu       sync.Mutex
	workersChannels map[string]chan valueUpdate

	// closed on shutdown
	shutdown chan struct{}

	// metrics
	numberOfReceivedMessages            prometheus.Counter
	totalSizeOfReceivedMessages         prometheus.Counter
	numberOfInvalidReceivedMessages     prometheus.Counter
	numberOfDroppedMessages             prometheus.Counter
	numberOfPulls                       prometheus.Counter
	numberOfPushes                      prometheus.Counter
	totalSizeOfPulls                    prometheus.Counter
	totalSizeOfPushes                   prometheus.Counter
	numberOfGossipMessagesInQueue       prometheus.GaugeFunc
	numberOfLocalMessagesInQueue        prometheus.GaugeFunc
	totalSizeOfBroadcastMessagesInQueue prometheus.Gauge
	numberOfBroadcastMessagesDropped    prometheus.Counter
	casAttempts                         prometheus.Counter
	casFailures                         prometheus.Counter
	casSuccesses                        prometheus.Counter
	watchPrefixDroppedNotifications     *prometheus.CounterVec
	numberOfKeyNotifications            prometheus.Gauge

	storeValuesDesc        *prometheus.Desc
	storeTombstones        *prometheus.GaugeVec
	storeRemovedTombstones *prometheus.CounterVec

	memberlistMembersCount prometheus.GaugeFunc
	memberlistHealthScore  prometheus.GaugeFunc

	// make this configurable for tests. Default value is fine for normal usage
	// where updates are coming from network, but when running tests with many
	// goroutines using same KV, default can be too low.
	maxCasRetries int
}

// Message describes incoming or outgoing message, and local state after applying incoming message, or state when sending message.
// Fields are exported for templating to work.
type Message struct {
	ID   int       // Unique local ID of the message.
	Time time.Time // Time when message was sent or received.
	Size int       // Message size
	Pair KeyValuePair

	// Following values are computed on the receiving node, based on local state.
	Version uint     // For sent message, which version the message reflects. For received message, version after applying the message.
	Changes []string // List of changes in this message (as computed by *this* node).
}

// ValueDesc stores the value along with its codec and local version.
type ValueDesc struct {
	// We store the decoded value here to prevent decoding the entire state for every
	// update we receive. Whilst the updates are small and fast to decode,
	// the total state can be quite large.
	// The CAS function is passed a deep copy because it modifies in-place.
	value Mergeable

	// Version (local only) is used to keep track of what we're gossiping about, and invalidate old messages.
	Version uint

	// ID of codec used to write this value. Only used when sending full state.
	CodecID string

	// Deleted is used to mark the value as deleted. The value is removed from the KV store after `ObsoleteEntriesTimeout`.
	Deleted bool

	// UpdateTime keeps track of the last time the value was updated.
	UpdateTime time.Time
}

func (v ValueDesc) Clone() (result ValueDesc) {
	result = v
	if v.value != nil {
		result.value = v.value.Clone()
	}
	return
}

type valueUpdate struct {
	value       []byte
	codec       codec.Codec
	messageSize int
	deleted     bool
	updateTime  time.Time
}

func (v ValueDesc) String() string {
	return fmt.Sprintf("version: %d, codec: %s", v.Version, v.CodecID)
}

var (
	// if merge fails because of CAS version mismatch, this error is returned. CAS operation reacts on it
	errVersionMismatch     = errors.New("version mismatch")
	errNoChangeDetected    = errors.New("no change detected")
	errTooManyRetries      = errors.New("too many retries")
	emptySnappyEncodedData = snappy.Encode(nil, []byte{})
)

// NewKV creates new gossip-based KV service. Note that service needs to be started, until then it doesn't initialize
// gossiping part. Only after service is in Running state, it is really gossiping. Starting the service will also
// trigger connecting to the existing memberlist cluster. If that fails and AbortIfJoinFails is true, error is returned
// and service enters Failed state.
func NewKV(cfg KVConfig, logger log.Logger, dnsProvider DNSProvider, registerer prometheus.Registerer) *KV {
	cfg.TCPTransport.MetricsNamespace = cfg.MetricsNamespace

	mlkv := &KV{
		cfg:              cfg,
		logger:           logger,
		registerer:       registerer,
		provider:         dnsProvider,
		store:            make(map[string]ValueDesc),
		codecs:           make(map[string]codec.Codec),
		watchers:         make(map[string][]chan string),
		keyNotifications: make(map[string]struct{}),
		prefixWatchers:   make(map[string][]chan string),
		workersChannels:  make(map[string]chan valueUpdate),
		shutdown:         make(chan struct{}),
		maxCasRetries:    maxCasRetries,
	}

	mlkv.createAndRegisterMetrics()

	for _, c := range cfg.Codecs {
		mlkv.codecs[c.CodecID()] = c
	}

	mlkv.NamedService = services.NewBasicService(mlkv.starting, mlkv.running, mlkv.stopping).WithName("memberlist_kv")

	return mlkv
}

func defaultMemberlistConfig() *memberlist.Config {
	return memberlist.DefaultLANConfig()
}

func (m *KV) buildMemberlistConfig() (*memberlist.Config, error) {
	tr, err := NewTCPTransport(m.cfg.TCPTransport, m.logger, m.registerer)
	if err != nil {
		return nil, fmt.Errorf("failed to create transport: %v", err)
	}

	mlCfg := defaultMemberlistConfig()
	mlCfg.Delegate = m

	mlCfg.TCPTimeout = m.cfg.StreamTimeout
	mlCfg.RetransmitMult = m.cfg.RetransmitMult
	mlCfg.PushPullInterval = m.cfg.PushPullInterval
	mlCfg.GossipInterval = m.cfg.GossipInterval
	mlCfg.GossipNodes = m.cfg.GossipNodes
	mlCfg.GossipToTheDeadTime = m.cfg.GossipToTheDeadTime
	mlCfg.DeadNodeReclaimTime = m.cfg.DeadNodeReclaimTime
	mlCfg.EnableCompression = m.cfg.EnableCompression

	mlCfg.AdvertiseAddr = m.cfg.AdvertiseAddr
	mlCfg.AdvertisePort = m.cfg.AdvertisePort

	mlCfg.Label = m.cfg.ClusterLabel
	mlCfg.SkipInboundLabelCheck = m.cfg.ClusterLabelVerificationDisabled

	if m.cfg.NodeName != "" {
		mlCfg.Name = m.cfg.NodeName
	}
	if m.cfg.RandomizeNodeName {
		mlCfg.Name = mlCfg.Name + "-" + generateRandomSuffix(m.logger)
	}

	mlCfg.LogOutput = newMemberlistLoggerAdapter(m.logger, false)
	mlCfg.Transport = tr

	// Memberlist uses UDPBufferSize to figure out how many messages it can put into single "packet".
	// As we don't use UDP for sending packets, we can use higher value here.
	mlCfg.UDPBufferSize = 10 * 1024 * 1024

	// For our use cases, we don't need a very fast detection of dead nodes. Since we use a TCP transport
	// and we open a new TCP connection for each packet, we prefer to reduce the probe frequency and increase
	// the timeout compared to defaults.
	mlCfg.ProbeInterval = 5 * time.Second // Probe a random node every this interval. This setting is also the total timeout for the direct + indirect probes.
	mlCfg.ProbeTimeout = 2 * time.Second  // Timeout for the direct probe.

	// Since we use a custom transport based on TCP, having TCP-based fallbacks doesn't give us any benefit.
	// On the contrary, if we keep TCP pings enabled, each node will effectively run 2x pings against a dead
	// node, because the TCP-based fallback will always trigger.
	mlCfg.DisableTcpPings = true

	// Configure zone-aware routing if enabled.
	if m.cfg.ZoneAwareRouting.Enabled {
		if err := m.configureZoneAwareRouting(mlCfg); err != nil {
			return nil, fmt.Errorf("failed to configure zone-aware routing: %w", err)
		}
	}

	level.Info(m.logger).Log("msg", "Using memberlist cluster label and node name", "cluster_label", mlCfg.Label, "node", mlCfg.Name)

	return mlCfg, nil
}

// configureZoneAwareRouting configures zone-aware routing for memberlist.
func (m *KV) configureZoneAwareRouting(mlCfg *memberlist.Config) error {
	// Parse the role from the config string.
	var role NodeRole
	switch m.cfg.ZoneAwareRouting.Role {
	case NodeRoleMember.String():
		role = NodeRoleMember
	case NodeRoleBridge.String():
		role = NodeRoleBridge
	default:
		return fmt.Errorf("invalid zone-aware routing role: %s (valid values: %s, %s)", m.cfg.ZoneAwareRouting.Role, NodeRoleMember.String(), NodeRoleBridge.String())
	}

	// Encode the local node metadata.
	localMeta, err := EncodeNodeMetadata(role, m.cfg.ZoneAwareRouting.Zone)
	if err != nil {
		return fmt.Errorf("failed to encode node metadata: %w", err)
	}

	// Store the encoded metadata so NodeMeta() can return it.
	m.nodeMeta = localMeta

	// Set up the node selection delegate.
	mlCfg.NodeSelection = newZoneAwareNodeSelectionDelegate(role, m.cfg.ZoneAwareRouting.Zone, m.logger, m.registerer)

	// The bridge always prefer another bridge as first node. If the bridge only push/pull to 1 node per interval, then
	// it will only communicate to bridges, potentially leading to network partitioning if the gossiping is not
	// working to propagate changes. To reduce the likelihood of network partitioning when gossiping is not
	// working and periodic push/pull is enabled, we configure the bridge to push/pull to 2 nodes per interval
	// (the first node is a bridge, and the second node is selected randomly).
	if role == NodeRoleBridge {
		mlCfg.PushPullNodes = 2
	} else {
		mlCfg.PushPullNodes = 1
	}

	level.Info(m.logger).Log(
		"msg", "zone-aware routing enabled",
		"zone", m.cfg.ZoneAwareRouting.Zone,
		"role", role.String(),
	)

	return nil
}

func (m *KV) starting(ctx context.Context) error {
	mlCfg, err := m.buildMemberlistConfig()
	if err != nil {
		return err
	}

	// Wait for memberlist and broadcasts fields creation because
	// memberlist may start calling delegate methods if it
	// receives traffic.
	// See https://godoc.org/github.com/hashicorp/memberlist#Delegate
	//
	// Note: We cannot check for Starting state, as we want to use delegate during cluster joining process
	// that happens in Starting state.
	list, err := memberlist.Create(mlCfg)
	if err != nil {
		return fmt.Errorf("failed to create memberlist: %v", err)
	}
	// Finish delegate initialization.
	m.memberlist = list
	m.localBroadcasts = &memberlist.TransmitLimitedQueue{
		NumNodes:       list.NumMembers,
		RetransmitMult: mlCfg.RetransmitMult,
	}
	m.gossipBroadcasts = &memberlist.TransmitLimitedQueue{
		NumNodes:       list.NumMembers,
		RetransmitMult: mlCfg.RetransmitMult,
	}
	m.delegateReady.Store(true)

	// Try to fast-join memberlist cluster in Starting state, so that we don't start with empty KV store.
	if len(m.cfg.JoinMembers) > 0 {
		if err := m.fastJoinMembersOnStartup(ctx); err != nil {
			level.Error(m.logger).Log("msg", "failed to fast-join the memberlist cluster at startup", "err", err)

			if m.cfg.AbortIfFastJoinFails {
				return fmt.Errorf("failed to fast-join the memberlist cluster at startup: %w", err)
			}
		}
	}

	return nil
}

var errFailedToJoinCluster = errors.New("failed to join memberlist cluster on startup")

func (m *KV) running(ctx context.Context) error {
	// The key notifications goroutine must be started as the very first thing, otherwise watch key notifications
	// will be delayed. In particular, it must be started before the memberlist cluster full-join procedure (below)
	// because it may take a long time to complete.
	if m.cfg.NotifyInterval > 0 {
		// Start delayed key notifications.
		notifTicker := time.NewTicker(m.cfg.NotifyInterval)
		defer notifTicker.Stop()
		go m.monitorKeyNotifications(ctx, notifTicker.C)
	}

	ok := m.joinMembersOnStartup(ctx)
	if !ok && m.cfg.AbortIfJoinFails {
		return errFailedToJoinCluster
	}

	var tickerChan <-chan time.Time
	if m.cfg.RejoinInterval > 0 && len(m.cfg.JoinMembers) > 0 {
		t := time.NewTicker(m.cfg.RejoinInterval)
		defer t.Stop()

		tickerChan = t.C
	}

	var obsoleteEntriesTickerChan <-chan time.Time
	if m.cfg.ObsoleteEntriesTimeout > 0 {
		obsoleteEntriesTicker := time.NewTicker(m.cfg.ObsoleteEntriesTimeout)
		defer obsoleteEntriesTicker.Stop()

		obsoleteEntriesTickerChan = obsoleteEntriesTicker.C
	}

	logger := log.With(m.logger, "phase", "periodic_rejoin")
	for {
		select {
		case <-tickerChan:
			const numAttempts = 1 // don't retry if resolution fails, we will try again next time
			reached, err := m.joinMembersWithRetries(ctx, numAttempts, logger)
			if err == nil {
				level.Info(logger).Log("msg", "re-joined memberlist cluster", "reached_nodes", reached)
			} else {
				// Don't report error from rejoin, otherwise KV service would be stopped completely.
				level.Warn(logger).Log("msg", "re-joining memberlist cluster failed", "err", err, "next_try_in", m.cfg.RejoinInterval)
			}

		case <-obsoleteEntriesTickerChan:
			// cleanupObsoleteEntries is normally called during push/pull, but if there are no other
			// nodes to push/pull with, we can call it periodically to make sure we remove unused entries from memory.
			m.cleanupObsoleteEntries()

		case <-ctx.Done():
			return nil
		}
	}
}

// GetCodec returns codec for given ID or nil.
func (m *KV) GetCodec(codecID string) codec.Codec {
	return m.codecs[codecID]
}

// GetListeningPort returns port used for listening for memberlist communication. Useful when BindPort is set to 0.
// This call is only valid after KV service has been started.
func (m *KV) GetListeningPort() int {
	return int(m.memberlist.LocalNode().Port)
}

// JoinMembers joins the cluster with given members.
// See https://godoc.org/github.com/hashicorp/memberlist#Memberlist.Join
// This call is only valid after KV service has been started and is still running.
func (m *KV) JoinMembers(members []string) (int, error) {
	if m.State() != services.Running {
		return 0, fmt.Errorf("service not Running")
	}
	return m.memberlist.Join(members)
}

// fastJoinMembersOnStartup attempts to reach small subset of nodes (computed as RetransmitMult * log10(number of discovered members + 1)).
func (m *KV) fastJoinMembersOnStartup(ctx context.Context) error {
	startTime := time.Now()

	nodes, err := m.discoverMembersWithRetries(ctx, m.cfg.JoinMembers)
	if err != nil && len(nodes) == 0 {
		return err
	}

	// Shuffle the node addresses to randomize the ones picked for the fast join.
	math_rand.Shuffle(len(nodes), func(i, j int) {
		nodes[i], nodes[j] = nodes[j], nodes[i]
	})

	// This is the same formula as used by memberlist for number of nodes that a single message should be gossiped to.
	toJoin := m.cfg.RetransmitMult * int(math.Ceil(math.Log10(float64(len(nodes)+1))))

	level.Info(m.logger).Log("msg", "memberlist fast-join starting", "nodes_found", len(nodes), "to_join", toJoin)

	totalJoined := 0
	for toJoin > 0 && len(nodes) > 0 && ctx.Err() == nil {
		reached, err := m.memberlist.Join(nodes[0:1]) // Try to join single node only.
		if err != nil {
			level.Info(m.logger).Log("msg", "fast-joining node failed", "node", nodes[0], "err", err)
		}

		totalJoined += reached
		toJoin -= reached

		nodes = nodes[1:]
	}

	if totalJoined == 0 {
		level.Warn(m.logger).Log("msg", "memberlist fast-join failed because no node has been successfully reached", "elapsed_time", time.Since(startTime))
		return fmt.Errorf("no memberlist node reached during fast-join procedure")
	}

	level.Info(m.logger).Log("msg", "memberlist fast-join finished", "joined_nodes", totalJoined, "elapsed_time", time.Since(startTime))
	return nil
}

// The joinMembersOnStartup method resolves the addresses of the given join_members hosts and asks memberlist to join to them.
// This method cannot be called before KV.running state as it may wait for K8S DNS to resolve the service addresses of members
// running this very method. Which means the service needs to be READY for K8S to add it to DNS.
func (m *KV) joinMembersOnStartup(ctx context.Context) bool {
	// Trigger a hook used for testing.
	if m.cfg.beforeJoinMembersOnStartupHook != nil {
		m.cfg.beforeJoinMembersOnStartupHook(ctx)
	}

	if len(m.cfg.JoinMembers) == 0 {
		return true
	}

	logger := log.With(m.logger, "phase", "startup")
	level.Info(logger).Log("msg", "joining memberlist cluster", "join_members", strings.Join(m.cfg.JoinMembers, ","))
	startTime := time.Now()
	reached, err := m.joinMembersWithRetries(ctx, m.cfg.MaxJoinRetries, logger)
	if err != nil {
		level.Error(logger).Log("msg", "joining memberlist cluster failed", "err", err, "elapsed_time", time.Since(startTime))
		return false
	}
	level.Info(logger).Log("msg", "joining memberlist cluster succeeded", "reached_nodes", reached, "elapsed_time", time.Since(startTime))
	return true
}

// joinMembersWithRetries joins m.cfg.JoinMembers 100 at a time. After each batch of 100 it rediscoveres the members.
// This helps when the list of members is big and by the time we reach the end the originally resolved addresses may be obsolete.
// joinMembersWithRetries returns an error iff it couldn't successfully join any node OR the context was cancelled.
func (m *KV) joinMembersWithRetries(ctx context.Context, numAttempts int, logger log.Logger) (int, error) {
	var (
		cfg = backoff.Config{
			MinBackoff: m.cfg.MinJoinBackoff,
			MaxBackoff: m.cfg.MaxJoinBackoff,
			MaxRetries: numAttempts,
		}
		boff               = backoff.New(ctx, cfg)
		err                error
		successfullyJoined = 0
	)

	for ; boff.Ongoing(); boff.Wait() {
		successfullyJoined, err = m.joinMembersInBatches(ctx)
		if successfullyJoined > 0 {
			// If there are _some_ successful joins, then we can consider the join done.
			// Mimicking the Join semantics we return an error only when we couldn't join any node at all
			err = nil
			break
		}
		level.Warn(logger).Log("msg", "joining memberlist cluster", "attempts", boff.NumRetries()+1, "max_attempts", numAttempts, "err", err)
	}
	if err == nil && boff.Err() != nil {
		err = fmt.Errorf("joining memberlist: %w", boff.Err())
	}

	return successfullyJoined, err
}

// joinMembersInBatches joins m.cfg.JoinMembers and re-resolves the address of m.cfg.JoinMembers after joining 100 nodes.
// joinMembersInBatches returns the number of nodes joined. joinMembersInBatches returns an error only when the
// number of joined nodes is 0.
func (m *KV) joinMembersInBatches(ctx context.Context) (int, error) {
	const batchSize = 100
	var (
		attemptedNodes     = make(map[string]bool)
		successfullyJoined = 0
		lastErr            error
		batch              = make([]string, batchSize)
		nodes              []string
	)
	for moreAvailableNodes := true; ctx.Err() == nil && moreAvailableNodes; {
		// Rediscover nodes and try to join a subset of them with each batch.
		// When the list of nodes is large by the time we reach the end of the list some of the
		// IPs can be unreachable.
		//
		// Ignores any DNS resolution error because it's not really actionable in this
		// context.
		newlyResolved, _ := m.discoverMembersWithRetries(ctx, m.cfg.JoinMembers)
		if len(newlyResolved) > 0 {
			// If the resolution fails we keep using the nodes list from the last resolution.
			// If that failed too, then we fail the join attempt.
			nodes = newlyResolved
		}

		// Prepare batch
		batch = batch[:0]
		moreAvailableNodes = false
		for _, n := range nodes {
			if attemptedNodes[n] {
				continue
			}
			if len(batch) >= batchSize {
				moreAvailableNodes = true
				break
			}
			batch = append(batch, n)
			attemptedNodes[n] = true
		}

		// Join batch
		joinedInBatch, err := m.joinMembersBatch(ctx, batch)
		if err != nil {
			lastErr = err
		}
		successfullyJoined += joinedInBatch
	}
	if successfullyJoined > 0 {
		return successfullyJoined, nil
	}
	if successfullyJoined == 0 && lastErr == nil {
		return 0, errors.New("found no nodes to join")
	}
	return 0, lastErr
}

// joinMembersBatch returns an error only if it couldn't successfully join any nodes or if ctx is cancelled.
func (m *KV) joinMembersBatch(ctx context.Context, nodes []string) (successfullyJoined int, lastErr error) {
	for nodeIdx := range nodes {
		if ctx.Err() != nil {
			return successfullyJoined, fmt.Errorf("joining batch: %w", context.Cause(ctx))
		}
		// Attempt to join a single node.
		// The cost of calling Join shouldn't be different between passing all nodes in one invocation versus passing a single node per invocation.
		reached, err := m.memberlist.Join(nodes[nodeIdx : nodeIdx+1])
		successfullyJoined += reached
		if err != nil {
			lastErr = err
		}
	}
	if successfullyJoined > 0 {
		lastErr = nil
	}
	return successfullyJoined, lastErr
}

// Provides a dns-based member discovery to join a memberlist cluster w/o knowning members' addresses upfront.
// May both return some addresses and an error in case of a partial resolution.
func (m *KV) discoverMembers(ctx context.Context, members []string) ([]string, error) {
	if len(members) == 0 {
		return nil, nil
	}

	var ms, resolve []string

	for _, member := range members {
		if strings.Contains(member, "+") {
			resolve = append(resolve, member)
		} else {
			// No DNS SRV record to lookup, just append member
			ms = append(ms, member)
		}
	}

	err := m.provider.Resolve(ctx, resolve)
	if err != nil {
		level.Warn(m.logger).Log("msg", "failed to resolve members", "addrs", strings.Join(resolve, ","), "err", err)
	}

	ms = append(ms, m.provider.Addresses()...)

	return ms, err
}

// Like discoverMembers() but retries (up to 10 times) on error.
func (m *KV) discoverMembersWithRetries(ctx context.Context, members []string) ([]string, error) {
	boff := backoff.New(ctx, m.cfg.discoverMembersBackoff)

	var (
		lastErr   error
		lastAddrs []string
	)

	for boff.Ongoing() {
		lastAddrs, lastErr = m.discoverMembers(ctx, members)
		if lastErr == nil {
			return lastAddrs, nil
		}

		boff.Wait()
	}

	// We may have both some addresses and error, in case of a partial resolution.
	return lastAddrs, lastErr
}

// While Stopping, we try to leave memberlist cluster and then shutdown memberlist client.
// We do this in order to send out last messages, typically that ingester has LEFT the ring.
func (m *KV) stopping(_ error) error {
	level.Info(m.logger).Log("msg", "leaving memberlist cluster")

	// Wait until queue with locally-generated messages is empty, but don't wait for too long.
	// Also don't wait if there is just one node left.
	// Note: Once we enter Stopping state, we don't queue more locally-generated messages.

	deadline := time.Now().Add(m.cfg.BroadcastTimeoutForLocalUpdatesOnShutdown)

	msgs := m.localBroadcasts.NumQueued()
	nodes := m.memberlist.NumMembers()
	for msgs > 0 && nodes > 1 && (m.cfg.BroadcastTimeoutForLocalUpdatesOnShutdown <= 0 || time.Now().Before(deadline)) {
		level.Info(m.logger).Log("msg", "waiting for locally-generated broadcast messages to be sent out", "count", msgs, "nodes", nodes)
		time.Sleep(250 * time.Millisecond)

		msgs = m.localBroadcasts.NumQueued()
		nodes = m.memberlist.NumMembers()
	}

	if msgs > 0 {
		level.Warn(m.logger).Log("msg", "locally-generated broadcast messages left the queue", "count", msgs, "nodes", nodes)
	}

	err := m.memberlist.Leave(m.cfg.LeaveTimeout)
	if err != nil {
		level.Error(m.logger).Log("msg", "error when leaving memberlist cluster", "err", err)
	}

	close(m.shutdown)

	err = m.memberlist.Shutdown()
	if err != nil {
		level.Error(m.logger).Log("msg", "error when shutting down memberlist client", "err", err)
	}
	return nil
}

// List returns all known keys under a given prefix.
// No communication with other nodes in the cluster is done here.
func (m *KV) List(prefix string) []string {
	m.storeMu.Lock()
	defer m.storeMu.Unlock()

	var keys []string
	for k := range m.store {
		if strings.HasPrefix(k, prefix) {
			keys = append(keys, k)
		}
	}
	return keys
}

// Get returns current value associated with given key.
// No communication with other nodes in the cluster is done here.
func (m *KV) Get(key string, codec codec.Codec) (interface{}, error) {
	val, _, err := m.get(key, codec)
	return val, err
}

// Returns current value with removed tombstones.
func (m *KV) get(key string, _ codec.Codec) (out interface{}, version uint, err error) {
	m.storeMu.Lock()
	v := m.store[key].Clone()
	m.storeMu.Unlock()

	if v.value != nil {
		// remove ALL tombstones before returning to client.
		// No need for clients to see them.
		_, _ = v.value.RemoveTombstones(time.Time{})
	}

	return v.value, v.Version, nil
}

// WatchKey watches for value changes for given key. When value changes, 'f' function is called with the
// latest value. Notifications that arrive while 'f' is running are coalesced into one subsequent 'f' call.
//
// Watching ends when 'f' returns false, context is done, or this client is shut down.
func (m *KV) WatchKey(ctx context.Context, key string, codec codec.Codec, f func(interface{}) bool) {
	// keep one extra notification, to avoid missing notification if we're busy running the function
	w := make(chan string, 1)

	// register watcher
	m.watchersMu.Lock()
	m.watchers[key] = append(m.watchers[key], w)
	m.watchersMu.Unlock()

	defer func() {
		// unregister watcher on exit
		m.watchersMu.Lock()
		defer m.watchersMu.Unlock()

		removeWatcherChannel(key, w, m.watchers)
	}()

	for {
		select {
		case <-w:
			// value changed
			val, _, err := m.get(key, codec)
			if err != nil {
				level.Warn(m.logger).Log("msg", "failed to decode value while watching for changes", "key", key, "err", err)
				continue
			}

			if !f(val) {
				return
			}

		case <-m.shutdown:
			// stop watching on shutdown
			return

		case <-ctx.Done():
			return
		}
	}
}

// WatchPrefix watches for any change of values stored under keys with given prefix. When change occurs,
// function 'f' is called with key and current value.
// Each change of the key results in one notification. If there are too many pending notifications ('f' is slow),
// some notifications may be lost.
//
// Watching ends when 'f' returns false, context is done, or this client is shut down.
func (m *KV) WatchPrefix(ctx context.Context, prefix string, codec codec.Codec, f func(string, interface{}) bool) {
	// we use bigger buffer here, since keys are interesting and we don't want to lose them.
	w := make(chan string, m.cfg.WatchPrefixBufferSize)

	// register watcher
	m.watchersMu.Lock()
	m.prefixWatchers[prefix] = append(m.prefixWatchers[prefix], w)
	m.watchersMu.Unlock()

	defer func() {
		// unregister watcher on exit
		m.watchersMu.Lock()
		defer m.watchersMu.Unlock()

		removeWatcherChannel(prefix, w, m.prefixWatchers)
	}()

	for {
		select {
		case key := <-w:
			val, _, err := m.get(key, codec)
			if err != nil {
				level.Warn(m.logger).Log("msg", "failed to decode value while watching for changes", "key", key, "err", err)
				continue
			}
			if val == nil {
				// Skip nil values that can be generated if the notification is received after the entry has been deleted
				continue
			}
			if !f(key, val) {
				return
			}

		case <-m.shutdown:
			// stop watching on shutdown
			return

		case <-ctx.Done():
			return
		}
	}
}

func removeWatcherChannel(k string, w chan string, watchers map[string][]chan string) {
	ws := watchers[k]
	for ix, kw := range ws {
		if kw == w {
			ws = append(ws[:ix], ws[ix+1:]...)
			break
		}
	}

	if len(ws) > 0 {
		watchers[k] = ws
	} else {
		delete(watchers, k)
	}
}

// notifyWatchers sends notification to all watchers of given key. If delay is
// enabled, it accumulates them for later sending.
func (m *KV) notifyWatchers(key string) {
	if m.cfg.NotifyInterval <= 0 {
		m.notifyWatchersSync(key)
		return
	}

	m.notifMu.Lock()
	defer m.notifMu.Unlock()
	m.keyNotifications[key] = struct{}{}
}

// monitorKeyNotifications sends accumulated notifications to all watchers of
// respective keys when the given channel ticks.
func (m *KV) monitorKeyNotifications(ctx context.Context, tickChan <-chan time.Time) {
	if m.cfg.NotifyInterval <= 0 {
		panic("sendNotifications called with NotifyInterval <= 0")
	}

	for {
		select {
		case <-tickChan:
			m.sendKeyNotifications()
		case <-ctx.Done():
			return
		}
	}
}

// sendKeyNotifications sends accumulated notifications to watchers of respective keys.
func (m *KV) sendKeyNotifications() {
	newNotifs := func() map[string]struct{} {
		// Grab and clear accumulated notifications.
		m.notifMu.Lock()
		defer m.notifMu.Unlock()

		if len(m.keyNotifications) == 0 {
			return nil
		}
		newMap := make(map[string]struct{})
		m.numberOfKeyNotifications.Set(float64(len(m.keyNotifications)))
		notifs := m.keyNotifications
		m.keyNotifications = newMap
		return notifs
	}

	for key := range newNotifs() {
		m.notifyWatchersSync(key)
	}
}

// notifyWatcherSync immediately sends notification to all watchers of given key.
func (m *KV) notifyWatchersSync(key string) {
	m.watchersMu.Lock()
	defer m.watchersMu.Unlock()

	for _, kw := range m.watchers[key] {
		select {
		case kw <- key:
			// notification sent.
		default:
			// cannot send notification to this watcher at the moment
			// but since this is a buffered channel, it means that
			// there is already a pending notification anyway
		}
	}

	for p, ws := range m.prefixWatchers {
		if strings.HasPrefix(key, p) {
			for _, pw := range ws {
				select {
				case pw <- key:
					// notification sent.
				default:
					c, _ := m.watchPrefixDroppedNotifications.GetMetricWithLabelValues(p)
					if c != nil {
						c.Inc()
					}

					level.Warn(m.logger).Log("msg", "failed to send notification to prefix watcher", "prefix", p)
				}
			}
		}
	}
}

func (m *KV) Delete(key string) error {
	m.storeMu.Lock()
	val, ok := m.store[key]
	m.storeMu.Unlock()

	if !ok || val.Deleted {
		return nil
	}

	c := m.GetCodec(val.CodecID)
	if c == nil {
		level.Error(m.logger).Log("msg", "could not mark key for deletion due to an invalid codec", "key", key, "codec", val.CodecID)
		return fmt.Errorf("invalid codec: %s", val.CodecID)
	}

	change, newver, deleted, updated, err := m.mergeValueForKey(key, val.value, false, 0, val.CodecID, true, time.Now())
	if err != nil {
		level.Error(m.logger).Log("msg", "could not mark key for deletion due to error while trying to merge new value", "key", key, "err", err)
		return err
	}

	if newver > 0 {
		m.notifyWatchers(key)
		m.broadcastNewValue(key, change, newver, c, false, deleted, updated)
	}

	level.Info(m.logger).Log("msg", "successfully marked key for deletion", "key", key)

	return nil
}

// CAS implements Compare-And-Set/Swap operation.
//
// CAS expects that value returned by 'f' function implements Mergeable interface. If it doesn't, CAS fails immediately.
//
// This method combines Compare-And-Swap with Merge: it calls 'f' function to get a new state, and then merges this
// new state into current state, to find out what the change was. Resulting updated current state is then CAS-ed to
// KV store, and change is broadcast to cluster peers. Merge function is called with CAS flag on, so that it can
// detect removals. If Merge doesn't result in any change (returns nil), then operation fails and is retried again.
// After too many failed retries, this method returns error.
func (m *KV) CAS(ctx context.Context, key string, codec codec.Codec, f func(in interface{}) (out interface{}, retry bool, err error)) error {
	var lastError error

outer:
	for retries := m.maxCasRetries; retries > 0; retries-- {
		m.casAttempts.Inc()

		if lastError == errNoChangeDetected {
			// We only get here, if 'f' reports some change, but Merge function reports no change. This can happen
			// with Ring's merge function, which depends on timestamps (and not the tokens) with 1-second resolution.
			// By waiting for one second, we hope that Merge will be able to detect change from 'f' function.

			select {
			case <-time.After(noChangeDetectedRetrySleep):
				// ok
			case <-ctx.Done():
				lastError = ctx.Err()
				break outer
			}
		}

		change, newver, retry, deleted, updated, err := m.trySingleCas(key, codec, f)
		if err != nil {
			level.Debug(m.logger).Log("msg", "CAS attempt failed", "err", err, "retry", retry)

			lastError = err
			if !retry {
				break
			}
			continue
		}

		if change != nil {
			m.casSuccesses.Inc()
			m.notifyWatchers(key)

			m.broadcastNewValue(key, change, newver, codec, true, deleted, updated)
		}

		return nil
	}

	if errors.Is(lastError, errVersionMismatch) {
		// this is more likely error than version mismatch.
		lastError = errTooManyRetries
	}

	m.casFailures.Inc()
	return fmt.Errorf("failed to CAS-update key %s: %v", key, lastError)
}

// returns change, error (or nil, if CAS succeeded), and whether to retry or not.
// returns errNoChangeDetected if merge failed to detect change in f's output.
func (m *KV) trySingleCas(key string, codec codec.Codec, f func(in interface{}) (out interface{}, retry bool, err error)) (Mergeable, uint, bool, bool, time.Time, error) {
	val, ver, err := m.get(key, codec)
	if err != nil {
		return nil, 0, false, false, time.Time{}, fmt.Errorf("failed to get value: %v", err)
	}

	out, retry, err := f(val)
	if err != nil {
		return nil, 0, retry, false, time.Time{}, fmt.Errorf("fn returned error: %v", err)
	}

	if out == nil {
		// no change to be done
		return nil, 0, false, false, time.Time{}, nil
	}

	// Don't even try
	incomingValue, ok := out.(Mergeable)
	if !ok || incomingValue == nil {
		return nil, 0, retry, false, time.Time{}, fmt.Errorf("invalid type: %T, expected Mergeable", out)
	}

	// To support detection of removed items from value, we will only allow CAS operation to
	// succeed if version hasn't changed, i.e. state hasn't changed since running 'f'.
	// Supplied function may have kept a reference to the returned "incoming value".
	// If KV store will keep this value as well, it needs to make a clone.
	change, newver, deleted, updated, err := m.mergeValueForKey(key, incomingValue, true, ver, codec.CodecID(), false, time.Now())
	if err == errVersionMismatch {
		return nil, 0, retry, false, time.Time{}, err
	}

	if err != nil {
		return nil, 0, retry, false, time.Time{}, fmt.Errorf("merge failed: %v", err)
	}

	if newver == 0 {
		// CAS method reacts on this error
		return nil, 0, retry, deleted, updated, errNoChangeDetected
	}

	return change, newver, retry, deleted, updated, nil
}

func (m *KV) broadcastNewValue(key string, change Mergeable, version uint, codec codec.Codec, locallyGenerated bool, deleted bool, updateTime time.Time) {
	if locallyGenerated && m.State() != services.Running {
		level.Warn(m.logger).Log("msg", "skipped broadcasting of locally-generated update because memberlist KV is shutting down", "key", key)
		return
	}
	data, err := codec.Encode(change)

	if err != nil {
		level.Error(m.logger).Log("msg", "failed to encode change", "key", key, "version", version, "err", err)
		m.numberOfBroadcastMessagesDropped.Inc()
		return
	}

	kvPair := KeyValuePair{Key: key, Value: data, Codec: codec.CodecID(), Deleted: deleted, UpdateTimeMillis: updateTimeMillis(updateTime)}
	pairData, err := kvPair.Marshal()
	if err != nil {
		level.Error(m.logger).Log("msg", "failed to serialize KV pair", "key", key, "version", version, "err", err)
		m.numberOfBroadcastMessagesDropped.Inc()
		return
	}

	mergedChanges := change.MergeContent()
	m.addSentMessage(Message{
		Time:    time.Now(),
		Size:    len(pairData),
		Pair:    kvPair,
		Version: version,
		Changes: mergedChanges,
	})

	l := len(pairData)
	b := ringBroadcast{
		key:     key,
		content: mergedChanges,
		version: version,
		msg:     pairData,
		finished: func(ringBroadcast) {
			m.totalSizeOfBroadcastMessagesInQueue.Sub(float64(l))
		},
		logger: m.logger,
	}

	m.totalSizeOfBroadcastMessagesInQueue.Add(float64(l))

	if locallyGenerated {
		m.localBroadcasts.QueueBroadcast(b)
	} else {
		m.gossipBroadcasts.QueueBroadcast(b)
	}
}

// NodeMeta is method from Memberlist Delegate interface
func (m *KV) NodeMeta(_ int) []byte {
	// Return the encoded node metadata if zone-aware routing is enabled.
	// Otherwise, return nil (no metadata).
	return m.nodeMeta
}

// NotifyMsg is method from Memberlist Delegate interface
// Called when single message is received, i.e. what our broadcastNewValue has sent.
func (m *KV) NotifyMsg(msg []byte) {
	if !m.delegateReady.Load() {
		return
	}

	m.numberOfReceivedMessages.Inc()
	m.totalSizeOfReceivedMessages.Add(float64(len(msg)))

	kvPair := KeyValuePair{}
	err := kvPair.Unmarshal(msg)
	if err != nil {
		level.Warn(m.logger).Log("msg", "failed to unmarshal received KV Pair", "err", err)
		m.numberOfInvalidReceivedMessages.Inc()
		return
	}

	if len(kvPair.Key) == 0 {
		level.Warn(m.logger).Log("msg", "received an invalid KV Pair (empty key)")
		m.numberOfInvalidReceivedMessages.Inc()
		return
	}

	codec := m.GetCodec(kvPair.GetCodec())
	if codec == nil {
		m.numberOfInvalidReceivedMessages.Inc()
		level.Error(m.logger).Log("msg", "failed to decode received value, unknown codec", "codec", kvPair.GetCodec())
		return
	}

	ch := m.getKeyWorkerChannel(kvPair.Key)
	select {
	case ch <- valueUpdate{value: kvPair.Value, codec: codec, messageSize: len(msg), deleted: kvPair.Deleted, updateTime: updateTime(kvPair.UpdateTimeMillis)}:
	default:
		m.numberOfDroppedMessages.Inc()
		level.Warn(m.logger).Log("msg", "notify queue full, dropping message", "key", kvPair.Key)
	}
}

func (m *KV) getKeyWorkerChannel(key string) chan<- valueUpdate {
	m.workersMu.Lock()
	defer m.workersMu.Unlock()

	ch := m.workersChannels[key]
	if ch == nil {
		// spawn a key associated worker goroutine to process updates in background
		ch = make(chan valueUpdate, notifyMsgQueueSize)
		go m.processValueUpdate(ch, key)

		m.workersChannels[key] = ch
	}
	return ch
}

func (m *KV) processValueUpdate(workerCh <-chan valueUpdate, key string) {
	for {
		select {
		case update := <-workerCh:
			// we have a value update! Let's merge it with our current version for given key
			mod, version, deleted, updated, err := m.mergeBytesValueForKey(key, update.value, update.codec, update.deleted, update.updateTime)

			changes := []string(nil)
			if mod != nil {
				changes = mod.MergeContent()
			}

			m.addReceivedMessage(Message{
				Time: time.Now(),
				Size: update.messageSize,
				Pair: KeyValuePair{
					Key:              key,
					Value:            update.value,
					Codec:            update.codec.CodecID(),
					Deleted:          deleted,
					UpdateTimeMillis: updateTimeMillis(updated),
				},
				Version: version,
				Changes: changes,
			})

			if err != nil {
				level.Error(m.logger).Log("msg", "failed to store received value", "key", key, "err", err)
			} else if version > 0 {
				m.notifyWatchers(key)

				// Don't resend original message, but only changes, if any.
				m.broadcastNewValue(key, mod, version, update.codec, false, deleted, updated)
			}

		case <-m.shutdown:
			// stop running on shutdown
			return
		}
	}
}

// GetBroadcasts is method from Memberlist Delegate interface
// It returns all pending broadcasts (within the size limit)
func (m *KV) GetBroadcasts(overhead, limit int) [][]byte {
	if !m.delegateReady.Load() {
		return nil
	}

	// Prioritize locally-generated messages
	msgs := m.localBroadcasts.GetBroadcasts(overhead, limit)

	// Decrease limit for each message we got from locally-generated broadcasts.
	for _, m := range msgs {
		limit -= overhead + len(m)
	}

	if limit > 0 {
		msgs = append(msgs, m.gossipBroadcasts.GetBroadcasts(overhead, limit)...)
	}
	return msgs
}

// LocalState is method from Memberlist Delegate interface
//
// This is "pull" part of push/pull sync (either periodic, or when new node joins the cluster).
// Here we dump our entire state -- all keys and their values. There is no limit on message size here,
// as Memberlist uses 'stream' operations for transferring this state.
func (m *KV) LocalState(_ bool) []byte {
	if !m.delegateReady.Load() {
		return nil
	}

	m.numberOfPulls.Inc()

	m.storeMu.Lock()
	defer m.storeMu.Unlock()

	// For each Key/Value pair in our store, we write
	// [4-bytes length of marshalled KV pair] [marshalled KV pair]

	buf := bytes.Buffer{}
	sent := time.Now()

	kvPair := KeyValuePair{}
	for key, val := range m.store {
		if val.value == nil {
			continue
		}

		codec := m.GetCodec(val.CodecID)
		if codec == nil {
			level.Error(m.logger).Log("msg", "failed to encode remote state: unknown codec for key", "codec", val.CodecID, "key", key)
			continue
		}

		encoded, err := codec.Encode(val.value)
		if err != nil {
			level.Error(m.logger).Log("msg", "failed to encode remote state", "err", err)
			continue
		}

		kvPair.Reset()
		kvPair.Key = key
		kvPair.Value = encoded
		kvPair.Codec = val.CodecID
		kvPair.Deleted = val.Deleted
		kvPair.UpdateTimeMillis = updateTimeMillis(val.UpdateTime)

		ser, err := kvPair.Marshal()
		if err != nil {
			level.Error(m.logger).Log("msg", "failed to serialize KV Pair", "err", err)
			continue
		}

		if uint(len(ser)) > math.MaxUint32 {
			level.Error(m.logger).Log("msg", "value too long", "key", key, "value_length", len(encoded))
			continue
		}

		err = binary.Write(&buf, binary.BigEndian, uint32(len(ser)))
		if err != nil {
			level.Error(m.logger).Log("msg", "failed to write uint32 to buffer?", "err", err)
			continue
		}
		buf.Write(ser)

		m.addSentMessage(Message{
			Time:    sent,
			Size:    len(ser),
			Pair:    kvPair, // Makes a copy of kvPair.
			Version: val.Version,
		})
	}

	m.totalSizeOfPulls.Add(float64(buf.Len()))
	return buf.Bytes()
}

// MergeRemoteState is a method from the Memberlist Delegate interface.
//
// This is 'push' part of push/pull sync. We merge incoming KV store (all keys and values) with ours.
//
// Data is full state of remote KV store, as generated by LocalState method (run on another node).
func (m *KV) MergeRemoteState(data []byte, _ bool) {
	if !m.delegateReady.Load() {
		return
	}

	received := time.Now()

	m.numberOfPushes.Inc()
	m.totalSizeOfPushes.Add(float64(len(data)))

	kvPair := KeyValuePair{}

	var err error
	// Data contains individual KV pairs (encoded as protobuf messages), each prefixed with 4 bytes length of KV pair:
	// [4-bytes length of marshalled KV pair] [marshalled KV pair] [4-bytes length] [KV pair]...
	for len(data) > 0 {
		if len(data) < 4 {
			err = fmt.Errorf("not enough data left for another KV Pair: %d", len(data))
			break
		}

		kvPairLength := binary.BigEndian.Uint32(data)

		data = data[4:]

		if len(data) < int(kvPairLength) {
			err = fmt.Errorf("not enough data left for next KV Pair, expected %d, remaining %d bytes", kvPairLength, len(data))
			break
		}

		kvPair.Reset()
		err = kvPair.Unmarshal(data[:kvPairLength])
		if err != nil {
			err = fmt.Errorf("failed to parse KV Pair: %v", err)
			break
		}

		data = data[kvPairLength:]

		codec := m.GetCodec(kvPair.GetCodec())
		if codec == nil {
			level.Error(m.logger).Log("msg", "failed to parse remote state: unknown codec for key", "codec", kvPair.GetCodec(), "key", kvPair.GetKey())
			continue
		}

		// we have both key and value, try to merge it with our state
		change, newver, deleted, updated, err := m.mergeBytesValueForKey(kvPair.Key, kvPair.Value, codec, kvPair.Deleted, updateTime(kvPair.UpdateTimeMillis))

		changes := []string(nil)
		if change != nil {
			changes = change.MergeContent()
		}

		m.addReceivedMessage(Message{
			Time:    received,
			Size:    int(kvPairLength),
			Pair:    kvPair, // Makes a copy of kvPair.
			Version: newver,
			Changes: changes,
		})

		if err != nil {
			level.Error(m.logger).Log("msg", "failed to store received value", "key", kvPair.Key, "err", err)
		} else if newver > 0 {
			m.notifyWatchers(kvPair.Key)
			m.broadcastNewValue(kvPair.Key, change, newver, codec, false, deleted, updated)
		}
	}

	if err != nil {
		level.Error(m.logger).Log("msg", "failed to parse remote state", "err", err)
	}
}

func (m *KV) mergeBytesValueForKey(key string, incomingData []byte, codec codec.Codec, deleted bool, updateTime time.Time) (Mergeable, uint, bool, time.Time, error) {
	// Even if there is no change to the Mergeable, we still may need to update the timestamp and deleted state.
	if len(incomingData) == 0 {
		incomingData = emptySnappyEncodedData
	}
	decodedValue, err := codec.Decode(incomingData)
	if err != nil {
		return nil, 0, false, time.Time{}, fmt.Errorf("failed to decode value: %v", err)
	}

	incomingValue, ok := decodedValue.(Mergeable)
	if !ok {
		return nil, 0, false, time.Time{}, fmt.Errorf("expected Mergeable, got: %T", decodedValue)
	}

	// No need to clone this "incomingValue", since we have just decoded it from bytes, and won't be using it.
	return m.mergeValueForKey(key, incomingValue, false, 0, codec.CodecID(), deleted, updateTime)
}

// Merges incoming value with value we have in our store. Returns "a change" that can be sent to other
// cluster members to update their state, and new version of the value.
// If CAS version is specified, then merging will fail if state has changed already, and errVersionMismatch is reported.
// If no modification occurred, new version is 0.
func (m *KV) mergeValueForKey(key string, incomingValue Mergeable, incomingValueRequiresClone bool, casVersion uint, codecID string, deleted bool, updateTime time.Time) (change Mergeable, newVersion uint, newDeleted bool, newUpdated time.Time, err error) {
	m.storeMu.Lock()
	defer m.storeMu.Unlock()

	// Note that we do not take a deep copy of curr.value here, it is modified in-place.
	// This is safe because the entire function runs under the store lock; we do not return
	// the full state anywhere as is done elsewhere (i.e. Get/WatchKey/CAS).
	curr := m.store[key]

	// if current entry is nil but the incoming for that key is deleted then we return no change, as we do not want to revive the entry.
	if curr.value == nil && deleted {
		return nil, 0, false, time.Time{}, err
	}

	// if casVersion is 0, then there was no previous value, so we will just do normal merge, without localCAS flag set.
	if casVersion > 0 && curr.Version != casVersion {
		return nil, 0, false, time.Time{}, errVersionMismatch
	}
	result, change, err := computeNewValue(incomingValue, incomingValueRequiresClone, curr.value, casVersion > 0)
	if err != nil {
		return nil, 0, false, time.Time{}, err
	}
	newUpdated = curr.UpdateTime
	newDeleted = curr.Deleted

	// If incoming value is newer, use its timestamp and deleted value
	if !updateTime.IsZero() && updateTime.After(newUpdated) && deleted {
		newUpdated = updateTime
		newDeleted = deleted
	}

	// No change, don't store it.
	if (change == nil || len(change.MergeContent()) == 0) && curr.Deleted == newDeleted {
		return nil, 0, curr.Deleted, curr.UpdateTime, nil
	}

	if m.cfg.LeftIngestersTimeout > 0 {
		limit := time.Now().Add(-m.cfg.LeftIngestersTimeout)
		total, removed := result.RemoveTombstones(limit)
		m.storeTombstones.WithLabelValues(key).Set(float64(total))
		m.storeRemovedTombstones.WithLabelValues(key).Add(float64(removed))

		// Remove tombstones from change too. If change turns out to be empty after this,
		// we don't need to gossip the change. However, the local value will be always be updated.
		//
		// Note that "result" and "change" may actually be the same Mergeable. That is why we
		// call RemoveTombstones on "result" first, so that we get the correct metrics. Calling
		// RemoveTombstones twice with same limit should be noop.
		if change != nil {
			change.RemoveTombstones(limit)
			if len(change.MergeContent()) == 0 {
				return nil, 0, curr.Deleted, curr.UpdateTime, nil
			}
		}
	}

	if change == nil && curr.Deleted != newDeleted {
		// return result as change if the only thing that changes is the Delete state of the entry.
		change = result
	}

	newVersion = curr.Version + 1
	m.store[key] = ValueDesc{
		value:      result,
		Version:    newVersion,
		CodecID:    codecID,
		Deleted:    newDeleted,
		UpdateTime: newUpdated,
	}

	// The "changes" returned by Merge() can contain references to the "result"
	// state. Therefore, make sure we clone it before releasing the lock.
	if change != nil {
		change = change.Clone()
	}
	return change, newVersion, newDeleted, newUpdated, nil
}

// returns [result, change, error]
func computeNewValue(incoming Mergeable, incomingValueRequiresClone bool, oldVal Mergeable, cas bool) (Mergeable, Mergeable, error) {
	if oldVal == nil {
		// It's OK to return the same value twice (once as result, once as change), because "change" will be cloned
		// in mergeValueForKey if needed.

		if incomingValueRequiresClone {
			clone := incoming.Clone()
			return clone, clone, nil
		}

		return incoming, incoming, nil
	}

	// otherwise we have two mergeables, so merge them
	change, err := oldVal.Merge(incoming, cas)
	return oldVal, change, err
}

func (m *KV) storeCopy() map[string]ValueDesc {
	m.storeMu.Lock()
	defer m.storeMu.Unlock()

	result := make(map[string]ValueDesc, len(m.store))
	for k, v := range m.store {
		result[k] = v.Clone()
	}
	return result
}

func (m *KV) addReceivedMessage(msg Message) {
	if m.cfg.MessageHistoryBufferBytes == 0 {
		return
	}

	m.messagesMu.Lock()
	defer m.messagesMu.Unlock()

	m.messageCounter++
	msg.ID = m.messageCounter

	m.receivedMessages, m.receivedMessagesSize = addMessageToBuffer(m.receivedMessages, m.receivedMessagesSize, m.cfg.MessageHistoryBufferBytes, msg)
}

func (m *KV) addSentMessage(msg Message) {
	if m.cfg.MessageHistoryBufferBytes == 0 {
		return
	}

	m.messagesMu.Lock()
	defer m.messagesMu.Unlock()

	m.messageCounter++
	msg.ID = m.messageCounter

	m.sentMessages, m.sentMessagesSize = addMessageToBuffer(m.sentMessages, m.sentMessagesSize, m.cfg.MessageHistoryBufferBytes, msg)
}

func (m *KV) getSentAndReceivedMessages() (sent, received []Message) {
	m.messagesMu.Lock()
	defer m.messagesMu.Unlock()

	// Make copy of both slices.
	return append([]Message(nil), m.sentMessages...), append([]Message(nil), m.receivedMessages...)
}

func (m *KV) deleteSentReceivedMessages() {
	m.messagesMu.Lock()
	defer m.messagesMu.Unlock()

	m.sentMessages = nil
	m.sentMessagesSize = 0
	m.receivedMessages = nil
	m.receivedMessagesSize = 0
}

func (m *KV) cleanupObsoleteEntries() {
	m.storeMu.Lock()
	defer m.storeMu.Unlock()

	for k, v := range m.store {
		if v.Deleted && time.Since(v.UpdateTime) > m.cfg.ObsoleteEntriesTimeout {
			delete(m.store, k)
		}
	}
}

func addMessageToBuffer(msgs []Message, size int, limit int, msg Message) ([]Message, int) {
	msgs = append(msgs, msg)
	size += msg.Size

	for len(msgs) > 0 && size > limit {
		size -= msgs[0].Size
		msgs = msgs[1:]
	}

	return msgs, size
}

func updateTime(val int64) time.Time {
	if val == 0 {
		return time.Time{}
	}
	return time.UnixMilli(val)
}

func updateTimeMillis(ts time.Time) int64 {
	if ts.IsZero() {
		return 0
	}
	return ts.UnixMilli()
}
