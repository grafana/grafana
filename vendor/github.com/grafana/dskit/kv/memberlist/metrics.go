package memberlist

import (
	"time"

	"github.com/go-kit/log/level"
	"github.com/hashicorp/go-metrics"
	metricsprometheus "github.com/hashicorp/go-metrics/prometheus"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/dskit/services"
)

func (m *KV) createAndRegisterMetrics() {
	const subsystem = "memberlist_client"

	m.numberOfReceivedMessages = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "received_broadcasts_total",
		Help:      "Number of received broadcast user messages",
	})

	m.totalSizeOfReceivedMessages = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "received_broadcasts_bytes_total",
		Help:      "Total size of received broadcast user messages",
	})

	m.numberOfInvalidReceivedMessages = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "received_broadcasts_invalid_total",
		Help:      "Number of received broadcast user messages that were invalid. Hopefully 0.",
	})

	m.numberOfDroppedMessages = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "received_broadcasts_dropped_total",
		Help:      "Number of received broadcast user messages that were dropped. Hopefully 0.",
	})

	m.numberOfPushes = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "state_pushes_total",
		Help:      "How many times did this node push its full state to another node",
	})

	m.totalSizeOfPushes = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "state_pushes_bytes_total",
		Help:      "Total size of pushed state",
	})

	m.numberOfPulls = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "state_pulls_total",
		Help:      "How many times did this node pull full state from another node",
	})

	m.totalSizeOfPulls = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "state_pulls_bytes_total",
		Help:      "Total size of pulled state",
	})

	const queueMetricName = "messages_in_broadcast_queue"
	const queueMetricHelp = "Number of user messages in the broadcast queue"

	m.numberOfGossipMessagesInQueue = promauto.With(m.registerer).NewGaugeFunc(prometheus.GaugeOpts{
		Namespace:   m.cfg.MetricsNamespace,
		Subsystem:   subsystem,
		Name:        queueMetricName,
		Help:        queueMetricHelp,
		ConstLabels: map[string]string{"queue": "gossip"},
	}, func() float64 {
		// Queues are not set before Starting state
		if m.State() == services.Running || m.State() == services.Stopping {
			return float64(m.gossipBroadcasts.NumQueued())
		}
		return 0
	})

	m.numberOfLocalMessagesInQueue = promauto.With(m.registerer).NewGaugeFunc(prometheus.GaugeOpts{
		Namespace:   m.cfg.MetricsNamespace,
		Subsystem:   subsystem,
		Name:        queueMetricName,
		Help:        queueMetricHelp,
		ConstLabels: map[string]string{"queue": "local"},
	}, func() float64 {
		// Queues are not set before Starting state
		if m.State() == services.Running || m.State() == services.Stopping {
			return float64(m.localBroadcasts.NumQueued())
		}
		return 0
	})

	m.totalSizeOfBroadcastMessagesInQueue = promauto.With(m.registerer).NewGauge(prometheus.GaugeOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "messages_in_broadcast_queue_bytes",
		Help:      "Total size of messages waiting in the broadcast queue",
	})

	m.numberOfBroadcastMessagesDropped = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "messages_to_broadcast_dropped_total",
		Help:      "Number of broadcast messages intended to be sent but were dropped due to encoding errors or for being too big",
	})

	m.casAttempts = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "cas_attempt_total",
		Help:      "Attempted CAS operations",
	})

	m.casSuccesses = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "cas_success_total",
		Help:      "Successful CAS operations",
	})

	m.casFailures = promauto.With(m.registerer).NewCounter(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "cas_failure_total",
		Help:      "Failed CAS operations",
	})

	m.storeValuesDesc = prometheus.NewDesc(
		prometheus.BuildFQName(m.cfg.MetricsNamespace, subsystem, "kv_store_count"), // gauge
		"Number of values in KV Store",
		nil, nil)

	m.storeTombstones = promauto.With(m.registerer).NewGaugeVec(prometheus.GaugeOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "kv_store_value_tombstones",
		Help:      "Number of tombstones currently present in KV store values",
	}, []string{"key"})

	m.storeRemovedTombstones = promauto.With(m.registerer).NewCounterVec(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "kv_store_value_tombstones_removed_total",
		Help:      "Total number of tombstones which have been removed from KV store values",
	}, []string{"key"})

	m.memberlistMembersCount = promauto.With(m.registerer).NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "cluster_members_count",
		Help:      "Number of members in memberlist cluster",
	}, func() float64 {
		// m.memberlist is not set before Starting state
		if m.State() == services.Running || m.State() == services.Stopping {
			return float64(m.memberlist.NumMembers())
		}
		return 0
	})

	m.memberlistHealthScore = promauto.With(m.registerer).NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "cluster_node_health_score",
		Help:      "Health score of this cluster. Lower value is better. 0 = healthy",
	}, func() float64 {
		// m.memberlist is not set before Starting state
		if m.State() == services.Running || m.State() == services.Stopping {
			return float64(m.memberlist.GetHealthScore())
		}
		return 0
	})

	m.watchPrefixDroppedNotifications = promauto.With(m.registerer).NewCounterVec(prometheus.CounterOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "watch_prefix_dropped_notifications",
		Help:      "Number of dropped notifications in WatchPrefix function",
	}, []string{"prefix"})

	m.numberOfKeyNotifications = promauto.With(m.registerer).NewGauge(prometheus.GaugeOpts{
		Namespace: m.cfg.MetricsNamespace,
		Subsystem: subsystem,
		Name:      "pending_key_notifications",
		Help:      "Number of pending notifications in WatchPrefix function",
	})

	if m.registerer == nil {
		return
	}

	m.registerer.MustRegister(m)

	// memberlist uses hashicorp/go-metrics module for internal usage
	// here we configure go-metrics to use prometheus.
	opts := metricsprometheus.PrometheusOpts{
		Expiration: 0, // Don't expire metrics.
		Registerer: m.registerer,
	}
	sink, err := metricsprometheus.NewPrometheusSinkFrom(opts)
	if err == nil {
		cfg := metrics.DefaultConfig("")
		cfg.EnableHostname = false         // no need to put hostname into metric
		cfg.EnableHostnameLabel = false    // no need to put hostname into labels
		cfg.EnableServiceLabel = false     // Don't put service name into a label. (We don't set service name anyway).
		cfg.EnableRuntimeMetrics = false   // metrics about Go runtime already provided by prometheus
		cfg.EnableTypePrefix = true        // to make better sense of internal memberlist metrics
		cfg.TimerGranularity = time.Second // timers are in seconds in prometheus world

		_, err = metrics.NewGlobal(cfg, sink)
	}

	if err != nil {
		level.Error(m.logger).Log("msg", "failed to register prometheus metrics for memberlist", "err", err)
	}
}

// Describe returns prometheus descriptions via supplied channel
func (m *KV) Describe(ch chan<- *prometheus.Desc) {
	ch <- m.storeValuesDesc
}

// Collect returns extra metrics via supplied channel
func (m *KV) Collect(ch chan<- prometheus.Metric) {
	m.storeMu.Lock()
	defer m.storeMu.Unlock()

	ch <- prometheus.MustNewConstMetric(m.storeValuesDesc, prometheus.GaugeValue, float64(len(m.store)))
}
