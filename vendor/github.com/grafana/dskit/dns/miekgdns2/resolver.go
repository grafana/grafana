// Provenance-includes-location: https://github.com/thanos-io/thanos/blob/main/pkg/discovery/dns/miekgdns/resolver.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Thanos Authors.

package miekgdns2

import (
	"context"
	"fmt"
	"net"
	"slices"
	"sync"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/miekg/dns"

	"github.com/grafana/dskit/multierror"
)

const (
	DefaultResolvConfPath   = "/etc/resolv.conf"
	defaultResolvConfReload = time.Second * 5
	defaultMaxConnsPerHost  = 2
)

type Client interface {
	Exchange(ctx context.Context, msg *dns.Msg, server string) (*dns.Msg, time.Duration, error)
	Clean(known []string)
}

// Resolver is a DNS service discovery backend that retries on errors, only uses TCP,
// and pools connections to nameservers to increase reliability.
//
// This backend:
// * Does _not_ use search domains, all names are assumed to be fully qualified
// * Only uses TCP connections to the nameservers
// * Keeps several connections to each nameserver open
// * Reads resolv.conf periodically, using stale configuration if this fails
// * Closes connections to unknown nameservers periodically
//
// The following parts of resolv.conf are supported:
// * `nameserver` setting
// * `attempts` option
//
// The following parts of resolv.conf are NOT supported.
// * `search` setting
// * `timeout` option
// * `ndots` option
type Resolver struct {
	client       Client
	logger       log.Logger
	confPath     string
	reloadPeriod time.Duration
	stop         chan struct{}

	mtx  sync.RWMutex
	conf *dns.ClientConfig
}

// NewResolver creates a new Resolver that uses the provided resolv.conf configuration
// to perform DNS queries. Configuration from resolv.conf will be periodically reloaded.
func NewResolver(resolvConf string, logger log.Logger) *Resolver {
	return NewResolverWithClient(resolvConf, logger, defaultResolvConfReload, NewPoolingClient(defaultMaxConnsPerHost))
}

// NewResolverWithClient creates a new Resolver that uses the provided resolv.conf configuration,
// reload period, and Client implementation to perform DNS queries. Configuration from resolv.conf
// will be periodically reloaded.
func NewResolverWithClient(resolvConf string, logger log.Logger, reloadPeriod time.Duration, client Client) *Resolver {
	r := &Resolver{
		client:       client,
		logger:       logger,
		confPath:     resolvConf,
		reloadPeriod: reloadPeriod,
		stop:         make(chan struct{}),
	}

	// Attempt an initial load of the configuration but fallback to defaults if it fails. The file
	// missing should not be fatal according to `man 5 resolv.conf`.
	if err := r.loadConfig(); err != nil {
		level.Warn(r.logger).Log("msg", "unable to load resolv.conf, using default values", "path", r.confPath, "err", err)
		r.conf = defaultClientConfig()
	}

	// Attempt to reload configuration periodically. If the reloads fail, old values are used.
	go r.loop()
	return r
}

// Stop stops periodic tasks run by the Resolver. The resolver should not be used after it is stopped.
func (r *Resolver) Stop() {
	close(r.stop)
}

func (r *Resolver) IsNotFound(error) bool {
	// We don't return an error when there are no hosts found so this is
	// always false. Instead, we return the empty DNS response with the
	// appropriate return code set.
	return false
}

func (r *Resolver) LookupSRV(ctx context.Context, service, proto, name string) (cname string, addrs []*net.SRV, err error) {
	return r.lookupSRV(ctx, r.getConfig(), service, proto, name)
}

func (r *Resolver) lookupSRV(ctx context.Context, conf *dns.ClientConfig, service, proto, name string) (cname string, addrs []*net.SRV, err error) {
	var target string
	if service == "" && proto == "" {
		target = name
	} else {
		target = "_" + service + "._" + proto + "." + name
	}

	response, err := r.query(ctx, conf, target, dns.Type(dns.TypeSRV))
	if err != nil {
		return "", nil, err
	}

	for _, record := range response.Answer {
		switch addr := record.(type) {
		case *dns.SRV:
			addrs = append(addrs, &net.SRV{
				Weight:   addr.Weight,
				Target:   addr.Target,
				Priority: addr.Priority,
				Port:     addr.Port,
			})
		default:
			return "", nil, fmt.Errorf("invalid SRV response record %s", record)
		}
	}

	return "", addrs, err
}

func (r *Resolver) LookupIPAddr(ctx context.Context, host string) ([]net.IPAddr, error) {
	return r.lookupIPAddr(ctx, r.getConfig(), host, 1, 8)
}

func (r *Resolver) lookupIPAddr(ctx context.Context, conf *dns.ClientConfig, host string, currIteration, maxIterations int) ([]net.IPAddr, error) {
	// We want to protect from infinite loops when resolving DNS records recursively.
	if currIteration > maxIterations {
		return nil, fmt.Errorf("maximum number of recursive iterations reached (%d)", maxIterations)
	}

	response, err := r.query(ctx, conf, host, dns.Type(dns.TypeAAAA))
	if err != nil || len(response.Answer) == 0 {
		// Ugly fallback to A lookup.
		response, err = r.query(ctx, conf, host, dns.Type(dns.TypeA))
		if err != nil {
			return nil, err
		}
	}

	var resp []net.IPAddr
	for _, record := range response.Answer {
		switch addr := record.(type) {
		case *dns.A:
			resp = append(resp, net.IPAddr{IP: addr.A})
		case *dns.AAAA:
			resp = append(resp, net.IPAddr{IP: addr.AAAA})
		case *dns.CNAME:
			// Recursively resolve it.
			addrs, err := r.lookupIPAddr(ctx, conf, addr.Target, currIteration+1, maxIterations)
			if err != nil {
				return nil, fmt.Errorf("%w: recursively resolve %s", err, addr.Target)
			}
			resp = append(resp, addrs...)
		default:
			return nil, fmt.Errorf("invalid A, AAAA or CNAME response record %s", record)
		}
	}
	return resp, nil
}

func (r *Resolver) query(ctx context.Context, conf *dns.ClientConfig, name string, qType dns.Type) (*dns.Msg, error) {
	// We don't support search domains, all names are assumed to be fully qualified already.
	msg := new(dns.Msg).SetQuestion(dns.Fqdn(name), uint16(qType))

	merr := multierror.New()
	// `man 5 resolv.conf` says that we should try each server, continuing to the next if
	// there is a timeout. We should repeat this process up to "attempt" times trying to get
	// a viable response.
	//
	// > (The algorithm used is to try a name server, and if the query times out, try the next,
	// > until out of name servers, then repeat trying all the name servers until a maximum number
	// > of retries are made.)
	for i := 0; i < conf.Attempts; i++ {
		for _, ip := range conf.Servers {
			server := net.JoinHostPort(ip, conf.Port)
			response, _, err := r.client.Exchange(ctx, msg, server)
			if err != nil {
				merr.Add(fmt.Errorf("resolution against server %s: %w", server, err))
				continue
			}

			if response.Truncated {
				merr.Add(fmt.Errorf("resolution against server %s: response truncated", server))
				continue
			}

			if response.Rcode == dns.RcodeSuccess || response.Rcode == dns.RcodeNameError {
				return response, nil
			}
		}
	}

	return nil, fmt.Errorf("could not resolve %s: no servers returned a viable answer. Errs %s", name, merr.Err())
}

// loop periodically reloads configuration from resolv.conf until the resolver is stopped.
func (r *Resolver) loop() {
	ticker := time.NewTicker(r.reloadPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := r.loadConfig(); err != nil {
				level.Warn(r.logger).Log("msg", "unable to reload resolv.conf, using old values", "path", r.confPath, "err", err)
			}
		case <-r.stop:
			return
		}
	}
}

// loadConfig loads and updates configuration from the configured resolv.conf path,
// closing connections to defunct servers that are no longer configured, and returning
// an error if the configuration file couldn't be opened or parsed. If an error is
// returned, connections are not closed and the stored configuration is not updated.
func (r *Resolver) loadConfig() error {
	conf, err := dns.ClientConfigFromFile(r.confPath)
	if err != nil {
		return fmt.Errorf("could not load %s: %w", r.confPath, err)
	}

	// Note that we're building the list of known servers for the r.client.Clean method
	// below from the newly read configuration before updating r.conf so that we know
	// that the configuration can't be modified by another thread.
	servers := make([]string, len(conf.Servers))
	for i, ip := range conf.Servers {
		servers[i] = net.JoinHostPort(ip, conf.Port)
	}

	r.mtx.Lock()
	r.conf = conf
	r.mtx.Unlock()

	// Close connections to any servers that are no longer in resolv.conf.
	r.client.Clean(servers)

	return nil
}

func (r *Resolver) getConfig() *dns.ClientConfig {
	r.mtx.RLock()
	defer r.mtx.RUnlock()

	return &dns.ClientConfig{
		Servers:  r.conf.Servers,
		Search:   r.conf.Search,
		Port:     r.conf.Port,
		Ndots:    r.conf.Ndots,
		Timeout:  r.conf.Timeout,
		Attempts: r.conf.Attempts,
	}
}

// defaultClientConfig returns Default values if resolv.conf can't be loaded, picked based on values from `man 5 resolv.conf`
func defaultClientConfig() *dns.ClientConfig {
	return &dns.ClientConfig{
		Servers:  []string{"127.0.0.1"},
		Search:   []string{},
		Port:     "53",
		Ndots:    1,
		Timeout:  5,
		Attempts: 2,
	}
}

// PoolingClient is a DNS client that pools TCP connections to each nameserver.
type PoolingClient struct {
	network string
	maxOpen int

	mtx   sync.Mutex
	pools map[string]*Pool
}

// NewPoolingClient creates a new PoolingClient instance that keeps up to maxOpen connections to each nameserver.
func NewPoolingClient(maxOpen int) *PoolingClient {
	return &PoolingClient{
		network: "tcp",
		maxOpen: maxOpen,
		pools:   make(map[string]*Pool),
	}
}

// Exchange sends the DNS msg to the nameserver using a pooled connection. The nameserver must be
// of the form "ip:port".
func (c *PoolingClient) Exchange(ctx context.Context, msg *dns.Msg, server string) (*dns.Msg, time.Duration, error) {
	pool := c.getPool(server)
	conn, err := pool.Get(ctx, c.network, server)
	if err != nil {
		return nil, 0, fmt.Errorf("unable to create connection to %s via %s: %w", server, c.network, err)
	}

	connOk := true
	defer func() {
		if connOk {
			_ = pool.Put(conn)
		} else {
			pool.Discard(conn)
		}
	}()

	client := &dns.Client{Net: c.network}
	response, rtt, err := client.ExchangeWithConnContext(ctx, msg, conn)
	if err != nil {
		connOk = false
	}

	return response, rtt, err
}

// Clean closes connections to any nameservers that are _not_ part of list of known
// nameservers. The nameservers must be of the form "ip:port", the same format as the
// Exchange method.
func (c *PoolingClient) Clean(known []string) {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	for server, pool := range c.pools {
		if slices.Contains(known, server) {
			continue
		}

		pool.Close()
		delete(c.pools, server)
	}
}

func (c *PoolingClient) getPool(server string) *Pool {
	c.mtx.Lock()
	defer c.mtx.Unlock()

	p, ok := c.pools[server]
	if !ok {
		p = NewPool(c.maxOpen)
		c.pools[server] = p
	}

	return p
}

// Pool is a pool of DNS connections for a single DNS server.
type Pool struct {
	mtx    sync.RWMutex
	conns  chan *dns.Conn
	closed bool
}

// NewPool creates a new DNS connection Pool, keeping up to maxConns open.
func NewPool(maxConns int) *Pool {
	return &Pool{
		conns: make(chan *dns.Conn, maxConns),
	}
}

// Get gets an existing connection from the pool or creates a new one if there are no
// pooled connections available. If the pool has been closed, an error is returned.
func (p *Pool) Get(ctx context.Context, network string, server string) (*dns.Conn, error) {
	p.mtx.RLock()
	defer p.mtx.RUnlock()

	if p.closed {
		return nil, fmt.Errorf("connection pool for %s %s is closed", network, server)
	}

	select {
	case conn := <-p.conns:
		return conn, nil
	default:
		return p.newConn(ctx, network, server)
	}
}

// Put returns a healthy connection to the pool, potentially closing it if the pool is
// already at capacity. If the pool has been closed, the connection will be closed immediately.
func (p *Pool) Put(conn *dns.Conn) error {
	p.mtx.RLock()
	defer p.mtx.RUnlock()

	if p.closed {
		return conn.Close()
	}

	select {
	case p.conns <- conn:
		return nil
	default:
		return conn.Close()
	}
}

// Discard closes and does not return the given broken connection to the pool.
func (p *Pool) Discard(conn *dns.Conn) {
	_ = conn.Close()
}

// Close shuts down this pool, closing all existing connections and preventing new connections
// from being created. Any attempts to get a connection from this pool after it is closed will
// result in an error.
func (p *Pool) Close() {
	p.mtx.Lock()
	defer p.mtx.Unlock()

	p.closed = true
	for {
		select {
		case c := <-p.conns:
			_ = c.Close()
		default:
			return
		}
	}
}

func (p *Pool) newConn(ctx context.Context, network string, server string) (*dns.Conn, error) {
	client := &dns.Client{Net: network}
	return client.DialContext(ctx, server)
}
