package nfstatus

import (
	"context"
	"sync"
	"time"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
)

type NotificationHistorian interface {
	Record(ctx context.Context, alerts []*types.Alert, retry bool, notificationErr error, duration time.Duration) <-chan error
}

// Integration wraps an upstream notify.Integration, adding the ability to
// capture notification status.
type Integration struct {
	status      *statusCaptureNotifier
	integration *notify.Integration
}

// NewIntegration returns a new integration.
func NewIntegration(notifier notify.Notifier, rs notify.ResolvedSender, name string, idx int, receiverName string, notificationHistorian NotificationHistorian) *Integration {
	// Wrap the provided Notifier with our own, which will capture notification attempt errors.
	status := &statusCaptureNotifier{upstream: notifier, notificationHistorian: notificationHistorian}

	integration := notify.NewIntegration(status, rs, name, idx, receiverName)

	return &Integration{
		status:      status,
		integration: integration,
	}
}

// Integration returns the wrapped notify.Integration
func (i *Integration) Integration() *notify.Integration {
	return i.integration
}

// Notify implements the Notifier interface.
// Note that this is only included to make out Integration a drop-in replacement
// for parts of Grafana Alertmanager, we cannot actually pass our Integration to Prometheus.
func (i *Integration) Notify(ctx context.Context, alerts ...*types.Alert) (bool, error) {
	return i.integration.Notify(ctx, alerts...)
}

// SendResolved implements the ResolvedSender interface.
func (i *Integration) SendResolved() bool {
	return i.integration.SendResolved()
}

// Name returns the name of the integration.
func (i *Integration) Name() string {
	return i.integration.Name()
}

// Index returns the index of the integration.
func (i *Integration) Index() int {
	return i.integration.Index()
}

// String implements the Stringer interface.
func (i *Integration) String() string {
	return i.integration.String()
}

// GetReport returns information about the last notification attempt.
func (i *Integration) GetReport() (time.Time, model.Duration, error) {
	return i.status.GetReport()
}

// GetIntegrations is a convenience function to unwrap all the notify.GetIntegrations
// from a slice of nfstatus.Integration.
func GetIntegrations(integrations []*Integration) []*notify.Integration {
	result := make([]*notify.Integration, len(integrations))
	for i := range integrations {
		result[i] = integrations[i].Integration()
	}
	return result
}

// statusCaptureNotifier is used to wrap a notify.Notifer and capture information about attempts.
type statusCaptureNotifier struct {
	upstream              notify.Notifier
	notificationHistorian NotificationHistorian

	mtx                       sync.RWMutex
	lastNotifyAttempt         time.Time
	lastNotifyAttemptDuration model.Duration
	lastNotifyAttemptError    error
}

// Notify implements the Notifier interface.
func (n *statusCaptureNotifier) Notify(ctx context.Context, alerts ...*types.Alert) (bool, error) {
	start := time.Now()
	retry, err := n.upstream.Notify(ctx, alerts...)
	duration := time.Since(start)

	if n.notificationHistorian != nil {
		n.notificationHistorian.Record(ctx, alerts, retry, err, duration)
	}

	n.mtx.Lock()
	defer n.mtx.Unlock()

	n.lastNotifyAttempt = start
	n.lastNotifyAttemptDuration = model.Duration(duration)
	n.lastNotifyAttemptError = err

	return retry, err
}

// GetReport returns information about the last notification attempt.
func (n *statusCaptureNotifier) GetReport() (time.Time, model.Duration, error) {
	n.mtx.RLock()
	defer n.mtx.RUnlock()

	return n.lastNotifyAttempt, n.lastNotifyAttemptDuration, n.lastNotifyAttemptError
}
