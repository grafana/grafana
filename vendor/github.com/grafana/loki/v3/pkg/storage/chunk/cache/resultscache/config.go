package resultscache

import (
	"context"
	"flag"
	"time"

	"github.com/pkg/errors"

	"github.com/grafana/loki/v3/pkg/storage/chunk/cache"
)

// Config is the config for the results cache.
type Config struct {
	CacheConfig cache.Config `yaml:"cache"`
	Compression string       `yaml:"compression"`
}

func (cfg *Config) RegisterFlagsWithPrefix(f *flag.FlagSet, prefix string) {
	cfg.CacheConfig.RegisterFlagsWithPrefix(prefix, "", f)
	f.StringVar(&cfg.Compression, prefix+"compression", "", "Use compression in cache. The default is an empty value '', which disables compression. Supported values are: 'snappy' and ''.")
}

func (cfg *Config) RegisterFlags(f *flag.FlagSet) {
	cfg.RegisterFlagsWithPrefix(f, "")
}

func (cfg *Config) Validate() error {
	switch cfg.Compression {
	case "snappy", "":
		// valid
	default:
		return errors.Errorf("unsupported compression type: %s", cfg.Compression)
	}

	if !cache.IsCacheConfigured(cfg.CacheConfig) {
		return errors.New("no cache configured")
	}

	return nil
}

type Limits interface {
	MaxCacheFreshness(ctx context.Context, tenantID string) time.Duration
}
