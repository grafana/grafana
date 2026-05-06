package middleware

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// NewInvalidClusterRequests registers and returns a new counter metric server_invalid_cluster_validation_label_requests_total, with namespace.
func NewInvalidClusterRequests(reg prometheus.Registerer, namespace string) *prometheus.CounterVec {
	return promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
		Name:      "server_invalid_cluster_validation_label_requests_total",
		Namespace: namespace,
		Help:      "Number of requests received by server with invalid cluster validation label.",
	}, []string{"protocol", "method", "cluster_validation_label", "request_cluster_validation_label"})
}
