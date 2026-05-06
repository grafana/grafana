package cache

import (
	"context"
	"crypto/tls"
	"flag"
	"fmt"
	"net"
	"strings"
	"time"
	"unsafe"

	"github.com/grafana/dskit/flagext"

	"github.com/go-redis/redis/v8"
)

// RedisConfig defines how a RedisCache should be constructed.
type RedisConfig struct {
	Endpoint           string         `yaml:"endpoint"`
	MasterName         string         `yaml:"master_name"`
	Timeout            time.Duration  `yaml:"timeout"`
	Expiration         time.Duration  `yaml:"expiration"`
	DB                 int            `yaml:"db"`
	PoolSize           int            `yaml:"pool_size"`
	Username           string         `yaml:"username"`
	Password           flagext.Secret `yaml:"password"`
	EnableTLS          bool           `yaml:"tls_enabled"`
	InsecureSkipVerify bool           `yaml:"tls_insecure_skip_verify"`
	IdleTimeout        time.Duration  `yaml:"idle_timeout"`
	MaxConnAge         time.Duration  `yaml:"max_connection_age"`
	RouteRandomly      bool           `yaml:"route_randomly"`
}

// RegisterFlagsWithPrefix adds the flags required to config this to the given FlagSet
func (cfg *RedisConfig) RegisterFlagsWithPrefix(prefix, description string, f *flag.FlagSet) {
	f.StringVar(&cfg.Endpoint, prefix+"redis.endpoint", "", description+"Redis Server or Cluster configuration endpoint to use for caching. A comma-separated list of endpoints for Redis Cluster or Redis Sentinel. If empty, no redis will be used.")
	f.StringVar(&cfg.MasterName, prefix+"redis.master-name", "", description+"Redis Sentinel master name. An empty string for Redis Server or Redis Cluster.")
	f.DurationVar(&cfg.Timeout, prefix+"redis.timeout", 500*time.Millisecond, description+"Maximum time to wait before giving up on redis requests.")
	f.DurationVar(&cfg.Expiration, prefix+"redis.expiration", 0, description+"How long keys stay in the redis.")
	f.IntVar(&cfg.DB, prefix+"redis.db", 0, description+"Database index.")
	f.IntVar(&cfg.PoolSize, prefix+"redis.pool-size", 0, description+"Maximum number of connections in the pool.")
	f.StringVar(&cfg.Username, prefix+"redis.username", "", description+"Username to use when connecting to redis.")
	f.Var(&cfg.Password, prefix+"redis.password", description+"Password to use when connecting to redis.")
	f.BoolVar(&cfg.EnableTLS, prefix+"redis.tls-enabled", false, description+"Enable connecting to redis with TLS.")
	f.BoolVar(&cfg.InsecureSkipVerify, prefix+"redis.tls-insecure-skip-verify", false, description+"Skip validating server certificate.")
	f.DurationVar(&cfg.IdleTimeout, prefix+"redis.idle-timeout", 0, description+"Close connections after remaining idle for this duration. If the value is zero, then idle connections are not closed.")
	f.DurationVar(&cfg.MaxConnAge, prefix+"redis.max-connection-age", 0, description+"Close connections older than this duration. If the value is zero, then the pool does not close connections based on age.")
	f.BoolVar(&cfg.RouteRandomly, prefix+"redis.route-randomly", false, description+"By default, the Redis client only reads from the master node. Enabling this option can lower pressure on the master node by randomly routing read-only commands to the master and any available replicas.")
}

type RedisClient struct {
	expiration time.Duration
	timeout    time.Duration
	rdb        redis.UniversalClient
}

// NewRedisClient creates Redis client
func NewRedisClient(cfg *RedisConfig) (*RedisClient, error) {
	endpoints, err := deriveEndpoints(cfg.Endpoint, net.LookupHost)
	if err != nil {
		return nil, fmt.Errorf("failed to derive endpoints: %w", err)
	}

	opt := &redis.UniversalOptions{
		Addrs:         endpoints,
		MasterName:    cfg.MasterName,
		Username:      cfg.Username,
		Password:      cfg.Password.String(),
		DB:            cfg.DB,
		PoolSize:      cfg.PoolSize,
		IdleTimeout:   cfg.IdleTimeout,
		MaxConnAge:    cfg.MaxConnAge,
		RouteRandomly: cfg.RouteRandomly,
	}
	if cfg.EnableTLS {
		opt.TLSConfig = &tls.Config{InsecureSkipVerify: cfg.InsecureSkipVerify}
	}
	return &RedisClient{
		expiration: cfg.Expiration,
		timeout:    cfg.Timeout,
		rdb:        redis.NewUniversalClient(opt),
	}, nil
}

func deriveEndpoints(endpoint string, lookup func(host string) ([]string, error)) ([]string, error) {
	if lookup == nil {
		return nil, fmt.Errorf("lookup function is nil")
	}

	endpoints := strings.Split(endpoint, ",")

	// no endpoints or multiple endpoints will not need derivation
	if len(endpoints) != 1 {
		return endpoints, nil
	}

	// Handle single configuration endpoint which resolves multiple nodes.
	host, port, err := net.SplitHostPort(endpoints[0])
	if err != nil {
		return nil, fmt.Errorf("splitting host:port failed :%w", err)
	}
	addrs, err := lookup(host)
	if err != nil {
		return nil, fmt.Errorf("could not lookup host: %w", err)
	}

	// only use the resolved addresses if they are not all loopback addresses;
	// multiple addresses invokes cluster mode
	allLoopback := allAddrsAreLoopback(addrs)
	if len(addrs) > 1 && !allLoopback {
		endpoints = nil
		for _, addr := range addrs {
			endpoints = append(endpoints, net.JoinHostPort(addr, port))
		}
	}

	return endpoints, nil
}

func allAddrsAreLoopback(addrs []string) bool {
	for _, addr := range addrs {
		if !net.ParseIP(addr).IsLoopback() {
			return false
		}
	}

	return true
}

func (c *RedisClient) Ping(ctx context.Context) error {
	var cancel context.CancelFunc
	if c.timeout > 0 {
		ctx, cancel = context.WithTimeout(ctx, c.timeout)
		defer cancel()
	}

	pong, err := c.rdb.Ping(ctx).Result()
	if err != nil {
		return err
	}
	if pong != "PONG" {
		return fmt.Errorf("redis: Unexpected PING response %q", pong)
	}
	return nil
}

func (c *RedisClient) MSet(ctx context.Context, keys []string, values [][]byte) error {
	var cancel context.CancelFunc
	if c.timeout > 0 {
		ctx, cancel = context.WithTimeout(ctx, c.timeout)
		defer cancel()
	}

	pipe := c.rdb.TxPipeline()
	for i := range keys {
		pipe.Set(ctx, keys[i], values[i], c.expiration)
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (c *RedisClient) MGet(ctx context.Context, keys []string) ([][]byte, error) {
	var cancel context.CancelFunc
	if c.timeout > 0 {
		ctx, cancel = context.WithTimeout(ctx, c.timeout)
		defer cancel()
	}

	ret := make([][]byte, len(keys))

	// redis.UniversalClient can take redis.Client and redis.ClusterClient.
	// if redis.Client is set, then Single node or sentinel configuration. mget is always supported.
	// if redis.ClusterClient is set, then Redis Cluster configuration. mget may not be supported.
	_, isCluster := c.rdb.(*redis.ClusterClient)

	if isCluster {
		for i, key := range keys {
			cmd := c.rdb.Get(ctx, key)
			err := cmd.Err()
			if err == redis.Nil {
				// if key not found, response nil
				continue
			} else if err != nil {
				return nil, err
			}
			ret[i] = StringToBytes(cmd.Val())
		}
	} else {
		cmd := c.rdb.MGet(ctx, keys...)
		if err := cmd.Err(); err != nil {
			return nil, err
		}

		for i, val := range cmd.Val() {
			if val != nil {
				ret[i] = StringToBytes(val.(string))
			}
		}
	}

	return ret, nil
}

func (c *RedisClient) Close() error {
	return c.rdb.Close()
}

// StringToBytes converts string to byte slice. (copied from vendor/github.com/go-redis/redis/v8/internal/util/unsafe.go)
func StringToBytes(s string) []byte {
	return *(*[]byte)(unsafe.Pointer(
		&struct {
			string
			Cap int
		}{s, len(s)},
	))
}
