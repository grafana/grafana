/*
Package client is a Go client for the Docker Engine API.

For more information about the Engine API, see the documentation:
https://docs.docker.com/reference/api/engine/

# Usage

You use the library by constructing a client object using [NewClientWithOpts]
and calling methods on it. The client can be configured from environment
variables by passing the [FromEnv] option, or configured manually by passing any
of the other available [Opts].

For example, to list running containers (the equivalent of "docker ps"):

	package main

	import (
		"context"
		"fmt"

		"github.com/docker/docker/api/types/container"
		"github.com/docker/docker/client"
	)

	func main() {
		cli, err := client.NewClientWithOpts(client.FromEnv)
		if err != nil {
			panic(err)
		}

		containers, err := cli.ContainerList(context.Background(), container.ListOptions{})
		if err != nil {
			panic(err)
		}

		for _, ctr := range containers {
			fmt.Printf("%s %s\n", ctr.ID, ctr.Image)
		}
	}
*/
package client // import "github.com/docker/docker/client"

import (
	"context"
	"crypto/tls"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/docker/docker/api"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/versions"
	"github.com/docker/go-connections/sockets"
	"github.com/pkg/errors"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

// DummyHost is a hostname used for local communication.
//
// It acts as a valid formatted hostname for local connections (such as "unix://"
// or "npipe://") which do not require a hostname. It should never be resolved,
// but uses the special-purpose ".localhost" TLD (as defined in [RFC 2606, Section 2]
// and [RFC 6761, Section 6.3]).
//
// [RFC 7230, Section 5.4] defines that an empty header must be used for such
// cases:
//
//	If the authority component is missing or undefined for the target URI,
//	then a client MUST send a Host header field with an empty field-value.
//
// However, [Go stdlib] enforces the semantics of HTTP(S) over TCP, does not
// allow an empty header to be used, and requires req.URL.Scheme to be either
// "http" or "https".
//
// For further details, refer to:
//
//   - https://github.com/docker/engine-api/issues/189
//   - https://github.com/golang/go/issues/13624
//   - https://github.com/golang/go/issues/61076
//   - https://github.com/moby/moby/issues/45935
//
// [RFC 2606, Section 2]: https://www.rfc-editor.org/rfc/rfc2606.html#section-2
// [RFC 6761, Section 6.3]: https://www.rfc-editor.org/rfc/rfc6761#section-6.3
// [RFC 7230, Section 5.4]: https://datatracker.ietf.org/doc/html/rfc7230#section-5.4
// [Go stdlib]: https://github.com/golang/go/blob/6244b1946bc2101b01955468f1be502dbadd6807/src/net/http/transport.go#L558-L569
const DummyHost = "api.moby.localhost"

// fallbackAPIVersion is the version to fallback to if API-version negotiation
// fails. This version is the highest version of the API before API-version
// negotiation was introduced. If negotiation fails (or no API version was
// included in the API response), we assume the API server uses the most
// recent version before negotiation was introduced.
const fallbackAPIVersion = "1.24"

// Ensure that Client always implements APIClient.
var _ APIClient = &Client{}

// Client is the API client that performs all operations
// against a docker server.
type Client struct {
	// scheme sets the scheme for the client
	scheme string
	// host holds the server address to connect to
	host string
	// proto holds the client protocol i.e. unix.
	proto string
	// addr holds the client address.
	addr string
	// basePath holds the path to prepend to the requests.
	basePath string
	// client used to send and receive http requests.
	client *http.Client
	// version of the server to talk to.
	version string
	// userAgent is the User-Agent header to use for HTTP requests. It takes
	// precedence over User-Agent headers set in customHTTPHeaders, and other
	// header variables. When set to an empty string, the User-Agent header
	// is removed, and no header is sent.
	userAgent *string
	// custom HTTP headers configured by users.
	customHTTPHeaders map[string]string
	// manualOverride is set to true when the version was set by users.
	manualOverride bool

	// negotiateVersion indicates if the client should automatically negotiate
	// the API version to use when making requests. API version negotiation is
	// performed on the first request, after which negotiated is set to "true"
	// so that subsequent requests do not re-negotiate.
	negotiateVersion bool

	// negotiated indicates that API version negotiation took place
	negotiated atomic.Bool

	// negotiateLock is used to single-flight the version negotiation process
	negotiateLock sync.Mutex

	traceOpts []otelhttp.Option

	// When the client transport is an *http.Transport (default) we need to do some extra things (like closing idle connections).
	// Store the original transport as the http.Client transport will be wrapped with tracing libs.
	baseTransport *http.Transport
}

// ErrRedirect is the error returned by checkRedirect when the request is non-GET.
var ErrRedirect = errors.New("unexpected redirect in response")

// CheckRedirect specifies the policy for dealing with redirect responses. It
// can be set on [http.Client.CheckRedirect] to prevent HTTP redirects for
// non-GET requests. It returns an [ErrRedirect] for non-GET request, otherwise
// returns a [http.ErrUseLastResponse], which is special-cased by http.Client
// to use the last response.
//
// Go 1.8 changed behavior for HTTP redirects (specifically 301, 307, and 308)
// in the client. The client (and by extension API client) can be made to send
// a request like "POST /containers//start" where what would normally be in the
// name section of the URL is empty. This triggers an HTTP 301 from the daemon.
//
// In go 1.8 this 301 is converted to a GET request, and ends up getting
// a 404 from the daemon. This behavior change manifests in the client in that
// before, the 301 was not followed and the client did not generate an error,
// but now results in a message like "Error response from daemon: page not found".
func CheckRedirect(_ *http.Request, via []*http.Request) error {
	if via[0].Method == http.MethodGet {
		return http.ErrUseLastResponse
	}
	return ErrRedirect
}

// NewClientWithOpts initializes a new API client with a default HTTPClient, and
// default API host and version. It also initializes the custom HTTP headers to
// add to each request.
//
// It takes an optional list of [Opt] functional arguments, which are applied in
// the order they're provided, which allows modifying the defaults when creating
// the client. For example, the following initializes a client that configures
// itself with values from environment variables ([FromEnv]), and has automatic
// API version negotiation enabled ([WithAPIVersionNegotiation]).
//
//	cli, err := client.NewClientWithOpts(
//		client.FromEnv,
//		client.WithAPIVersionNegotiation(),
//	)
func NewClientWithOpts(ops ...Opt) (*Client, error) {
	hostURL, err := ParseHostURL(DefaultDockerHost)
	if err != nil {
		return nil, err
	}

	client, err := defaultHTTPClient(hostURL)
	if err != nil {
		return nil, err
	}
	c := &Client{
		host:    DefaultDockerHost,
		version: api.DefaultVersion,
		client:  client,
		proto:   hostURL.Scheme,
		addr:    hostURL.Host,

		traceOpts: []otelhttp.Option{
			otelhttp.WithSpanNameFormatter(func(_ string, req *http.Request) string {
				return req.Method + " " + req.URL.Path
			}),
		},
	}

	for _, op := range ops {
		if err := op(c); err != nil {
			return nil, err
		}
	}

	if tr, ok := c.client.Transport.(*http.Transport); ok {
		// Store the base transport before we wrap it in tracing libs below
		// This is used, as an example, to close idle connections when the client is closed
		c.baseTransport = tr
	}

	if c.scheme == "" {
		// TODO(stevvooe): This isn't really the right way to write clients in Go.
		// `NewClient` should probably only take an `*http.Client` and work from there.
		// Unfortunately, the model of having a host-ish/url-thingy as the connection
		// string has us confusing protocol and transport layers. We continue doing
		// this to avoid breaking existing clients but this should be addressed.
		if c.tlsConfig() != nil {
			c.scheme = "https"
		} else {
			c.scheme = "http"
		}
	}

	c.client.Transport = otelhttp.NewTransport(c.client.Transport, c.traceOpts...)

	return c, nil
}

func (cli *Client) tlsConfig() *tls.Config {
	if cli.baseTransport == nil {
		return nil
	}
	return cli.baseTransport.TLSClientConfig
}

func defaultHTTPClient(hostURL *url.URL) (*http.Client, error) {
	transport := &http.Transport{}
	// Necessary to prevent long-lived processes using the
	// client from leaking connections due to idle connections
	// not being released.
	// TODO: see if we can also address this from the server side,
	// or in go-connections.
	// see: https://github.com/moby/moby/issues/45539
	transport.MaxIdleConns = 6
	transport.IdleConnTimeout = 30 * time.Second
	err := sockets.ConfigureTransport(transport, hostURL.Scheme, hostURL.Host)
	if err != nil {
		return nil, err
	}
	return &http.Client{
		Transport:     transport,
		CheckRedirect: CheckRedirect,
	}, nil
}

// Close the transport used by the client
func (cli *Client) Close() error {
	if cli.baseTransport != nil {
		cli.baseTransport.CloseIdleConnections()
		return nil
	}
	return nil
}

// checkVersion manually triggers API version negotiation (if configured).
// This allows for version-dependent code to use the same version as will
// be negotiated when making the actual requests, and for which cases
// we cannot do the negotiation lazily.
func (cli *Client) checkVersion(ctx context.Context) error {
	if !cli.manualOverride && cli.negotiateVersion && !cli.negotiated.Load() {
		// Ensure exclusive write access to version and negotiated fields
		cli.negotiateLock.Lock()
		defer cli.negotiateLock.Unlock()

		// May have been set during last execution of critical zone
		if cli.negotiated.Load() {
			return nil
		}

		ping, err := cli.Ping(ctx)
		if err != nil {
			return err
		}
		cli.negotiateAPIVersionPing(ping)
	}
	return nil
}

// getAPIPath returns the versioned request path to call the API.
// It appends the query parameters to the path if they are not empty.
func (cli *Client) getAPIPath(ctx context.Context, p string, query url.Values) string {
	var apiPath string
	_ = cli.checkVersion(ctx)
	if cli.version != "" {
		apiPath = path.Join(cli.basePath, "/v"+strings.TrimPrefix(cli.version, "v"), p)
	} else {
		apiPath = path.Join(cli.basePath, p)
	}
	return (&url.URL{Path: apiPath, RawQuery: query.Encode()}).String()
}

// ClientVersion returns the API version used by this client.
func (cli *Client) ClientVersion() string {
	return cli.version
}

// NegotiateAPIVersion queries the API and updates the version to match the API
// version. NegotiateAPIVersion downgrades the client's API version to match the
// APIVersion if the ping version is lower than the default version. If the API
// version reported by the server is higher than the maximum version supported
// by the client, it uses the client's maximum version.
//
// If a manual override is in place, either through the "DOCKER_API_VERSION"
// ([EnvOverrideAPIVersion]) environment variable, or if the client is initialized
// with a fixed version ([WithVersion]), no negotiation is performed.
//
// If the API server's ping response does not contain an API version, or if the
// client did not get a successful ping response, it assumes it is connected with
// an old daemon that does not support API version negotiation, in which case it
// downgrades to the latest version of the API before version negotiation was
// added (1.24).
func (cli *Client) NegotiateAPIVersion(ctx context.Context) {
	if !cli.manualOverride {
		// Avoid concurrent modification of version-related fields
		cli.negotiateLock.Lock()
		defer cli.negotiateLock.Unlock()

		ping, err := cli.Ping(ctx)
		if err != nil {
			// FIXME(thaJeztah): Ping returns an error when failing to connect to the API; we should not swallow the error here, and instead returning it.
			return
		}
		cli.negotiateAPIVersionPing(ping)
	}
}

// NegotiateAPIVersionPing downgrades the client's API version to match the
// APIVersion in the ping response. If the API version in pingResponse is higher
// than the maximum version supported by the client, it uses the client's maximum
// version.
//
// If a manual override is in place, either through the "DOCKER_API_VERSION"
// ([EnvOverrideAPIVersion]) environment variable, or if the client is initialized
// with a fixed version ([WithVersion]), no negotiation is performed.
//
// If the API server's ping response does not contain an API version, we assume
// we are connected with an old daemon without API version negotiation support,
// and downgrade to the latest version of the API before version negotiation was
// added (1.24).
func (cli *Client) NegotiateAPIVersionPing(pingResponse types.Ping) {
	if !cli.manualOverride {
		// Avoid concurrent modification of version-related fields
		cli.negotiateLock.Lock()
		defer cli.negotiateLock.Unlock()

		cli.negotiateAPIVersionPing(pingResponse)
	}
}

// negotiateAPIVersionPing queries the API and updates the version to match the
// API version from the ping response.
func (cli *Client) negotiateAPIVersionPing(pingResponse types.Ping) {
	// default to the latest version before versioning headers existed
	if pingResponse.APIVersion == "" {
		pingResponse.APIVersion = fallbackAPIVersion
	}

	// if the client is not initialized with a version, start with the latest supported version
	if cli.version == "" {
		cli.version = api.DefaultVersion
	}

	// if server version is lower than the client version, downgrade
	if versions.LessThan(pingResponse.APIVersion, cli.version) {
		cli.version = pingResponse.APIVersion
	}

	// Store the results, so that automatic API version negotiation (if enabled)
	// won't be performed on the next request.
	if cli.negotiateVersion {
		cli.negotiated.Store(true)
	}
}

// DaemonHost returns the host address used by the client
func (cli *Client) DaemonHost() string {
	return cli.host
}

// HTTPClient returns a copy of the HTTP client bound to the server
func (cli *Client) HTTPClient() *http.Client {
	c := *cli.client
	return &c
}

// ParseHostURL parses a url string, validates the string is a host url, and
// returns the parsed URL
func ParseHostURL(host string) (*url.URL, error) {
	proto, addr, ok := strings.Cut(host, "://")
	if !ok || addr == "" {
		return nil, errors.Errorf("unable to parse docker host `%s`", host)
	}

	var basePath string
	if proto == "tcp" {
		parsed, err := url.Parse("tcp://" + addr)
		if err != nil {
			return nil, err
		}
		addr = parsed.Host
		basePath = parsed.Path
	}
	return &url.URL{
		Scheme: proto,
		Host:   addr,
		Path:   basePath,
	}, nil
}

func (cli *Client) dialerFromTransport() func(context.Context, string, string) (net.Conn, error) {
	if cli.baseTransport == nil || cli.baseTransport.DialContext == nil {
		return nil
	}

	if cli.baseTransport.TLSClientConfig != nil {
		// When using a tls config we don't use the configured dialer but instead a fallback dialer...
		// Note: It seems like this should use the normal dialer and wrap the returned net.Conn in a tls.Conn
		// I honestly don't know why it doesn't do that, but it doesn't and such a change is entirely unrelated to the change in this commit.
		return nil
	}
	return cli.baseTransport.DialContext
}

// Dialer returns a dialer for a raw stream connection, with an HTTP/1.1 header,
// that can be used for proxying the daemon connection. It is used by
// ["docker dial-stdio"].
//
// ["docker dial-stdio"]: https://github.com/docker/cli/pull/1014
func (cli *Client) Dialer() func(context.Context) (net.Conn, error) {
	return cli.dialer()
}

func (cli *Client) dialer() func(context.Context) (net.Conn, error) {
	return func(ctx context.Context) (net.Conn, error) {
		if dialFn := cli.dialerFromTransport(); dialFn != nil {
			return dialFn(ctx, cli.proto, cli.addr)
		}
		switch cli.proto {
		case "unix":
			return net.Dial(cli.proto, cli.addr)
		case "npipe":
			return sockets.DialPipe(cli.addr, 32*time.Second)
		default:
			if tlsConfig := cli.tlsConfig(); tlsConfig != nil {
				return tls.Dial(cli.proto, cli.addr, tlsConfig)
			}
			return net.Dial(cli.proto, cli.addr)
		}
	}
}
