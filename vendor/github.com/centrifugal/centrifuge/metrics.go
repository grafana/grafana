package centrifuge

import (
	"errors"
	"strconv"
	"sync"
	"time"

	"github.com/centrifugal/protocol"
	"github.com/maypok86/otter"
	"github.com/prometheus/client_golang/prometheus"
)

// default namespace for prometheus metrics. Can be changed over Config.
var defaultMetricsNamespace = "centrifuge"

var registryMu sync.RWMutex

type metrics struct {
	messagesSentCount             *prometheus.CounterVec
	messagesReceivedCount         *prometheus.CounterVec
	actionCount                   *prometheus.CounterVec
	buildInfoGauge                *prometheus.GaugeVec
	numClientsGauge               prometheus.Gauge
	numUsersGauge                 prometheus.Gauge
	numSubsGauge                  prometheus.Gauge
	numChannelsGauge              prometheus.Gauge
	numNodesGauge                 prometheus.Gauge
	replyErrorCount               *prometheus.CounterVec
	connectionsInflight           *prometheus.GaugeVec
	subscriptionsInflight         *prometheus.GaugeVec
	serverUnsubscribeCount        *prometheus.CounterVec
	serverDisconnectCount         *prometheus.CounterVec
	commandDurationSummary        *prometheus.SummaryVec
	surveyDurationSummary         *prometheus.SummaryVec
	recoverCount                  *prometheus.CounterVec
	transportMessagesSent         *prometheus.CounterVec
	transportMessagesSentSize     *prometheus.CounterVec
	transportMessagesReceived     *prometheus.CounterVec
	transportMessagesReceivedSize *prometheus.CounterVec

	messagesReceivedCountPublication prometheus.Counter
	messagesReceivedCountJoin        prometheus.Counter
	messagesReceivedCountLeave       prometheus.Counter
	messagesReceivedCountControl     prometheus.Counter

	messagesSentCountPublication prometheus.Counter
	messagesSentCountJoin        prometheus.Counter
	messagesSentCountLeave       prometheus.Counter
	messagesSentCountControl     prometheus.Counter

	commandDurationConnect       prometheus.Observer
	commandDurationSubscribe     prometheus.Observer
	commandDurationUnsubscribe   prometheus.Observer
	commandDurationPublish       prometheus.Observer
	commandDurationPresence      prometheus.Observer
	commandDurationPresenceStats prometheus.Observer
	commandDurationHistory       prometheus.Observer
	commandDurationSend          prometheus.Observer
	commandDurationRPC           prometheus.Observer
	commandDurationRefresh       prometheus.Observer
	commandDurationSubRefresh    prometheus.Observer
	commandDurationUnknown       prometheus.Observer

	broadcastDurationHistogram *prometheus.HistogramVec
	pubSubLagHistogram         prometheus.Histogram
	pingPongDurationHistogram  *prometheus.HistogramVec

	redisBrokerPubSubErrors           *prometheus.CounterVec
	redisBrokerPubSubDroppedMessages  *prometheus.CounterVec
	redisBrokerPubSubBufferedMessages *prometheus.GaugeVec

	config MetricsConfig

	transportMessagesSentCache     sync.Map
	transportMessagesReceivedCache sync.Map
	commandDurationCache           sync.Map
	replyErrorCache                sync.Map
	actionCache                    sync.Map
	recoverCache                   sync.Map
	unsubscribeCache               sync.Map
	disconnectCache                sync.Map
	messagesSentCache              sync.Map
	messagesReceivedCache          sync.Map
	nsCache                        *otter.Cache[string, string]
	codeStrings                    map[uint32]string
}

func getMetricsNamespace(config MetricsConfig) string {
	if config.MetricsNamespace == "" {
		return defaultMetricsNamespace
	}
	return config.MetricsNamespace
}

func newMetricsRegistry(config MetricsConfig) (*metrics, error) {
	registryMu.Lock()
	defer registryMu.Unlock()

	metricsNamespace := getMetricsNamespace(config)

	var registerer prometheus.Registerer
	if config.RegistererGatherer != nil {
		registerer = config.RegistererGatherer
	} else {
		registerer = prometheus.DefaultRegisterer
	}

	var nsCache *otter.Cache[string, string]
	if config.GetChannelNamespaceLabel != nil {
		cacheSize := config.ChannelNamespaceCacheSize
		if cacheSize == 0 {
			cacheSize = 4096
		}
		cacheTTL := config.ChannelNamespaceCacheTTL
		if cacheTTL == 0 {
			cacheTTL = 15 * time.Second
		}
		if cacheTTL < 0 {
			return nil, errors.New("channel namespace cache TTL must be positive")
		}
		if cacheSize != -1 {
			c, _ := otter.MustBuilder[string, string](cacheSize).
				WithTTL(cacheTTL).
				Build()
			nsCache = &c
		}
	}

	codeStrings := make(map[uint32]string)
	for i := uint32(0); i <= 5000; i++ {
		codeStrings[i] = strconv.FormatUint(uint64(i), 10)
	}

	m := &metrics{
		config:      config,
		nsCache:     nsCache,
		codeStrings: codeStrings,
	}

	m.messagesSentCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "messages_sent_count",
		Help:      "Number of messages sent by node to broker.",
	}, []string{"type", "channel_namespace"})

	m.messagesReceivedCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "messages_received_count",
		Help:      "Number of messages received from broker.",
	}, []string{"type", "channel_namespace"})

	m.actionCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "action_count",
		Help:      "Number of various actions called.",
	}, []string{"action", "channel_namespace"})

	m.numClientsGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "num_clients",
		Help:      "Number of clients connected.",
	})

	m.numUsersGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "num_users",
		Help:      "Number of unique users connected.",
	})

	m.numSubsGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "num_subscriptions",
		Help:      "Number of subscriptions.",
	})

	m.numNodesGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "num_nodes",
		Help:      "Number of nodes in the cluster.",
	})

	m.buildInfoGauge = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "build",
		Help:      "Node build info.",
	}, []string{"version"})

	m.numChannelsGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "num_channels",
		Help:      "Number of channels with one or more subscribers.",
	})

	m.surveyDurationSummary = prometheus.NewSummaryVec(prometheus.SummaryOpts{
		Namespace:  metricsNamespace,
		Subsystem:  "node",
		Name:       "survey_duration_seconds",
		Objectives: map[float64]float64{0.5: 0.05, 0.99: 0.001, 0.999: 0.0001},
		Help:       "Survey duration summary.",
	}, []string{"op"})

	m.commandDurationSummary = prometheus.NewSummaryVec(prometheus.SummaryOpts{
		Namespace:  metricsNamespace,
		Subsystem:  "client",
		Name:       "command_duration_seconds",
		Objectives: map[float64]float64{0.5: 0.05, 0.99: 0.001, 0.999: 0.0001},
		Help:       "Client command duration summary.",
	}, []string{"method", "channel_namespace"})

	m.replyErrorCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "client",
		Name:      "num_reply_errors",
		Help:      "Number of errors in replies sent to clients.",
	}, []string{"method", "code", "channel_namespace"})

	m.serverUnsubscribeCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "client",
		Name:      "num_server_unsubscribes",
		Help:      "Number of server initiated unsubscribes.",
	}, []string{"code", "channel_namespace"})

	m.serverDisconnectCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "client",
		Name:      "num_server_disconnects",
		Help:      "Number of server initiated disconnects.",
	}, []string{"code"})

	m.recoverCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "client",
		Name:      "recover",
		Help:      "Count of recover operations.",
	}, []string{"recovered", "channel_namespace"})

	m.pingPongDurationHistogram = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: "client",
		Name:      "ping_pong_duration_seconds",
		Help:      "Ping/Pong duration in seconds",
		Buckets: []float64{
			0.000100, 0.000250, 0.000500, // Microsecond resolution.
			0.001, 0.005, 0.010, 0.025, 0.050, 0.100, 0.250, 0.500, // Millisecond resolution.
			1.0, 2.5, 5.0, 10.0, // Second resolution.
		}}, []string{"transport"})

	m.connectionsInflight = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "client",
		Name:      "connections_inflight",
		Help:      "Number of inflight client connections.",
	}, []string{"transport", "client_name", "client_version"})

	m.subscriptionsInflight = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "client",
		Name:      "subscriptions_inflight",
		Help:      "Number of inflight client subscriptions.",
	}, []string{"client_name", "channel_namespace"})

	m.transportMessagesSent = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "transport",
		Name:      "messages_sent",
		Help:      "Number of messages sent to client connections over specific transport.",
	}, []string{"transport", "frame_type", "channel_namespace"})

	m.transportMessagesSentSize = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "transport",
		Name:      "messages_sent_size",
		Help:      "MaxSize in bytes of messages sent to client connections over specific transport (uncompressed and does not include framing overhead).",
	}, []string{"transport", "frame_type", "channel_namespace"})

	m.transportMessagesReceived = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "transport",
		Name:      "messages_received",
		Help:      "Number of messages received from client connections over specific transport.",
	}, []string{"transport", "frame_type", "channel_namespace"})

	m.transportMessagesReceivedSize = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "transport",
		Name:      "messages_received_size",
		Help:      "MaxSize in bytes of messages received from client connections over specific transport (uncompressed and does not include framing overhead).",
	}, []string{"transport", "frame_type", "channel_namespace"})

	m.pubSubLagHistogram = prometheus.NewHistogram(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "pub_sub_lag_seconds",
		Help:      "Pub sub lag in seconds",
		Buckets:   []float64{0.001, 0.005, 0.010, 0.025, 0.050, 0.100, 0.200, 0.500, 1.000, 2.000, 5.000, 10.000},
	})

	m.broadcastDurationHistogram = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "broadcast_duration_seconds",
		Help:      "Broadcast duration in seconds",
		Buckets: []float64{
			0.000001, 0.000005, 0.000010, 0.000050, 0.000100, 0.000250, 0.000500, // Microsecond resolution.
			0.001, 0.005, 0.010, 0.025, 0.050, 0.100, 0.250, 0.500, // Millisecond resolution.
			1.0, 2.5, 5.0, 10.0, // Second resolution.
		}}, []string{"type", "channel_namespace"})

	m.redisBrokerPubSubErrors = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "broker",
		Name:      "redis_pub_sub_errors",
		Help:      "Number of times there was an error in Redis PUB/SUB connection.",
	}, []string{"broker_name", "error"})

	m.redisBrokerPubSubDroppedMessages = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "broker",
		Name:      "redis_pub_sub_dropped_messages",
		Help:      "Number of dropped messages on application level in Redis PUB/SUB.",
	}, []string{"broker_name", "channel_type"})

	m.redisBrokerPubSubBufferedMessages = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "broker",
		Name:      "redis_pub_sub_buffered_messages",
		Help:      "Number of messages buffered in Redis PUB/SUB.",
	}, []string{"broker_name", "channel_type", "pub_sub_processor"})

	m.redisBrokerPubSubDroppedMessages.WithLabelValues("", "control").Add(0)
	m.redisBrokerPubSubDroppedMessages.WithLabelValues("", "client").Add(0)

	m.messagesReceivedCountPublication = m.messagesReceivedCount.WithLabelValues("publication", "")
	m.messagesReceivedCountJoin = m.messagesReceivedCount.WithLabelValues("join", "")
	m.messagesReceivedCountLeave = m.messagesReceivedCount.WithLabelValues("leave", "")
	m.messagesReceivedCountControl = m.messagesReceivedCount.WithLabelValues("control", "")

	m.messagesSentCountPublication = m.messagesSentCount.WithLabelValues("publication", "")
	m.messagesSentCountJoin = m.messagesSentCount.WithLabelValues("join", "")
	m.messagesSentCountLeave = m.messagesSentCount.WithLabelValues("leave", "")
	m.messagesSentCountControl = m.messagesSentCount.WithLabelValues("control", "")

	labelForMethod := func(frameType protocol.FrameType) string {
		return frameType.String()
	}

	m.commandDurationConnect = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypeConnect), "")
	m.commandDurationSubscribe = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypeSubscribe), "")
	m.commandDurationUnsubscribe = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypeUnsubscribe), "")
	m.commandDurationPublish = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypePublish), "")
	m.commandDurationPresence = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypePresence), "")
	m.commandDurationPresenceStats = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypePresenceStats), "")
	m.commandDurationHistory = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypeHistory), "")
	m.commandDurationSend = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypeSend), "")
	m.commandDurationRPC = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypeRPC), "")
	m.commandDurationRefresh = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypeRefresh), "")
	m.commandDurationSubRefresh = m.commandDurationSummary.WithLabelValues(labelForMethod(protocol.FrameTypeSubRefresh), "")
	m.commandDurationUnknown = m.commandDurationSummary.WithLabelValues("unknown", "")

	var alreadyRegistered prometheus.AlreadyRegisteredError

	for _, collector := range []prometheus.Collector{
		m.messagesSentCount,
		m.messagesReceivedCount,
		m.actionCount,
		m.numClientsGauge,
		m.numUsersGauge,
		m.numSubsGauge,
		m.numChannelsGauge,
		m.numNodesGauge,
		m.commandDurationSummary,
		m.replyErrorCount,
		m.connectionsInflight,
		m.subscriptionsInflight,
		m.serverUnsubscribeCount,
		m.serverDisconnectCount,
		m.recoverCount,
		m.pingPongDurationHistogram,
		m.transportMessagesSent,
		m.transportMessagesSentSize,
		m.transportMessagesReceived,
		m.transportMessagesReceivedSize,
		m.buildInfoGauge,
		m.surveyDurationSummary,
		m.pubSubLagHistogram,
		m.broadcastDurationHistogram,
		m.redisBrokerPubSubErrors,
		m.redisBrokerPubSubDroppedMessages,
		m.redisBrokerPubSubBufferedMessages,
	} {
		if err := registerer.Register(collector); err != nil && !errors.As(err, &alreadyRegistered) {
			return nil, err
		}
	}
	return m, nil
}

func (m *metrics) incRedisBrokerPubSubErrors(name string, error string) {
	m.redisBrokerPubSubErrors.WithLabelValues(name, error).Inc()
}

func (m *metrics) getChannelNamespaceLabel(ch string) string {
	if ch == "" {
		return ""
	}
	nsLabel := ""
	if m.config.GetChannelNamespaceLabel == nil {
		return nsLabel
	}
	if m.nsCache == nil {
		return m.config.GetChannelNamespaceLabel(ch)
	}
	var cached bool
	if nsLabel, cached = m.nsCache.Get(ch); cached {
		return nsLabel
	}
	nsLabel = m.config.GetChannelNamespaceLabel(ch)
	m.nsCache.Set(ch, nsLabel)
	return nsLabel
}

type commandDurationLabels struct {
	ChannelNamespace string
	FrameType        protocol.FrameType
}

func (m *metrics) observeCommandDuration(frameType protocol.FrameType, d time.Duration, ch string) {
	if ch != "" && m.config.GetChannelNamespaceLabel != nil {
		channelNamespace := m.getChannelNamespaceLabel(ch)
		labels := commandDurationLabels{
			ChannelNamespace: channelNamespace,
			FrameType:        frameType,
		}
		summary, ok := m.commandDurationCache.Load(labels)
		if !ok {
			summary = m.commandDurationSummary.WithLabelValues(frameType.String(), channelNamespace)
			m.commandDurationCache.Store(labels, summary)
		}
		summary.(prometheus.Observer).Observe(d.Seconds())
		return
	}

	var observer prometheus.Observer

	switch frameType {
	case protocol.FrameTypeConnect:
		observer = m.commandDurationConnect
	case protocol.FrameTypeSubscribe:
		observer = m.commandDurationSubscribe
	case protocol.FrameTypeUnsubscribe:
		observer = m.commandDurationUnsubscribe
	case protocol.FrameTypePublish:
		observer = m.commandDurationPublish
	case protocol.FrameTypePresence:
		observer = m.commandDurationPresence
	case protocol.FrameTypePresenceStats:
		observer = m.commandDurationPresenceStats
	case protocol.FrameTypeHistory:
		observer = m.commandDurationHistory
	case protocol.FrameTypeSend:
		observer = m.commandDurationSend
	case protocol.FrameTypeRPC:
		observer = m.commandDurationRPC
	case protocol.FrameTypeRefresh:
		observer = m.commandDurationRefresh
	case protocol.FrameTypeSubRefresh:
		observer = m.commandDurationSubRefresh
	default:
		observer = m.commandDurationUnknown
	}
	observer.Observe(d.Seconds())
}

func (m *metrics) observePubSubDeliveryLag(lagTimeMilli int64) {
	if lagTimeMilli < 0 {
		lagTimeMilli = -lagTimeMilli
	}
	m.pubSubLagHistogram.Observe(float64(lagTimeMilli) / 1000)
}

func (m *metrics) observeBroadcastDuration(started time.Time, ch string) {
	if m.config.GetChannelNamespaceLabel != nil {
		m.broadcastDurationHistogram.WithLabelValues("publication", m.getChannelNamespaceLabel(ch)).Observe(time.Since(started).Seconds())
		return
	}
	m.broadcastDurationHistogram.WithLabelValues("publication", m.getChannelNamespaceLabel(ch)).Observe(time.Since(started).Seconds())
}

func (m *metrics) observePingPongDuration(duration time.Duration, transport string) {
	m.pingPongDurationHistogram.WithLabelValues(transport).Observe(duration.Seconds())
}

func (m *metrics) setBuildInfo(version string) {
	m.buildInfoGauge.WithLabelValues(version).Set(1)
}

func (m *metrics) setNumClients(n float64) {
	m.numClientsGauge.Set(n)
}

func (m *metrics) setNumUsers(n float64) {
	m.numUsersGauge.Set(n)
}

func (m *metrics) setNumSubscriptions(n float64) {
	m.numSubsGauge.Set(n)
}

func (m *metrics) setNumChannels(n float64) {
	m.numChannelsGauge.Set(n)
}

func (m *metrics) setNumNodes(n float64) {
	m.numNodesGauge.Set(n)
}

type replyErrorLabels struct {
	FrameType        protocol.FrameType
	ChannelNamespace string
	Code             string
}

func (m *metrics) incReplyError(frameType protocol.FrameType, code uint32, ch string) {
	channelNamespace := m.getChannelNamespaceLabel(ch)
	labels := replyErrorLabels{
		ChannelNamespace: channelNamespace,
		FrameType:        frameType,
		Code:             m.getCodeLabel(code),
	}
	counter, ok := m.replyErrorCache.Load(labels)
	if !ok {
		counter = m.replyErrorCount.WithLabelValues(frameType.String(), labels.Code, channelNamespace)
		m.replyErrorCache.Store(labels, counter)
	}
	counter.(prometheus.Counter).Inc()
}

type recoverLabels struct {
	ChannelNamespace string
	Success          string
}

func (m *metrics) incRecover(success bool, ch string) {
	var successStr string
	if success {
		successStr = "yes"
	} else {
		successStr = "no"
	}
	channelNamespace := m.getChannelNamespaceLabel(ch)
	labels := recoverLabels{
		ChannelNamespace: channelNamespace,
		Success:          successStr,
	}
	counter, ok := m.recoverCache.Load(labels)
	if !ok {
		counter = m.recoverCount.WithLabelValues(successStr, channelNamespace)
		m.recoverCache.Store(labels, counter)
	}
	counter.(prometheus.Counter).Inc()
}

type transportMessageLabels struct {
	Transport        string
	ChannelNamespace string
	FrameType        string
}

type transportMessagesSent struct {
	counterSent     prometheus.Counter
	counterSentSize prometheus.Counter
}

type transportMessagesReceived struct {
	counterReceived     prometheus.Counter
	counterReceivedSize prometheus.Counter
}

func (m *metrics) incTransportMessagesSent(transport string, frameType protocol.FrameType, channel string, size int) {
	channelNamespace := m.getChannelNamespaceLabel(channel)
	labels := transportMessageLabels{
		Transport:        transport,
		ChannelNamespace: channelNamespace,
		FrameType:        frameType.String(),
	}
	counters, ok := m.transportMessagesSentCache.Load(labels)
	if !ok {
		counterSent := m.transportMessagesSent.WithLabelValues(transport, labels.FrameType, channelNamespace)
		counterSentSize := m.transportMessagesSentSize.WithLabelValues(transport, labels.FrameType, channelNamespace)
		counters = transportMessagesSent{
			counterSent:     counterSent,
			counterSentSize: counterSentSize,
		}
		m.transportMessagesSentCache.Store(labels, counters)
	}
	counters.(transportMessagesSent).counterSent.Inc()
	counters.(transportMessagesSent).counterSentSize.Add(float64(size))
}

func (m *metrics) incTransportMessagesReceived(transport string, frameType protocol.FrameType, channel string, size int) {
	channelNamespace := m.getChannelNamespaceLabel(channel)
	labels := transportMessageLabels{
		Transport:        transport,
		ChannelNamespace: channelNamespace,
		FrameType:        frameType.String(),
	}
	counters, ok := m.transportMessagesReceivedCache.Load(labels)
	if !ok {
		counterReceived := m.transportMessagesReceived.WithLabelValues(transport, labels.FrameType, channelNamespace)
		counterReceivedSize := m.transportMessagesReceivedSize.WithLabelValues(transport, labels.FrameType, channelNamespace)
		counters = transportMessagesReceived{
			counterReceived:     counterReceived,
			counterReceivedSize: counterReceivedSize,
		}
		m.transportMessagesReceivedCache.Store(labels, counters)
	}
	counters.(transportMessagesReceived).counterReceived.Inc()
	counters.(transportMessagesReceived).counterReceivedSize.Add(float64(size))
}

func (m *metrics) getCodeLabel(code uint32) string {
	codeStr, ok := m.codeStrings[code]
	if !ok {
		return strconv.FormatUint(uint64(code), 10)
	}
	return codeStr
}

type disconnectLabels struct {
	Code string
}

func (m *metrics) incServerDisconnect(code uint32) {
	labels := disconnectLabels{
		Code: m.getCodeLabel(code),
	}
	counter, ok := m.disconnectCache.Load(labels)
	if !ok {
		counter = m.serverDisconnectCount.WithLabelValues(labels.Code)
		m.disconnectCache.Store(labels, counter)
	}
	counter.(prometheus.Counter).Inc()
}

type unsubscribeLabels struct {
	Code             string
	ChannelNamespace string
}

func (m *metrics) incServerUnsubscribe(code uint32, ch string) {
	labels := unsubscribeLabels{
		Code:             m.getCodeLabel(code),
		ChannelNamespace: m.getChannelNamespaceLabel(ch),
	}
	counter, ok := m.unsubscribeCache.Load(labels)
	if !ok {
		counter = m.serverUnsubscribeCount.WithLabelValues(labels.Code, labels.ChannelNamespace)
		m.unsubscribeCache.Store(labels, counter)
	}
	counter.(prometheus.Counter).Inc()
}

type messageSentLabels struct {
	MsgType          string
	ChannelNamespace string
}

func (m *metrics) incMessagesSent(msgType string, ch string) {
	if m.config.GetChannelNamespaceLabel != nil {
		labels := messageSentLabels{
			MsgType:          msgType,
			ChannelNamespace: m.getChannelNamespaceLabel(ch),
		}
		counter, ok := m.messagesSentCache.Load(labels)
		if !ok {
			counter = m.messagesSentCount.WithLabelValues(msgType, labels.ChannelNamespace)
			m.messagesSentCache.Store(labels, counter)
		}
		counter.(prometheus.Counter).Inc()
		return
	}
	switch msgType {
	case "publication":
		m.messagesSentCountPublication.Inc()
	case "join":
		m.messagesSentCountJoin.Inc()
	case "leave":
		m.messagesSentCountLeave.Inc()
	case "control":
		m.messagesSentCountControl.Inc()
	default:
		m.messagesSentCount.WithLabelValues(msgType, "").Inc()
	}
}

type messageReceivedLabels struct {
	MsgType          string
	ChannelNamespace string
}

func (m *metrics) incMessagesReceived(msgType string, ch string) {
	if m.config.GetChannelNamespaceLabel != nil {
		labels := messageReceivedLabels{
			MsgType:          msgType,
			ChannelNamespace: m.getChannelNamespaceLabel(ch),
		}
		counter, ok := m.messagesReceivedCache.Load(labels)
		if !ok {
			counter = m.messagesReceivedCount.WithLabelValues(msgType, labels.ChannelNamespace)
			m.messagesReceivedCache.Store(labels, counter)
		}
		counter.(prometheus.Counter).Inc()
		return
	}
	switch msgType {
	case "publication":
		m.messagesReceivedCountPublication.Inc()
	case "join":
		m.messagesReceivedCountJoin.Inc()
	case "leave":
		m.messagesReceivedCountLeave.Inc()
	case "control":
		m.messagesReceivedCountControl.Inc()
	default:
		m.messagesReceivedCount.WithLabelValues(msgType, "").Inc()
	}
}

type actionLabels struct {
	Action           string
	ChannelNamespace string
}

func (m *metrics) incActionCount(action string, ch string) {
	channelNamespace := m.getChannelNamespaceLabel(ch)
	labels := actionLabels{
		ChannelNamespace: channelNamespace,
		Action:           action,
	}
	counter, ok := m.actionCache.Load(labels)
	if !ok {
		counter = m.actionCount.WithLabelValues(action, channelNamespace)
		m.actionCache.Store(labels, counter)
	}
	counter.(prometheus.Counter).Inc()
}

func (m *metrics) observeSurveyDuration(op string, d time.Duration) {
	m.surveyDurationSummary.WithLabelValues(op).Observe(d.Seconds())
}
