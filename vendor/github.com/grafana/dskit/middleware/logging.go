// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/middleware/logging.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package middleware

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"

	dskit_log "github.com/grafana/dskit/log"
	"github.com/grafana/dskit/tracing"
	"github.com/grafana/dskit/user"
)

// Log middleware logs http requests
type Log struct {
	Log                      log.Logger
	DisableRequestSuccessLog bool
	LogRequestHeaders        bool // LogRequestHeaders true -> dump http headers at debug log level
	LogRequestAtInfoLevel    bool // LogRequestAtInfoLevel true -> log requests at info log level
	SourceIPs                *SourceIPExtractor
	HTTPHeadersToExclude     map[string]bool
}

var AlwaysExcludedHeaders = map[string]bool{
	"Cookie":        true,
	"X-Csrf-Token":  true,
	"Authorization": true,
}

func NewLogMiddleware(log log.Logger, logRequestHeaders bool, logRequestAtInfoLevel bool, sourceIPs *SourceIPExtractor, headersList []string) Log {
	httpHeadersToExclude := map[string]bool{}
	for header := range AlwaysExcludedHeaders {
		httpHeadersToExclude[header] = true
	}
	for _, header := range headersList {
		httpHeadersToExclude[header] = true
	}

	return Log{
		Log:                   log,
		LogRequestHeaders:     logRequestHeaders,
		LogRequestAtInfoLevel: logRequestAtInfoLevel,
		SourceIPs:             sourceIPs,
		HTTPHeadersToExclude:  httpHeadersToExclude,
	}
}

// logWithRequest information from the request and context as fields.
func (l Log) logWithRequest(r *http.Request) log.Logger {
	localLog := l.Log
	traceID, ok := tracing.ExtractSampledTraceID(r.Context())
	if ok {
		localLog = log.With(localLog, "trace_id", traceID)
	} else if traceID != "" {
		localLog = log.With(localLog, "trace_id_unsampled", traceID)
	}

	if l.SourceIPs != nil {
		ips := l.SourceIPs.Get(r)
		if ips != "" {
			localLog = log.With(localLog, "sourceIPs", ips)
		}
	}

	return user.LogWith(r.Context(), localLog)
}

// Wrap implements Middleware
func (l Log) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		begin := time.Now()
		uri := r.RequestURI // capture the URI before running next, as it may get rewritten
		requestLog := l.logWithRequest(r)
		// Log headers before running 'next' in case other interceptors change the data.
		headers, err := dumpRequestHeaders(r, l.HTTPHeadersToExclude)
		if err != nil {
			headers = nil
			level.Error(requestLog).Log("msg", "could not dump request headers", "err", err)
		}
		var buf bytes.Buffer
		wrapped := newBadResponseLoggingWriter(w, &buf)
		next.ServeHTTP(wrapped, r)

		statusCode, writeErr := wrapped.getStatusCode(), wrapped.getWriteError()

		if writeErr != nil {
			if errors.Is(writeErr, context.Canceled) {
				if l.LogRequestAtInfoLevel {
					if l.LogRequestHeaders && headers != nil {
						level.Info(requestLog).Log("msg", dskit_log.LazySprintf("%s %s %s, request cancelled: %s ws: %v; %s", r.Method, uri, time.Since(begin), writeErr, IsWSHandshakeRequest(r), headers))
					} else {
						level.Info(requestLog).Log("msg", dskit_log.LazySprintf("%s %s %s, request cancelled: %s ws: %v", r.Method, uri, time.Since(begin), writeErr, IsWSHandshakeRequest(r)))
					}
				} else {
					if l.LogRequestHeaders && headers != nil {
						level.Debug(requestLog).Log("msg", dskit_log.LazySprintf("%s %s %s, request cancelled: %s ws: %v; %s", r.Method, uri, time.Since(begin), writeErr, IsWSHandshakeRequest(r), headers))
					} else {
						level.Debug(requestLog).Log("msg", dskit_log.LazySprintf("%s %s %s, request cancelled: %s ws: %v", r.Method, uri, time.Since(begin), writeErr, IsWSHandshakeRequest(r)))
					}
				}
			} else {
				if l.LogRequestHeaders && headers != nil {
					level.Warn(requestLog).Log("msg", dskit_log.LazySprintf("%s %s %s, error: %s ws: %v; %s", r.Method, uri, time.Since(begin), writeErr, IsWSHandshakeRequest(r), headers))
				} else {
					level.Warn(requestLog).Log("msg", dskit_log.LazySprintf("%s %s %s, error: %s ws: %v", r.Method, uri, time.Since(begin), writeErr, IsWSHandshakeRequest(r)))
				}
			}
			return
		}

		switch {
		// success and shouldn't log successful requests.
		case statusCode >= 200 && statusCode < 300 && l.DisableRequestSuccessLog:
			return

		case 100 <= statusCode && statusCode < 500 || statusCode == http.StatusBadGateway || statusCode == http.StatusServiceUnavailable:
			if l.LogRequestAtInfoLevel {
				if l.LogRequestHeaders && headers != nil {
					level.Info(requestLog).Log("msg", dskit_log.LazySprintf("%s %s (%d) %s ws: %v; %s", r.Method, uri, statusCode, time.Since(begin), IsWSHandshakeRequest(r), string(headers)))
				} else {
					level.Info(requestLog).Log("msg", dskit_log.LazySprintf("%s %s (%d) %s", r.Method, uri, statusCode, time.Since(begin)))
				}
			} else {
				if l.LogRequestHeaders && headers != nil {
					level.Debug(requestLog).Log("msg", dskit_log.LazySprintf("%s %s (%d) %s ws: %v; %s", r.Method, uri, statusCode, time.Since(begin), IsWSHandshakeRequest(r), string(headers)))
				} else {
					level.Debug(requestLog).Log("msg", dskit_log.LazySprintf("%s %s (%d) %s", r.Method, uri, statusCode, time.Since(begin)))
				}
			}
		default:
			if l.LogRequestHeaders && headers != nil {
				level.Warn(requestLog).Log("msg", dskit_log.LazySprintf("%s %s (%d) %s Response: %q ws: %v; %s", r.Method, uri, statusCode, time.Since(begin), buf.Bytes(), IsWSHandshakeRequest(r), headers))
			} else {
				level.Warn(requestLog).Log("msg", dskit_log.LazySprintf("%s %s (%d) %s Response: %q", r.Method, uri, statusCode, time.Since(begin), buf.Bytes()))
			}
		}
	})
}

func dumpRequestHeaders(req *http.Request, httpHeadersToExclude map[string]bool) ([]byte, error) {
	var b bytes.Buffer

	// In case users initialize the Log middleware using the exported struct, skip the default headers anyway
	if len(httpHeadersToExclude) == 0 {
		httpHeadersToExclude = AlwaysExcludedHeaders
	}
	// Exclude some headers for security, or just that we don't need them when debugging
	err := req.Header.WriteSubset(&b, httpHeadersToExclude)
	if err != nil {
		return nil, err
	}

	ret := bytes.ReplaceAll(b.Bytes(), []byte("\r\n"), []byte("; "))
	return ret, nil
}
