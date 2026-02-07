package log

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	dslog "github.com/grafana/dskit/log"
	"github.com/grafana/dskit/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/loki/v3/pkg/util/constants"
)

var (
	// Logger is a shared go-kit logger.
	// TODO: Change all components to take a non-global logger via their constructors.
	// Prefer accepting a non-global logger as an argument.
	Logger = log.NewNopLogger()

	bufferedLogger *dslog.BufferedLogger

	plogger *prometheusLogger
)

// InitLogger initialises the global gokit logger (util_log.Logger) and returns that logger.
func InitLogger(cfg *server.Config, reg prometheus.Registerer, sync bool) log.Logger {
	logger := newPrometheusLogger(cfg.LogLevel, cfg.LogFormat, reg, sync)
	// when using util_log.Logger, skip 3 stack frames.
	Logger = log.With(logger, "caller", log.Caller(3))

	return Logger
}

type Flusher interface {
	Flush() error
}

func Flush() error {
	if bufferedLogger != nil {
		return bufferedLogger.Flush()
	}

	return nil
}

// prometheusLogger exposes Prometheus counters for each of go-kit's log levels.
type prometheusLogger struct {
	baseLogger          log.Logger
	logger              log.Logger
	logMessages         *prometheus.CounterVec
	internalLogMessages *prometheus.CounterVec
	logFlushes          prometheus.Histogram

	useBufferedLogger bool
	useSyncLogger     bool
}

// LevelHandler returns an http handler function that returns the current log level.
// The optional query parameter 'log_level' can be passed to change the log level at runtime.
func LevelHandler(currentLogLevel *dslog.Level) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		type logResponse struct {
			Status  string `json:"status,omitempty"`
			Message string `json:"message"`
		}
		var resp logResponse
		status := http.StatusOK

		w.Header().Set("Content-Type", "application/json; charset=utf-8")

		switch r.Method {
		case "GET":
			resp = logResponse{
				Message: fmt.Sprintf("Current log level is %s", currentLogLevel.String()),
			}
		case "POST":
			logLevel := r.FormValue("log_level")

			// Update log level in config
			err := currentLogLevel.Set(logLevel)
			if err != nil {
				status = http.StatusBadRequest
				resp = logResponse{
					Message: fmt.Sprintf("%v", err),
					Status:  "failed",
				}
			} else {
				plogger.Set(currentLogLevel.Option)

				msg := fmt.Sprintf("Log level set to %s", logLevel)
				level.Info(Logger).Log("msg", msg)
				resp = logResponse{
					Status:  "success",
					Message: msg,
				}
			}
		}

		w.WriteHeader(status)
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			level.Error(Logger).Log("msg", err)
		}
	}
}

// newPrometheusLogger creates a new instance of PrometheusLogger which exposes
// Prometheus counters for various log levels.
func newPrometheusLogger(l dslog.Level, format string, reg prometheus.Registerer, sync bool) log.Logger {
	// buffered logger settings
	var (
		logEntries    uint32 = 256                    // buffer up to 256 log lines in memory before flushing to a write(2) syscall
		logBufferSize uint32 = 10e6                   // 10MB
		flushTimeout         = 100 * time.Millisecond // flush the buffer after 100ms regardless of how full it is, to prevent losing many logs in case of ungraceful termination
	)

	logMessages := promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
		Namespace: constants.Loki,
		Name:      "log_messages_total",
		Help:      "DEPRECATED. Use internal_log_messages_total for the same functionality. Total number of log messages created by Loki itself.",
	}, []string{"level"})
	internalLogMessages := promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
		Namespace: constants.Loki,
		Name:      "internal_log_messages_total",
		Help:      "Total number of log messages created by Loki itself.",
	}, []string{"level"})
	logFlushes := promauto.With(reg).NewHistogram(prometheus.HistogramOpts{
		Namespace: constants.Loki,
		Name:      "log_flushes",
		Help:      "Histogram of log flushes using the line-buffered logger.",
		Buckets:   prometheus.ExponentialBuckets(1, 2, int(math.Log2(float64(logEntries)))+1),
	})

	// retain a reference to this logger because it doesn't conform to the standard Logger interface,
	// and we can't unwrap it to get the underlying logger when we flush on shutdown
	bufferedLogger = dslog.NewBufferedLogger(os.Stderr, logEntries,
		dslog.WithFlushPeriod(flushTimeout),
		dslog.WithPrellocatedBuffer(logBufferSize),
		dslog.WithFlushCallback(func(entries uint32) {
			logFlushes.Observe(float64(entries))
		}),
	)
	var writer io.Writer = bufferedLogger

	if sync {
		writer = log.NewSyncWriter(writer)
	}

	baseLogger := dslog.NewGoKitWithWriter(format, writer)
	logger := level.NewFilter(baseLogger, l.Option)

	plogger = &prometheusLogger{
		baseLogger:          baseLogger,
		logger:              logger,
		logMessages:         logMessages,
		internalLogMessages: internalLogMessages,
		logFlushes:          logFlushes,
	}
	// Initialise counters for all supported levels:
	supportedLevels := []level.Value{
		level.DebugValue(),
		level.InfoValue(),
		level.WarnValue(),
		level.ErrorValue(),
	}
	for _, level := range supportedLevels {
		plogger.logMessages.WithLabelValues(level.String())
		plogger.internalLogMessages.WithLabelValues(level.String())
	}

	// return a Logger without caller information, shouldn't use directly
	return log.With(plogger, "ts", log.DefaultTimestampUTC)
}

// Set overrides the log level of the logger.
func (pl *prometheusLogger) Set(option level.Option) {
	pl.logger = level.NewFilter(pl.baseLogger, option)
}

// Log increments the appropriate Prometheus counter depending on the log level.
func (pl *prometheusLogger) Log(kv ...interface{}) error {
	pl.logger.Log(kv...)
	l := "unknown"
	for i := 1; i < len(kv); i += 2 {
		if v, ok := kv[i].(level.Value); ok {
			l = v.String()
			break
		}
	}
	pl.logMessages.WithLabelValues(l).Inc()
	pl.internalLogMessages.WithLabelValues(l).Inc()
	return nil
}

// CheckFatal prints an error and exits with error code 1 if err is non-nil.
func CheckFatal(location string, err error, logger log.Logger) {
	if err == nil {
		return
	}

	logger = level.Error(logger)
	if location != "" {
		logger = log.With(logger, "msg", "error "+location)
	}
	// %+v gets the stack trace from errors using github.com/pkg/errors
	errStr := fmt.Sprintf("%+v", err)
	fmt.Fprintln(os.Stderr, errStr)

	logger.Log("err", errStr)
	if err = Flush(); err != nil {
		fmt.Fprintln(os.Stderr, "Could not flush logger", err)
	}
	os.Exit(1)
}
