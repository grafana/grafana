package etcd

import (
	"context"
	"crypto/tls"
	"flag"
	"fmt"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"
	"go.etcd.io/etcd/client/pkg/v3/transport"
	clientv3 "go.etcd.io/etcd/client/v3"

	"github.com/grafana/dskit/backoff"
	dstls "github.com/grafana/dskit/crypto/tls"
	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/kv/codec"
)

// Config for a new etcd.Client.
type Config struct {
	Endpoints   []string           `yaml:"endpoints"`
	DialTimeout time.Duration      `yaml:"dial_timeout" category:"advanced"`
	MaxRetries  int                `yaml:"max_retries" category:"advanced"`
	EnableTLS   bool               `yaml:"tls_enabled" category:"advanced"`
	TLS         dstls.ClientConfig `yaml:",inline"`

	UserName string         `yaml:"username"`
	Password flagext.Secret `yaml:"password"`
}

// Clientv3Facade is a subset of all Etcd client operations that are required
// to implement an Etcd version of kv.Client
type Clientv3Facade interface {
	clientv3.KV
	clientv3.Watcher
}

// Client implements kv.Client for etcd.
type Client struct {
	cfg    Config
	codec  codec.Codec
	cli    Clientv3Facade
	logger log.Logger
}

func (cfg *Config) RegisterFlags(f *flag.FlagSet) {
	cfg.RegisterFlagsWithPrefix(f, "")
}

// RegisterFlagsWithPrefix adds the flags required to config this to the given FlagSet.
func (cfg *Config) RegisterFlagsWithPrefix(f *flag.FlagSet, prefix string) {
	cfg.Endpoints = []string{}
	f.Var((*flagext.StringSlice)(&cfg.Endpoints), prefix+"etcd.endpoints", "The etcd endpoints to connect to.")
	f.DurationVar(&cfg.DialTimeout, prefix+"etcd.dial-timeout", 10*time.Second, "The dial timeout for the etcd connection.")
	f.IntVar(&cfg.MaxRetries, prefix+"etcd.max-retries", 10, "The maximum number of retries to do for failed ops.")
	f.BoolVar(&cfg.EnableTLS, prefix+"etcd.tls-enabled", false, "Enable TLS.")
	f.StringVar(&cfg.UserName, prefix+"etcd.username", "", "Etcd username.")
	f.Var(&cfg.Password, prefix+"etcd.password", "Etcd password.")
	cfg.TLS.RegisterFlagsWithPrefix(prefix+"etcd", f)
}

// GetTLS sets the TLS config field with certs
func (cfg *Config) GetTLS() (*tls.Config, error) {
	if !cfg.EnableTLS {
		return nil, nil
	}
	tlsInfo := &transport.TLSInfo{
		CertFile:           cfg.TLS.CertPath,
		KeyFile:            cfg.TLS.KeyPath,
		TrustedCAFile:      cfg.TLS.CAPath,
		ServerName:         cfg.TLS.ServerName,
		InsecureSkipVerify: cfg.TLS.InsecureSkipVerify,
	}
	return tlsInfo.ClientConfig()
}

// New makes a new Client.
func New(cfg Config, codec codec.Codec, logger log.Logger) (*Client, error) {
	tlsConfig, err := cfg.GetTLS()
	if err != nil {
		return nil, errors.Wrapf(err, "unable to initialise TLS configuration for etcd")
	}
	cli, err := clientv3.New(clientv3.Config{
		Endpoints:   cfg.Endpoints,
		DialTimeout: cfg.DialTimeout,
		// Configure the keepalive to make sure that the client reconnects
		// to the etcd service endpoint(s) in case the current connection is
		// dead (ie. the node where etcd is running is dead or a network
		// partition occurs).
		//
		// The settings:
		// - DialKeepAliveTime: time before the client pings the server to
		//   see if transport is alive (10s hardcoded)
		// - DialKeepAliveTimeout: time the client waits for a response for
		//   the keep-alive probe (set to 2x dial timeout, in order to avoid
		//   exposing another config option which is likely to be a factor of
		//   the dial timeout anyway)
		// - PermitWithoutStream: whether the client should send keepalive pings
		//   to server without any active streams (enabled)
		DialKeepAliveTime:    10 * time.Second,
		DialKeepAliveTimeout: 2 * cfg.DialTimeout,
		PermitWithoutStream:  true,
		TLS:                  tlsConfig,
		Username:             cfg.UserName,
		Password:             cfg.Password.String(),
	})
	if err != nil {
		return nil, err
	}

	return &Client{
		cfg:    cfg,
		codec:  codec,
		cli:    cli,
		logger: logger,
	}, nil
}

// CAS implements kv.Client.
func (c *Client) CAS(ctx context.Context, key string, f func(in interface{}) (out interface{}, retry bool, err error)) error {
	var revision int64
	var lastErr error

	for i := 0; i < c.cfg.MaxRetries; i++ {
		resp, err := c.cli.Get(ctx, key)
		if err != nil {
			level.Error(c.logger).Log("msg", "error getting key", "key", key, "err", err)
			lastErr = err
			continue
		}

		var intermediate interface{}
		if len(resp.Kvs) > 0 {
			intermediate, err = c.codec.Decode(resp.Kvs[0].Value)
			if err != nil {
				level.Error(c.logger).Log("msg", "error decoding key", "key", key, "err", err)
				lastErr = err
				continue
			}
			revision = resp.Kvs[0].Version
		}

		var retry bool
		intermediate, retry, err = f(intermediate)
		if err != nil {
			if !retry {
				return err
			}
			lastErr = err
			continue
		}

		// Callback returning nil means it doesn't want to CAS anymore.
		if intermediate == nil {
			return nil
		}

		buf, err := c.codec.Encode(intermediate)
		if err != nil {
			level.Error(c.logger).Log("msg", "error serialising value", "key", key, "err", err)
			lastErr = err
			continue
		}

		result, err := c.cli.Txn(ctx).
			If(clientv3.Compare(clientv3.Version(key), "=", revision)).
			Then(clientv3.OpPut(key, string(buf))).
			Commit()
		if err != nil {
			level.Error(c.logger).Log("msg", "error CASing", "key", key, "err", err)
			lastErr = err
			continue
		}
		// result is not Succeeded if the the comparison was false, meaning if the modify indexes did not match.
		if !result.Succeeded {
			level.Debug(c.logger).Log("msg", "failed to CAS, revision and version did not match in etcd", "key", key, "revision", revision)
			continue
		}

		return nil
	}

	if lastErr != nil {
		return lastErr
	}
	return fmt.Errorf("failed to CAS %s", key)
}

// WatchKey implements kv.Client.
func (c *Client) WatchKey(ctx context.Context, key string, f func(interface{}) bool) {
	backoff := backoff.New(ctx, backoff.Config{
		MinBackoff: 1 * time.Second,
		MaxBackoff: 1 * time.Minute,
	})

	// Ensure the context used by the Watch is always cancelled.
	watchCtx, cancel := context.WithCancel(ctx)
	defer cancel()

outer:
	for backoff.Ongoing() {
		for resp := range c.cli.Watch(watchCtx, key) {
			if err := resp.Err(); err != nil {
				level.Error(c.logger).Log("msg", "watch error", "key", key, "err", err)
				continue outer
			}

			backoff.Reset()

			for _, event := range resp.Events {
				out, err := c.codec.Decode(event.Kv.Value)
				if err != nil {
					level.Error(c.logger).Log("msg", "error decoding key", "key", key, "err", err)
					continue
				}

				if !f(out) {
					return
				}
			}
		}
	}
}

// WatchPrefix implements kv.Client.
func (c *Client) WatchPrefix(ctx context.Context, key string, f func(string, interface{}) bool) {
	backoff := backoff.New(ctx, backoff.Config{
		MinBackoff: 1 * time.Second,
		MaxBackoff: 1 * time.Minute,
	})

	// Ensure the context used by the Watch is always cancelled.
	watchCtx, cancel := context.WithCancel(ctx)
	defer cancel()

outer:
	for backoff.Ongoing() {
		for resp := range c.cli.Watch(watchCtx, key, clientv3.WithPrefix()) {
			if err := resp.Err(); err != nil {
				level.Error(c.logger).Log("msg", "watch error", "key", key, "err", err)
				continue outer
			}

			backoff.Reset()

			for _, event := range resp.Events {
				if event.Kv.Version == 0 && event.Kv.Value == nil {
					// Delete notification. Since not all KV store clients (and codecs) support this, we ignore it.
					continue
				}

				out, err := c.codec.Decode(event.Kv.Value)
				if err != nil {
					level.Error(c.logger).Log("msg", "error decoding key", "key", key, "err", err)
					continue
				}

				if !f(string(event.Kv.Key), out) {
					return
				}
			}
		}
	}
}

// List implements kv.Client.
func (c *Client) List(ctx context.Context, prefix string) ([]string, error) {
	resp, err := c.cli.Get(ctx, prefix, clientv3.WithPrefix(), clientv3.WithKeysOnly())
	if err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(resp.Kvs))
	for _, kv := range resp.Kvs {
		keys = append(keys, string(kv.Key))
	}
	return keys, nil
}

// Get implements kv.Client.
func (c *Client) Get(ctx context.Context, key string) (interface{}, error) {
	resp, err := c.cli.Get(ctx, key)
	if err != nil {
		return nil, err
	}
	if len(resp.Kvs) == 0 {
		return nil, nil
	} else if len(resp.Kvs) != 1 {
		return nil, fmt.Errorf("got %d kvs, expected 1 or 0", len(resp.Kvs))
	}
	return c.codec.Decode(resp.Kvs[0].Value)
}

// Delete implements kv.Client.
func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.cli.Delete(ctx, key)
	return err
}
