package httpclient

import (
	"crypto/tls"
	"net/http"
)

// ProviderOptions are the options that will be used as default if not specified
// in Options provided to Provider.New, Provider.GetTransport and
// Provider.GetTLSConfig.
type ProviderOptions struct {
	// Timeouts timeout/connection related options.
	Timeout *TimeoutOptions

	TLS *TLSOptions

	// Middlewares optionally provides additional middlewares.
	Middlewares []Middleware

	// ConfigureMiddleware optionally provide a ConfigureMiddlewareFunc
	// to modify the middlewares chain.
	ConfigureMiddleware ConfigureMiddlewareFunc

	// ConfigureClient optionally provide a ConfigureClientFunc
	// to modify the created http.Client.
	ConfigureClient ConfigureClientFunc

	// ConfigureTransport optionally provide a ConfigureTransportFunc
	// to modify the created http.Client.
	ConfigureTransport ConfigureTransportFunc

	// ConfigureTLSConfig optionally provide a ConfigureTLSConfigFunc
	// to modify the created http.Client.
	ConfigureTLSConfig ConfigureTLSConfigFunc
}

// Provider is the default HTTP client provider implementation.
type Provider struct {
	Opts ProviderOptions
}

// NewProvider creates a new HTTP client provider.
// Optionally provide ProviderOptions which will be used as a fallback if no Options
// are provided to Provider.New, Provider.GetTransport or Provider.GetTLSConfig.
// If no middlewares are provided in opts the DefaultMiddlewares() will be used. If you
// provide middlewares you have to manually add the DefaultMiddlewares() for it to be
// enabled.
// Note: Middlewares will be executed in the same order as provided.
// Note: If more than one ProviderOption is provided a panic is raised.
func NewProvider(opts ...ProviderOptions) *Provider {
	var providerOpts ProviderOptions
	switch len(opts) {
	case 0:
		providerOpts = ProviderOptions{
			Timeout: &DefaultTimeoutOptions,
		}
	case 1:
		providerOpts = opts[0]
	default:
		panic("only an empty or one ProviderOptions is valid as argument")
	}

	if providerOpts.Middlewares == nil {
		providerOpts.Middlewares = DefaultMiddlewares()
	}

	return &Provider{
		Opts: providerOpts,
	}
}

// New creates a new http.Client given provided options.
// Note: If more than one Options is provided a panic is raised.
func (p *Provider) New(opts ...Options) (*http.Client, error) {
	clientOpts := p.createClientOptions(opts...)

	var configuredTransport *http.Transport
	clientOpts.ConfigureTransport = configureTransportChain(clientOpts.ConfigureTransport, func(_ Options, transport *http.Transport) {
		configuredTransport = transport
	})

	client, err := New(clientOpts)
	if err != nil {
		return nil, err
	}

	if configuredTransport != nil {
		if p.Opts.ConfigureTLSConfig != nil {
			p.Opts.ConfigureTLSConfig(clientOpts, configuredTransport.TLSClientConfig)
		}

		if p.Opts.ConfigureTransport != nil {
			p.Opts.ConfigureTransport(clientOpts, configuredTransport)
		}
	}

	if p.Opts.ConfigureClient != nil {
		p.Opts.ConfigureClient(clientOpts, client)
	}
	return client, nil
}

// GetTransport creates a new http.RoundTripper given provided options.
// If opts is nil the http.DefaultTransport will be returned and no
// outgoing request middleware applied.
// Note: If more than one Options is provided a panic is raised.
func (p *Provider) GetTransport(opts ...Options) (http.RoundTripper, error) {
	clientOpts := p.createClientOptions(opts...)

	var configuredTransport *http.Transport
	clientOpts.ConfigureTransport = configureTransportChain(clientOpts.ConfigureTransport, func(_ Options, transport *http.Transport) {
		configuredTransport = transport
	})

	transport, err := GetTransport(clientOpts)
	if err != nil {
		return nil, err
	}

	if configuredTransport != nil {
		if p.Opts.ConfigureTLSConfig != nil {
			p.Opts.ConfigureTLSConfig(clientOpts, configuredTransport.TLSClientConfig)
		}

		if p.Opts.ConfigureTransport != nil {
			p.Opts.ConfigureTransport(clientOpts, configuredTransport)
		}
	}

	return transport, nil
}

// GetTLSConfig creates a new tls.Config given provided options.
// Note: If more than one Options is provided a panic is raised.
func (p *Provider) GetTLSConfig(opts ...Options) (*tls.Config, error) {
	clientOpts := p.createClientOptions(opts...)

	config, err := GetTLSConfig(clientOpts)
	if err != nil {
		return nil, err
	}

	if p.Opts.ConfigureTLSConfig != nil {
		p.Opts.ConfigureTLSConfig(clientOpts, config)
	}

	return config, nil
}

func (p *Provider) createClientOptions(providedOpts ...Options) Options {
	var clientOpts Options

	switch len(providedOpts) {
	case 0:
		clientOpts = Options{
			Timeouts:    p.Opts.Timeout,
			TLS:         p.Opts.TLS,
			Middlewares: p.Opts.Middlewares,
		}
	case 1:
		clientOpts = providedOpts[0]
		clientOpts.Middlewares = append(clientOpts.Middlewares, p.Opts.Middlewares...)
	default:
		panic("only an empty or one Options is valid as argument")
	}

	clientOpts.ConfigureMiddleware = configureMiddlewareChain(clientOpts.ConfigureMiddleware, p.Opts.ConfigureMiddleware)

	return clientOpts
}

func configureMiddlewareChain(first, second ConfigureMiddlewareFunc) ConfigureMiddlewareFunc {
	if first != nil && second != nil {
		return ConfigureMiddlewareFunc(func(opts Options, existingMiddleware []Middleware) []Middleware {
			middlewares := first(opts, existingMiddleware)
			return second(opts, middlewares)
		})
	}

	if first != nil {
		return first
	}

	return second
}

func configureTransportChain(first, second ConfigureTransportFunc) ConfigureTransportFunc {
	if first != nil && second != nil {
		return ConfigureTransportFunc(func(opts Options, transport *http.Transport) {
			first(opts, transport)
			second(opts, transport)
		})
	}

	if first != nil {
		return first
	}

	return second
}
