package log

import (
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/time/rate"
)

type RateLimitedLogger struct {
	next    log.Logger
	limiter *rate.Limiter

	discardedInfoLogLinesCounter  prometheus.Counter
	discardedDebugLogLinesCounter prometheus.Counter
	discardedWarnLogLinesCounter  prometheus.Counter
	discardedErrorLogLinesCounter prometheus.Counter
}

// NewRateLimitedLogger returns a log.Logger that is limited to the given number of logs per second,
// with the given burst size.
func NewRateLimitedLogger(logger log.Logger, logsPerSecond float64, logsBurstSize int, registry prometheus.Registerer) log.Logger {
	discardedLogLinesCounter := promauto.With(registry).NewCounterVec(prometheus.CounterOpts{
		Name: "logger_rate_limit_discarded_log_lines_total",
		Help: "Total number of discarded log lines per level.",
	}, []string{"level"})

	return &RateLimitedLogger{
		next:                          logger,
		limiter:                       rate.NewLimiter(rate.Limit(logsPerSecond), logsBurstSize),
		discardedInfoLogLinesCounter:  discardedLogLinesCounter.WithLabelValues(level.InfoValue().String()),
		discardedDebugLogLinesCounter: discardedLogLinesCounter.WithLabelValues(level.DebugValue().String()),
		discardedWarnLogLinesCounter:  discardedLogLinesCounter.WithLabelValues(level.WarnValue().String()),
		discardedErrorLogLinesCounter: discardedLogLinesCounter.WithLabelValues(level.ErrorValue().String()),
	}
}

func (l *RateLimitedLogger) Log(keyvals ...interface{}) error {
	if l.limiter.Allow() {
		return l.next.Log(keyvals...)
	}
	counter := l.getCounterFromKeyvals(keyvals...)
	if counter != nil {
		counter.Inc()
	}
	return nil
}

func (l *RateLimitedLogger) getCounterFromKeyvals(keyvals ...interface{}) prometheus.Counter {
	for i := 0; i < len(keyvals); i += 2 {
		levelKey, ok := keyvals[i].(string)
		if ok && levelKey == "level" && i+1 < len(keyvals) {
			levelValue := keyvals[i+1]
			switch levelValue {
			case level.InfoValue():
				return l.discardedInfoLogLinesCounter
			case level.DebugValue():
				return l.discardedDebugLogLinesCounter
			case level.WarnValue():
				return l.discardedWarnLogLinesCounter
			case level.ErrorValue():
				return l.discardedErrorLogLinesCounter
			default:
				return nil
			}
		}
	}
	return nil
}
