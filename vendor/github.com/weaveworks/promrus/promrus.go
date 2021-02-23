package promrus

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
)

// PrometheusHook exposes Prometheus counters for each of logrus' log levels.
type PrometheusHook struct {
	counterVec *prometheus.CounterVec
}

var supportedLevels = []logrus.Level{logrus.DebugLevel, logrus.InfoLevel, logrus.WarnLevel, logrus.ErrorLevel}

// NewPrometheusHook creates a new instance of PrometheusHook which exposes Prometheus counters for various log levels.
// Contrarily to MustNewPrometheusHook, it returns an error to the caller in case of issue.
// Use NewPrometheusHook if you want more control. Use MustNewPrometheusHook if you want a less verbose hook creation.
func NewPrometheusHook() (*PrometheusHook, error) {
	counterVec := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "log_messages",
		Help: "Total number of log messages.",
	}, []string{"level"})
	// Initialise counters for all supported levels:
	for _, level := range supportedLevels {
		counterVec.WithLabelValues(level.String())
	}
	// Try to unregister the counter vector, in case already registered for some reason,
	// e.g. double initialisation/configuration done by mistake by the end-user.
	prometheus.Unregister(counterVec)
	// Try to register the counter vector:
	err := prometheus.Register(counterVec)
	if err != nil {
		return nil, err
	}
	return &PrometheusHook{
		counterVec: counterVec,
	}, nil
}

// MustNewPrometheusHook creates a new instance of PrometheusHook which exposes Prometheus counters for various log levels.
// Contrarily to NewPrometheusHook, it does not return any error to the caller, but panics instead.
// Use MustNewPrometheusHook if you want a less verbose hook creation. Use NewPrometheusHook if you want more control.
func MustNewPrometheusHook() *PrometheusHook {
	hook, err := NewPrometheusHook()
	if err != nil {
		panic(err)
	}
	return hook
}

// Fire increments the appropriate Prometheus counter depending on the entry's log level.
func (hook *PrometheusHook) Fire(entry *logrus.Entry) error {
	hook.counterVec.WithLabelValues(entry.Level.String()).Inc()
	return nil
}

// Levels returns all supported log levels, i.e.: Debug, Info, Warn and Error, as
// there is no point incrementing a counter just before exiting/panicking.
func (hook *PrometheusHook) Levels() []logrus.Level {
	return supportedLevels
}
