package centrifuge

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Config contains Node configuration options.
type Config struct {
	// Version of server – if set will be sent to a client on connection
	// establishment phase in reply to connect command from a client.
	Version string
	// Name is a unique name of the current server Node. Name used as human-readable
	// and meaningful node identifier. If not set then os.Hostname will be used.
	Name string
	// LogLevel is a log level. By default, nothing will be logged by Centrifuge.
	LogLevel LogLevel
	// LogHandler is a handler function Node will send logs to.
	LogHandler LogHandler
	// NodeInfoMetricsAggregateInterval sets interval for automatic metrics
	// aggregation. It's not reasonable to have it less than one second.
	// Zero value means 60 * time.Second.
	NodeInfoMetricsAggregateInterval time.Duration
	// ClientConnectIncludeServerTime tells Centrifuge to append `time` field to Connect result of client protocol.
	// This field contains Unix timestamp in milliseconds and represents current server time. By default, server time
	// is not included.
	ClientConnectIncludeServerTime bool
	// ClientPresenceUpdateInterval sets an interval how often connected
	// clients update presence information.
	// Zero value means 25 * time.Second.
	ClientPresenceUpdateInterval time.Duration
	// ClientExpiredCloseDelay is an extra time given to client to refresh
	// its connection in the end of connection TTL. At moment only used for
	// a client-side refresh workflow.
	// Zero value means 25 * time.Second.
	ClientExpiredCloseDelay time.Duration
	// ClientExpiredSubCloseDelay is an extra time given to client to
	// refresh its expiring subscription in the end of subscription TTL.
	// At the moment only used for a client-side subscription refresh workflow.
	// Zero value means 25 * time.Second.
	ClientExpiredSubCloseDelay time.Duration
	// ClientStaleCloseDelay is a timeout after which connection will be
	// closed if still not authenticated (i.e. no valid connect command
	// received yet).
	// Zero value means 15 * time.Second.
	ClientStaleCloseDelay time.Duration
	// ClientChannelPositionCheckDelay defines minimal time from previous
	// client position check in channel. If client does not pass check it
	// will be disconnected with DisconnectInsufficientState.
	// Zero value means 40 * time.Second.
	ClientChannelPositionCheckDelay time.Duration
	// Maximum allowed time lag for publications for subscribers with positioning on.
	// When exceeded we mark connection with insufficient state. By default, not used - i.e.
	// Centrifuge does not take lag into account for positioning.
	// See also pub_sub_time_lag_seconds as a helpful metric.
	ClientChannelPositionMaxTimeLag time.Duration
	// ClientQueueMaxSize is a maximum size of client's message queue in
	// bytes. After this queue size exceeded Centrifuge closes client's connection.
	// Zero value means 1048576 bytes (1MB).
	ClientQueueMaxSize int
	// ClientChannelLimit sets upper limit of client-side channels each client
	// can subscribe to. Client-side subscriptions attempts will get an ErrorLimitExceeded
	// in subscribe reply. Server-side subscriptions above limit will result into
	// DisconnectChannelLimit.
	// Zero value means 128.
	ClientChannelLimit int
	// UserConnectionLimit limits number of client connections to single Node
	// from user with the same ID. Zero value means unlimited. Anonymous users
	// can't be tracked.
	UserConnectionLimit int
	// ChannelMaxLength is the maximum length of a channel name. This is only checked
	// for client-side subscription requests.
	// Zero value means 255.
	ChannelMaxLength int
	// HistoryMaxPublicationLimit allows limiting the maximum number of publications to be
	// asked over client API history call. This is useful when you have large streams and
	// want to prevent a massive number of missed messages to be sent to a client when
	// calling history without any limit explicitly set. By default, no limit used.
	// This option does not affect Node.History method. See also RecoveryMaxPublicationLimit.
	HistoryMaxPublicationLimit int
	// RecoveryMaxPublicationLimit allows limiting the number of Publications that could be
	// restored during the automatic recovery process. See also HistoryMaxPublicationLimit.
	// By default, no limit used.
	RecoveryMaxPublicationLimit int
	// UseSingleFlight allows turning on mode where singleflight will be automatically used
	// for Node.History (including recovery) and Node.Presence/Node.PresenceStats calls.
	UseSingleFlight bool
	// HistoryMetaTTL sets a time of stream meta key expiration in Redis. Stream
	// meta key is a Redis HASH that contains top offset in channel and epoch value.
	// In some cases – when channels created for а short time and then
	// not used anymore – created stream meta keys can stay in memory while
	// not actually useful. For example, you can have a personal user channel but
	// after using your app for a while user left it forever. In long-term
	// perspective this can be an unwanted memory leak. Setting a reasonable
	// value to this option (usually much bigger than history retention period)
	// can help. In this case unused channel stream metadata will eventually expire.
	//
	// Keep this value much larger than history stream TTL used when publishing.
	// When zero Centrifuge uses default 30 days which we believe is more than enough
	// for most use cases.
	HistoryMetaTTL time.Duration
	// Metrics is MetricsConfig to configure Prometheus metrics provided by Centrifuge.
	Metrics MetricsConfig
	// GetChannelMediumOptions is a way to provide ChannelMediumOptions for specific channel.
	// This function is called each time new channel appears on the Node.
	// See the doc comment for ChannelMediumOptions for more details about channel medium concept.
	GetChannelMediumOptions func(channel string) ChannelMediumOptions
	// GetBroker when set allows returning a custom Broker to use for a specific channel. If not set
	// then the default Node's Broker is always used for all channels. Also, Node's default Broker is
	// always used for control channels. It's the responsibility of an application to call Broker.Run
	// method of all brokers except the default one (called automatically inside Node.Run). Also, a
	// proper Broker shutdown is the responsibility of application because Node does not know about
	// custom Broker instances. When GetBroker returns false as the second argument then Node will
	// use the default Broker for the channel.
	GetBroker func(channel string) (Broker, bool)
	// GetPresenceManager when set allows returning a custom PresenceManager to use for a specific
	// channel. If not set then the default Node's PresenceManager is always used for all channels.
	// A proper PresenceManager shutdown is the responsibility of application because Node does not
	// know about custom PresenceManager instances. When GetPresenceManager returns false as the second
	// argument then Node will use the default PresenceManager for the channel.
	GetPresenceManager func(channel string) (PresenceManager, bool)
	// Tell Centrifuge how to transform connect error codes to disconnect objects for unidirectional
	// transports. If not set or code not found in the mapping then Centrifuge falls back to the default
	// mapping defined internally.
	UnidirectionalCodeToDisconnect map[uint32]Disconnect
	// GetChannelBatchConfig allows configuring per-channel write batching. Batching config if
	// returned is applied for publications and join/leave channel pushes for all channel subscribers.
	// The cost of batching are extra goroutines, buffers and extra timers for each channel used in
	// batching, so you can expect memory overhead. But batching may be useful for reducing CPU usage
	// coming from write system calls in channels with high publication rate. If GetChannelBatchConfig
	// not set then no batching is used on per-channel level. This function may be called in the hot
	// broadcast path, so must be fast. This is an EXPERIMENTAL feature.
	GetChannelBatchConfig func(channel string) ChannelBatchConfig
	// ClientTimerScheduler if set will be used for scheduling client timers.
	// This is an EXPERIMENTAL API.
	ClientTimerScheduler TimerScheduler
}

const (
	// nodeInfoPublishInterval is an interval how often node must publish
	// node control message.
	nodeInfoPublishInterval = 3 * time.Second
	// nodeInfoCleanInterval is an interval in seconds, how often node must
	// clean information about other running nodes.
	nodeInfoCleanInterval = nodeInfoPublishInterval * 3
	// nodeInfoMaxDelay is an interval in seconds how long node info is
	// considered actual.
	nodeInfoMaxDelay = nodeInfoPublishInterval*2 + time.Second
)

// RegistererGatherer defines an interface that combines Registerer and Gatherer from Prometheus.
// Prometheus Registry implements both interfaces.
type RegistererGatherer interface {
	prometheus.Registerer
	prometheus.Gatherer
}

type MetricsConfig struct {
	// MetricsNamespace is a Prometheus metrics namespace to use for Centrifuge metrics.
	// If not set then the default metrics namespace name "centrifuge" will be used.
	MetricsNamespace string
	// RegistererGatherer is a Prometheus registerer and gatherer. If not set then a
	// prometheus.DefaultRegisterer and prometheus.DefaultGatherer will be used.
	RegistererGatherer RegistererGatherer

	// GetChannelNamespaceLabel if set will be used by Centrifuge to extract channel_namespace
	// label for channel related metrics. Make sure to maintain low cardinality of returned values
	// to avoid issues with Prometheus performance. This function may introduce sufficient overhead
	// since it's called in hot paths - so it should be fast. By default, Centrifuge uses cache
	// of resolved channel namespace labels to avoid calling this function too often. See below
	// ChannelNamespaceCacheSize and ChannelNamespaceCacheTTL options to tweak the cache behavior.
	GetChannelNamespaceLabel func(channel string) string
	// ChannelNamespaceCacheSize sets the size of the cache for channel namespace label resolution.
	// Zero value will use cache size equal to 4096. Set -1 to disable cache (in that case make sure
	// your GetChannelNamespaceLabel is fast and ideally does not allocate because it's called in hot
	// paths).
	ChannelNamespaceCacheSize int
	// ChannelNamespaceCacheTTL sets the time after which resolved channel namespace for a channel
	// will expire in the cache. If zero – default TTL 10 seconds is used.
	ChannelNamespaceCacheTTL time.Duration

	// RegisteredClientNames is an optional list of known client names which will be allowed to be
	// attached as labels to metrics. If client passed a name which is not in the list – then Centrifuge
	// will use string "unregistered" as a client_name label. We need to be strict here to avoid
	// Prometheus cardinality issues.
	RegisteredClientNames []string
	// CheckRegisteredClientVersion is a function to check whether the version passed by a client with a
	// particular name is valid and can be used in metric values. When function is not set or returns
	// false Centrifuge will use "unregistered" value for a client version. Note, the name argument here
	// is an original name of client passed to Centrifuge.
	CheckRegisteredClientVersion func(clientName string, clientVersion string) bool
	// EnableRecoveredPublicationsHistogram enables histogram tracking of number of publications
	// recovered during subscription successful recovery operations.
	EnableRecoveredPublicationsHistogram bool
	// ExposeTransportAcceptProtocol enables exposing in labels the accept protocol used by client's transport.
	// If not enabled - empty string will be used as a label value.
	ExposeTransportAcceptProtocol bool
}

// PingPongConfig allows configuring application level ping-pong behavior.
// Note that in current implementation PingPongConfig.PingInterval must be greater than PingPongConfig.PongTimeout.
type PingPongConfig struct {
	// PingInterval tells how often to issue server-to-client pings.
	// For zero value 25 secs will be used. To disable sending app-level pings use -1.
	PingInterval time.Duration
	// PongTimeout sets time for pong check after issuing a ping.
	// For zero value 10 seconds will be used. To disable pong checks use -1.
	// PongTimeout must be less than PingInterval in current implementation.
	PongTimeout time.Duration
}

func getPingPongPeriodValues(config PingPongConfig) (time.Duration, time.Duration) {
	pingInterval := config.PingInterval
	if pingInterval < 0 {
		pingInterval = 0
	} else if pingInterval == 0 {
		pingInterval = 25 * time.Second
	}
	pongTimeout := config.PongTimeout
	if pongTimeout < 0 {
		pongTimeout = 0
	} else if pongTimeout == 0 {
		pongTimeout = 10 * time.Second
	}
	return pingInterval, pongTimeout
}

func warnAboutIncorrectPingPongConfig(node *Node, config PingPongConfig, transportName string) {
	pingInterval, pongTimeout := getPingPongPeriodValues(config)
	if pingInterval > 0 && pongTimeout > 0 && pongTimeout >= pingInterval {
		node.logger.log(newLogEntry(
			LogLevelWarn,
			"ping interval must be greater than pong timeout to work properly",
			map[string]any{
				"transport":     transportName,
				"ping_interval": pingInterval.String(),
				"pong_timeout":  pongTimeout.String(),
			},
		))
	}
}
