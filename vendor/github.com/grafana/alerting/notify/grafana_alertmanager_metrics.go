package notify

import (
	"github.com/go-kit/log"
	"github.com/prometheus/alertmanager/api/metrics"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const namespace = "grafana"
const subsystem = "alerting"
const ActiveStateLabelValue = "active"
const InactiveStateLabelValue = "inactive"

type GrafanaAlertmanagerMetrics struct {
	Registerer prometheus.Registerer
	*metrics.Alerts
	configuredReceivers       *prometheus.GaugeVec
	configuredIntegrations    *prometheus.GaugeVec
	configuredInhibitionRules *prometheus.GaugeVec
}

// NewGrafanaAlertmanagerMetrics creates a set of metrics for the Alertmanager.
func NewGrafanaAlertmanagerMetrics(r prometheus.Registerer, l log.Logger) *GrafanaAlertmanagerMetrics {
	return &GrafanaAlertmanagerMetrics{
		Registerer: r,
		Alerts:     metrics.NewAlerts(r, l),
		configuredReceivers: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "alertmanager_receivers",
			Help:      "Number of configured receivers by state. It is considered active if used within a route.",
		}, []string{"org", "state"}),
		configuredIntegrations: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "alertmanager_integrations",
			Help:      "Number of configured integrations.",
		}, []string{"org", "type"}),
		configuredInhibitionRules: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "alertmanager_inhibition_rules",
			Help:      "Number of configured inhibition rules.",
		}, []string{"org"}),
	}
}
