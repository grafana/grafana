package stats

type Config struct {
	rootdir string
}

type Option func(*Config)

func newConfig(opts ...Option) *Config {
	var cfg Config
	for _, opt := range opts {
		opt(&cfg)
	}
	return &cfg
}

func WithRootDir(dir string) Option {
	return func(cfg *Config) {
		cfg.rootdir = dir
	}
}
