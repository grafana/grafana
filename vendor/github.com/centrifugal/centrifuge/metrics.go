package centrifuge

import (
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/centrifugal/protocol"

	"github.com/prometheus/client_golang/prometheus"
)

// default namespace for prometheus metrics. Can be changed over Config.
var defaultMetricsNamespace = "centrifuge"

var registryMu sync.RWMutex

var (
	messagesSentCount      *prometheus.CounterVec
	messagesReceivedCount  *prometheus.CounterVec
	actionCount            *prometheus.CounterVec
	buildInfoGauge         *prometheus.GaugeVec
	numClientsGauge        prometheus.Gauge
	numUsersGauge          prometheus.Gauge
	numChannelsGauge       prometheus.Gauge
	numNodesGauge          prometheus.Gauge
	replyErrorCount        *prometheus.CounterVec
	serverDisconnectCount  *prometheus.CounterVec
	commandDurationSummary *prometheus.SummaryVec
	recoverCount           *prometheus.CounterVec
	transportConnectCount  *prometheus.CounterVec
	transportMessagesSent  *prometheus.CounterVec

	messagesReceivedCountPublication prometheus.Counter
	messagesReceivedCountJoin        prometheus.Counter
	messagesReceivedCountLeave       prometheus.Counter
	messagesReceivedCountControl     prometheus.Counter

	messagesSentCountPublication prometheus.Counter
	messagesSentCountJoin        prometheus.Counter
	messagesSentCountLeave       prometheus.Counter
	messagesSentCountControl     prometheus.Counter

	actionCountAddClient        prometheus.Counter
	actionCountRemoveClient     prometheus.Counter
	actionCountAddSub           prometheus.Counter
	actionCountRemoveSub        prometheus.Counter
	actionCountAddPresence      prometheus.Counter
	actionCountRemovePresence   prometheus.Counter
	actionCountPresence         prometheus.Counter
	actionCountPresenceStats    prometheus.Counter
	actionCountHistoryFull      prometheus.Counter
	actionCountHistoryRecover   prometheus.Counter
	actionCountHistoryStreamTop prometheus.Counter
	actionCountHistoryRemove    prometheus.Counter

	recoverCountYes prometheus.Counter
	recoverCountNo  prometheus.Counter

	transportConnectCountWebsocket prometheus.Counter
	transportConnectCountSockJS    prometheus.Counter

	transportMessagesSentWebsocket prometheus.Counter
	transportMessagesSentSockJS    prometheus.Counter

	commandDurationConnect       prometheus.Observer
	commandDurationSubscribe     prometheus.Observer
	commandDurationUnsubscribe   prometheus.Observer
	commandDurationPublish       prometheus.Observer
	commandDurationPresence      prometheus.Observer
	commandDurationPresenceStats prometheus.Observer
	commandDurationHistory       prometheus.Observer
	commandDurationPing          prometheus.Observer
	commandDurationSend          prometheus.Observer
	commandDurationRPC           prometheus.Observer
	commandDurationRefresh       prometheus.Observer
	commandDurationSubRefresh    prometheus.Observer
	commandDurationUnknown       prometheus.Observer
)

func observeCommandDuration(method protocol.MethodType, d time.Duration) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	var observer prometheus.Observer

	switch method {
	case protocol.MethodTypeConnect:
		observer = commandDurationConnect
	case protocol.MethodTypeSubscribe:
		observer = commandDurationSubscribe
	case protocol.MethodTypeUnsubscribe:
		observer = commandDurationUnsubscribe
	case protocol.MethodTypePublish:
		observer = commandDurationPublish
	case protocol.MethodTypePresence:
		observer = commandDurationPresence
	case protocol.MethodTypePresenceStats:
		observer = commandDurationPresenceStats
	case protocol.MethodTypeHistory:
		observer = commandDurationHistory
	case protocol.MethodTypePing:
		observer = commandDurationPing
	case protocol.MethodTypeSend:
		observer = commandDurationSend
	case protocol.MethodTypeRPC:
		observer = commandDurationRPC
	case protocol.MethodTypeRefresh:
		observer = commandDurationRefresh
	case protocol.MethodTypeSubRefresh:
		observer = commandDurationSubRefresh
	default:
		observer = commandDurationUnknown
	}
	observer.Observe(d.Seconds())
}

func setBuildInfo(version string) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	buildInfoGauge.WithLabelValues(version).Set(1)
}

func setNumClients(n float64) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	numClientsGauge.Set(n)
}

func setNumUsers(n float64) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	numUsersGauge.Set(n)
}

func setNumChannels(n float64) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	numChannelsGauge.Set(n)
}

func setNumNodes(n float64) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	numNodesGauge.Set(n)
}

func incReplyError(method protocol.MethodType, code uint32) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	replyErrorCount.WithLabelValues(strings.ToLower(protocol.MethodType_name[int32(method)]), strconv.FormatUint(uint64(code), 10)).Inc()
}

func incRecover(success bool) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	if success {
		recoverCountYes.Inc()
	} else {
		recoverCountNo.Inc()
	}
}

func incTransportConnect(transport string) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	switch transport {
	case transportWebsocket:
		transportConnectCountWebsocket.Inc()
	case transportSockJS:
		transportConnectCountSockJS.Inc()
	default:
		transportConnectCount.WithLabelValues(transport).Inc()
	}
}

func incTransportMessagesSent(transport string) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	switch transport {
	case transportWebsocket:
		transportMessagesSentWebsocket.Inc()
	case transportSockJS:
		transportMessagesSentSockJS.Inc()
	default:
		transportMessagesSent.WithLabelValues(transport).Inc()
	}
}

func addTransportMessagesSent(transport string, n float64) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	switch transport {
	case transportWebsocket:
		transportMessagesSentWebsocket.Add(n)
	case transportSockJS:
		transportMessagesSentSockJS.Add(n)
	default:
		transportMessagesSent.WithLabelValues(transport).Add(n)
	}
}

func incServerDisconnect(code uint32) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	serverDisconnectCount.WithLabelValues(strconv.FormatUint(uint64(code), 10)).Inc()
}

func incMessagesSent(msgType string) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	switch msgType {
	case "publication":
		messagesSentCountPublication.Inc()
	case "join":
		messagesSentCountJoin.Inc()
	case "leave":
		messagesSentCountLeave.Inc()
	case "control":
		messagesSentCountControl.Inc()
	default:
		messagesSentCount.WithLabelValues(msgType).Inc()
	}
}

func incMessagesReceived(msgType string) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	switch msgType {
	case "publication":
		messagesReceivedCountPublication.Inc()
	case "join":
		messagesReceivedCountJoin.Inc()
	case "leave":
		messagesReceivedCountLeave.Inc()
	case "control":
		messagesReceivedCountControl.Inc()
	default:
		messagesReceivedCount.WithLabelValues(msgType).Inc()
	}
}

func incActionCount(action string) {
	registryMu.RLock()
	defer registryMu.RUnlock()

	switch action {
	case "add_client":
		actionCountAddClient.Inc()
	case "remove_client":
		actionCountRemoveClient.Inc()
	case "add_subscription":
		actionCountAddSub.Inc()
	case "remove_subscription":
		actionCountRemoveSub.Inc()
	case "add_presence":
		actionCountAddPresence.Inc()
	case "remove_presence":
		actionCountRemovePresence.Inc()
	case "presence":
		actionCountPresence.Inc()
	case "presence_stats":
		actionCountPresenceStats.Inc()
	case "history_full":
		actionCountHistoryFull.Inc()
	case "history_recover":
		actionCountHistoryRecover.Inc()
	case "history_stream_top":
		actionCountHistoryStreamTop.Inc()
	case "history_remove":
		actionCountHistoryRemove.Inc()
	}
}

func initMetricsRegistry(registry prometheus.Registerer, metricsNamespace string) error {
	registryMu.Lock()
	defer registryMu.Unlock()

	if metricsNamespace == "" {
		metricsNamespace = defaultMetricsNamespace
	}
	if registry == nil {
		registry = prometheus.DefaultRegisterer
	}

	messagesSentCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "messages_sent_count",
		Help:      "Number of messages sent.",
	}, []string{"type"})

	messagesReceivedCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "messages_received_count",
		Help:      "Number of messages received.",
	}, []string{"type"})

	actionCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "action_count",
		Help:      "Number of node actions called.",
	}, []string{"action"})

	numClientsGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "num_clients",
		Help:      "Number of clients connected.",
	})

	numUsersGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "num_users",
		Help:      "Number of unique users connected.",
	})

	numNodesGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "num_nodes",
		Help:      "Number of nodes in cluster.",
	})

	buildInfoGauge = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "build",
		Help:      "Node build info.",
	}, []string{"version"})

	numChannelsGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace: metricsNamespace,
		Subsystem: "node",
		Name:      "num_channels",
		Help:      "Number of channels with one or more subscribers.",
	})

	replyErrorCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "client",
		Name:      "num_reply_errors",
		Help:      "Number of errors in replies sent to clients.",
	}, []string{"method", "code"})

	serverDisconnectCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "client",
		Name:      "num_server_disconnects",
		Help:      "Number of server initiated disconnects.",
	}, []string{"code"})

	commandDurationSummary = prometheus.NewSummaryVec(prometheus.SummaryOpts{
		Namespace:  metricsNamespace,
		Subsystem:  "client",
		Name:       "command_duration_seconds",
		Objectives: map[float64]float64{0.5: 0.05, 0.99: 0.001, 0.999: 0.0001},
		Help:       "Client command duration summary.",
	}, []string{"method"})

	recoverCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "client",
		Name:      "recover",
		Help:      "Count of recover operations.",
	}, []string{"recovered"})

	transportConnectCount = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "transport",
		Name:      "connect_count",
		Help:      "Number of connections to specific transport.",
	}, []string{"transport"})

	transportMessagesSent = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: "transport",
		Name:      "messages_sent",
		Help:      "Number of messages sent over specific transport.",
	}, []string{"transport"})

	messagesReceivedCountPublication = messagesReceivedCount.WithLabelValues("publication")
	messagesReceivedCountJoin = messagesReceivedCount.WithLabelValues("join")
	messagesReceivedCountLeave = messagesReceivedCount.WithLabelValues("leave")
	messagesReceivedCountControl = messagesReceivedCount.WithLabelValues("control")

	messagesSentCountPublication = messagesSentCount.WithLabelValues("publication")
	messagesSentCountJoin = messagesSentCount.WithLabelValues("join")
	messagesSentCountLeave = messagesSentCount.WithLabelValues("leave")
	messagesSentCountControl = messagesSentCount.WithLabelValues("control")

	actionCountAddClient = actionCount.WithLabelValues("add_client")
	actionCountRemoveClient = actionCount.WithLabelValues("remove_client")
	actionCountAddSub = actionCount.WithLabelValues("add_subscription")
	actionCountRemoveSub = actionCount.WithLabelValues("remove_subscription")
	actionCountAddPresence = actionCount.WithLabelValues("add_presence")
	actionCountRemovePresence = actionCount.WithLabelValues("remove_presence")
	actionCountPresence = actionCount.WithLabelValues("presence")
	actionCountPresenceStats = actionCount.WithLabelValues("presence_stats")
	actionCountHistoryFull = actionCount.WithLabelValues("history_full")
	actionCountHistoryRecover = actionCount.WithLabelValues("history_recover")
	actionCountHistoryStreamTop = actionCount.WithLabelValues("history_stream_top")
	actionCountHistoryRemove = actionCount.WithLabelValues("history_remove")

	recoverCountYes = recoverCount.WithLabelValues("yes")
	recoverCountNo = recoverCount.WithLabelValues("no")

	transportConnectCountWebsocket = transportConnectCount.WithLabelValues(transportWebsocket)
	transportConnectCountSockJS = transportConnectCount.WithLabelValues(transportSockJS)

	transportMessagesSentWebsocket = transportMessagesSent.WithLabelValues(transportWebsocket)
	transportMessagesSentSockJS = transportMessagesSent.WithLabelValues(transportSockJS)

	labelForMethod := func(methodType protocol.MethodType) string {
		return strings.ToLower(protocol.MethodType_name[int32(methodType)])
	}

	commandDurationConnect = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypeConnect))
	commandDurationSubscribe = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypeSubscribe))
	commandDurationUnsubscribe = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypeUnsubscribe))
	commandDurationPublish = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypePublish))
	commandDurationPresence = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypePresence))
	commandDurationPresenceStats = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypePresenceStats))
	commandDurationHistory = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypeHistory))
	commandDurationPing = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypePing))
	commandDurationSend = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypeSend))
	commandDurationRPC = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypeRPC))
	commandDurationRefresh = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypeRefresh))
	commandDurationSubRefresh = commandDurationSummary.WithLabelValues(labelForMethod(protocol.MethodTypeSubRefresh))
	commandDurationUnknown = commandDurationSummary.WithLabelValues("unknown")

	if err := registry.Register(messagesSentCount); err != nil {
		return err
	}
	if err := registry.Register(messagesReceivedCount); err != nil {
		return err
	}
	if err := registry.Register(actionCount); err != nil {
		return err
	}
	if err := registry.Register(numClientsGauge); err != nil {
		return err
	}
	if err := registry.Register(numUsersGauge); err != nil {
		return err
	}
	if err := registry.Register(numChannelsGauge); err != nil {
		return err
	}
	if err := registry.Register(numNodesGauge); err != nil {
		return err
	}
	if err := registry.Register(commandDurationSummary); err != nil {
		return err
	}
	if err := registry.Register(replyErrorCount); err != nil {
		return err
	}
	if err := registry.Register(serverDisconnectCount); err != nil {
		return err
	}
	if err := registry.Register(recoverCount); err != nil {
		return err
	}
	if err := registry.Register(transportConnectCount); err != nil {
		return err
	}
	if err := registry.Register(transportMessagesSent); err != nil {
		return err
	}
	if err := registry.Register(buildInfoGauge); err != nil {
		return err
	}

	return nil
}
