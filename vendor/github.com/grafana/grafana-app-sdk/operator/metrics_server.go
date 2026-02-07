package operator

// since operator is a serverless component on its own, its associated server
// is only used for hosting the /metrics, /livez and /readyz endpoints

import (
	"context"
	"fmt"
	"net/http"
	"net/http/pprof"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana-app-sdk/health"
)

// MetricsServer exports metrics as well as health checks under the same mux
type MetricsServer struct {
	mux  *http.ServeMux
	Port int

	observer *health.Observer
}

// MetricsServerConfig specifies the config for the metrics server
type MetricsServerConfig struct {
	// Server port for metrics and health endpoints
	Port int

	// HealthCheckInterval is the duration at which the server will periodically run the registered health checks
	HealthCheckInterval time.Duration
}

func NewMetricsServer(config MetricsServerConfig) *MetricsServer {
	if config.Port <= 0 {
		config.Port = 9090
	}

	if config.HealthCheckInterval <= 0 {
		config.HealthCheckInterval = 1 * time.Minute
	}

	return &MetricsServer{
		Port:     config.Port,
		mux:      http.NewServeMux(),
		observer: health.NewObserver(config.HealthCheckInterval),
	}
}

func (s *MetricsServer) RegisterHealthChecks(checks ...health.Check) {
	s.observer.AddChecks(checks...)
}

func (s *MetricsServer) RegisterMetricsHandler(handler http.Handler) {
	s.mux.Handle("/metrics", handler)
}

func (s *MetricsServer) RegisterProfilingHandlers() {
	s.mux.HandleFunc("/debug/pprof/", pprof.Index)
	s.mux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	s.mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
	s.mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	s.mux.HandleFunc("/debug/pprof/trace", pprof.Trace)
}

func (s *MetricsServer) registerHealthHandlers() {
	s.mux.Handle("/livez", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	s.mux.Handle("/readyz", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		status := s.observer.Status()
		if !status.Successful {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte("readiness check failed: " + status.String()))
			return
		}
		_, _ = w.Write([]byte(status.String()))
	}))
}

func (s *MetricsServer) Run(ctx context.Context) error {
	// Run creates an HTTP server which exposes
	// 1. if enabled, a /metrics endpoint on the configured port
	// 2. health endpoints for liveness and readiness
	// (if port <=0, uses the default 9090)
	s.registerHealthHandlers()
	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", s.Port),
		Handler:           s.mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		defer server.Shutdown(gctx) //nolint:errcheck
		return s.observer.Run(gctx)
	})

	g.Go(func() error {
		return server.ListenAndServe()
	})

	return g.Wait()
}
