// Package config contains all knobs and defaults used to configure features of
// OpenFGA when running as a standalone server.
package config

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/spf13/viper"
)

const (
	DefaultMaxRPCMessageSizeInBytes         = 512 * 1_204 // 512 KB
	DefaultMaxTuplesPerWrite                = 100
	DefaultMaxTypesPerAuthorizationModel    = 100
	DefaultMaxAuthorizationModelSizeInBytes = 256 * 1_024
	DefaultMaxAuthorizationModelCacheSize   = 100000
	DefaultChangelogHorizonOffset           = 0
	DefaultResolveNodeLimit                 = 25
	DefaultResolveNodeBreadthLimit          = 10
	DefaultListObjectsDeadline              = 3 * time.Second
	DefaultListObjectsMaxResults            = 1000
	DefaultMaxConcurrentReadsForCheck       = math.MaxUint32
	DefaultMaxConcurrentReadsForListObjects = math.MaxUint32
	DefaultListUsersDeadline                = 3 * time.Second
	DefaultListUsersMaxResults              = 1000
	DefaultMaxConcurrentReadsForListUsers   = math.MaxUint32

	DefaultWriteContextByteLimit = 32 * 1_024 // 32KB

	DefaultCheckCacheLimit = 10000

	DefaultCacheControllerEnabled = false
	DefaultCacheControllerTTL     = 10 * time.Second

	DefaultCheckQueryCacheEnabled = false
	DefaultCheckQueryCacheTTL     = 10 * time.Second

	DefaultCheckIteratorCacheEnabled    = false
	DefaultCheckIteratorCacheMaxResults = 10000
	DefaultCheckIteratorCacheTTL        = 10 * time.Second

	DefaultListObjectsIteratorCacheEnabled    = false
	DefaultListObjectsIteratorCacheMaxResults = 10000
	DefaultListObjectsIteratorCacheTTL        = 10 * time.Second

	DefaultListObjectsOptimizationsEnabled = false

	DefaultCacheControllerConfigEnabled = false
	DefaultCacheControllerConfigTTL     = 10 * time.Second

	DefaultShadowCheckResolverTimeout = 1 * time.Second

	DefaultShadowListObjectsQueryTimeout       = 1 * time.Second
	DefaultShadowListObjectsQueryMaxDeltaItems = 100

	// Care should be taken here - decreasing can cause API compatibility problems with Conditions.
	DefaultMaxConditionEvaluationCost = 100
	DefaultInterruptCheckFrequency    = 100

	DefaultCheckDispatchThrottlingEnabled          = false
	DefaultCheckDispatchThrottlingFrequency        = 10 * time.Microsecond
	DefaultCheckDispatchThrottlingDefaultThreshold = 100
	DefaultCheckDispatchThrottlingMaxThreshold     = 0 // 0 means use the default threshold as max

	// Batch Check.
	DefaultMaxChecksPerBatchCheck           = 50
	DefaultMaxConcurrentChecksPerBatchCheck = 50

	DefaultListObjectsDispatchThrottlingEnabled          = false
	DefaultListObjectsDispatchThrottlingFrequency        = 10 * time.Microsecond
	DefaultListObjectsDispatchThrottlingDefaultThreshold = 100
	DefaultListObjectsDispatchThrottlingMaxThreshold     = 0 // 0 means use the default threshold as max

	DefaultListUsersDispatchThrottlingEnabled          = false
	DefaultListUsersDispatchThrottlingFrequency        = 10 * time.Microsecond
	DefaultListUsersDispatchThrottlingDefaultThreshold = 100
	DefaultListUsersDispatchThrottlingMaxThreshold     = 0 // 0 means use the default threshold as max

	DefaultRequestTimeout     = 3 * time.Second
	additionalUpstreamTimeout = 3 * time.Second

	DefaultSharedIteratorEnabled          = false
	DefaultSharedIteratorLimit            = 1000000
	DefaultSharedIteratorTTL              = 4 * time.Minute
	DefaultSharedIteratorMaxAdmissionTime = 10 * time.Second
	DefaultSharedIteratorMaxIdleTime      = 1 * time.Second

	DefaultPlannerEvictionThreshold = 0
	DefaultPlannerCleanupInterval   = 0

	ExperimentalCheckOptimizations       = "enable-check-optimizations"
	ExperimentalListObjectsOptimizations = "enable-list-objects-optimizations"
	ExperimentalAccessControlParams      = "enable-access-control"

	// Moving forward, all experimental flags should follow the naming convention below:
	// 1. Avoid using enable/disable prefixes.
	// 2. Flag names should have only numbers, letters and underscores.
	ExperimentalShadowCheck         = "shadow_check"
	ExperimentalShadowListObjects   = "shadow_list_objects"
	ExperimentalDatastoreThrottling = "datastore_throttling"
	ExperimentalPipelineListObjects = "pipeline_list_objects"
)

type DatastoreMetricsConfig struct {
	// Enabled enables export of the Datastore metrics.
	Enabled bool
}

// DatastoreConfig defines OpenFGA server configurations for datastore specific settings.
type DatastoreConfig struct {
	// Engine is the datastore engine to use (e.g. 'memory', 'postgres', 'mysql', 'sqlite')
	Engine            string
	URI               string `json:"-"` // private field, won't be logged
	SecondaryURI      string `json:"-"` // private field, won't be logged
	Username          string
	Password          string `json:"-"` // private field, won't be logged
	SecondaryUsername string
	SecondaryPassword string `json:"-"` // private field, won't be logged

	// MaxCacheSize is the maximum number of authorization models that will be cached in memory.
	MaxCacheSize int

	// MaxOpenConns is the maximum number of open connections to the database.
	MaxOpenConns int

	// MinOpenConns is the minimum number of open connections to the database.
	// This is only available in Postgresql.
	MinOpenConns int

	// MaxIdleConns is the maximum number of connections to the datastore in the idle connection
	// pool. This is only used for some datastore engines (non-PostgresSQL that uses sql.DB).
	MaxIdleConns int

	// MinIdleConns is the minimum number of connections to the datastore in the idle connection
	// pool. This is only available in Postgresql..
	MinIdleConns int

	// ConnMaxIdleTime is the maximum amount of time a connection to the datastore may be idle.
	ConnMaxIdleTime time.Duration

	// ConnMaxLifetime is the maximum amount of time a connection to the datastore may be reused.
	ConnMaxLifetime time.Duration

	// Metrics is configuration for the Datastore metrics.
	Metrics DatastoreMetricsConfig
}

// GRPCConfig defines OpenFGA server configurations for grpc server specific settings.
type GRPCConfig struct {
	Addr string
	TLS  *TLSConfig
}

// HTTPConfig defines OpenFGA server configurations for HTTP server specific settings.
type HTTPConfig struct {
	Enabled bool
	Addr    string
	TLS     *TLSConfig

	// UpstreamTimeout is the timeout duration for proxying HTTP requests upstream
	// to the grpc endpoint. It cannot be smaller than Config.ListObjectsDeadline.
	UpstreamTimeout time.Duration

	CORSAllowedOrigins []string
	CORSAllowedHeaders []string
}

// TLSConfig defines configuration specific to Transport Layer Security (TLS) settings.
type TLSConfig struct {
	Enabled  bool
	CertPath string `mapstructure:"cert"`
	KeyPath  string `mapstructure:"key"`
}

// AuthnConfig defines OpenFGA server configurations for authentication specific settings.
type AuthnConfig struct {

	// Method is the authentication method that should be enforced (e.g. 'none', 'preshared',
	// 'oidc')
	Method                   string
	*AuthnOIDCConfig         `mapstructure:"oidc"`
	*AuthnPresharedKeyConfig `mapstructure:"preshared"`
}

// AuthnOIDCConfig defines configurations for the 'oidc' method of authentication.
type AuthnOIDCConfig struct {
	Issuer         string
	IssuerAliases  []string
	Subjects       []string
	Audience       string
	ClientIDClaims []string
}

// AuthnPresharedKeyConfig defines configurations for the 'preshared' method of authentication.
type AuthnPresharedKeyConfig struct {
	// Keys define the preshared keys to verify authn tokens against.
	Keys []string `json:"-"` // private field, won't be logged
}

// LogConfig defines OpenFGA server configurations for log specific settings. For production, we
// recommend using the 'json' log format.
type LogConfig struct {
	// Format is the log format to use in the log output (e.g. 'text' or 'json')
	Format string

	// Level is the log level to use in the log output (e.g. 'none', 'debug', or 'info')
	Level string

	// Format of the timestamp in the log output (e.g. 'Unix'(default) or 'ISO8601')
	TimestampFormat string
}

type TraceConfig struct {
	Enabled     bool
	OTLP        OTLPTraceConfig `mapstructure:"otlp"`
	SampleRatio float64
	ServiceName string
}

type OTLPTraceConfig struct {
	Endpoint string
	TLS      OTLPTraceTLSConfig
}

type OTLPTraceTLSConfig struct {
	Enabled bool
}

// PlaygroundConfig defines OpenFGA server configurations for the Playground specific settings.
type PlaygroundConfig struct {
	Enabled bool
	Port    int
}

// ProfilerConfig defines server configurations specific to pprof profiling.
type ProfilerConfig struct {
	Enabled bool
	Addr    string
}

// MetricConfig defines configurations for serving custom metrics from OpenFGA.
type MetricConfig struct {
	Enabled             bool
	Addr                string
	EnableRPCHistograms bool
}

// CheckQueryCache defines configuration for caching when resolving check.
type CheckQueryCache struct {
	Enabled bool
	TTL     time.Duration
}

// CheckCacheConfig defines configuration for a cache that is shared across Check requests.
type CheckCacheConfig struct {
	Limit uint32
}

// IteratorCacheConfig defines configuration to cache storage iterator results.
type IteratorCacheConfig struct {
	Enabled    bool
	MaxResults uint32
	TTL        time.Duration
}

// SharedIteratorConfig defines configuration to share storage iterator.
type SharedIteratorConfig struct {
	Enabled bool
	Limit   uint32
}

// CacheControllerConfig defines configuration to manage cache invalidation dynamically by observing whether
// there are recent tuple changes to specified store.
type CacheControllerConfig struct {
	Enabled bool
	TTL     time.Duration
}

// DispatchThrottlingConfig defines configurations for dispatch throttling.
type DispatchThrottlingConfig struct {
	Enabled      bool
	Frequency    time.Duration
	Threshold    uint32
	MaxThreshold uint32
}

// DatastoreThrottleConfig defines configurations for database throttling.
// A threshold <= 0 means DatastoreThrottling is not enabled.
type DatastoreThrottleConfig struct {
	Threshold int
	Duration  time.Duration
}

// AccessControlConfig is the configuration for the access control feature.
type AccessControlConfig struct {
	Enabled bool
	StoreID string
	ModelID string
}

type PlannerConfig struct {
	EvictionThreshold time.Duration
	CleanupInterval   time.Duration
}

type Config struct {
	// If you change any of these settings, please update the documentation at
	// https://github.com/openfga/openfga.dev/blob/main/docs/content/intro/setup-openfga.mdx

	// ListObjectsDeadline defines the maximum amount of time to accumulate ListObjects results
	// before the server will respond. This is to protect the server from misuse of the
	// ListObjects endpoints. It cannot be larger than HTTPConfig.UpstreamTimeout.
	ListObjectsDeadline time.Duration

	// ListObjectsMaxResults defines the maximum number of results to accumulate
	// before the non-streaming ListObjects API will respond to the client.
	// This is to protect the server from misuse of the ListObjects endpoints.
	ListObjectsMaxResults uint32

	// ListUsersDeadline defines the maximum amount of time to accumulate ListUsers results
	// before the server will respond. This is to protect the server from misuse of the
	// ListUsers endpoints. It cannot be larger than the configured server's request timeout (RequestTimeout or HTTPConfig.UpstreamTimeout).
	ListUsersDeadline time.Duration

	// ListUsersMaxResults defines the maximum number of results to accumulate
	// before the non-streaming ListUsers API will respond to the client.
	// This is to protect the server from misuse of the ListUsers endpoints.
	ListUsersMaxResults uint32

	// MaxTuplesPerWrite defines the maximum number of tuples per Write endpoint.
	MaxTuplesPerWrite int

	// MaxChecksPerBatchCheck defines the maximum number of tuples
	// that can be passed in each BatchCheck request.
	MaxChecksPerBatchCheck uint32

	// MaxConcurrentChecksPerBatchCheck defines the maximum number of checks
	// that can be run in simultaneously
	MaxConcurrentChecksPerBatchCheck uint32

	// MaxTypesPerAuthorizationModel defines the maximum number of type definitions per
	// authorization model for the WriteAuthorizationModel endpoint.
	MaxTypesPerAuthorizationModel int

	// MaxAuthorizationModelSizeInBytes defines the maximum size in bytes allowed for
	// persisting an Authorization Model.
	MaxAuthorizationModelSizeInBytes int

	// MaxConcurrentReadsForListObjects defines the maximum number of concurrent database reads
	// allowed in ListObjects queries
	MaxConcurrentReadsForListObjects uint32

	// MaxConcurrentReadsForCheck defines the maximum number of concurrent database reads allowed in
	// Check queries
	MaxConcurrentReadsForCheck uint32

	// MaxConcurrentReadsForListUsers defines the maximum number of concurrent database reads
	// allowed in ListUsers queries
	MaxConcurrentReadsForListUsers uint32

	// MaxConditionEvaluationCost defines the maximum cost for CEL condition evaluation before a request returns an error
	MaxConditionEvaluationCost uint64

	// ChangelogHorizonOffset is an offset in minutes from the current time. Changes that occur
	// after this offset will not be included in the response of ReadChanges.
	ChangelogHorizonOffset int

	// Experimentals is a list of the experimental features to enable in the OpenFGA server.
	Experimentals []string

	// AccessControl is the configuration for the access control feature.
	AccessControl AccessControlConfig

	// ResolveNodeLimit indicates how deeply nested an authorization model can be before a query
	// errors out.
	ResolveNodeLimit uint32

	// ResolveNodeBreadthLimit indicates how many nodes on a given level can be evaluated
	// concurrently in a query
	ResolveNodeBreadthLimit uint32

	// RequestTimeout configures request timeout.  If both HTTP upstream timeout and request timeout are specified,
	// request timeout will be prioritized
	RequestTimeout time.Duration

	// ContextPropagationToDatastore enables propagation of a requests context to the datastore,
	// thereby receiving API cancellation signals
	ContextPropagationToDatastore bool

	Datastore                     DatastoreConfig
	GRPC                          GRPCConfig
	HTTP                          HTTPConfig
	Authn                         AuthnConfig
	Log                           LogConfig
	Trace                         TraceConfig
	Playground                    PlaygroundConfig
	Profiler                      ProfilerConfig
	Metrics                       MetricConfig
	CheckCache                    CheckCacheConfig
	CheckIteratorCache            IteratorCacheConfig
	CheckQueryCache               CheckQueryCache
	CacheController               CacheControllerConfig
	CheckDispatchThrottling       DispatchThrottlingConfig
	ListObjectsDispatchThrottling DispatchThrottlingConfig
	ListUsersDispatchThrottling   DispatchThrottlingConfig
	CheckDatastoreThrottle        DatastoreThrottleConfig
	ListObjectsDatastoreThrottle  DatastoreThrottleConfig
	ListUsersDatastoreThrottle    DatastoreThrottleConfig
	ListObjectsIteratorCache      IteratorCacheConfig
	SharedIterator                SharedIteratorConfig
	Planner                       PlannerConfig

	RequestDurationDatastoreQueryCountBuckets []string
	RequestDurationDispatchCountBuckets       []string
}

func (cfg *Config) Verify() error {
	if err := cfg.VerifyServerSettings(); err != nil {
		return err
	}
	return cfg.VerifyBinarySettings()
}

func (cfg *Config) VerifyServerSettings() error {
	if err := cfg.verifyDeadline(); err != nil {
		return err
	}

	if cfg.MaxConcurrentReadsForListUsers == 0 {
		return fmt.Errorf("config 'maxConcurrentReadsForListUsers' cannot be 0")
	}

	if err := cfg.verifyRequestDurationDatastoreQueryCountBuckets(); err != nil {
		return err
	}

	if err := cfg.verifyCacheConfig(); err != nil {
		return err
	}

	if len(cfg.RequestDurationDispatchCountBuckets) == 0 {
		return errors.New("request duration datastore dispatch count buckets must not be empty")
	}
	for _, val := range cfg.RequestDurationDispatchCountBuckets {
		valInt, err := strconv.Atoi(val)
		if err != nil || valInt < 0 {
			return errors.New(
				"request duration dispatch count bucket items must be non-negative integer",
			)
		}
	}

	err := cfg.VerifyDispatchThrottlingConfig()
	if err != nil {
		return err
	}

	err = cfg.VerifyDatastoreThrottlesConfig()
	if err != nil {
		return err
	}

	if cfg.ListObjectsDeadline < 0 {
		return errors.New("listObjectsDeadline must be non-negative time duration")
	}

	if cfg.ListUsersDeadline < 0 {
		return errors.New("listUsersDeadline must be non-negative time duration")
	}

	if cfg.MaxConditionEvaluationCost < 100 {
		return errors.New("maxConditionsEvaluationCosts less than 100 can cause API compatibility problems with Conditions")
	}

	if cfg.Datastore.MaxOpenConns < cfg.Datastore.MinOpenConns {
		return errors.New("datastore MaxOpenConns must not be less than datastore MinOpenConns")
	}

	if cfg.Datastore.MinOpenConns < cfg.Datastore.MinIdleConns {
		return errors.New("datastore MinOpenConns must not be less than datastore MinIdleConns")
	}

	return nil
}

func (cfg *Config) VerifyBinarySettings() error {
	if cfg.Log.Format != "text" && cfg.Log.Format != "json" {
		return fmt.Errorf("config 'log.format' must be one of ['text', 'json']")
	}

	if cfg.Log.Level != "none" &&
		cfg.Log.Level != "debug" &&
		cfg.Log.Level != "info" &&
		cfg.Log.Level != "warn" &&
		cfg.Log.Level != "error" &&
		cfg.Log.Level != "panic" &&
		cfg.Log.Level != "fatal" {
		return fmt.Errorf(
			"config 'log.level' must be one of ['none', 'debug', 'info', 'warn', 'error', 'panic', 'fatal']",
		)
	}

	if cfg.Log.Level == "none" {
		fmt.Println("WARNING: Logging is not enabled. It is highly recommended to enable logging in production environments to avoid masking attacker operations.")
	}

	if cfg.Log.TimestampFormat != "Unix" && cfg.Log.TimestampFormat != "ISO8601" {
		return fmt.Errorf("config 'log.TimestampFormat' must be one of ['Unix', 'ISO8601']")
	}

	if cfg.Playground.Enabled {
		if !cfg.HTTP.Enabled {
			return errors.New("the HTTP server must be enabled to run the openfga playground")
		}

		if cfg.Authn.Method != "none" && cfg.Authn.Method != "preshared" {
			return errors.New("the playground only supports authn methods 'none' and 'preshared'")
		}
	}

	if cfg.HTTP.TLS.Enabled {
		if cfg.HTTP.TLS.CertPath == "" || cfg.HTTP.TLS.KeyPath == "" {
			return errors.New("'http.tls.cert' and 'http.tls.key' configs must be set")
		}
	}

	if cfg.GRPC.TLS.Enabled {
		if cfg.GRPC.TLS.CertPath == "" || cfg.GRPC.TLS.KeyPath == "" {
			return errors.New("'grpc.tls.cert' and 'grpc.tls.key' configs must be set")
		}
	}

	if cfg.RequestTimeout < 0 {
		return errors.New("requestTimeout must be a non-negative time duration")
	}

	if cfg.RequestTimeout == 0 && cfg.HTTP.Enabled && cfg.HTTP.UpstreamTimeout < 0 {
		return errors.New("http.upstreamTimeout must be a non-negative time duration")
	}

	if viper.IsSet("cache.limit") && !viper.IsSet("checkCache.limit") {
		fmt.Println("WARNING: flag `check-query-cache-limit` is deprecated. Please set --check-cache-limit instead.")
	}

	return nil
}

// DefaultContextTimeout returns the runtime DefaultContextTimeout.
// If requestTimeout > 0, we should let the middleware take care of the timeout and the
// runtime.DefaultContextTimeout is used as last resort.
// Otherwise, use the http upstream timeout if http is enabled.
func DefaultContextTimeout(config *Config) time.Duration {
	if config.RequestTimeout > 0 {
		return config.RequestTimeout + additionalUpstreamTimeout
	}
	if config.HTTP.Enabled && config.HTTP.UpstreamTimeout > 0 {
		return config.HTTP.UpstreamTimeout
	}
	return 0
}

// VerifyDispatchThrottlingConfig ensures DispatchThrottlingConfigs are valid.
func (cfg *Config) VerifyDispatchThrottlingConfig() error {
	if cfg.CheckDispatchThrottling.Enabled {
		if cfg.CheckDispatchThrottling.Frequency <= 0 {
			return errors.New("'checkDispatchThrottling.frequency' must be non-negative time duration")
		}
		if cfg.CheckDispatchThrottling.Threshold <= 0 {
			return errors.New("'checkDispatchThrottling.threshold' must be non-negative integer")
		}
		if cfg.CheckDispatchThrottling.MaxThreshold != 0 && cfg.CheckDispatchThrottling.Threshold > cfg.CheckDispatchThrottling.MaxThreshold {
			return errors.New("'checkDispatchThrottling.threshold' must be less than or equal to 'checkDispatchThrottling.maxThreshold' respectively")
		}
	}

	if cfg.ListObjectsDispatchThrottling.Enabled {
		if cfg.ListObjectsDispatchThrottling.Frequency <= 0 {
			return errors.New("'listObjectsDispatchThrottling.frequency' must be non-negative time duration")
		}
		if cfg.ListObjectsDispatchThrottling.Threshold <= 0 {
			return errors.New("'listObjectsDispatchThrottling.threshold' must be non-negative integer")
		}
		if cfg.ListObjectsDispatchThrottling.MaxThreshold != 0 && cfg.ListObjectsDispatchThrottling.Threshold > cfg.ListObjectsDispatchThrottling.MaxThreshold {
			return errors.New("'listObjectsDispatchThrottling.threshold' must be less than or equal to 'listObjectsDispatchThrottling.maxThreshold'")
		}
	}

	if cfg.ListUsersDispatchThrottling.Enabled {
		if cfg.ListUsersDispatchThrottling.Frequency <= 0 {
			return errors.New("'listUsersDispatchThrottling.frequency' must be non-negative time duration")
		}
		if cfg.ListUsersDispatchThrottling.Threshold <= 0 {
			return errors.New("'listUsersDispatchThrottling.threshold' must be non-negative integer")
		}
		if cfg.ListUsersDispatchThrottling.MaxThreshold != 0 && cfg.ListUsersDispatchThrottling.Threshold > cfg.ListUsersDispatchThrottling.MaxThreshold {
			return errors.New("'listUsersDispatchThrottling.threshold' must be less than or equal to 'listUsersDispatchThrottling.maxThreshold'")
		}
	}
	return nil
}

// VerifyDatastoreThrottlesConfig ensures VerifyDatastoreThrottlesConfig is called so that the right values are verified.
func (cfg *Config) VerifyDatastoreThrottlesConfig() error {
	if cfg.CheckDatastoreThrottle.Threshold > 0 && cfg.CheckDatastoreThrottle.Duration <= 0 {
		return errors.New("'checkDatastoreThrottler.duration' must be greater than zero if threshold > 0")
	}
	if cfg.ListObjectsDatastoreThrottle.Threshold > 0 && cfg.ListObjectsDatastoreThrottle.Duration <= 0 {
		return errors.New("'listObjectsDatastoreThrottler.duration' must be greater than zero if threshold > 0")
	}
	if cfg.ListUsersDatastoreThrottle.Threshold > 0 && cfg.ListUsersDatastoreThrottle.Duration <= 0 {
		return errors.New("'listUsersDatastoreThrottler.duration' must be greater than zero if threshold > 0")
	}
	return nil
}

func (cfg *Config) verifyDeadline() error {
	configuredTimeout := DefaultContextTimeout(cfg)

	if cfg.ListObjectsDeadline > configuredTimeout {
		return fmt.Errorf(
			"configured request timeout (%s) cannot be lower than 'listObjectsDeadline' config (%s)",
			configuredTimeout,
			cfg.ListObjectsDeadline,
		)
	}
	if cfg.ListUsersDeadline > configuredTimeout {
		return fmt.Errorf(
			"configured request timeout (%s) cannot be lower than 'listUsersDeadline' config (%s)",
			configuredTimeout,
			cfg.ListUsersDeadline,
		)
	}
	return nil
}

func (cfg *Config) verifyRequestDurationDatastoreQueryCountBuckets() error {
	if len(cfg.RequestDurationDatastoreQueryCountBuckets) == 0 {
		return errors.New("request duration datastore query count buckets must not be empty")
	}
	for _, val := range cfg.RequestDurationDatastoreQueryCountBuckets {
		valInt, err := strconv.Atoi(val)
		if err != nil || valInt < 0 {
			return errors.New(
				"request duration datastore query count bucket items must be non-negative integer",
			)
		}
	}
	return nil
}

func (cfg *Config) verifyCacheConfig() error {
	if cfg.CheckQueryCache.Enabled && cfg.CheckQueryCache.TTL <= 0 {
		return errors.New("'checkQueryCache.ttl' must be greater than zero")
	}
	if cfg.CheckIteratorCache.Enabled {
		if cfg.CheckIteratorCache.TTL <= 0 {
			return errors.New("'checkIteratorCache.ttl' must be greater than zero")
		}
		if cfg.CheckIteratorCache.MaxResults <= 0 {
			return errors.New("'checkIteratorCache.maxResults' must be greater than zero")
		}
	}
	if cfg.ListObjectsIteratorCache.Enabled {
		if cfg.ListObjectsIteratorCache.TTL <= 0 {
			return errors.New("'listObjectsIteratorCache.ttl' must be greater than zero")
		}
		if cfg.ListObjectsIteratorCache.MaxResults <= 0 {
			return errors.New("'listObjectsIteratorCache.maxResults' must be greater than zero")
		}
	}
	if cfg.CacheController.Enabled && cfg.CacheController.TTL <= 0 {
		return errors.New("'cacheController.ttl' must be greater than zero")
	}
	return nil
}

// MaxConditionEvaluationCost ensures a safe value for CEL evaluation cost.
func MaxConditionEvaluationCost() uint64 {
	return max(DefaultMaxConditionEvaluationCost, viper.GetUint64("maxConditionEvaluationCost"))
}

// DefaultConfig is the OpenFGA server default configurations.
func DefaultConfig() *Config {
	return &Config{
		MaxTuplesPerWrite:                         DefaultMaxTuplesPerWrite,
		MaxTypesPerAuthorizationModel:             DefaultMaxTypesPerAuthorizationModel,
		MaxAuthorizationModelSizeInBytes:          DefaultMaxAuthorizationModelSizeInBytes,
		MaxChecksPerBatchCheck:                    DefaultMaxChecksPerBatchCheck,
		MaxConcurrentChecksPerBatchCheck:          DefaultMaxConcurrentChecksPerBatchCheck,
		MaxConcurrentReadsForCheck:                DefaultMaxConcurrentReadsForCheck,
		MaxConcurrentReadsForListObjects:          DefaultMaxConcurrentReadsForListObjects,
		MaxConcurrentReadsForListUsers:            DefaultMaxConcurrentReadsForListUsers,
		MaxConditionEvaluationCost:                DefaultMaxConditionEvaluationCost,
		ChangelogHorizonOffset:                    DefaultChangelogHorizonOffset,
		ResolveNodeLimit:                          DefaultResolveNodeLimit,
		ResolveNodeBreadthLimit:                   DefaultResolveNodeBreadthLimit,
		Experimentals:                             []string{},
		AccessControl:                             AccessControlConfig{Enabled: false, StoreID: "", ModelID: ""},
		ListObjectsDeadline:                       DefaultListObjectsDeadline,
		ListObjectsMaxResults:                     DefaultListObjectsMaxResults,
		ListUsersMaxResults:                       DefaultListUsersMaxResults,
		ListUsersDeadline:                         DefaultListUsersDeadline,
		RequestDurationDatastoreQueryCountBuckets: []string{"50", "200"},
		RequestDurationDispatchCountBuckets:       []string{"50", "200"},
		Datastore: DatastoreConfig{
			Engine:       "memory",
			MaxCacheSize: DefaultMaxAuthorizationModelCacheSize,
			MinIdleConns: 0,
			MaxIdleConns: 10,
			MinOpenConns: 0,
			MaxOpenConns: 30,
		},
		GRPC: GRPCConfig{
			Addr: "0.0.0.0:8081",
			TLS:  &TLSConfig{Enabled: false},
		},
		HTTP: HTTPConfig{
			Enabled:            true,
			Addr:               "0.0.0.0:8080",
			TLS:                &TLSConfig{Enabled: false},
			UpstreamTimeout:    5 * time.Second,
			CORSAllowedOrigins: []string{"*"},
			CORSAllowedHeaders: []string{"*"},
		},
		Authn: AuthnConfig{
			Method:                  "none",
			AuthnPresharedKeyConfig: &AuthnPresharedKeyConfig{},
			AuthnOIDCConfig:         &AuthnOIDCConfig{},
		},
		Log: LogConfig{
			Format:          "text",
			Level:           "info",
			TimestampFormat: "Unix",
		},
		Trace: TraceConfig{
			Enabled: false,
			OTLP: OTLPTraceConfig{
				Endpoint: "0.0.0.0:4317",
				TLS: OTLPTraceTLSConfig{
					Enabled: false,
				},
			},
			SampleRatio: 0.2,
			ServiceName: "openfga",
		},
		Playground: PlaygroundConfig{
			Enabled: true,
			Port:    3000,
		},
		Profiler: ProfilerConfig{
			Enabled: false,
			Addr:    ":3001",
		},
		Metrics: MetricConfig{
			Enabled:             true,
			Addr:                "0.0.0.0:2112",
			EnableRPCHistograms: false,
		},
		CheckIteratorCache: IteratorCacheConfig{
			Enabled:    DefaultCheckIteratorCacheEnabled,
			MaxResults: DefaultCheckIteratorCacheMaxResults,
			TTL:        DefaultCheckIteratorCacheTTL,
		},
		CheckQueryCache: CheckQueryCache{
			Enabled: DefaultCheckQueryCacheEnabled,
			TTL:     DefaultCheckQueryCacheTTL,
		},
		CheckCache: CheckCacheConfig{
			Limit: DefaultCheckCacheLimit,
		},
		SharedIterator: SharedIteratorConfig{
			Enabled: DefaultSharedIteratorEnabled,
			Limit:   DefaultSharedIteratorLimit,
		},
		CacheController: CacheControllerConfig{
			Enabled: DefaultCacheControllerConfigEnabled,
			TTL:     DefaultCacheControllerConfigTTL,
		},
		CheckDispatchThrottling: DispatchThrottlingConfig{
			Enabled:      DefaultCheckDispatchThrottlingEnabled,
			Frequency:    DefaultCheckDispatchThrottlingFrequency,
			Threshold:    DefaultCheckDispatchThrottlingDefaultThreshold,
			MaxThreshold: DefaultCheckDispatchThrottlingMaxThreshold,
		},
		ListObjectsDispatchThrottling: DispatchThrottlingConfig{
			Enabled:      DefaultListObjectsDispatchThrottlingEnabled,
			Frequency:    DefaultListObjectsDispatchThrottlingFrequency,
			Threshold:    DefaultListObjectsDispatchThrottlingDefaultThreshold,
			MaxThreshold: DefaultListObjectsDispatchThrottlingMaxThreshold,
		},
		ListUsersDispatchThrottling: DispatchThrottlingConfig{
			Enabled:      DefaultListUsersDispatchThrottlingEnabled,
			Frequency:    DefaultListUsersDispatchThrottlingFrequency,
			Threshold:    DefaultListUsersDispatchThrottlingDefaultThreshold,
			MaxThreshold: DefaultListUsersDispatchThrottlingMaxThreshold,
		},
		ListObjectsIteratorCache: IteratorCacheConfig{
			Enabled:    DefaultListObjectsIteratorCacheEnabled,
			MaxResults: DefaultListObjectsIteratorCacheMaxResults,
			TTL:        DefaultListObjectsIteratorCacheTTL,
		},
		CheckDatastoreThrottle: DatastoreThrottleConfig{
			Threshold: 0,
			Duration:  0,
		},
		ListObjectsDatastoreThrottle: DatastoreThrottleConfig{
			Threshold: 0,
			Duration:  0,
		},
		ListUsersDatastoreThrottle: DatastoreThrottleConfig{
			Threshold: 0,
			Duration:  0,
		},
		RequestTimeout:                DefaultRequestTimeout,
		ContextPropagationToDatastore: false,
		Planner: PlannerConfig{
			EvictionThreshold: DefaultPlannerEvictionThreshold,
			CleanupInterval:   DefaultPlannerCleanupInterval,
		},
	}
}

// MustDefaultConfig returns default server config with the playground, tracing and metrics turned off.
func MustDefaultConfig() *Config {
	config := DefaultConfig()

	config.Playground.Enabled = false
	config.Metrics.Enabled = false

	return config
}
