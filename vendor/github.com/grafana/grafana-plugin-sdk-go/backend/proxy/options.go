package proxy

import "time"

// Options defines per datasource options for creating the proxy dialer.
type Options struct {
	Enabled bool
	// DatasourceName is the name of the datasource the proxy will be used to communicate with.
	DatasourceName string
	// DatasourceType is the type of the datasource the proxy will be used to communicate with.
	// It should be the value assigned to the type property in a datasource provisioning file (e.g mysql, prometheus)
	DatasourceType string
	Auth           *AuthOptions
	Timeouts       *TimeoutOptions
	ClientCfg      *ClientCfg
}

// AuthOptions socks5 username and password options.
// Every datasource can have separate credentials to the proxy.
type AuthOptions struct {
	Username string
	Password string
}

// TimeoutOptions timeout/connection options.
type TimeoutOptions struct {
	Timeout   time.Duration
	KeepAlive time.Duration
}

// DefaultTimeoutOptions default timeout/connection options for the proxy.
var DefaultTimeoutOptions = TimeoutOptions{
	Timeout:   30 * time.Second,
	KeepAlive: 30 * time.Second,
}

func (o *Options) setDefaults() {
	if o == nil {
		return
	}

	if o.Timeouts == nil {
		o.Timeouts = &DefaultTimeoutOptions
	}

	if o.ClientCfg == nil {
		o.ClientCfg = clientCfgFromEnv()
	}
}
