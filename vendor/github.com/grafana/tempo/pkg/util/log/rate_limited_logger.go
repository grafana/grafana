package log

import (
	"time"

	gkLog "github.com/go-kit/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/time/rate"
)

type RateLimitedLogger struct {
	limiter *rate.Limiter
	logger  gkLog.Logger
}

var metricDropedLines = promauto.NewCounter(prometheus.CounterOpts{
	Namespace: "tempo",
	Name:      "dropped_log_lines_total",
	Help:      "The total number of log lines dropped by the rate limited logger.",
})

// NewRateLimitedLogger returns a new RateLimitedLogger that logs at most logsPerSecond messages per second.
// TODO: migrate to the dskit rate limited logger
func NewRateLimitedLogger(logsPerSecond int, logger gkLog.Logger) *RateLimitedLogger {
	return &RateLimitedLogger{
		limiter: rate.NewLimiter(rate.Limit(logsPerSecond), 1),
		logger:  logger,
	}
}

func (l *RateLimitedLogger) Log(keyvals ...interface{}) {
	if !l.limiter.AllowN(time.Now(), 1) {
		metricDropedLines.Inc()
		return
	}

	_ = l.logger.Log(keyvals...)
}
