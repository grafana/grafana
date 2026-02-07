package kv

import (
	"context"
	"flag"
	"fmt"
	"sync"

	"github.com/go-kit/log"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/dskit/kv/codec"
	"github.com/grafana/dskit/kv/consul"
	"github.com/grafana/dskit/kv/etcd"
	"github.com/grafana/dskit/kv/memberlist"
)

const (
	// Primary is a role to use KV store primarily.
	Primary = role("primary")
	// Secondary is a role for KV store used by "multi" KV store.
	Secondary = role("secondary")
)

// The role type indicates a role of KV store.
type role string

// Labels method returns Prometheus labels relevant to itself.
func (r *role) Labels() prometheus.Labels {
	return prometheus.Labels{"role": string(*r)}
}

// The NewInMemoryKVClient returned by NewClient() is a singleton, so
// that distributors and ingesters started in the same process can
// find themselves.
var (
	inmemoryStoreInit sync.Once
	inmemoryStore     *consul.Client
)

// StoreConfig is a configuration used for building single store client, either
// Consul, Etcd, Memberlist or MultiClient. It was extracted from Config to keep
// single-client config separate from final client-config (with all the wrappers)
type StoreConfig struct {
	Consul consul.Config `yaml:"consul"`
	Etcd   etcd.Config   `yaml:"etcd"`
	Multi  MultiConfig   `yaml:"multi"`

	// Function that returns memberlist.KV store to use. By using a function, we can delay
	// initialization of memberlist.KV until it is actually required.
	MemberlistKV func() (*memberlist.KV, error) `yaml:"-"`
}

// Config is config for a KVStore currently used by ring and HA tracker,
// where store can be consul or inmemory.
type Config struct {
	Store       string `yaml:"store"`
	Prefix      string `yaml:"prefix" category:"advanced"`
	StoreConfig `yaml:",inline"`

	Mock Client `yaml:"-"`
}

// RegisterFlagsWithPrefix adds the flags required to config this to the given FlagSet.
// If prefix is an empty string we will register consul flags with no prefix and the
// store flag with the prefix ring, so ring.store. For everything else we pass the prefix
// to the Consul flags.
// If prefix is not an empty string it should end with a period.
func (cfg *Config) RegisterFlagsWithPrefix(flagsPrefix, defaultPrefix string, f *flag.FlagSet) {
	// We need Consul flags to not have the ring prefix to maintain compatibility.
	// This needs to be fixed in the future (1.0 release maybe?) when we normalize flags.
	// At the moment we have consul.<flag-name>, and ring.store, going forward it would
	// be easier to have everything under ring, so ring.consul.<flag-name>
	cfg.Consul.RegisterFlags(f, flagsPrefix)
	cfg.Etcd.RegisterFlagsWithPrefix(f, flagsPrefix)
	cfg.Multi.RegisterFlagsWithPrefix(f, flagsPrefix)

	if flagsPrefix == "" {
		flagsPrefix = "ring."
	}

	// Allow clients to override default store by setting it before calling this method.
	if cfg.Store == "" {
		cfg.Store = "consul"
	}

	f.StringVar(&cfg.Prefix, flagsPrefix+"prefix", defaultPrefix, "The prefix for the keys in the store. Should end with a /.")
	f.StringVar(&cfg.Store, flagsPrefix+"store", cfg.Store, "Backend storage to use for the ring. Supported values are: consul, etcd, inmemory, memberlist, multi.")
}

// Client is a high-level client for key-value stores (such as Etcd and
// Consul) that exposes operations such as CAS and Watch which take callbacks.
// It also deals with serialisation by using a Codec and having a instance of
// the the desired type passed in to methods ala json.Unmarshal.
type Client interface {
	// List returns a list of keys under the given prefix. Returned keys will
	// include the prefix.
	List(ctx context.Context, prefix string) ([]string, error)

	// Get a specific key.  Will use a codec to deserialise key to appropriate type.
	// If the key does not exist, Get will return nil and no error.
	Get(ctx context.Context, key string) (interface{}, error)

	// Delete a specific key. Deletions are best-effort and no error will
	// be returned if the key does not exist.
	Delete(ctx context.Context, key string) error

	// CAS stands for Compare-And-Swap. Will call provided callback f with the
	// current value of the key and allow callback to return a different value.
	// Will then attempt to atomically swap the current value for the new value.
	// If that doesn't succeed will try again - callback will be called again
	// with new value etc. Guarantees that only a single concurrent CAS
	// succeeds. Callback can return nil to indicate it is happy with existing
	// value.
	//
	// If the callback returns an error and true for retry, and the max number of
	// attempts is not exceeded, the operation will be retried.
	CAS(ctx context.Context, key string, f func(in interface{}) (out interface{}, retry bool, err error)) error

	// WatchKey calls f whenever the value stored under key changes.
	WatchKey(ctx context.Context, key string, f func(interface{}) bool)

	// WatchPrefix calls f whenever any value stored under prefix changes. Key deletions are not notified.
	WatchPrefix(ctx context.Context, prefix string, f func(string, interface{}) bool)
}

// NewClient creates a new Client (consul, etcd or inmemory) based on the config,
// encodes and decodes data for storage using the codec.
func NewClient(cfg Config, codec codec.Codec, reg prometheus.Registerer, logger log.Logger) (Client, error) {
	if cfg.Mock != nil {
		return cfg.Mock, nil
	}

	return createClient(cfg.Store, cfg.Prefix, cfg.StoreConfig, codec, Primary, reg, logger)
}

func createClient(backend string, prefix string, cfg StoreConfig, codec codec.Codec, role role, reg prometheus.Registerer, logger log.Logger) (Client, error) {
	var client Client
	var err error

	switch backend {
	case "consul":
		client, err = consul.NewClient(cfg.Consul, codec, logger, reg)

	case "etcd":
		client, err = etcd.New(cfg.Etcd, codec, logger)

	case "inmemory":
		// If we use the in-memory store, make sure everyone gets the same instance
		// within the same process.
		inmemoryStoreInit.Do(func() {
			inmemoryStore, _ = consul.NewInMemoryClient(codec, logger, reg)
		})
		// however we swap the codec so that we can encode different type of values.
		client = inmemoryStore.WithCodec(codec)

	case "memberlist":
		kv, err := cfg.MemberlistKV()
		if err != nil {
			return nil, err
		}
		client, err = memberlist.NewClient(kv, codec)
		if err != nil {
			return nil, err
		}

	case "multi":
		client, err = buildMultiClient(cfg, codec, reg, logger)

	// This case is for testing. The mock KV client does not do anything internally.
	case "mock":
		client, err = buildMockClient(logger)

	default:
		return nil, fmt.Errorf("invalid KV store type: %s", backend)
	}

	if err != nil {
		return nil, err
	}

	if prefix != "" {
		client = PrefixClient(client, prefix)
	}

	// If no Registerer is provided return the raw client.
	if reg == nil {
		return client, nil
	}

	return newMetricsClient(backend, client, prometheus.WrapRegistererWith(role.Labels(), reg)), nil
}

func buildMultiClient(cfg StoreConfig, codec codec.Codec, reg prometheus.Registerer, logger log.Logger) (Client, error) {
	if cfg.Multi.Primary == "" || cfg.Multi.Secondary == "" {
		return nil, fmt.Errorf("primary or secondary store not set")
	}
	if cfg.Multi.Primary == "multi" || cfg.Multi.Secondary == "multi" {
		return nil, fmt.Errorf("primary and secondary stores cannot be multi-stores")
	}
	if cfg.Multi.Primary == cfg.Multi.Secondary {
		return nil, fmt.Errorf("primary and secondary stores must be different")
	}

	primary, err := createClient(cfg.Multi.Primary, "", cfg, codec, Primary, reg, logger)
	if err != nil {
		return nil, err
	}

	secondary, err := createClient(cfg.Multi.Secondary, "", cfg, codec, Secondary, reg, logger)
	if err != nil {
		return nil, err
	}

	clients := []kvclient{
		{client: primary, name: cfg.Multi.Primary},
		{client: secondary, name: cfg.Multi.Secondary},
	}

	return NewMultiClient(cfg.Multi, clients, logger, reg), nil
}
