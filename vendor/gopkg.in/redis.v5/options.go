package redis

import (
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"

	"gopkg.in/redis.v5/internal/pool"
)

type Options struct {
	// The network type, either tcp or unix.
	// Default is tcp.
	Network string
	// host:port address.
	Addr string

	// Dialer creates new network connection and has priority over
	// Network and Addr options.
	Dialer func() (net.Conn, error)

	// Optional password. Must match the password specified in the
	// requirepass server configuration option.
	Password string
	// Database to be selected after connecting to the server.
	DB int

	// Maximum number of retries before giving up.
	// Default is to not retry failed commands.
	MaxRetries int

	// Dial timeout for establishing new connections.
	// Default is 5 seconds.
	DialTimeout time.Duration
	// Timeout for socket reads. If reached, commands will fail
	// with a timeout instead of blocking.
	// Default is 3 seconds.
	ReadTimeout time.Duration
	// Timeout for socket writes. If reached, commands will fail
	// with a timeout instead of blocking.
	// Default is 3 seconds.
	WriteTimeout time.Duration

	// Maximum number of socket connections.
	// Default is 10 connections.
	PoolSize int
	// Amount of time client waits for connection if all connections
	// are busy before returning an error.
	// Default is ReadTimeout + 1 second.
	PoolTimeout time.Duration
	// Amount of time after which client closes idle connections.
	// Should be less than server's timeout.
	// Default is to not close idle connections.
	IdleTimeout time.Duration
	// Frequency of idle checks.
	// Default is 1 minute.
	// When minus value is set, then idle check is disabled.
	IdleCheckFrequency time.Duration

	// Enables read only queries on slave nodes.
	ReadOnly bool

	// TLS Config to use. When set TLS will be negotiated.
	TLSConfig *tls.Config
}

func (opt *Options) init() {
	if opt.Network == "" {
		opt.Network = "tcp"
	}
	if opt.Dialer == nil {
		opt.Dialer = func() (net.Conn, error) {
			conn, err := net.DialTimeout(opt.Network, opt.Addr, opt.DialTimeout)
			if opt.TLSConfig == nil || err != nil {
				return conn, err
			}
			t := tls.Client(conn, opt.TLSConfig)
			return t, t.Handshake()
		}
	}
	if opt.PoolSize == 0 {
		opt.PoolSize = 10
	}
	if opt.DialTimeout == 0 {
		opt.DialTimeout = 5 * time.Second
	}
	if opt.ReadTimeout == 0 {
		opt.ReadTimeout = 3 * time.Second
	} else if opt.ReadTimeout == -1 {
		opt.ReadTimeout = 0
	}
	if opt.WriteTimeout == 0 {
		opt.WriteTimeout = opt.ReadTimeout
	} else if opt.WriteTimeout == -1 {
		opt.WriteTimeout = 0
	}
	if opt.PoolTimeout == 0 {
		opt.PoolTimeout = opt.ReadTimeout + time.Second
	}
	if opt.IdleTimeout == 0 {
		opt.IdleTimeout = 5 * time.Minute
	}
	if opt.IdleCheckFrequency == 0 {
		opt.IdleCheckFrequency = time.Minute
	}
}

// ParseURL parses a redis URL into options that can be used to connect to redis
func ParseURL(redisURL string) (*Options, error) {
	o := &Options{Network: "tcp"}
	u, err := url.Parse(redisURL)
	if err != nil {
		return nil, err
	}

	if u.Scheme != "redis" && u.Scheme != "rediss" {
		return nil, errors.New("invalid redis URL scheme: " + u.Scheme)
	}

	if u.User != nil {
		if p, ok := u.User.Password(); ok {
			o.Password = p
		}
	}

	if len(u.Query()) > 0 {
		return nil, errors.New("no options supported")
	}

	h, p, err := net.SplitHostPort(u.Host)
	if err != nil {
		h = u.Host
	}
	if h == "" {
		h = "localhost"
	}
	if p == "" {
		p = "6379"
	}
	o.Addr = net.JoinHostPort(h, p)

	f := strings.FieldsFunc(u.Path, func(r rune) bool {
		return r == '/'
	})
	switch len(f) {
	case 0:
		o.DB = 0
	case 1:
		if o.DB, err = strconv.Atoi(f[0]); err != nil {
			return nil, fmt.Errorf("invalid redis database number: %q", f[0])
		}
	default:
		return nil, errors.New("invalid redis URL path: " + u.Path)
	}

	if u.Scheme == "rediss" {
		o.TLSConfig = &tls.Config{ServerName: h}
	}
	return o, nil
}

func newConnPool(opt *Options) *pool.ConnPool {
	return pool.NewConnPool(
		opt.Dialer,
		opt.PoolSize,
		opt.PoolTimeout,
		opt.IdleTimeout,
		opt.IdleCheckFrequency,
	)
}

// PoolStats contains pool state information and accumulated stats.
type PoolStats struct {
	Requests uint32 // number of times a connection was requested by the pool
	Hits     uint32 // number of times free connection was found in the pool
	Timeouts uint32 // number of times a wait timeout occurred

	TotalConns uint32 // the number of total connections in the pool
	FreeConns  uint32 // the number of free connections in the pool
}
