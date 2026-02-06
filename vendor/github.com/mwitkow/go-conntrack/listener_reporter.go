// Copyright 2016 Michal Witkowski. All Rights Reserved.
// See LICENSE for licensing terms.

package conntrack

import prom "github.com/prometheus/client_golang/prometheus"

var (
	listenerAcceptedTotal = prom.NewCounterVec(
		prom.CounterOpts{
			Namespace: "net",
			Subsystem: "conntrack",
			Name:      "listener_conn_accepted_total",
			Help:      "Total number of connections opened to the listener of a given name.",
		}, []string{"listener_name"})

	listenerClosedTotal = prom.NewCounterVec(
		prom.CounterOpts{
			Namespace: "net",
			Subsystem: "conntrack",
			Name:      "listener_conn_closed_total",
			Help:      "Total number of connections closed that were made to the listener of a given name.",
		}, []string{"listener_name"})
)

func init() {
	prom.MustRegister(listenerAcceptedTotal)
	prom.MustRegister(listenerClosedTotal)
}

// preRegisterListener pre-populates Prometheus labels for the given listener name, to avoid Prometheus missing labels issue.
func preRegisterListenerMetrics(listenerName string) {
	listenerAcceptedTotal.WithLabelValues(listenerName)
	listenerClosedTotal.WithLabelValues(listenerName)
}

func reportListenerConnAccepted(listenerName string) {
	listenerAcceptedTotal.WithLabelValues(listenerName).Inc()
}

func reportListenerConnClosed(listenerName string) {
	listenerClosedTotal.WithLabelValues(listenerName).Inc()
}
