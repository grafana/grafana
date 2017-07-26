// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/pkg/errors"

	"gopkg.in/olivere/elastic.v5/config"
)

const (
	// Version is the current version of Elastic.
	Version = "5.0.43"

	// DefaultURL is the default endpoint of Elasticsearch on the local machine.
	// It is used e.g. when initializing a new Client without a specific URL.
	DefaultURL = "http://127.0.0.1:9200"

	// DefaultScheme is the default protocol scheme to use when sniffing
	// the Elasticsearch cluster.
	DefaultScheme = "http"

	// DefaultHealthcheckEnabled specifies if healthchecks are enabled by default.
	DefaultHealthcheckEnabled = true

	// DefaultHealthcheckTimeoutStartup is the time the healthcheck waits
	// for a response from Elasticsearch on startup, i.e. when creating a
	// client. After the client is started, a shorter timeout is commonly used
	// (its default is specified in DefaultHealthcheckTimeout).
	DefaultHealthcheckTimeoutStartup = 5 * time.Second

	// DefaultHealthcheckTimeout specifies the time a running client waits for
	// a response from Elasticsearch. Notice that the healthcheck timeout
	// when a client is created is larger by default (see DefaultHealthcheckTimeoutStartup).
	DefaultHealthcheckTimeout = 1 * time.Second

	// DefaultHealthcheckInterval is the default interval between
	// two health checks of the nodes in the cluster.
	DefaultHealthcheckInterval = 60 * time.Second

	// DefaultSnifferEnabled specifies if the sniffer is enabled by default.
	DefaultSnifferEnabled = true

	// DefaultSnifferInterval is the interval between two sniffing procedures,
	// i.e. the lookup of all nodes in the cluster and their addition/removal
	// from the list of actual connections.
	DefaultSnifferInterval = 15 * time.Minute

	// DefaultSnifferTimeoutStartup is the default timeout for the sniffing
	// process that is initiated while creating a new client. For subsequent
	// sniffing processes, DefaultSnifferTimeout is used (by default).
	DefaultSnifferTimeoutStartup = 5 * time.Second

	// DefaultSnifferTimeout is the default timeout after which the
	// sniffing process times out. Notice that for the initial sniffing
	// process, DefaultSnifferTimeoutStartup is used.
	DefaultSnifferTimeout = 2 * time.Second

	// DefaultSendGetBodyAs is the HTTP method to use when elastic is sending
	// a GET request with a body.
	DefaultSendGetBodyAs = "GET"

	// DefaultGzipEnabled specifies if gzip compression is enabled by default.
	DefaultGzipEnabled = false

	// off is used to disable timeouts.
	off = -1 * time.Second
)

var (
	// ErrNoClient is raised when no Elasticsearch node is available.
	ErrNoClient = errors.New("no Elasticsearch node available")

	// ErrRetry is raised when a request cannot be executed after the configured
	// number of retries.
	ErrRetry = errors.New("cannot connect after several retries")

	// ErrTimeout is raised when a request timed out, e.g. when WaitForStatus
	// didn't return in time.
	ErrTimeout = errors.New("timeout")

	// noRetries is a retrier that does not retry.
	noRetries = NewStopRetrier()
)

// ClientOptionFunc is a function that configures a Client.
// It is used in NewClient.
type ClientOptionFunc func(*Client) error

// Client is an Elasticsearch client. Create one by calling NewClient.
type Client struct {
	c *http.Client // net/http Client to use for requests

	connsMu sync.RWMutex // connsMu guards the next block
	conns   []*conn      // all connections
	cindex  int          // index into conns

	mu                        sync.RWMutex    // guards the next block
	urls                      []string        // set of URLs passed initially to the client
	running                   bool            // true if the client's background processes are running
	errorlog                  Logger          // error log for critical messages
	infolog                   Logger          // information log for e.g. response times
	tracelog                  Logger          // trace log for debugging
	scheme                    string          // http or https
	healthcheckEnabled        bool            // healthchecks enabled or disabled
	healthcheckTimeoutStartup time.Duration   // time the healthcheck waits for a response from Elasticsearch on startup
	healthcheckTimeout        time.Duration   // time the healthcheck waits for a response from Elasticsearch
	healthcheckInterval       time.Duration   // interval between healthchecks
	healthcheckStop           chan bool       // notify healthchecker to stop, and notify back
	snifferEnabled            bool            // sniffer enabled or disabled
	snifferTimeoutStartup     time.Duration   // time the sniffer waits for a response from nodes info API on startup
	snifferTimeout            time.Duration   // time the sniffer waits for a response from nodes info API
	snifferInterval           time.Duration   // interval between sniffing
	snifferCallback           SnifferCallback // callback to modify the sniffing decision
	snifferStop               chan bool       // notify sniffer to stop, and notify back
	decoder                   Decoder         // used to decode data sent from Elasticsearch
	basicAuth                 bool            // indicates whether to send HTTP Basic Auth credentials
	basicAuthUsername         string          // username for HTTP Basic Auth
	basicAuthPassword         string          // password for HTTP Basic Auth
	sendGetBodyAs             string          // override for when sending a GET with a body
	requiredPlugins           []string        // list of required plugins
	gzipEnabled               bool            // gzip compression enabled or disabled (default)
	retrier                   Retrier         // strategy for retries
}

// NewClient creates a new client to work with Elasticsearch.
//
// NewClient, by default, is meant to be long-lived and shared across
// your application. If you need a short-lived client, e.g. for request-scope,
// consider using NewSimpleClient instead.
//
// The caller can configure the new client by passing configuration options
// to the func.
//
// Example:
//
//   client, err := elastic.NewClient(
//     elastic.SetURL("http://127.0.0.1:9200", "http://127.0.0.1:9201"),
//     elastic.SetBasicAuth("user", "secret"))
//
// If no URL is configured, Elastic uses DefaultURL by default.
//
// If the sniffer is enabled (the default), the new client then sniffes
// the cluster via the Nodes Info API
// (see https://www.elastic.co/guide/en/elasticsearch/reference/5.2/cluster-nodes-info.html#cluster-nodes-info).
// It uses the URLs specified by the caller. The caller is responsible
// to only pass a list of URLs of nodes that belong to the same cluster.
// This sniffing process is run on startup and periodically.
// Use SnifferInterval to set the interval between two sniffs (default is
// 15 minutes). In other words: By default, the client will find new nodes
// in the cluster and remove those that are no longer available every
// 15 minutes. Disable the sniffer by passing SetSniff(false) to NewClient.
//
// The list of nodes found in the sniffing process will be used to make
// connections to the REST API of Elasticsearch. These nodes are also
// periodically checked in a shorter time frame. This process is called
// a health check. By default, a health check is done every 60 seconds.
// You can set a shorter or longer interval by SetHealthcheckInterval.
// Disabling health checks is not recommended, but can be done by
// SetHealthcheck(false).
//
// Connections are automatically marked as dead or healthy while
// making requests to Elasticsearch. When a request fails, Elastic will
// call into the Retry strategy which can be specified with SetRetry.
// The Retry strategy is also responsible for handling backoff i.e. the time
// to wait before starting the next request. There are various standard
// backoff implementations, e.g. ExponentialBackoff or SimpleBackoff.
// Retries are disabled by default.
//
// If no HttpClient is configured, then http.DefaultClient is used.
// You can use your own http.Client with some http.Transport for
// advanced scenarios.
//
// An error is also returned when some configuration option is invalid or
// the new client cannot sniff the cluster (if enabled).
func NewClient(options ...ClientOptionFunc) (*Client, error) {
	// Set up the client
	c := &Client{
		c:                         http.DefaultClient,
		conns:                     make([]*conn, 0),
		cindex:                    -1,
		scheme:                    DefaultScheme,
		decoder:                   &DefaultDecoder{},
		healthcheckEnabled:        DefaultHealthcheckEnabled,
		healthcheckTimeoutStartup: DefaultHealthcheckTimeoutStartup,
		healthcheckTimeout:        DefaultHealthcheckTimeout,
		healthcheckInterval:       DefaultHealthcheckInterval,
		healthcheckStop:           make(chan bool),
		snifferEnabled:            DefaultSnifferEnabled,
		snifferTimeoutStartup:     DefaultSnifferTimeoutStartup,
		snifferTimeout:            DefaultSnifferTimeout,
		snifferInterval:           DefaultSnifferInterval,
		snifferCallback:           nopSnifferCallback,
		snifferStop:               make(chan bool),
		sendGetBodyAs:             DefaultSendGetBodyAs,
		gzipEnabled:               DefaultGzipEnabled,
		retrier:                   noRetries, // no retries by default
	}

	// Run the options on it
	for _, option := range options {
		if err := option(c); err != nil {
			return nil, err
		}
	}

	// Use a default URL and normalize them
	if len(c.urls) == 0 {
		c.urls = []string{DefaultURL}
	}
	c.urls = canonicalize(c.urls...)

	// If the URLs have auth info, use them here as an alternative to SetBasicAuth
	if !c.basicAuth {
		for _, urlStr := range c.urls {
			u, err := url.Parse(urlStr)
			if err == nil && u.User != nil {
				c.basicAuth = true
				c.basicAuthUsername = u.User.Username()
				c.basicAuthPassword, _ = u.User.Password()
				break
			}
		}
	}

	// Check if we can make a request to any of the specified URLs
	if c.healthcheckEnabled {
		if err := c.startupHealthcheck(c.healthcheckTimeoutStartup); err != nil {
			return nil, err
		}
	}

	if c.snifferEnabled {
		// Sniff the cluster initially
		if err := c.sniff(c.snifferTimeoutStartup); err != nil {
			return nil, err
		}
	} else {
		// Do not sniff the cluster initially. Use the provided URLs instead.
		for _, url := range c.urls {
			c.conns = append(c.conns, newConn(url, url))
		}
	}

	if c.healthcheckEnabled {
		// Perform an initial health check
		c.healthcheck(c.healthcheckTimeoutStartup, true)
	}
	// Ensure that we have at least one connection available
	if err := c.mustActiveConn(); err != nil {
		return nil, err
	}

	// Check the required plugins
	for _, plugin := range c.requiredPlugins {
		found, err := c.HasPlugin(plugin)
		if err != nil {
			return nil, err
		}
		if !found {
			return nil, fmt.Errorf("elastic: plugin %s not found", plugin)
		}
	}

	if c.snifferEnabled {
		go c.sniffer() // periodically update cluster information
	}
	if c.healthcheckEnabled {
		go c.healthchecker() // start goroutine periodically ping all nodes of the cluster
	}

	c.mu.Lock()
	c.running = true
	c.mu.Unlock()

	return c, nil
}

// NewClientFromConfig initializes a client from a configuration.
func NewClientFromConfig(cfg *config.Config) (*Client, error) {
	var options []ClientOptionFunc
	if cfg != nil {
		if cfg.URL != "" {
			options = append(options, SetURL(cfg.URL))
		}
		if cfg.Errorlog != "" {
			f, err := os.OpenFile(cfg.Errorlog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err != nil {
				return nil, errors.Wrap(err, "unable to initialize error log")
			}
			l := log.New(f, "", 0)
			options = append(options, SetErrorLog(l))
		}
		if cfg.Tracelog != "" {
			f, err := os.OpenFile(cfg.Tracelog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err != nil {
				return nil, errors.Wrap(err, "unable to initialize trace log")
			}
			l := log.New(f, "", 0)
			options = append(options, SetTraceLog(l))
		}
		if cfg.Infolog != "" {
			f, err := os.OpenFile(cfg.Infolog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
			if err != nil {
				return nil, errors.Wrap(err, "unable to initialize info log")
			}
			l := log.New(f, "", 0)
			options = append(options, SetInfoLog(l))
		}
		if cfg.Username != "" || cfg.Password != "" {
			options = append(options, SetBasicAuth(cfg.Username, cfg.Password))
		}
		if cfg.Sniff != nil {
			options = append(options, SetSniff(*cfg.Sniff))
		}
	}
	return NewClient(options...)
}

// NewSimpleClient creates a new short-lived Client that can be used in
// use cases where you need e.g. one client per request.
//
// While NewClient by default sets up e.g. periodic health checks
// and sniffing for new nodes in separate goroutines, NewSimpleClient does
// not and is meant as a simple replacement where you don't need all the
// heavy lifting of NewClient.
//
// NewSimpleClient does the following by default: First, all health checks
// are disabled, including timeouts and periodic checks. Second, sniffing
// is disabled, including timeouts and periodic checks. The number of retries
// is set to 1. NewSimpleClient also does not start any goroutines.
//
// Notice that you can still override settings by passing additional options,
// just like with NewClient.
func NewSimpleClient(options ...ClientOptionFunc) (*Client, error) {
	c := &Client{
		c:                         http.DefaultClient,
		conns:                     make([]*conn, 0),
		cindex:                    -1,
		scheme:                    DefaultScheme,
		decoder:                   &DefaultDecoder{},
		healthcheckEnabled:        false,
		healthcheckTimeoutStartup: off,
		healthcheckTimeout:        off,
		healthcheckInterval:       off,
		healthcheckStop:           make(chan bool),
		snifferEnabled:            false,
		snifferTimeoutStartup:     off,
		snifferTimeout:            off,
		snifferInterval:           off,
		snifferCallback:           nopSnifferCallback,
		snifferStop:               make(chan bool),
		sendGetBodyAs:             DefaultSendGetBodyAs,
		gzipEnabled:               DefaultGzipEnabled,
		retrier:                   noRetries, // no retries by default
	}

	// Run the options on it
	for _, option := range options {
		if err := option(c); err != nil {
			return nil, err
		}
	}

	// Use a default URL and normalize them
	if len(c.urls) == 0 {
		c.urls = []string{DefaultURL}
	}
	c.urls = canonicalize(c.urls...)

	// If the URLs have auth info, use them here as an alternative to SetBasicAuth
	if !c.basicAuth {
		for _, urlStr := range c.urls {
			u, err := url.Parse(urlStr)
			if err == nil && u.User != nil {
				c.basicAuth = true
				c.basicAuthUsername = u.User.Username()
				c.basicAuthPassword, _ = u.User.Password()
				break
			}
		}
	}

	for _, url := range c.urls {
		c.conns = append(c.conns, newConn(url, url))
	}

	// Ensure that we have at least one connection available
	if err := c.mustActiveConn(); err != nil {
		return nil, err
	}

	// Check the required plugins
	for _, plugin := range c.requiredPlugins {
		found, err := c.HasPlugin(plugin)
		if err != nil {
			return nil, err
		}
		if !found {
			return nil, fmt.Errorf("elastic: plugin %s not found", plugin)
		}
	}

	c.mu.Lock()
	c.running = true
	c.mu.Unlock()

	return c, nil
}

// SetHttpClient can be used to specify the http.Client to use when making
// HTTP requests to Elasticsearch.
func SetHttpClient(httpClient *http.Client) ClientOptionFunc {
	return func(c *Client) error {
		if httpClient != nil {
			c.c = httpClient
		} else {
			c.c = http.DefaultClient
		}
		return nil
	}
}

// SetBasicAuth can be used to specify the HTTP Basic Auth credentials to
// use when making HTTP requests to Elasticsearch.
func SetBasicAuth(username, password string) ClientOptionFunc {
	return func(c *Client) error {
		c.basicAuthUsername = username
		c.basicAuthPassword = password
		c.basicAuth = c.basicAuthUsername != "" || c.basicAuthPassword != ""
		return nil
	}
}

// SetURL defines the URL endpoints of the Elasticsearch nodes. Notice that
// when sniffing is enabled, these URLs are used to initially sniff the
// cluster on startup.
func SetURL(urls ...string) ClientOptionFunc {
	return func(c *Client) error {
		switch len(urls) {
		case 0:
			c.urls = []string{DefaultURL}
		default:
			c.urls = urls
		}
		return nil
	}
}

// SetScheme sets the HTTP scheme to look for when sniffing (http or https).
// This is http by default.
func SetScheme(scheme string) ClientOptionFunc {
	return func(c *Client) error {
		c.scheme = scheme
		return nil
	}
}

// SetSniff enables or disables the sniffer (enabled by default).
func SetSniff(enabled bool) ClientOptionFunc {
	return func(c *Client) error {
		c.snifferEnabled = enabled
		return nil
	}
}

// SetSnifferTimeoutStartup sets the timeout for the sniffer that is used
// when creating a new client. The default is 5 seconds. Notice that the
// timeout being used for subsequent sniffing processes is set with
// SetSnifferTimeout.
func SetSnifferTimeoutStartup(timeout time.Duration) ClientOptionFunc {
	return func(c *Client) error {
		c.snifferTimeoutStartup = timeout
		return nil
	}
}

// SetSnifferTimeout sets the timeout for the sniffer that finds the
// nodes in a cluster. The default is 2 seconds. Notice that the timeout
// used when creating a new client on startup is usually greater and can
// be set with SetSnifferTimeoutStartup.
func SetSnifferTimeout(timeout time.Duration) ClientOptionFunc {
	return func(c *Client) error {
		c.snifferTimeout = timeout
		return nil
	}
}

// SetSnifferInterval sets the interval between two sniffing processes.
// The default interval is 15 minutes.
func SetSnifferInterval(interval time.Duration) ClientOptionFunc {
	return func(c *Client) error {
		c.snifferInterval = interval
		return nil
	}
}

// SnifferCallback defines the protocol for sniffing decisions.
type SnifferCallback func(*NodesInfoNode) bool

// nopSnifferCallback is the default sniffer callback: It accepts
// all nodes the sniffer finds.
var nopSnifferCallback = func(*NodesInfoNode) bool { return true }

// SetSnifferCallback allows the caller to modify sniffer decisions.
// When setting the callback, the given SnifferCallback is called for
// each (healthy) node found during the sniffing process.
// If the callback returns false, the node is ignored: No requests
// are routed to it.
func SetSnifferCallback(f SnifferCallback) ClientOptionFunc {
	return func(c *Client) error {
		if f != nil {
			c.snifferCallback = f
		}
		return nil
	}
}

// SetHealthcheck enables or disables healthchecks (enabled by default).
func SetHealthcheck(enabled bool) ClientOptionFunc {
	return func(c *Client) error {
		c.healthcheckEnabled = enabled
		return nil
	}
}

// SetHealthcheckTimeoutStartup sets the timeout for the initial health check.
// The default timeout is 5 seconds (see DefaultHealthcheckTimeoutStartup).
// Notice that timeouts for subsequent health checks can be modified with
// SetHealthcheckTimeout.
func SetHealthcheckTimeoutStartup(timeout time.Duration) ClientOptionFunc {
	return func(c *Client) error {
		c.healthcheckTimeoutStartup = timeout
		return nil
	}
}

// SetHealthcheckTimeout sets the timeout for periodic health checks.
// The default timeout is 1 second (see DefaultHealthcheckTimeout).
// Notice that a different (usually larger) timeout is used for the initial
// healthcheck, which is initiated while creating a new client.
// The startup timeout can be modified with SetHealthcheckTimeoutStartup.
func SetHealthcheckTimeout(timeout time.Duration) ClientOptionFunc {
	return func(c *Client) error {
		c.healthcheckTimeout = timeout
		return nil
	}
}

// SetHealthcheckInterval sets the interval between two health checks.
// The default interval is 60 seconds.
func SetHealthcheckInterval(interval time.Duration) ClientOptionFunc {
	return func(c *Client) error {
		c.healthcheckInterval = interval
		return nil
	}
}

// SetMaxRetries sets the maximum number of retries before giving up when
// performing a HTTP request to Elasticsearch.
//
// Deprecated: Replace with a Retry implementation.
func SetMaxRetries(maxRetries int) ClientOptionFunc {
	return func(c *Client) error {
		if maxRetries < 0 {
			return errors.New("MaxRetries must be greater than or equal to 0")
		} else if maxRetries == 0 {
			c.retrier = noRetries
		} else {
			// Create a Retrier that will wait for 100ms (+/- jitter) between requests.
			// This resembles the old behavior with maxRetries.
			ticks := make([]int, maxRetries)
			for i := 0; i < len(ticks); i++ {
				ticks[i] = 100
			}
			backoff := NewSimpleBackoff(ticks...)
			c.retrier = NewBackoffRetrier(backoff)
		}
		return nil
	}
}

// SetGzip enables or disables gzip compression (disabled by default).
func SetGzip(enabled bool) ClientOptionFunc {
	return func(c *Client) error {
		c.gzipEnabled = enabled
		return nil
	}
}

// SetDecoder sets the Decoder to use when decoding data from Elasticsearch.
// DefaultDecoder is used by default.
func SetDecoder(decoder Decoder) ClientOptionFunc {
	return func(c *Client) error {
		if decoder != nil {
			c.decoder = decoder
		} else {
			c.decoder = &DefaultDecoder{}
		}
		return nil
	}
}

// SetRequiredPlugins can be used to indicate that some plugins are required
// before a Client will be created.
func SetRequiredPlugins(plugins ...string) ClientOptionFunc {
	return func(c *Client) error {
		if c.requiredPlugins == nil {
			c.requiredPlugins = make([]string, 0)
		}
		c.requiredPlugins = append(c.requiredPlugins, plugins...)
		return nil
	}
}

// SetErrorLog sets the logger for critical messages like nodes joining
// or leaving the cluster or failing requests. It is nil by default.
func SetErrorLog(logger Logger) ClientOptionFunc {
	return func(c *Client) error {
		c.errorlog = logger
		return nil
	}
}

// SetInfoLog sets the logger for informational messages, e.g. requests
// and their response times. It is nil by default.
func SetInfoLog(logger Logger) ClientOptionFunc {
	return func(c *Client) error {
		c.infolog = logger
		return nil
	}
}

// SetTraceLog specifies the log.Logger to use for output of HTTP requests
// and responses which is helpful during debugging. It is nil by default.
func SetTraceLog(logger Logger) ClientOptionFunc {
	return func(c *Client) error {
		c.tracelog = logger
		return nil
	}
}

// SetSendGetBodyAs specifies the HTTP method to use when sending a GET request
// with a body. It is GET by default.
func SetSendGetBodyAs(httpMethod string) ClientOptionFunc {
	return func(c *Client) error {
		c.sendGetBodyAs = httpMethod
		return nil
	}
}

// SetRetrier specifies the retry strategy that handles errors during
// HTTP request/response with Elasticsearch.
func SetRetrier(retrier Retrier) ClientOptionFunc {
	return func(c *Client) error {
		if retrier == nil {
			retrier = noRetries // no retries by default
		}
		c.retrier = retrier
		return nil
	}
}

// String returns a string representation of the client status.
func (c *Client) String() string {
	c.connsMu.Lock()
	conns := c.conns
	c.connsMu.Unlock()

	var buf bytes.Buffer
	for i, conn := range conns {
		if i > 0 {
			buf.WriteString(", ")
		}
		buf.WriteString(conn.String())
	}
	return buf.String()
}

// IsRunning returns true if the background processes of the client are
// running, false otherwise.
func (c *Client) IsRunning() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.running
}

// Start starts the background processes like sniffing the cluster and
// periodic health checks. You don't need to run Start when creating a
// client with NewClient; the background processes are run by default.
//
// If the background processes are already running, this is a no-op.
func (c *Client) Start() {
	c.mu.RLock()
	if c.running {
		c.mu.RUnlock()
		return
	}
	c.mu.RUnlock()

	if c.snifferEnabled {
		go c.sniffer()
	}
	if c.healthcheckEnabled {
		go c.healthchecker()
	}

	c.mu.Lock()
	c.running = true
	c.mu.Unlock()

	c.infof("elastic: client started")
}

// Stop stops the background processes that the client is running,
// i.e. sniffing the cluster periodically and running health checks
// on the nodes.
//
// If the background processes are not running, this is a no-op.
func (c *Client) Stop() {
	c.mu.RLock()
	if !c.running {
		c.mu.RUnlock()
		return
	}
	c.mu.RUnlock()

	if c.healthcheckEnabled {
		c.healthcheckStop <- true
		<-c.healthcheckStop
	}

	if c.snifferEnabled {
		c.snifferStop <- true
		<-c.snifferStop
	}

	c.mu.Lock()
	c.running = false
	c.mu.Unlock()

	c.infof("elastic: client stopped")
}

// errorf logs to the error log.
func (c *Client) errorf(format string, args ...interface{}) {
	if c.errorlog != nil {
		c.errorlog.Printf(format, args...)
	}
}

// infof logs informational messages.
func (c *Client) infof(format string, args ...interface{}) {
	if c.infolog != nil {
		c.infolog.Printf(format, args...)
	}
}

// tracef logs to the trace log.
func (c *Client) tracef(format string, args ...interface{}) {
	if c.tracelog != nil {
		c.tracelog.Printf(format, args...)
	}
}

// dumpRequest dumps the given HTTP request to the trace log.
func (c *Client) dumpRequest(r *http.Request) {
	if c.tracelog != nil {
		out, err := httputil.DumpRequestOut(r, true)
		if err == nil {
			c.tracef("%s\n", string(out))
		}
	}
}

// dumpResponse dumps the given HTTP response to the trace log.
func (c *Client) dumpResponse(resp *http.Response) {
	if c.tracelog != nil {
		out, err := httputil.DumpResponse(resp, true)
		if err == nil {
			c.tracef("%s\n", string(out))
		}
	}
}

// sniffer periodically runs sniff.
func (c *Client) sniffer() {
	c.mu.RLock()
	timeout := c.snifferTimeout
	interval := c.snifferInterval
	c.mu.RUnlock()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-c.snifferStop:
			// we are asked to stop, so we signal back that we're stopping now
			c.snifferStop <- true
			return
		case <-ticker.C:
			c.sniff(timeout)
		}
	}
}

// sniff uses the Node Info API to return the list of nodes in the cluster.
// It uses the list of URLs passed on startup plus the list of URLs found
// by the preceding sniffing process (if sniffing is enabled).
//
// If sniffing is disabled, this is a no-op.
func (c *Client) sniff(timeout time.Duration) error {
	c.mu.RLock()
	if !c.snifferEnabled {
		c.mu.RUnlock()
		return nil
	}

	// Use all available URLs provided to sniff the cluster.
	var urls []string
	urlsMap := make(map[string]bool)

	// Add all URLs provided on startup
	for _, url := range c.urls {
		urlsMap[url] = true
		urls = append(urls, url)
	}
	c.mu.RUnlock()

	// Add all URLs found by sniffing
	c.connsMu.RLock()
	for _, conn := range c.conns {
		if !conn.IsDead() {
			url := conn.URL()
			if _, found := urlsMap[url]; !found {
				urls = append(urls, url)
			}
		}
	}
	c.connsMu.RUnlock()

	if len(urls) == 0 {
		return errors.Wrap(ErrNoClient, "no URLs found")
	}

	// Start sniffing on all found URLs
	ch := make(chan []*conn, len(urls))

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	for _, url := range urls {
		go func(url string) { ch <- c.sniffNode(ctx, url) }(url)
	}

	// Wait for the results to come back, or the process times out.
	for {
		select {
		case conns := <-ch:
			if len(conns) > 0 {
				c.updateConns(conns)
				return nil
			}
		case <-ctx.Done():
			// We get here if no cluster responds in time
			return errors.Wrap(ErrNoClient, "sniff timeout")
		}
	}
}

// sniffNode sniffs a single node. This method is run as a goroutine
// in sniff. If successful, it returns the list of node URLs extracted
// from the result of calling Nodes Info API. Otherwise, an empty array
// is returned.
func (c *Client) sniffNode(ctx context.Context, url string) []*conn {
	var nodes []*conn

	// Call the Nodes Info API at /_nodes/http
	req, err := NewRequest("GET", url+"/_nodes/http")
	if err != nil {
		return nodes
	}

	c.mu.RLock()
	if c.basicAuth {
		req.SetBasicAuth(c.basicAuthUsername, c.basicAuthPassword)
	}
	c.mu.RUnlock()

	res, err := c.c.Do((*http.Request)(req).WithContext(ctx))
	if err != nil {
		return nodes
	}
	if res == nil {
		return nodes
	}

	if res.Body != nil {
		defer res.Body.Close()
	}

	var info NodesInfoResponse
	if err := json.NewDecoder(res.Body).Decode(&info); err == nil {
		if len(info.Nodes) > 0 {
			for nodeID, node := range info.Nodes {
				if c.snifferCallback(node) {
					if node.HTTP != nil && len(node.HTTP.PublishAddress) > 0 {
						url := c.extractHostname(c.scheme, node.HTTP.PublishAddress)
						if url != "" {
							nodes = append(nodes, newConn(nodeID, url))
						}
					}
				}
			}
		}
	}
	return nodes
}

// reSniffHostAndPort is used to extract hostname and port from a result
// from a Nodes Info API (example: "inet[/127.0.0.1:9200]").
var reSniffHostAndPort = regexp.MustCompile(`\/([^:]*):([0-9]+)\]`)

func (c *Client) extractHostname(scheme, address string) string {
	if strings.HasPrefix(address, "inet") {
		m := reSniffHostAndPort.FindStringSubmatch(address)
		if len(m) == 3 {
			return fmt.Sprintf("%s://%s:%s", scheme, m[1], m[2])
		}
	}
	s := address
	if idx := strings.Index(s, "/"); idx >= 0 {
		s = s[idx+1:]
	}
	if strings.Index(s, ":") < 0 {
		return ""
	}
	return fmt.Sprintf("%s://%s", scheme, s)
}

// updateConns updates the clients' connections with new information
// gather by a sniff operation.
func (c *Client) updateConns(conns []*conn) {
	c.connsMu.Lock()

	// Build up new connections:
	// If we find an existing connection, use that (including no. of failures etc.).
	// If we find a new connection, add it.
	var newConns []*conn
	for _, conn := range conns {
		var found bool
		for _, oldConn := range c.conns {
			if oldConn.NodeID() == conn.NodeID() {
				// Take over the old connection
				newConns = append(newConns, oldConn)
				found = true
				break
			}
		}
		if !found {
			// New connection didn't exist, so add it to our list of new conns.
			c.infof("elastic: %s joined the cluster", conn.URL())
			newConns = append(newConns, conn)
		}
	}

	c.conns = newConns
	c.cindex = -1
	c.connsMu.Unlock()
}

// healthchecker periodically runs healthcheck.
func (c *Client) healthchecker() {
	c.mu.RLock()
	timeout := c.healthcheckTimeout
	interval := c.healthcheckInterval
	c.mu.RUnlock()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-c.healthcheckStop:
			// we are asked to stop, so we signal back that we're stopping now
			c.healthcheckStop <- true
			return
		case <-ticker.C:
			c.healthcheck(timeout, false)
		}
	}
}

// healthcheck does a health check on all nodes in the cluster. Depending on
// the node state, it marks connections as dead, sets them alive etc.
// If healthchecks are disabled and force is false, this is a no-op.
// The timeout specifies how long to wait for a response from Elasticsearch.
func (c *Client) healthcheck(timeout time.Duration, force bool) {
	c.mu.RLock()
	if !c.healthcheckEnabled && !force {
		c.mu.RUnlock()
		return
	}
	basicAuth := c.basicAuth
	basicAuthUsername := c.basicAuthUsername
	basicAuthPassword := c.basicAuthPassword
	c.mu.RUnlock()

	c.connsMu.RLock()
	conns := c.conns
	c.connsMu.RUnlock()

	for _, conn := range conns {
		// Run the HEAD request against ES with a timeout
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		// Goroutine executes the HTTP request, returns an error and sets status
		var status int
		errc := make(chan error, 1)
		go func(url string) {
			req, err := NewRequest("HEAD", url)
			if err != nil {
				errc <- err
				return
			}
			if basicAuth {
				req.SetBasicAuth(basicAuthUsername, basicAuthPassword)
			}
			res, err := c.c.Do((*http.Request)(req).WithContext(ctx))
			if res != nil {
				status = res.StatusCode
				if res.Body != nil {
					res.Body.Close()
				}
			}
			errc <- err
		}(conn.URL())

		// Wait for the Goroutine (or its timeout)
		select {
		case <-ctx.Done(): // timeout
			c.errorf("elastic: %s is dead", conn.URL())
			conn.MarkAsDead()
			break
		case err := <-errc:
			if err != nil {
				c.errorf("elastic: %s is dead", conn.URL())
				conn.MarkAsDead()
				break
			}
			if status >= 200 && status < 300 {
				conn.MarkAsAlive()
			} else {
				conn.MarkAsDead()
				c.errorf("elastic: %s is dead [status=%d]", conn.URL(), status)
			}
			break
		}
	}
}

// startupHealthcheck is used at startup to check if the server is available
// at all.
func (c *Client) startupHealthcheck(timeout time.Duration) error {
	c.mu.Lock()
	urls := c.urls
	basicAuth := c.basicAuth
	basicAuthUsername := c.basicAuthUsername
	basicAuthPassword := c.basicAuthPassword
	c.mu.Unlock()

	// If we don't get a connection after "timeout", we bail.
	start := time.Now()
	for {
		// Make a copy of the HTTP client provided via options to respect
		// settings like Basic Auth or a user-specified http.Transport.
		cl := new(http.Client)
		*cl = *c.c
		cl.Timeout = timeout
		for _, url := range urls {
			req, err := http.NewRequest("HEAD", url, nil)
			if err != nil {
				return err
			}
			if basicAuth {
				req.SetBasicAuth(basicAuthUsername, basicAuthPassword)
			}
			res, err := cl.Do(req)
			if err == nil && res != nil && res.StatusCode >= 200 && res.StatusCode < 300 {
				return nil
			}
		}
		time.Sleep(1 * time.Second)
		if time.Now().Sub(start) > timeout {
			break
		}
	}
	return errors.Wrap(ErrNoClient, "health check timeout")
}

// next returns the next available connection, or ErrNoClient.
func (c *Client) next() (*conn, error) {
	// We do round-robin here.
	// TODO(oe) This should be a pluggable strategy, like the Selector in the official clients.
	c.connsMu.Lock()
	defer c.connsMu.Unlock()

	i := 0
	numConns := len(c.conns)
	for {
		i++
		if i > numConns {
			break // we visited all conns: they all seem to be dead
		}
		c.cindex++
		if c.cindex >= numConns {
			c.cindex = 0
		}
		conn := c.conns[c.cindex]
		if !conn.IsDead() {
			return conn, nil
		}
	}

	// We have a deadlock here: All nodes are marked as dead.
	// If sniffing is disabled, connections will never be marked alive again.
	// So we are marking them as alive--if sniffing is disabled.
	// They'll then be picked up in the next call to PerformRequest.
	if !c.snifferEnabled {
		c.errorf("elastic: all %d nodes marked as dead; resurrecting them to prevent deadlock", len(c.conns))
		for _, conn := range c.conns {
			conn.MarkAsAlive()
		}
	}

	// We tried hard, but there is no node available
	return nil, errors.Wrap(ErrNoClient, "no available connection")
}

// mustActiveConn returns nil if there is an active connection,
// otherwise ErrNoClient is returned.
func (c *Client) mustActiveConn() error {
	c.connsMu.Lock()
	defer c.connsMu.Unlock()

	for _, c := range c.conns {
		if !c.IsDead() {
			return nil
		}
	}
	return errors.Wrap(ErrNoClient, "no active connection found")
}

// PerformRequest does a HTTP request to Elasticsearch.
// It returns a response (which might be nil) and an error on failure.
//
// Optionally, a list of HTTP error codes to ignore can be passed.
// This is necessary for services that expect e.g. HTTP status 404 as a
// valid outcome (Exists, IndicesExists, IndicesTypeExists).
func (c *Client) PerformRequest(ctx context.Context, method, path string, params url.Values, body interface{}, ignoreErrors ...int) (*Response, error) {
	start := time.Now().UTC()

	c.mu.RLock()
	timeout := c.healthcheckTimeout
	basicAuth := c.basicAuth
	basicAuthUsername := c.basicAuthUsername
	basicAuthPassword := c.basicAuthPassword
	sendGetBodyAs := c.sendGetBodyAs
	gzipEnabled := c.gzipEnabled
	c.mu.RUnlock()

	var err error
	var conn *conn
	var req *Request
	var resp *Response
	var retried bool
	var n int

	// Change method if sendGetBodyAs is specified.
	if method == "GET" && body != nil && sendGetBodyAs != "GET" {
		method = sendGetBodyAs
	}

	for {
		pathWithParams := path
		if len(params) > 0 {
			pathWithParams += "?" + params.Encode()
		}

		// Get a connection
		conn, err = c.next()
		if errors.Cause(err) == ErrNoClient {
			n++
			if !retried {
				// Force a healtcheck as all connections seem to be dead.
				c.healthcheck(timeout, false)
			}
			wait, ok, rerr := c.retrier.Retry(ctx, n, nil, nil, err)
			if rerr != nil {
				return nil, rerr
			}
			if !ok {
				return nil, err
			}
			retried = true
			time.Sleep(wait)
			continue // try again
		}
		if err != nil {
			c.errorf("elastic: cannot get connection from pool")
			return nil, err
		}

		req, err = NewRequest(method, conn.URL()+pathWithParams)
		if err != nil {
			c.errorf("elastic: cannot create request for %s %s: %v", strings.ToUpper(method), conn.URL()+pathWithParams, err)
			return nil, err
		}

		if basicAuth {
			req.SetBasicAuth(basicAuthUsername, basicAuthPassword)
		}

		// Set body
		if body != nil {
			err = req.SetBody(body, gzipEnabled)
			if err != nil {
				c.errorf("elastic: couldn't set body %+v for request: %v", body, err)
				return nil, err
			}
		}

		// Tracing
		c.dumpRequest((*http.Request)(req))

		// Get response
		res, err := c.c.Do((*http.Request)(req).WithContext(ctx))
		if err == context.Canceled || err == context.DeadlineExceeded {
			// Proceed, but don't mark the node as dead
			return nil, err
		}
		if err != nil {
			n++
			wait, ok, rerr := c.retrier.Retry(ctx, n, (*http.Request)(req), res, err)
			if rerr != nil {
				c.errorf("elastic: %s is dead", conn.URL())
				conn.MarkAsDead()
				return nil, rerr
			}
			if !ok {
				c.errorf("elastic: %s is dead", conn.URL())
				conn.MarkAsDead()
				return nil, err
			}
			retried = true
			time.Sleep(wait)
			continue // try again
		}
		if res.Body != nil {
			defer res.Body.Close()
		}

		// Tracing
		c.dumpResponse(res)

		// Check for errors
		if err := checkResponse((*http.Request)(req), res, ignoreErrors...); err != nil {
			// No retry if request succeeded
			// We still try to return a response.
			resp, _ = c.newResponse(res)
			return resp, err
		}

		// We successfully made a request with this connection
		conn.MarkAsHealthy()

		resp, err = c.newResponse(res)
		if err != nil {
			return nil, err
		}

		break
	}

	duration := time.Now().UTC().Sub(start)
	c.infof("%s %s [status:%d, request:%.3fs]",
		strings.ToUpper(method),
		req.URL,
		resp.StatusCode,
		float64(int64(duration/time.Millisecond))/1000)

	return resp, nil
}

// -- Document APIs --

// Index a document.
func (c *Client) Index() *IndexService {
	return NewIndexService(c)
}

// Get a document.
func (c *Client) Get() *GetService {
	return NewGetService(c)
}

// MultiGet retrieves multiple documents in one roundtrip.
func (c *Client) MultiGet() *MgetService {
	return NewMgetService(c)
}

// Mget retrieves multiple documents in one roundtrip.
func (c *Client) Mget() *MgetService {
	return NewMgetService(c)
}

// Delete a document.
func (c *Client) Delete() *DeleteService {
	return NewDeleteService(c)
}

// DeleteByQuery deletes documents as found by a query.
func (c *Client) DeleteByQuery(indices ...string) *DeleteByQueryService {
	return NewDeleteByQueryService(c).Index(indices...)
}

// Update a document.
func (c *Client) Update() *UpdateService {
	return NewUpdateService(c)
}

// UpdateByQuery performs an update on a set of documents.
func (c *Client) UpdateByQuery(indices ...string) *UpdateByQueryService {
	return NewUpdateByQueryService(c).Index(indices...)
}

// Bulk is the entry point to mass insert/update/delete documents.
func (c *Client) Bulk() *BulkService {
	return NewBulkService(c)
}

// BulkProcessor allows setting up a concurrent processor of bulk requests.
func (c *Client) BulkProcessor() *BulkProcessorService {
	return NewBulkProcessorService(c)
}

// Reindex copies data from a source index into a destination index.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/docs-reindex.html
// for details on the Reindex API.
func (c *Client) Reindex() *ReindexService {
	return NewReindexService(c)
}

// TermVectors returns information and statistics on terms in the fields
// of a particular document.
func (c *Client) TermVectors(index, typ string) *TermvectorsService {
	builder := NewTermvectorsService(c)
	builder = builder.Index(index).Type(typ)
	return builder
}

// MultiTermVectors returns information and statistics on terms in the fields
// of multiple documents.
func (c *Client) MultiTermVectors() *MultiTermvectorService {
	return NewMultiTermvectorService(c)
}

// -- Search APIs --

// Search is the entry point for searches.
func (c *Client) Search(indices ...string) *SearchService {
	return NewSearchService(c).Index(indices...)
}

// Suggest returns a service to return suggestions.
func (c *Client) Suggest(indices ...string) *SuggestService {
	return NewSuggestService(c).Index(indices...)
}

// MultiSearch is the entry point for multi searches.
func (c *Client) MultiSearch() *MultiSearchService {
	return NewMultiSearchService(c)
}

// Count documents.
func (c *Client) Count(indices ...string) *CountService {
	return NewCountService(c).Index(indices...)
}

// Explain computes a score explanation for a query and a specific document.
func (c *Client) Explain(index, typ, id string) *ExplainService {
	return NewExplainService(c).Index(index).Type(typ).Id(id)
}

// TODO Search Template
// TODO Search Shards API
// TODO Search Exists API
// TODO Validate API

// FieldStats returns statistical information about fields in indices.
func (c *Client) FieldStats(indices ...string) *FieldStatsService {
	return NewFieldStatsService(c).Index(indices...)
}

// Exists checks if a document exists.
func (c *Client) Exists() *ExistsService {
	return NewExistsService(c)
}

// Scroll through documents. Use this to efficiently scroll through results
// while returning the results to a client.
func (c *Client) Scroll(indices ...string) *ScrollService {
	return NewScrollService(c).Index(indices...)
}

// ClearScroll can be used to clear search contexts manually.
func (c *Client) ClearScroll(scrollIds ...string) *ClearScrollService {
	return NewClearScrollService(c).ScrollId(scrollIds...)
}

// -- Indices APIs --

// CreateIndex returns a service to create a new index.
func (c *Client) CreateIndex(name string) *IndicesCreateService {
	return NewIndicesCreateService(c).Index(name)
}

// DeleteIndex returns a service to delete an index.
func (c *Client) DeleteIndex(indices ...string) *IndicesDeleteService {
	return NewIndicesDeleteService(c).Index(indices)
}

// IndexExists allows to check if an index exists.
func (c *Client) IndexExists(indices ...string) *IndicesExistsService {
	return NewIndicesExistsService(c).Index(indices)
}

// ShrinkIndex returns a service to shrink one index into another.
func (c *Client) ShrinkIndex(source, target string) *IndicesShrinkService {
	return NewIndicesShrinkService(c).Source(source).Target(target)
}

// RolloverIndex rolls an alias over to a new index when the existing index
// is considered to be too large or too old.
func (c *Client) RolloverIndex(alias string) *IndicesRolloverService {
	return NewIndicesRolloverService(c).Alias(alias)
}

// TypeExists allows to check if one or more types exist in one or more indices.
func (c *Client) TypeExists() *IndicesExistsTypeService {
	return NewIndicesExistsTypeService(c)
}

// IndexStats provides statistics on different operations happining
// in one or more indices.
func (c *Client) IndexStats(indices ...string) *IndicesStatsService {
	return NewIndicesStatsService(c).Index(indices...)
}

// OpenIndex opens an index.
func (c *Client) OpenIndex(name string) *IndicesOpenService {
	return NewIndicesOpenService(c).Index(name)
}

// CloseIndex closes an index.
func (c *Client) CloseIndex(name string) *IndicesCloseService {
	return NewIndicesCloseService(c).Index(name)
}

// IndexGet retrieves information about one or more indices.
// IndexGet is only available for Elasticsearch 1.4 or later.
func (c *Client) IndexGet(indices ...string) *IndicesGetService {
	return NewIndicesGetService(c).Index(indices...)
}

// IndexGetSettings retrieves settings of all, one or more indices.
func (c *Client) IndexGetSettings(indices ...string) *IndicesGetSettingsService {
	return NewIndicesGetSettingsService(c).Index(indices...)
}

// IndexPutSettings sets settings for all, one or more indices.
func (c *Client) IndexPutSettings(indices ...string) *IndicesPutSettingsService {
	return NewIndicesPutSettingsService(c).Index(indices...)
}

// IndexAnalyze performs the analysis process on a text and returns the
// token breakdown of the text.
func (c *Client) IndexAnalyze() *IndicesAnalyzeService {
	return NewIndicesAnalyzeService(c)
}

// Forcemerge optimizes one or more indices.
// It replaces the deprecated Optimize API.
func (c *Client) Forcemerge(indices ...string) *IndicesForcemergeService {
	return NewIndicesForcemergeService(c).Index(indices...)
}

// Refresh asks Elasticsearch to refresh one or more indices.
func (c *Client) Refresh(indices ...string) *RefreshService {
	return NewRefreshService(c).Index(indices...)
}

// Flush asks Elasticsearch to free memory from the index and
// flush data to disk.
func (c *Client) Flush(indices ...string) *IndicesFlushService {
	return NewIndicesFlushService(c).Index(indices...)
}

// Alias enables the caller to add and/or remove aliases.
func (c *Client) Alias() *AliasService {
	return NewAliasService(c)
}

// Aliases returns aliases by index name(s).
func (c *Client) Aliases() *AliasesService {
	return NewAliasesService(c)
}

// GetTemplate gets a search template.
// Use IndexXXXTemplate funcs to manage index templates.
func (c *Client) GetTemplate() *GetTemplateService {
	return NewGetTemplateService(c)
}

// PutTemplate creates or updates a search template.
// Use IndexXXXTemplate funcs to manage index templates.
func (c *Client) PutTemplate() *PutTemplateService {
	return NewPutTemplateService(c)
}

// DeleteTemplate deletes a search template.
// Use IndexXXXTemplate funcs to manage index templates.
func (c *Client) DeleteTemplate() *DeleteTemplateService {
	return NewDeleteTemplateService(c)
}

// IndexGetTemplate gets an index template.
// Use XXXTemplate funcs to manage search templates.
func (c *Client) IndexGetTemplate(names ...string) *IndicesGetTemplateService {
	return NewIndicesGetTemplateService(c).Name(names...)
}

// IndexTemplateExists gets check if an index template exists.
// Use XXXTemplate funcs to manage search templates.
func (c *Client) IndexTemplateExists(name string) *IndicesExistsTemplateService {
	return NewIndicesExistsTemplateService(c).Name(name)
}

// IndexPutTemplate creates or updates an index template.
// Use XXXTemplate funcs to manage search templates.
func (c *Client) IndexPutTemplate(name string) *IndicesPutTemplateService {
	return NewIndicesPutTemplateService(c).Name(name)
}

// IndexDeleteTemplate deletes an index template.
// Use XXXTemplate funcs to manage search templates.
func (c *Client) IndexDeleteTemplate(name string) *IndicesDeleteTemplateService {
	return NewIndicesDeleteTemplateService(c).Name(name)
}

// GetMapping gets a mapping.
func (c *Client) GetMapping() *IndicesGetMappingService {
	return NewIndicesGetMappingService(c)
}

// PutMapping registers a mapping.
func (c *Client) PutMapping() *IndicesPutMappingService {
	return NewIndicesPutMappingService(c)
}

// GetFieldMapping gets mapping for fields.
func (c *Client) GetFieldMapping() *IndicesGetFieldMappingService {
	return NewIndicesGetFieldMappingService(c)
}

// -- cat APIs --

// TODO cat aliases
// TODO cat allocation
// TODO cat count
// TODO cat fielddata
// TODO cat health
// TODO cat indices
// TODO cat master
// TODO cat nodes
// TODO cat pending tasks
// TODO cat plugins
// TODO cat recovery
// TODO cat thread pool
// TODO cat shards
// TODO cat segments

// -- Ingest APIs --

// IngestPutPipeline adds pipelines and updates existing pipelines in
// the cluster.
func (c *Client) IngestPutPipeline(id string) *IngestPutPipelineService {
	return NewIngestPutPipelineService(c).Id(id)
}

// IngestGetPipeline returns pipelines based on ID.
func (c *Client) IngestGetPipeline(ids ...string) *IngestGetPipelineService {
	return NewIngestGetPipelineService(c).Id(ids...)
}

// IngestDeletePipeline deletes a pipeline by ID.
func (c *Client) IngestDeletePipeline(id string) *IngestDeletePipelineService {
	return NewIngestDeletePipelineService(c).Id(id)
}

// IngestSimulatePipeline executes a specific pipeline against the set of
// documents provided in the body of the request.
func (c *Client) IngestSimulatePipeline() *IngestSimulatePipelineService {
	return NewIngestSimulatePipelineService(c)
}

// -- Cluster APIs --

// ClusterHealth retrieves the health of the cluster.
func (c *Client) ClusterHealth() *ClusterHealthService {
	return NewClusterHealthService(c)
}

// ClusterState retrieves the state of the cluster.
func (c *Client) ClusterState() *ClusterStateService {
	return NewClusterStateService(c)
}

// ClusterStats retrieves cluster statistics.
func (c *Client) ClusterStats() *ClusterStatsService {
	return NewClusterStatsService(c)
}

// NodesInfo retrieves one or more or all of the cluster nodes information.
func (c *Client) NodesInfo() *NodesInfoService {
	return NewNodesInfoService(c)
}

// NodesStats retrieves one or more or all of the cluster nodes statistics.
func (c *Client) NodesStats() *NodesStatsService {
	return NewNodesStatsService(c)
}

// TasksCancel cancels tasks running on the specified nodes.
func (c *Client) TasksCancel() *TasksCancelService {
	return NewTasksCancelService(c)
}

// TasksList retrieves the list of tasks running on the specified nodes.
func (c *Client) TasksList() *TasksListService {
	return NewTasksListService(c)
}

// TasksGetTask retrieves a task running on the cluster.
func (c *Client) TasksGetTask() *TasksGetTaskService {
	return NewTasksGetTaskService(c)
}

// TODO Pending cluster tasks
// TODO Cluster Reroute
// TODO Cluster Update Settings
// TODO Nodes Stats
// TODO Nodes hot_threads

// -- Snapshot and Restore --

// TODO Snapshot Delete
// TODO Snapshot Get
// TODO Snapshot Restore
// TODO Snapshot Status

// SnapshotCreate creates a snapshot.
func (c *Client) SnapshotCreate(repository string, snapshot string) *SnapshotCreateService {
	return NewSnapshotCreateService(c).Repository(repository).Snapshot(snapshot)
}

// SnapshotCreateRepository creates or updates a snapshot repository.
func (c *Client) SnapshotCreateRepository(repository string) *SnapshotCreateRepositoryService {
	return NewSnapshotCreateRepositoryService(c).Repository(repository)
}

// SnapshotDeleteRepository deletes a snapshot repository.
func (c *Client) SnapshotDeleteRepository(repositories ...string) *SnapshotDeleteRepositoryService {
	return NewSnapshotDeleteRepositoryService(c).Repository(repositories...)
}

// SnapshotGetRepository gets a snapshot repository.
func (c *Client) SnapshotGetRepository(repositories ...string) *SnapshotGetRepositoryService {
	return NewSnapshotGetRepositoryService(c).Repository(repositories...)
}

// SnapshotVerifyRepository verifies a snapshot repository.
func (c *Client) SnapshotVerifyRepository(repository string) *SnapshotVerifyRepositoryService {
	return NewSnapshotVerifyRepositoryService(c).Repository(repository)
}

// -- Helpers and shortcuts --

// ElasticsearchVersion returns the version number of Elasticsearch
// running on the given URL.
func (c *Client) ElasticsearchVersion(url string) (string, error) {
	res, _, err := c.Ping(url).Do(context.Background())
	if err != nil {
		return "", err
	}
	return res.Version.Number, nil
}

// IndexNames returns the names of all indices in the cluster.
func (c *Client) IndexNames() ([]string, error) {
	res, err := c.IndexGetSettings().Index("_all").Do(context.Background())
	if err != nil {
		return nil, err
	}
	var names []string
	for name := range res {
		names = append(names, name)
	}
	return names, nil
}

// Ping checks if a given node in a cluster exists and (optionally)
// returns some basic information about the Elasticsearch server,
// e.g. the Elasticsearch version number.
//
// Notice that you need to specify a URL here explicitly.
func (c *Client) Ping(url string) *PingService {
	return NewPingService(c).URL(url)
}

// WaitForStatus waits for the cluster to have the given status.
// This is a shortcut method for the ClusterHealth service.
//
// WaitForStatus waits for the specified timeout, e.g. "10s".
// If the cluster will have the given state within the timeout, nil is returned.
// If the request timed out, ErrTimeout is returned.
func (c *Client) WaitForStatus(status string, timeout string) error {
	health, err := c.ClusterHealth().WaitForStatus(status).Timeout(timeout).Do(context.Background())
	if err != nil {
		return err
	}
	if health.TimedOut {
		return ErrTimeout
	}
	return nil
}

// WaitForGreenStatus waits for the cluster to have the "green" status.
// See WaitForStatus for more details.
func (c *Client) WaitForGreenStatus(timeout string) error {
	return c.WaitForStatus("green", timeout)
}

// WaitForYellowStatus waits for the cluster to have the "yellow" status.
// See WaitForStatus for more details.
func (c *Client) WaitForYellowStatus(timeout string) error {
	return c.WaitForStatus("yellow", timeout)
}

// IsConnError unwraps the given error value and checks if it is equal to
// elastic.ErrNoClient.
func IsConnErr(err error) bool {
	return errors.Cause(err) == ErrNoClient
}
