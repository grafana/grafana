// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/server/server.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package server

import (
	"context"
	"crypto/tls"
	"flag"
	"fmt"
	"maps"
	"math"
	"net"
	"net/http"
	_ "net/http/pprof" // anonymous import to get the pprof handler registered
	"slices"
	"strconv"
	"strings"
	"time"

	gokit_log "github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/gorilla/mux"
	_ "github.com/grafana/pyroscope-go/godeltaprof/http/pprof" // anonymous import to get godelatprof handlers registered
	otgrpc "github.com/opentracing-contrib/go-grpc"
	"github.com/opentracing/opentracing-go"
	"github.com/pires/go-proxyproto"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/prometheus/common/config"
	"github.com/prometheus/exporter-toolkit/web"
	"golang.org/x/net/netutil"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/keepalive"

	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"

	"github.com/grafana/dskit/clusterutil"
	"github.com/grafana/dskit/httpgrpc"
	httpgrpc_server "github.com/grafana/dskit/httpgrpc/server"
	"github.com/grafana/dskit/log"
	"github.com/grafana/dskit/middleware"
	"github.com/grafana/dskit/signals"
)

// Listen on the named network
const (
	// DefaultNetwork  the host resolves to multiple IP addresses,
	// Dial will try each IP address in order until one succeeds
	DefaultNetwork = "tcp"
	// NetworkTCPV4 for IPV4 only
	NetworkTCPV4 = "tcp4"
)

// SignalHandler used by Server.
type SignalHandler interface {
	// Starts the signals handler. This method is blocking, and returns only after signal is received,
	// or "Stop" is called.
	Loop()

	// Stop blocked "Loop" method.
	Stop()
}

// TLSConfig contains TLS parameters for Config.
type TLSConfig struct {
	TLSCert       string        `yaml:"cert" doc:"description=Server TLS certificate. This configuration parameter is YAML only."`
	TLSKey        config.Secret `yaml:"key" doc:"description=Server TLS key. This configuration parameter is YAML only."`
	ClientCAsText string        `yaml:"client_ca" doc:"description=Root certificate authority used to verify client certificates. This configuration parameter is YAML only."`
	TLSCertPath   string        `yaml:"cert_file"`
	TLSKeyPath    string        `yaml:"key_file"`
	ClientAuth    string        `yaml:"client_auth_type"`
	ClientCAs     string        `yaml:"client_ca_file"`
}

// Config for a Server
type Config struct {
	MetricsNamespace string `yaml:"-"`
	// Set to > 1 to add native histograms to requestDuration.
	// See documentation for NativeHistogramBucketFactor in
	// https://pkg.go.dev/github.com/prometheus/client_golang/prometheus#HistogramOpts
	// for details. A generally useful value is 1.1.
	MetricsNativeHistogramFactor float64 `yaml:"-"`

	HTTPListenNetwork           string `yaml:"http_listen_network"`
	HTTPListenAddress           string `yaml:"http_listen_address"`
	HTTPListenPort              int    `yaml:"http_listen_port"`
	HTTPConnLimit               int    `yaml:"http_listen_conn_limit"`
	GRPCListenNetwork           string `yaml:"grpc_listen_network"`
	GRPCListenAddress           string `yaml:"grpc_listen_address"`
	GRPCListenPort              int    `yaml:"grpc_listen_port"`
	GRPCConnLimit               int    `yaml:"grpc_listen_conn_limit"`
	GRPCCollectMaxStreamsByConn bool   `yaml:"grpc_collect_max_streams_by_conn"`
	ProxyProtocolEnabled        bool   `yaml:"proxy_protocol_enabled"`

	CipherSuites  string    `yaml:"tls_cipher_suites"`
	MinVersion    string    `yaml:"tls_min_version"`
	HTTPTLSConfig TLSConfig `yaml:"http_tls_config"`
	GRPCTLSConfig TLSConfig `yaml:"grpc_tls_config"`

	RegisterInstrumentation                  bool `yaml:"register_instrumentation"`
	ReportGRPCCodesInInstrumentationLabel    bool `yaml:"report_grpc_codes_in_instrumentation_label_enabled"`
	ReportHTTP4XXCodesInInstrumentationLabel bool `yaml:"-"`
	ExcludeRequestInLog                      bool `yaml:"-"`
	DisableRequestSuccessLog                 bool `yaml:"-"`

	PerTenantInstrumentation middleware.PerTenantCallback `yaml:"-"`

	ServerGracefulShutdownTimeout time.Duration `yaml:"graceful_shutdown_timeout"`
	HTTPServerReadTimeout         time.Duration `yaml:"http_server_read_timeout"`
	HTTPServerReadHeaderTimeout   time.Duration `yaml:"http_server_read_header_timeout"`
	HTTPServerWriteTimeout        time.Duration `yaml:"http_server_write_timeout"`
	HTTPServerIdleTimeout         time.Duration `yaml:"http_server_idle_timeout"`

	HTTPLogClosedConnectionsWithoutResponse bool `yaml:"http_log_closed_connections_without_response_enabled"`

	GRPCOptions                   []grpc.ServerOption            `yaml:"-"`
	GRPCMiddleware                []grpc.UnaryServerInterceptor  `yaml:"-"`
	GRPCStreamMiddleware          []grpc.StreamServerInterceptor `yaml:"-"`
	HTTPMiddleware                []middleware.Interface         `yaml:"-"`
	Router                        *mux.Router                    `yaml:"-"`
	DoNotAddDefaultHTTPMiddleware bool                           `yaml:"-"`

	GRPCServerMaxRecvMsgSize           int           `yaml:"grpc_server_max_recv_msg_size"`
	GRPCServerMaxSendMsgSize           int           `yaml:"grpc_server_max_send_msg_size"`
	GRPCServerMaxConcurrentStreams     uint          `yaml:"grpc_server_max_concurrent_streams"`
	GRPCServerMaxConnectionIdle        time.Duration `yaml:"grpc_server_max_connection_idle"`
	GRPCServerMaxConnectionAge         time.Duration `yaml:"grpc_server_max_connection_age"`
	GRPCServerMaxConnectionAgeGrace    time.Duration `yaml:"grpc_server_max_connection_age_grace"`
	GRPCServerTime                     time.Duration `yaml:"grpc_server_keepalive_time"`
	GRPCServerTimeout                  time.Duration `yaml:"grpc_server_keepalive_timeout"`
	GRPCServerMinTimeBetweenPings      time.Duration `yaml:"grpc_server_min_time_between_pings"`
	GRPCServerPingWithoutStreamAllowed bool          `yaml:"grpc_server_ping_without_stream_allowed"`
	GRPCServerNumWorkers               int           `yaml:"grpc_server_num_workers"`
	GRPCServerStatsTrackingEnabled     bool          `yaml:"grpc_server_stats_tracking_enabled"`
	GRPCServerRecvBufferPoolsEnabled   bool          `yaml:"grpc_server_recv_buffer_pools_enabled"`

	LogFormat                    string           `yaml:"log_format"`
	LogLevel                     log.Level        `yaml:"log_level"`
	Log                          gokit_log.Logger `yaml:"-"`
	LogSourceIPs                 bool             `yaml:"log_source_ips_enabled"`
	LogSourceIPsFull             bool             `yaml:"log_source_ips_full"`
	LogSourceIPsHeader           string           `yaml:"log_source_ips_header"`
	LogSourceIPsRegex            string           `yaml:"log_source_ips_regex"`
	LogRequestHeaders            bool             `yaml:"log_request_headers"`
	LogRequestAtInfoLevel        bool             `yaml:"log_request_at_info_level_enabled"`
	LogRequestExcludeHeadersList string           `yaml:"log_request_exclude_headers_list"`

	TraceRequestHeaders            bool   `yaml:"trace_request_headers"`
	TraceRequestExcludeHeadersList string `yaml:"trace_request_exclude_headers_list"`

	// If not set, default signal handler is used.
	SignalHandler SignalHandler `yaml:"-"`

	// If not set, default Prometheus registry is used.
	Registerer prometheus.Registerer `yaml:"-"`
	Gatherer   prometheus.Gatherer   `yaml:"-"`

	PathPrefix string `yaml:"http_path_prefix"`

	// This limiter is called for every started and finished gRPC request.
	GrpcMethodLimiter GrpcInflightMethodLimiter `yaml:"-"`

	Throughput Throughput `yaml:"-"`

	ClusterValidation clusterutil.ServerClusterValidationConfig `yaml:"cluster_validation" category:"experimental"`
}

type Throughput struct {
	LatencyCutoff time.Duration `yaml:"throughput_latency_cutoff"`
	Unit          string        `yaml:"throughput_unit"`
}

var infinty = time.Duration(math.MaxInt64)

// RegisterFlags adds the flags required to config this to the given FlagSet
func (cfg *Config) RegisterFlags(f *flag.FlagSet) {
	f.StringVar(&cfg.HTTPListenAddress, "server.http-listen-address", "", "HTTP server listen address.")
	f.StringVar(&cfg.HTTPListenNetwork, "server.http-listen-network", DefaultNetwork, "HTTP server listen network, default tcp")
	f.StringVar(&cfg.CipherSuites, "server.tls-cipher-suites", "", "Comma-separated list of cipher suites to use. If blank, the default Go cipher suites is used.")
	f.StringVar(&cfg.MinVersion, "server.tls-min-version", "", "Minimum TLS version to use. Allowed values: VersionTLS10, VersionTLS11, VersionTLS12, VersionTLS13. If blank, the Go TLS minimum version is used.")
	f.StringVar(&cfg.HTTPTLSConfig.TLSCertPath, "server.http-tls-cert-path", "", "HTTP server cert path.")
	f.StringVar(&cfg.HTTPTLSConfig.TLSKeyPath, "server.http-tls-key-path", "", "HTTP server key path.")
	f.StringVar(&cfg.HTTPTLSConfig.ClientAuth, "server.http-tls-client-auth", "", "HTTP TLS Client Auth type.")
	f.StringVar(&cfg.HTTPTLSConfig.ClientCAs, "server.http-tls-ca-path", "", "HTTP TLS Client CA path.")
	f.StringVar(&cfg.GRPCTLSConfig.TLSCertPath, "server.grpc-tls-cert-path", "", "GRPC TLS server cert path.")
	f.StringVar(&cfg.GRPCTLSConfig.TLSKeyPath, "server.grpc-tls-key-path", "", "GRPC TLS server key path.")
	f.StringVar(&cfg.GRPCTLSConfig.ClientAuth, "server.grpc-tls-client-auth", "", "GRPC TLS Client Auth type.")
	f.StringVar(&cfg.GRPCTLSConfig.ClientCAs, "server.grpc-tls-ca-path", "", "GRPC TLS Client CA path.")
	f.IntVar(&cfg.HTTPListenPort, "server.http-listen-port", 80, "HTTP server listen port.")
	f.IntVar(&cfg.HTTPConnLimit, "server.http-conn-limit", 0, "Maximum number of simultaneous http connections, <=0 to disable")
	f.StringVar(&cfg.GRPCListenNetwork, "server.grpc-listen-network", DefaultNetwork, "gRPC server listen network")
	f.StringVar(&cfg.GRPCListenAddress, "server.grpc-listen-address", "", "gRPC server listen address.")
	f.IntVar(&cfg.GRPCListenPort, "server.grpc-listen-port", 9095, "gRPC server listen port.")
	f.IntVar(&cfg.GRPCConnLimit, "server.grpc-conn-limit", 0, "Maximum number of simultaneous grpc connections, <=0 to disable")
	f.BoolVar(&cfg.GRPCCollectMaxStreamsByConn, "server.grpc-collect-max-streams-by-conn", true, "If true, the max streams by connection gauge will be collected.")
	f.BoolVar(&cfg.RegisterInstrumentation, "server.register-instrumentation", true, "Register the intrumentation handlers (/metrics etc).")
	f.BoolVar(&cfg.ReportGRPCCodesInInstrumentationLabel, "server.report-grpc-codes-in-instrumentation-label-enabled", false, "If set to true, gRPC statuses will be reported in instrumentation labels with their string representations. Otherwise, they will be reported as \"error\".")
	f.DurationVar(&cfg.ServerGracefulShutdownTimeout, "server.graceful-shutdown-timeout", 30*time.Second, "Timeout for graceful shutdowns")
	f.DurationVar(&cfg.HTTPServerReadTimeout, "server.http-read-timeout", 30*time.Second, "Read timeout for entire HTTP request, including headers and body.")
	f.DurationVar(&cfg.HTTPServerReadHeaderTimeout, "server.http-read-header-timeout", 0, "Read timeout for HTTP request headers. If set to 0, value of -server.http-read-timeout is used.")
	f.DurationVar(&cfg.HTTPServerWriteTimeout, "server.http-write-timeout", 30*time.Second, "Write timeout for HTTP server")
	f.DurationVar(&cfg.HTTPServerIdleTimeout, "server.http-idle-timeout", 120*time.Second, "Idle timeout for HTTP server")
	f.BoolVar(&cfg.HTTPLogClosedConnectionsWithoutResponse, "server.http-log-closed-connections-without-response-enabled", false, "Log closed connections that did not receive any response, most likely because client didn't send any request within timeout.")
	f.IntVar(&cfg.GRPCServerMaxRecvMsgSize, "server.grpc-max-recv-msg-size-bytes", 4*1024*1024, "Limit on the size of a gRPC message this server can receive (bytes).")
	f.IntVar(&cfg.GRPCServerMaxSendMsgSize, "server.grpc-max-send-msg-size-bytes", 4*1024*1024, "Limit on the size of a gRPC message this server can send (bytes).")
	f.UintVar(&cfg.GRPCServerMaxConcurrentStreams, "server.grpc-max-concurrent-streams", 100, "Limit on the number of concurrent streams for gRPC calls per client connection (0 = unlimited)")
	f.DurationVar(&cfg.GRPCServerMaxConnectionIdle, "server.grpc.keepalive.max-connection-idle", infinty, "The duration after which an idle connection should be closed. Default: infinity")
	f.DurationVar(&cfg.GRPCServerMaxConnectionAge, "server.grpc.keepalive.max-connection-age", infinty, "The duration for the maximum amount of time a connection may exist before it will be closed. Default: infinity")
	f.DurationVar(&cfg.GRPCServerMaxConnectionAgeGrace, "server.grpc.keepalive.max-connection-age-grace", infinty, "An additive period after max-connection-age after which the connection will be forcibly closed. Default: infinity")
	f.DurationVar(&cfg.GRPCServerTime, "server.grpc.keepalive.time", time.Hour*2, "Duration after which a keepalive probe is sent in case of no activity over the connection., Default: 2h")
	f.DurationVar(&cfg.GRPCServerTimeout, "server.grpc.keepalive.timeout", time.Second*20, "After having pinged for keepalive check, the duration after which an idle connection should be closed, Default: 20s")
	f.DurationVar(&cfg.GRPCServerMinTimeBetweenPings, "server.grpc.keepalive.min-time-between-pings", 5*time.Minute, "Minimum amount of time a client should wait before sending a keepalive ping. If client sends keepalive ping more often, server will send GOAWAY and close the connection.")
	f.BoolVar(&cfg.GRPCServerPingWithoutStreamAllowed, "server.grpc.keepalive.ping-without-stream-allowed", false, "If true, server allows keepalive pings even when there are no active streams(RPCs). If false, and client sends ping when there are no active streams, server will send GOAWAY and close the connection.")
	f.BoolVar(&cfg.GRPCServerStatsTrackingEnabled, "server.grpc.stats-tracking-enabled", true, "If true, the request_message_bytes, response_message_bytes, and inflight_requests metrics will be tracked. Enabling this option prevents the use of memory pools for parsing gRPC request bodies and may lead to more memory allocations.")
	f.BoolVar(&cfg.GRPCServerRecvBufferPoolsEnabled, "server.grpc.recv-buffer-pools-enabled", false, "Deprecated option, has no effect and will be removed in a future version.")
	f.IntVar(&cfg.GRPCServerNumWorkers, "server.grpc.num-workers", 0, "If non-zero, configures the amount of GRPC server workers used to serve the requests.")
	f.StringVar(&cfg.PathPrefix, "server.path-prefix", "", "Base path to serve all API routes from (e.g. /v1/)")
	f.StringVar(&cfg.LogFormat, "log.format", log.LogfmtFormat, "Output log messages in the given format. Valid formats: [logfmt, json]")
	cfg.LogLevel.RegisterFlags(f)
	f.BoolVar(&cfg.LogSourceIPs, "server.log-source-ips-enabled", false, "Optionally log the source IPs.")
	f.BoolVar(&cfg.LogSourceIPsFull, "server.log-source-ips-full", false, "Log all source IPs instead of only the originating one. Only used if server.log-source-ips-enabled is true")
	f.StringVar(&cfg.LogSourceIPsHeader, "server.log-source-ips-header", "", "Header field storing the source IPs. Only used if server.log-source-ips-enabled is true. If not set the default Forwarded, X-Real-IP and X-Forwarded-For headers are used")
	f.StringVar(&cfg.LogSourceIPsRegex, "server.log-source-ips-regex", "", "Regex for matching the source IPs. Only used if server.log-source-ips-enabled is true. If not set the default Forwarded, X-Real-IP and X-Forwarded-For headers are used")
	f.BoolVar(&cfg.LogRequestHeaders, "server.log-request-headers", false, "Optionally log request headers.")
	f.StringVar(&cfg.LogRequestExcludeHeadersList, "server.log-request-headers-exclude-list", "", "Comma separated list of headers to exclude from loggin. Only used if server.log-request-headers is true.")
	f.BoolVar(&cfg.LogRequestAtInfoLevel, "server.log-request-at-info-level-enabled", false, "Optionally log requests at info level instead of debug level. Applies to request headers as well if server.log-request-headers is enabled.")

	f.BoolVar(&cfg.TraceRequestHeaders, "server.trace-request-headers", false, "Optionally add request headers to tracing spans.")
	f.StringVar(&cfg.TraceRequestExcludeHeadersList, "server.trace-request-headers-exclude-list", "", fmt.Sprintf("Comma separated list of headers to exclude from tracing spans. Only used if server.trace-request-headers is true. The following headers are always excluded: %s.", strings.Join(slices.Sorted(maps.Keys(middleware.AlwaysExcludedHeaders)), ", ")))

	f.BoolVar(&cfg.ProxyProtocolEnabled, "server.proxy-protocol-enabled", false, "Enables PROXY protocol.")
	f.DurationVar(&cfg.Throughput.LatencyCutoff, "server.throughput.latency-cutoff", 0, "Requests taking over the cutoff are be observed to measure throughput. Server-Timing header is used with specified unit as the indicator, for example 'Server-Timing: unit;val=8.2'. If set to 0, the throughput is not calculated.")
	f.StringVar(&cfg.Throughput.Unit, "server.throughput.unit", "samples_processed", "Unit of the server throughput metric, for example 'processed_bytes' or 'samples_processed'. Observed values are gathered from the 'Server-Timing' header with the 'val' key. If set, it is appended to the request_server_throughput metric name.")
	cfg.ClusterValidation.RegisterFlagsWithPrefix("server.cluster-validation.", f)
}

func (cfg *Config) Validate() error {
	return cfg.ClusterValidation.Validate()
}

func (cfg *Config) registererOrDefault() prometheus.Registerer {
	// If user doesn't supply a Registerer/gatherer, use Prometheus' by default.
	if cfg.Registerer != nil {
		return cfg.Registerer
	}
	return prometheus.DefaultRegisterer
}

// Server wraps a HTTP and gRPC server, and some common initialization.
//
// Servers will be automatically instrumented for Prometheus metrics.
type Server struct {
	cfg          Config
	handler      SignalHandler
	grpcListener net.Listener
	httpListener net.Listener

	HTTP       *mux.Router
	HTTPServer *http.Server
	GRPC       *grpc.Server
	Log        gokit_log.Logger
	Registerer prometheus.Registerer
	Gatherer   prometheus.Gatherer
}

// New makes a new Server. It will panic if the metrics cannot be registered.
func New(cfg Config) (*Server, error) {
	metrics := NewServerMetrics(cfg)
	return newServer(cfg, metrics)
}

// NewWithMetrics makes a new Server using the provided Metrics. It will not attempt to register the metrics,
// the user is responsible for doing so.
func NewWithMetrics(cfg Config, metrics *Metrics) (*Server, error) {
	return newServer(cfg, metrics)
}

func newServer(cfg Config, metrics *Metrics) (*Server, error) {
	// If user doesn't supply a logging implementation, by default instantiate go-kit.
	logger := cfg.Log
	if logger == nil {
		logger = log.NewGoKitWithLevel(cfg.LogLevel, cfg.LogFormat)
	}

	reg := cfg.registererOrDefault()

	gatherer := cfg.Gatherer
	if gatherer == nil {
		gatherer = prometheus.DefaultGatherer
	}

	network := cfg.HTTPListenNetwork
	if network == "" {
		network = DefaultNetwork
	}
	// Setup listeners first, so we can fail early if the port is in use.
	httpListener, err := net.Listen(network, net.JoinHostPort(cfg.HTTPListenAddress, strconv.Itoa(cfg.HTTPListenPort)))
	if err != nil {
		return nil, err
	}
	httpListener = middleware.CountingListener(httpListener, metrics.TCPConnections.WithLabelValues("http"))
	if cfg.HTTPLogClosedConnectionsWithoutResponse {
		httpListener = middleware.NewZeroResponseListener(httpListener, level.Warn(logger))
	}

	metrics.TCPConnectionsLimit.WithLabelValues("http").Set(float64(cfg.HTTPConnLimit))
	if cfg.HTTPConnLimit > 0 {
		httpListener = netutil.LimitListener(httpListener, cfg.HTTPConnLimit)
	}

	network = cfg.GRPCListenNetwork
	if network == "" {
		network = DefaultNetwork
	}
	grpcListener, err := net.Listen(network, net.JoinHostPort(cfg.GRPCListenAddress, strconv.Itoa(cfg.GRPCListenPort)))
	if err != nil {
		return nil, err
	}
	grpcListener = middleware.CountingListener(grpcListener, metrics.TCPConnections.WithLabelValues("grpc"))

	metrics.TCPConnectionsLimit.WithLabelValues("grpc").Set(float64(cfg.GRPCConnLimit))
	if cfg.GRPCConnLimit > 0 {
		grpcListener = netutil.LimitListener(grpcListener, cfg.GRPCConnLimit)
	}

	if cfg.ProxyProtocolEnabled {
		httpListener = newProxyProtocolListener(httpListener, cfg.HTTPServerReadHeaderTimeout)
		grpcListener = newProxyProtocolListener(grpcListener, cfg.HTTPServerReadHeaderTimeout)
	}

	cipherSuites, err := stringToCipherSuites(cfg.CipherSuites)
	if err != nil {
		return nil, err
	}
	minVersion, err := stringToTLSVersion(cfg.MinVersion)
	if err != nil {
		return nil, err
	}

	// Setup TLS
	var httpTLSConfig *tls.Config
	if (len(cfg.HTTPTLSConfig.TLSCertPath) > 0 || len(cfg.HTTPTLSConfig.TLSCert) > 0) &&
		(len(cfg.HTTPTLSConfig.TLSKeyPath) > 0 || len(cfg.HTTPTLSConfig.TLSKey) > 0) {
		// Note: ConfigToTLSConfig from prometheus/exporter-toolkit is awaiting security review.
		httpTLSConfig, err = web.ConfigToTLSConfig(&web.TLSConfig{
			TLSCert:       cfg.HTTPTLSConfig.TLSCert,
			TLSKey:        config.Secret(cfg.HTTPTLSConfig.TLSKey),
			ClientCAsText: cfg.HTTPTLSConfig.ClientCAsText,
			TLSCertPath:   cfg.HTTPTLSConfig.TLSCertPath,
			TLSKeyPath:    cfg.HTTPTLSConfig.TLSKeyPath,
			ClientAuth:    cfg.HTTPTLSConfig.ClientAuth,
			ClientCAs:     cfg.HTTPTLSConfig.ClientCAs,
			CipherSuites:  cipherSuites,
			MinVersion:    minVersion,
		})
		if err != nil {
			return nil, fmt.Errorf("error generating http tls config: %v", err)
		}
	}
	var grpcTLSConfig *tls.Config
	if (len(cfg.GRPCTLSConfig.TLSCertPath) > 0 || len(cfg.GRPCTLSConfig.TLSCert) > 0) &&
		(len(cfg.GRPCTLSConfig.TLSKeyPath) > 0 || len(cfg.GRPCTLSConfig.TLSKey) > 0) {
		// Note: ConfigToTLSConfig from prometheus/exporter-toolkit is awaiting security review.
		grpcTLSConfig, err = web.ConfigToTLSConfig(&web.TLSConfig{
			TLSCert:       cfg.GRPCTLSConfig.TLSCert,
			TLSKey:        config.Secret(cfg.GRPCTLSConfig.TLSKey),
			ClientCAsText: cfg.GRPCTLSConfig.ClientCAsText,
			TLSCertPath:   cfg.GRPCTLSConfig.TLSCertPath,
			TLSKeyPath:    cfg.GRPCTLSConfig.TLSKeyPath,
			ClientAuth:    cfg.GRPCTLSConfig.ClientAuth,
			ClientCAs:     cfg.GRPCTLSConfig.ClientCAs,
			CipherSuites:  cipherSuites,
			MinVersion:    minVersion,
		})
		if err != nil {
			return nil, fmt.Errorf("error generating grpc tls config: %v", err)
		}
	}

	level.Info(logger).Log("msg", "server listening on addresses", "http", httpListener.Addr(), "grpc", grpcListener.Addr())

	// Setup HTTP server
	var router *mux.Router
	if cfg.Router != nil {
		router = cfg.Router
	} else {
		router = mux.NewRouter()
	}
	if cfg.PathPrefix != "" {
		// Expect metrics and pprof handlers to be prefixed with server's path prefix.
		// e.g. /loki/metrics or /loki/debug/pprof
		router = router.PathPrefix(cfg.PathPrefix).Subrouter()
	}
	if cfg.RegisterInstrumentation {
		RegisterInstrumentationWithGatherer(router, gatherer)
	}

	// Setup gRPC server
	serverLog := middleware.GRPCServerLog{
		Log:                      logger,
		WithRequest:              !cfg.ExcludeRequestInLog,
		DisableRequestSuccessLog: cfg.DisableRequestSuccessLog,
	}
	var grpcInstrumentationOptions []middleware.InstrumentationOption
	if cfg.ReportGRPCCodesInInstrumentationLabel {
		grpcInstrumentationOptions = append(grpcInstrumentationOptions, middleware.ReportGRPCStatusOption)
	}
	if cfg.PerTenantInstrumentation != nil {
		grpcInstrumentationOptions = append(grpcInstrumentationOptions,
			middleware.WithPerTenantInstrumentation(
				metrics.PerTenantRequestTotal,
				metrics.PerTenantRequestDuration,
				cfg.PerTenantInstrumentation,
			))
	}
	grpcMiddleware := []grpc.UnaryServerInterceptor{
		serverLog.UnaryServerInterceptor,
	}

	if opentracing.IsGlobalTracerRegistered() {
		grpcMiddleware = append(grpcMiddleware,
			otgrpc.OpenTracingServerInterceptor(opentracing.GlobalTracer()),
		)
	}

	grpcMiddleware = append(grpcMiddleware,
		middleware.HTTPGRPCTracingInterceptor(router), // This must appear after the OpenTracingServerInterceptor, if that's configured.
		middleware.UnaryServerInstrumentInterceptor(metrics.RequestDuration, grpcInstrumentationOptions...),
	)
	grpcMiddleware = append(grpcMiddleware, cfg.GRPCMiddleware...)
	if cfg.ClusterValidation.GRPC.Enabled {
		grpcMiddleware = append(grpcMiddleware, middleware.ClusterUnaryServerInterceptor(
			cfg.ClusterValidation.Label, cfg.ClusterValidation.GRPC.SoftValidation,
			metrics.InvalidClusterRequests, logger,
		))
	}

	grpcStreamMiddleware := []grpc.StreamServerInterceptor{
		serverLog.StreamServerInterceptor,
	}

	if opentracing.IsGlobalTracerRegistered() {
		grpcStreamMiddleware = append(grpcStreamMiddleware,
			otgrpc.OpenTracingStreamServerInterceptor(opentracing.GlobalTracer()),
		)
	}

	grpcStreamMiddleware = append(grpcStreamMiddleware,
		middleware.StreamServerInstrumentInterceptor(metrics.RequestDuration, grpcInstrumentationOptions...),
	)
	grpcStreamMiddleware = append(grpcStreamMiddleware, cfg.GRPCStreamMiddleware...)

	grpcKeepAliveOptions := keepalive.ServerParameters{
		MaxConnectionIdle:     cfg.GRPCServerMaxConnectionIdle,
		MaxConnectionAge:      cfg.GRPCServerMaxConnectionAge,
		MaxConnectionAgeGrace: cfg.GRPCServerMaxConnectionAgeGrace,
		Time:                  cfg.GRPCServerTime,
		Timeout:               cfg.GRPCServerTimeout,
	}

	grpcKeepAliveEnforcementPolicy := keepalive.EnforcementPolicy{
		MinTime:             cfg.GRPCServerMinTimeBetweenPings,
		PermitWithoutStream: cfg.GRPCServerPingWithoutStreamAllowed,
	}

	var grpcServerLimit *grpcInflightLimitCheck
	if cfg.GrpcMethodLimiter != nil {
		grpcServerLimit = newGrpcInflightLimitCheck(cfg.GrpcMethodLimiter)
		grpcMiddleware = append(grpcMiddleware, grpcServerLimit.UnaryServerInterceptor)
		grpcStreamMiddleware = append(grpcStreamMiddleware, grpcServerLimit.StreamServerInterceptor)
	}

	metrics.GRPCConcurrentStreamsLimit.WithLabelValues().Set(float64(cfg.GRPCServerMaxConcurrentStreams))
	grpcOptions := []grpc.ServerOption{
		grpc.ChainUnaryInterceptor(grpcMiddleware...),
		grpc.ChainStreamInterceptor(grpcStreamMiddleware...),
		grpc.KeepaliveParams(grpcKeepAliveOptions),
		grpc.KeepaliveEnforcementPolicy(grpcKeepAliveEnforcementPolicy),
		grpc.MaxRecvMsgSize(cfg.GRPCServerMaxRecvMsgSize),
		grpc.MaxSendMsgSize(cfg.GRPCServerMaxSendMsgSize),
		grpc.MaxConcurrentStreams(uint32(cfg.GRPCServerMaxConcurrentStreams)),
		grpc.NumStreamWorkers(uint32(cfg.GRPCServerNumWorkers)),
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
	}

	if grpcServerLimit != nil {
		grpcOptions = append(grpcOptions,
			grpc.StatsHandler(grpcServerLimit),
			grpc.InTapHandle(grpcServerLimit.TapHandle),
		)
	}

	if cfg.GRPCServerStatsTrackingEnabled {
		grpcOptions = append(grpcOptions,
			grpc.StatsHandler(middleware.NewStatsHandler(
				reg,
				metrics.ReceivedMessageSize,
				metrics.SentMessageSize,
				metrics.InflightRequests,
				cfg.GRPCCollectMaxStreamsByConn,
			)),
		)
	}

	if cfg.GRPCServerRecvBufferPoolsEnabled {
		level.Warn(logger).Log("msg", "'server.grpc.recv-buffer-pools-enabled' is a deprecated option that currently has no effect and will be removed in a future version")
	}

	grpcOptions = append(grpcOptions, cfg.GRPCOptions...)
	if grpcTLSConfig != nil {
		grpcCreds := credentials.NewTLS(grpcTLSConfig)
		grpcOptions = append(grpcOptions, grpc.Creds(grpcCreds))
	}
	grpcServer := grpc.NewServer(grpcOptions...)

	httpMiddleware, err := BuildHTTPMiddleware(cfg, router, metrics, logger)
	if err != nil {
		return nil, fmt.Errorf("error building http middleware: %w", err)
	}

	httpServer := &http.Server{
		ReadTimeout:       cfg.HTTPServerReadTimeout,
		ReadHeaderTimeout: cfg.HTTPServerReadHeaderTimeout,
		WriteTimeout:      cfg.HTTPServerWriteTimeout,
		IdleTimeout:       cfg.HTTPServerIdleTimeout,
		Handler:           middleware.Merge(httpMiddleware...).Wrap(router),
	}
	if httpTLSConfig != nil {
		httpServer.TLSConfig = httpTLSConfig
	}

	handler := cfg.SignalHandler
	if handler == nil {
		handler = signals.NewHandler(logger)
	}

	return &Server{
		cfg:          cfg,
		httpListener: httpListener,
		grpcListener: grpcListener,
		handler:      handler,

		HTTP:       router,
		HTTPServer: httpServer,
		GRPC:       grpcServer,
		Log:        logger,
		Registerer: cfg.registererOrDefault(),
		Gatherer:   gatherer,
	}, nil
}

// RegisterInstrumentation on the given router.
func RegisterInstrumentation(router *mux.Router) {
	RegisterInstrumentationWithGatherer(router, prometheus.DefaultGatherer)
}

// RegisterInstrumentationWithGatherer on the given router.
func RegisterInstrumentationWithGatherer(router *mux.Router, gatherer prometheus.Gatherer) {
	router.Handle("/metrics", promhttp.HandlerFor(gatherer, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	}))
	router.PathPrefix("/debug/pprof").Handler(http.DefaultServeMux)
}

func BuildHTTPMiddleware(cfg Config, router *mux.Router, metrics *Metrics, logger gokit_log.Logger) ([]middleware.Interface, error) {
	sourceIPs, err := middleware.NewSourceIPs(cfg.LogSourceIPsHeader, cfg.LogSourceIPsRegex, cfg.LogSourceIPsFull)
	if err != nil {
		return nil, fmt.Errorf("error setting up source IP extraction: %w", err)
	}
	logSourceIPs := sourceIPs
	if !cfg.LogSourceIPs {
		// We always include the source IPs for traces,
		// but only want to log them in the middleware if that is enabled.
		logSourceIPs = nil
	}

	defaultLogMiddleware := middleware.NewLogMiddleware(logger, cfg.LogRequestHeaders, cfg.LogRequestAtInfoLevel, logSourceIPs, strings.Split(cfg.LogRequestExcludeHeadersList, ","))
	defaultLogMiddleware.DisableRequestSuccessLog = cfg.DisableRequestSuccessLog

	defaultHTTPMiddleware := []middleware.Interface{
		middleware.RouteInjector{
			RouteMatcher: router,
		},
		middleware.NewTracer(sourceIPs, cfg.TraceRequestHeaders, strings.Split(cfg.TraceRequestExcludeHeadersList, ",")),
		defaultLogMiddleware,
		middleware.Instrument{
			Duration:          metrics.RequestDuration,
			PerTenantDuration: metrics.PerTenantRequestDuration,
			PerTenantTotal:    metrics.PerTenantRequestTotal,
			PerTenantCallback: cfg.PerTenantInstrumentation,
			RequestBodySize:   metrics.ReceivedMessageSize,
			ResponseBodySize:  metrics.SentMessageSize,
			InflightRequests:  metrics.InflightRequests,
			LatencyCutoff:     cfg.Throughput.LatencyCutoff,
			ThroughputUnit:    cfg.Throughput.Unit,
			RequestThroughput: metrics.RequestThroughput,
		},
	}
	var httpMiddleware []middleware.Interface
	if cfg.DoNotAddDefaultHTTPMiddleware {
		httpMiddleware = cfg.HTTPMiddleware
	} else {
		httpMiddleware = append(defaultHTTPMiddleware, cfg.HTTPMiddleware...)
	}
	if cfg.ClusterValidation.HTTP.Enabled {
		httpMiddleware = append(httpMiddleware, middleware.ClusterValidationMiddleware(
			cfg.ClusterValidation.Label, cfg.ClusterValidation.HTTP.ExcludedPaths,
			cfg.ClusterValidation.HTTP.SoftValidation,
			metrics.InvalidClusterRequests, logger,
		))
	}

	return httpMiddleware, nil
}

// Run the server; blocks until SIGTERM (if signal handling is enabled), an error is received, or Stop() is called.
func (s *Server) Run() error {
	errChan := make(chan error, 1)

	// Wait for a signal
	go func() {
		s.handler.Loop()
		select {
		case errChan <- nil:
		default:
		}
	}()

	go func() {
		var err error
		if s.HTTPServer.TLSConfig == nil {
			err = s.HTTPServer.Serve(s.httpListener)
		} else {
			err = s.HTTPServer.ServeTLS(s.httpListener, s.cfg.HTTPTLSConfig.TLSCertPath, s.cfg.HTTPTLSConfig.TLSKeyPath)
		}
		if err == http.ErrServerClosed {
			err = nil
		}

		select {
		case errChan <- err:
		default:
		}
	}()

	serverOptions := make([]httpgrpc_server.Option, 0, 1)
	if s.cfg.ReportHTTP4XXCodesInInstrumentationLabel {
		serverOptions = append(serverOptions, httpgrpc_server.WithReturn4XXErrors)
	}
	// Setup gRPC server for HTTP over gRPC, ensure we don't double-count the middleware
	httpgrpc.RegisterHTTPServer(s.GRPC, httpgrpc_server.NewServer(s.HTTP, serverOptions...))

	go func() {
		err := s.GRPC.Serve(s.grpcListener)
		handleGRPCError(err, errChan)
	}()

	return <-errChan
}

// handleGRPCError consolidates GRPC Server error handling by sending
// any error to errChan except for grpc.ErrServerStopped which is ignored.
func handleGRPCError(err error, errChan chan error) {
	if err == grpc.ErrServerStopped {
		err = nil
	}

	select {
	case errChan <- err:
	default:
	}
}

// HTTPListenAddr exposes `net.Addr` that `Server` is listening to for HTTP connections.
func (s *Server) HTTPListenAddr() net.Addr {
	return s.httpListener.Addr()

}

// GRPCListenAddr exposes `net.Addr` that `Server` is listening to for GRPC connections.
func (s *Server) GRPCListenAddr() net.Addr {
	return s.grpcListener.Addr()
}

// Stop unblocks Run().
func (s *Server) Stop() {
	s.handler.Stop()
}

// Shutdown the server, gracefully.  Should be defered after New().
func (s *Server) Shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), s.cfg.ServerGracefulShutdownTimeout)
	defer cancel() // releases resources if httpServer.Shutdown completes before timeout elapses

	_ = s.HTTPServer.Shutdown(ctx)
	s.GRPC.GracefulStop()
}

func newProxyProtocolListener(httpListener net.Listener, readHeaderTimeout time.Duration) net.Listener {
	// Wraps the listener with a proxy protocol listener.
	// NOTE: go-proxyproto supports non-PROXY, PROXY v1 and PROXY v2 protocols via the same listener.
	// Therefore, enabling this feature does not break existing setups.
	return &proxyproto.Listener{
		Listener:          httpListener,
		ReadHeaderTimeout: readHeaderTimeout,
	}
}
