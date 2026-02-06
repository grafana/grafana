package grpcutil

// Copied from https://github.com/grpc/grpc-go/tree/v1.29.x/naming.

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strconv"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

const (
	defaultPort = "443"
	defaultFreq = time.Minute * 30
)

var (
	errMissingAddr  = errors.New("missing address")
	errWatcherClose = errors.New("watcher has been closed")

	lookupHost = net.DefaultResolver.LookupHost
	lookupSRV  = net.DefaultResolver.LookupSRV
)

// NewDNSResolverWithFreq creates a DNS Resolver that can resolve DNS names, and
// create watchers that poll the DNS server using the frequency set by freq.
func NewDNSResolverWithFreq(freq time.Duration, logger log.Logger) (*Resolver, error) {
	return &Resolver{
		logger: logger,
		freq:   freq,
	}, nil
}

// NewDNSResolver creates a DNS Resolver that can resolve DNS names, and create
// watchers that poll the DNS server using the default frequency defined by defaultFreq.
func NewDNSResolver(logger log.Logger) (*Resolver, error) {
	return NewDNSResolverWithFreq(defaultFreq, logger)
}

// Resolver handles name resolution for names following the DNS scheme.
type Resolver struct {
	logger log.Logger
	// frequency of polling the DNS server that the watchers created by this resolver will use.
	freq time.Duration
}

// formatIP returns ok = false if addr is not a valid textual representation of an IP address.
// If addr is an IPv4 address, return the addr and ok = true.
// If addr is an IPv6 address, return the addr enclosed in square brackets and ok = true.
func formatIP(addr string) (addrIP string, ok bool) {
	ip := net.ParseIP(addr)
	if ip == nil {
		return "", false
	}
	if ip.To4() != nil {
		return addr, true
	}
	return "[" + addr + "]", true
}

// parseTarget takes the user input target string, returns formatted host and port info.
// If target doesn't specify a port, set the port to be the defaultPort.
// If target is in IPv6 format and host-name is enclosed in square brackets, brackets
// are stripped when setting the host.
// examples:
// target: "www.google.com" returns host: "www.google.com", port: "443"
// target: "ipv4-host:80" returns host: "ipv4-host", port: "80"
// target: "[ipv6-host]" returns host: "ipv6-host", port: "443"
// target: ":80" returns host: "localhost", port: "80"
// target: ":" returns host: "localhost", port: "443"
func parseTarget(target string) (host, port string, err error) {
	if target == "" {
		return "", "", errMissingAddr
	}

	if ip := net.ParseIP(target); ip != nil {
		// target is an IPv4 or IPv6(without brackets) address
		return target, defaultPort, nil
	}
	if host, port, err := net.SplitHostPort(target); err == nil {
		// target has port, i.e ipv4-host:port, [ipv6-host]:port, host-name:port
		if host == "" {
			// Keep consistent with net.Dial(): If the host is empty, as in ":80", the local system is assumed.
			host = "localhost"
		}
		if port == "" {
			// If the port field is empty(target ends with colon), e.g. "[::1]:", defaultPort is used.
			port = defaultPort
		}
		return host, port, nil
	}
	if host, port, err := net.SplitHostPort(target + ":" + defaultPort); err == nil {
		// target doesn't have port
		return host, port, nil
	}
	return "", "", fmt.Errorf("invalid target address %v", target)
}

// Resolve creates a watcher that watches the SRV/hostname record resolution of the target.
//
// If service is not empty, the watcher will first attempt to resolve an SRV record.
// If that fails, or service is empty, hostname record resolution is attempted instead.
// If target can be parsed as an IP address, the watcher will return it, and will not send any more updates afterwards.
func (r *Resolver) Resolve(target, service string) (Watcher, error) {
	host, port, err := parseTarget(target)
	if err != nil {
		return nil, err
	}

	if net.ParseIP(host) != nil {
		ipWatcher := &ipWatcher{
			updateChan: make(chan *Update, 1),
		}
		host, _ = formatIP(host)
		ipWatcher.updateChan <- &Update{Op: Add, Addr: host + ":" + port}
		return ipWatcher, nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	return &dnsWatcher{
		r:       r,
		logger:  r.logger,
		host:    host,
		port:    port,
		service: service,
		ctx:     ctx,
		cancel:  cancel,
		t:       time.NewTimer(0),
	}, nil
}

// dnsWatcher watches for the name resolution update for a specific target
type dnsWatcher struct {
	r       *Resolver
	logger  log.Logger
	host    string
	port    string
	service string
	// The latest resolved address set
	curAddrs map[string]*Update
	ctx      context.Context
	cancel   context.CancelFunc
	t        *time.Timer
}

// ipWatcher watches for the name resolution update for an IP address.
type ipWatcher struct {
	updateChan chan *Update
}

// Next returns the address resolution Update for the target. For IP address,
// the resolution is itself, thus polling name server is unnecessary. Therefore,
// Next() will return an Update the first time it is called, and will be blocked
// for all following calls as no Update exists until watcher is closed.
func (i *ipWatcher) Next() ([]*Update, error) {
	u, ok := <-i.updateChan
	if !ok {
		return nil, errWatcherClose
	}
	return []*Update{u}, nil
}

// Close closes the ipWatcher.
func (i *ipWatcher) Close() {
	close(i.updateChan)
}

// compileUpdate compares the old resolved addresses and newly resolved addresses,
// and generates an update list
func (w *dnsWatcher) compileUpdate(newAddrs map[string]*Update) []*Update {
	var res []*Update
	for a, u := range w.curAddrs {
		if _, ok := newAddrs[a]; !ok {
			u.Op = Delete
			res = append(res, u)
		}
	}
	for a, u := range newAddrs {
		if _, ok := w.curAddrs[a]; !ok {
			res = append(res, u)
		}
	}
	return res
}

func (w *dnsWatcher) lookupSRV() map[string]*Update {
	if w.service == "" {
		return nil
	}

	newAddrs := make(map[string]*Update)
	_, srvs, err := lookupSRV(w.ctx, w.service, "tcp", w.host)
	if err != nil {
		level.Info(w.logger).Log("msg", "failed DNS SRV record lookup", "err", err)
		return nil
	}
	for _, s := range srvs {
		addrs, err := lookupHost(w.ctx, s.Target)
		if err != nil {
			level.Warn(w.logger).Log("msg", "failed SRV target DNS lookup", "target", s.Target, "err", err)
			continue
		}
		for _, a := range addrs {
			a, ok := formatIP(a)
			if !ok {
				level.Error(w.logger).Log("msg", "failed IP parsing", "err", err)
				continue
			}
			addr := a + ":" + strconv.Itoa(int(s.Port))
			newAddrs[addr] = &Update{Addr: addr}
		}
	}
	return newAddrs
}

func (w *dnsWatcher) lookupHost() map[string]*Update {
	newAddrs := make(map[string]*Update)
	addrs, err := lookupHost(w.ctx, w.host)
	if err != nil {
		level.Warn(w.logger).Log("msg", "failed DNS A record lookup", "err", err)
		return nil
	}
	for _, a := range addrs {
		a, ok := formatIP(a)
		if !ok {
			level.Error(w.logger).Log("msg", "failed IP parsing", "err", err)
			continue
		}
		addr := a + ":" + w.port
		newAddrs[addr] = &Update{Addr: addr}
	}
	return newAddrs
}

func (w *dnsWatcher) lookup() []*Update {
	newAddrs := w.lookupSRV()
	if newAddrs == nil {
		// If we failed to get any valid addresses from SRV record lookup,
		// return any A record info available.
		newAddrs = w.lookupHost()
	}
	result := w.compileUpdate(newAddrs)
	w.curAddrs = newAddrs
	return result
}

// Next returns the resolved address update(delta) for the target. If there's no
// change, it will sleep for 30 mins and try to resolve again after that.
func (w *dnsWatcher) Next() ([]*Update, error) {
	for {
		select {
		case <-w.ctx.Done():
			return nil, errWatcherClose
		case <-w.t.C:
		}
		result := w.lookup()
		// Next lookup should happen after an interval defined by w.r.freq.
		w.t.Reset(w.r.freq)
		if len(result) > 0 {
			return result, nil
		}
	}
}

func (w *dnsWatcher) Close() {
	w.cancel()
}
