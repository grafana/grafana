package redis

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/url"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v8/internal"
	"github.com/go-redis/redis/v8/internal/pool"
	"go.opentelemetry.io/otel/label"
	"go.opentelemetry.io/otel/trace"
)

// Limiter is the interface of a rate limiter or a circuit breaker.
type Limiter interface {
	// Allow returns nil if operation is allowed or an error otherwise.
	// If operation is allowed client must ReportResult of the operation
	// whether it is a success or a failure.
	Allow() error
	// ReportResult reports the result of the previously allowed operation.
	// nil indicates a success, non-nil error usually indicates a failure.
	ReportResult(result error)
}

// Options keeps the settings to setup redis connection.
type Options struct {
	// The network type, either tcp or unix.
	// Default is tcp.
	Network string
	// host:port address.
	Addr string

	// Dialer creates new network connection and has priority over
	// Network and Addr options.
	Dialer func(ctx context.Context, network, addr string) (net.Conn, error)

	// Hook that is called when new connection is established.
	OnConnect func(ctx context.Context, cn *Conn) error

	// Use the specified Username to authenticate the current connection
	// with one of the connections defined in the ACL list when connecting
	// to a Redis 6.0 instance, or greater, that is using the Redis ACL system.
	Username string
	// Optional password. Must match the password specified in the
	// requirepass server configuration option (if connecting to a Redis 5.0 instance, or lower),
	// or the User Password when connecting to a Redis 6.0 instance, or greater,
	// that is using the Redis ACL system.
	Password string

	// Database to be selected after connecting to the server.
	DB int

	// Maximum number of retries before giving up.
	// Default is 3 retries.
	MaxRetries int
	// Minimum backoff between each retry.
	// Default is 8 milliseconds; -1 disables backoff.
	MinRetryBackoff time.Duration
	// Maximum backoff between each retry.
	// Default is 512 milliseconds; -1 disables backoff.
	MaxRetryBackoff time.Duration

	// Dial timeout for establishing new connections.
	// Default is 5 seconds.
	DialTimeout time.Duration
	// Timeout for socket reads. If reached, commands will fail
	// with a timeout instead of blocking. Use value -1 for no timeout and 0 for default.
	// Default is 3 seconds.
	ReadTimeout time.Duration
	// Timeout for socket writes. If reached, commands will fail
	// with a timeout instead of blocking.
	// Default is ReadTimeout.
	WriteTimeout time.Duration

	// Maximum number of socket connections.
	// Default is 10 connections per every CPU as reported by runtime.NumCPU.
	PoolSize int
	// Minimum number of idle connections which is useful when establishing
	// new connection is slow.
	MinIdleConns int
	// Connection age at which client retires (closes) the connection.
	// Default is to not close aged connections.
	MaxConnAge time.Duration
	// Amount of time client waits for connection if all connections
	// are busy before returning an error.
	// Default is ReadTimeout + 1 second.
	PoolTimeout time.Duration
	// Amount of time after which client closes idle connections.
	// Should be less than server's timeout.
	// Default is 5 minutes. -1 disables idle timeout check.
	IdleTimeout time.Duration
	// Frequency of idle checks made by idle connections reaper.
	// Default is 1 minute. -1 disables idle connections reaper,
	// but idle connections are still discarded by the client
	// if IdleTimeout is set.
	IdleCheckFrequency time.Duration

	// Enables read only queries on slave nodes.
	readOnly bool

	// TLS Config to use. When set TLS will be negotiated.
	TLSConfig *tls.Config

	// Limiter interface used to implemented circuit breaker or rate limiter.
	Limiter Limiter
}

func (opt *Options) init() {
	if opt.Addr == "" {
		opt.Addr = "localhost:6379"
	}
	if opt.Network == "" {
		if strings.HasPrefix(opt.Addr, "/") {
			opt.Network = "unix"
		} else {
			opt.Network = "tcp"
		}
	}
	if opt.DialTimeout == 0 {
		opt.DialTimeout = 5 * time.Second
	}
	if opt.Dialer == nil {
		opt.Dialer = func(ctx context.Context, network, addr string) (net.Conn, error) {
			netDialer := &net.Dialer{
				Timeout:   opt.DialTimeout,
				KeepAlive: 5 * time.Minute,
			}
			if opt.TLSConfig == nil {
				return netDialer.DialContext(ctx, network, addr)
			}
			return tls.DialWithDialer(netDialer, network, addr, opt.TLSConfig)
		}
	}
	if opt.PoolSize == 0 {
		opt.PoolSize = 10 * runtime.NumCPU()
	}
	switch opt.ReadTimeout {
	case -1:
		opt.ReadTimeout = 0
	case 0:
		opt.ReadTimeout = 3 * time.Second
	}
	switch opt.WriteTimeout {
	case -1:
		opt.WriteTimeout = 0
	case 0:
		opt.WriteTimeout = opt.ReadTimeout
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

	if opt.MaxRetries == -1 {
		opt.MaxRetries = 0
	} else if opt.MaxRetries == 0 {
		opt.MaxRetries = 3
	}
	switch opt.MinRetryBackoff {
	case -1:
		opt.MinRetryBackoff = 0
	case 0:
		opt.MinRetryBackoff = 8 * time.Millisecond
	}
	switch opt.MaxRetryBackoff {
	case -1:
		opt.MaxRetryBackoff = 0
	case 0:
		opt.MaxRetryBackoff = 512 * time.Millisecond
	}
}

func (opt *Options) clone() *Options {
	clone := *opt
	return &clone
}

// ParseURL parses an URL into Options that can be used to connect to Redis.
// Scheme is required.
// There are two connection types: by tcp socket and by unix socket.
// Tcp connection:
// 		redis://<user>:<password>@<host>:<port>/<db_number>
// Unix connection:
//		unix://<user>:<password>@</path/to/redis.sock>?db=<db_number>
func ParseURL(redisURL string) (*Options, error) {
	u, err := url.Parse(redisURL)
	if err != nil {
		return nil, err
	}

	switch u.Scheme {
	case "redis", "rediss":
		return setupTCPConn(u)
	case "unix":
		return setupUnixConn(u)
	default:
		return nil, fmt.Errorf("redis: invalid URL scheme: %s", u.Scheme)
	}
}

func setupTCPConn(u *url.URL) (*Options, error) {
	o := &Options{Network: "tcp"}

	o.Username, o.Password = getUserPassword(u)

	if len(u.Query()) > 0 {
		return nil, errors.New("redis: no options supported")
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
			return nil, fmt.Errorf("redis: invalid database number: %q", f[0])
		}
	default:
		return nil, fmt.Errorf("redis: invalid URL path: %s", u.Path)
	}

	if u.Scheme == "rediss" {
		o.TLSConfig = &tls.Config{ServerName: h}
	}

	return o, nil
}

func setupUnixConn(u *url.URL) (*Options, error) {
	o := &Options{
		Network: "unix",
	}

	if strings.TrimSpace(u.Path) == "" { // path is required with unix connection
		return nil, errors.New("redis: empty unix socket path")
	}
	o.Addr = u.Path

	o.Username, o.Password = getUserPassword(u)

	dbStr := u.Query().Get("db")
	if dbStr == "" {
		return o, nil // if database is not set, connect to 0 db.
	}

	db, err := strconv.Atoi(dbStr)
	if err != nil {
		return nil, fmt.Errorf("redis: invalid database number: %w", err)
	}
	o.DB = db

	return o, nil
}

func getUserPassword(u *url.URL) (string, string) {
	var user, password string
	if u.User != nil {
		user = u.User.Username()
		if p, ok := u.User.Password(); ok {
			password = p
		}
	}
	return user, password
}

func newConnPool(opt *Options) *pool.ConnPool {
	return pool.NewConnPool(&pool.Options{
		Dialer: func(ctx context.Context) (net.Conn, error) {
			var conn net.Conn
			err := internal.WithSpan(ctx, "redis.dial", func(ctx context.Context, span trace.Span) error {
				span.SetAttributes(
					label.String("db.connection_string", opt.Addr),
				)

				var err error
				conn, err = opt.Dialer(ctx, opt.Network, opt.Addr)
				if err != nil {
					_ = internal.RecordError(ctx, span, err)
				}
				return err
			})
			return conn, err
		},
		PoolSize:           opt.PoolSize,
		MinIdleConns:       opt.MinIdleConns,
		MaxConnAge:         opt.MaxConnAge,
		PoolTimeout:        opt.PoolTimeout,
		IdleTimeout:        opt.IdleTimeout,
		IdleCheckFrequency: opt.IdleCheckFrequency,
	})
}
