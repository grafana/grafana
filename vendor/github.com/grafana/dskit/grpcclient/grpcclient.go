package grpcclient

import (
	"flag"
	"slices"
	"strings"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc"
	grpcbackoff "google.golang.org/grpc/backoff"
	"google.golang.org/grpc/encoding/gzip"
	"google.golang.org/grpc/keepalive"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/dskit/clusterutil"
	"github.com/grafana/dskit/crypto/tls"
	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/grpcencoding/snappy"
	"github.com/grafana/dskit/middleware"
)

// grpcWithChainUnaryInterceptor helps to ensure that the requested order of interceptors is preserved.
var grpcWithChainUnaryInterceptor = grpc.WithChainUnaryInterceptor

// Config for a gRPC client.
type Config struct {
	MaxRecvMsgSize  int     `yaml:"max_recv_msg_size" category:"advanced"`
	MaxSendMsgSize  int     `yaml:"max_send_msg_size" category:"advanced"`
	GRPCCompression string  `yaml:"grpc_compression" category:"advanced"`
	RateLimit       float64 `yaml:"rate_limit" category:"advanced"`
	RateLimitBurst  int     `yaml:"rate_limit_burst" category:"advanced"`

	BackoffOnRatelimits bool           `yaml:"backoff_on_ratelimits" category:"advanced"`
	BackoffConfig       backoff.Config `yaml:"backoff_config"`

	InitialStreamWindowSize     flagext.Bytes `yaml:"initial_stream_window_size" category:"experimental"`
	InitialConnectionWindowSize flagext.Bytes `yaml:"initial_connection_window_size" category:"experimental"`

	TLSEnabled bool             `yaml:"tls_enabled" category:"advanced"`
	TLS        tls.ClientConfig `yaml:",inline"`

	ConnectTimeout time.Duration `yaml:"connect_timeout" category:"advanced"`
	// https://github.com/grpc/grpc/blob/master/doc/connection-backoff.md
	ConnectBackoffBaseDelay time.Duration `yaml:"connect_backoff_base_delay" category:"advanced"`
	ConnectBackoffMaxDelay  time.Duration `yaml:"connect_backoff_max_delay" category:"advanced"`

	Middleware       []grpc.UnaryClientInterceptor  `yaml:"-"`
	StreamMiddleware []grpc.StreamClientInterceptor `yaml:"-"`

	// CustomCompressors allows configuring custom compressors.
	CustomCompressors []string `yaml:"-"`

	ClusterValidation clusterutil.ClusterValidationConfig `yaml:"cluster_validation" category:"experimental"`

	// clusterUnaryClientInterceptor is needed for testing purposes.
	clusterUnaryClientInterceptor grpc.UnaryClientInterceptor `yaml:"-"`
}

// RegisterFlags registers flags.
func (cfg *Config) RegisterFlags(f *flag.FlagSet) {
	cfg.RegisterFlagsWithPrefix("", f)
}

const defaultInitialWindowSize = 65535 // From https://github.com/grpc/grpc-go/blob/c9d3ea5673252d212c69f3d3c10ce1d7b287a86b/internal/transport/defaults.go#L28

// RegisterFlagsWithPrefix registers flags with prefix.
func (cfg *Config) RegisterFlagsWithPrefix(prefix string, f *flag.FlagSet) {
	// Set the default values.
	cfg.InitialStreamWindowSize = defaultInitialWindowSize
	cfg.InitialConnectionWindowSize = defaultInitialWindowSize

	var supportedCompressors strings.Builder
	supportedCompressors.WriteString("Use compression when sending messages. Supported values are: 'gzip', 'snappy'")
	for _, cmp := range cfg.CustomCompressors {
		supportedCompressors.WriteString(", ")
		supportedCompressors.WriteString("'")
		supportedCompressors.WriteString(cmp)
		supportedCompressors.WriteString("'")
	}
	supportedCompressors.WriteString(" and '' (disable compression)")

	f.IntVar(&cfg.MaxRecvMsgSize, prefix+".grpc-max-recv-msg-size", 100<<20, "gRPC client max receive message size (bytes).")
	f.IntVar(&cfg.MaxSendMsgSize, prefix+".grpc-max-send-msg-size", 100<<20, "gRPC client max send message size (bytes).")
	f.StringVar(&cfg.GRPCCompression, prefix+".grpc-compression", "", supportedCompressors.String())
	f.Float64Var(&cfg.RateLimit, prefix+".grpc-client-rate-limit", 0., "Rate limit for gRPC client; 0 means disabled.")
	f.IntVar(&cfg.RateLimitBurst, prefix+".grpc-client-rate-limit-burst", 0, "Rate limit burst for gRPC client.")
	f.BoolVar(&cfg.BackoffOnRatelimits, prefix+".backoff-on-ratelimits", false, "Enable backoff and retry when we hit rate limits.")
	f.Var(&cfg.InitialStreamWindowSize, prefix+".initial-stream-window-size", "Initial stream window size. Values less than the default are not supported and are ignored. Setting this to a value other than the default disables the BDP estimator.")
	f.Var(&cfg.InitialConnectionWindowSize, prefix+".initial-connection-window-size", "Initial connection window size. Values less than the default are not supported and are ignored. Setting this to a value other than the default disables the BDP estimator.")
	f.BoolVar(&cfg.TLSEnabled, prefix+".tls-enabled", cfg.TLSEnabled, "Enable TLS in the gRPC client. This flag needs to be enabled when any other TLS flag is set. If set to false, insecure connection to gRPC server will be used.")
	f.DurationVar(&cfg.ConnectTimeout, prefix+".connect-timeout", 5*time.Second, "The maximum amount of time to establish a connection. A value of 0 means default gRPC client connect timeout and backoff.")
	f.DurationVar(&cfg.ConnectBackoffBaseDelay, prefix+".connect-backoff-base-delay", time.Second, "Initial backoff delay after first connection failure. Only relevant if ConnectTimeout > 0.")
	f.DurationVar(&cfg.ConnectBackoffMaxDelay, prefix+".connect-backoff-max-delay", 5*time.Second, "Maximum backoff delay when establishing a connection. Only relevant if ConnectTimeout > 0.")

	cfg.BackoffConfig.RegisterFlagsWithPrefix(prefix, f)
	cfg.TLS.RegisterFlagsWithPrefix(prefix, f)
	cfg.ClusterValidation.RegisterFlagsWithPrefix(prefix+".cluster-validation.", f)
}

func (cfg *Config) Validate() error {
	supportedCompressors := []string{gzip.Name, snappy.Name, ""}
	supportedCompressors = append(supportedCompressors, cfg.CustomCompressors...)
	if !slices.Contains(supportedCompressors, cfg.GRPCCompression) {
		return errors.Errorf("unsupported compression type: %q", cfg.GRPCCompression)
	}
	return nil
}

// CallOptions returns the config in terms of CallOptions.
func (cfg *Config) CallOptions() []grpc.CallOption {
	var opts []grpc.CallOption
	opts = append(opts, grpc.MaxCallRecvMsgSize(cfg.MaxRecvMsgSize))
	opts = append(opts, grpc.MaxCallSendMsgSize(cfg.MaxSendMsgSize))
	if cfg.GRPCCompression != "" {
		opts = append(opts, grpc.UseCompressor(cfg.GRPCCompression))
	}
	return opts
}

// DialOption returns the config as a grpc.DialOptions. The passed interceptors wrap around the configured middleware.
// It requires an InvalidClusterValidationReporter for reporting the cluster validation issues back to the caller,
// if cluster validation is enabled.
// If a nil InvalidClusterValidationReporter is provided, a NoOpInvalidClusterValidationReporter is used.
func (cfg *Config) DialOption(unaryClientInterceptors []grpc.UnaryClientInterceptor, streamClientInterceptors []grpc.StreamClientInterceptor, invalidClusterValidationReporter middleware.InvalidClusterValidationReporter) ([]grpc.DialOption, error) {
	if invalidClusterValidationReporter == nil {
		invalidClusterValidationReporter = middleware.NoOpInvalidClusterValidationReporter
	}
	var opts []grpc.DialOption
	tlsOpts, err := cfg.TLS.GetGRPCDialOptions(cfg.TLSEnabled)
	if err != nil {
		return nil, err
	}
	opts = append(opts, tlsOpts...)

	unaryClientInterceptors = append(unaryClientInterceptors, cfg.Middleware...)
	streamClientInterceptors = append(streamClientInterceptors, cfg.StreamMiddleware...)

	if cfg.BackoffOnRatelimits {
		unaryClientInterceptors = append([]grpc.UnaryClientInterceptor{NewRateLimitRetrier(cfg.BackoffConfig)}, unaryClientInterceptors...)
	}

	if cfg.RateLimit > 0 {
		unaryClientInterceptors = append([]grpc.UnaryClientInterceptor{NewRateLimiter(cfg)}, unaryClientInterceptors...)
	}

	// If cluster validation is enabled, ClusterUnaryClientInterceptor must be the last UnaryClientInterceptor
	// to wrap the real call.
	if cfg.ClusterValidation.Label != "" {
		cfg.clusterUnaryClientInterceptor = middleware.ClusterUnaryClientInterceptor(cfg.ClusterValidation.Label, invalidClusterValidationReporter)
		unaryClientInterceptors = append(unaryClientInterceptors, cfg.clusterUnaryClientInterceptor)
	}

	if cfg.ConnectTimeout > 0 {
		defaultCfg := grpcbackoff.DefaultConfig

		if cfg.ConnectBackoffBaseDelay > 0 {
			defaultCfg.BaseDelay = cfg.ConnectBackoffBaseDelay
		}

		if cfg.ConnectBackoffMaxDelay > 0 {
			defaultCfg.MaxDelay = cfg.ConnectBackoffMaxDelay
		}

		opts = append(
			opts,
			grpc.WithConnectParams(grpc.ConnectParams{
				Backoff:           defaultCfg,
				MinConnectTimeout: cfg.ConnectTimeout,
			}),
		)
	}

	if cfg.InitialStreamWindowSize > defaultInitialWindowSize {
		// We only want to explicitly set the window size if it's not the default, as setting the window size (even to the default) always disables the BDP estimator.
		opts = append(opts, grpc.WithInitialWindowSize(int32(cfg.InitialStreamWindowSize)))
	}

	if cfg.InitialConnectionWindowSize > defaultInitialWindowSize {
		// We only want to explicitly set the window size if it's not the default, as setting the window size (even to the default) always disables the BDP estimator.
		opts = append(opts, grpc.WithInitialConnWindowSize(int32(cfg.InitialConnectionWindowSize)))
	}

	return append(
		opts,
		grpc.WithDefaultCallOptions(cfg.CallOptions()...),
		grpcWithChainUnaryInterceptor(unaryClientInterceptors...),
		grpc.WithChainStreamInterceptor(streamClientInterceptors...),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                time.Second * 20,
			Timeout:             time.Second * 10,
			PermitWithoutStream: true,
		}),
	), nil
}
