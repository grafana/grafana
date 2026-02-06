package util

import "github.com/prometheus/client_golang/prometheus"

type NoopRegistry struct{}

var _ prometheus.Registerer = NoopRegistry{}

// MustRegister implements prometheus.Registerer.
func (n NoopRegistry) MustRegister(...prometheus.Collector) {}

// Register implements prometheus.Registerer.
func (n NoopRegistry) Register(prometheus.Collector) error {
	return nil
}

// Unregister implements prometheus.Registerer.
func (n NoopRegistry) Unregister(prometheus.Collector) bool {
	return true
}
