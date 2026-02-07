package rueidis

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// ParseURL parses a redis URL into ClientOption.
// https://github.com/redis/redis-specifications/blob/master/uri/redis.txt
// Example:
//
// redis://<user>:<password>@<host>:<port>/<db_number>
// redis://<user>:<password>@<host>:<port>?addr=<host2>:<port2>&addr=<host3>:<port3>
// unix://<user>:<password>@</path/to/redis.sock>?db=<db_number>
func ParseURL(str string) (opt ClientOption, err error) {
	u, err := url.Parse(str)
	if err != nil {
		return opt, err
	}
	parseAddr := func(hostport string) (host string, addr string) {
		host, port, _ := net.SplitHostPort(hostport)
		if host == "" {
			host = u.Host
		}
		if host == "" {
			host = "localhost"
		}
		if port == "" {
			port = "6379"
		}
		return host, net.JoinHostPort(host, port)
	}
	switch u.Scheme {
	case "unix":
		opt.DialCtxFn = func(ctx context.Context, s string, dialer *net.Dialer, config *tls.Config) (conn net.Conn, err error) {
			return dialer.DialContext(ctx, "unix", s)
		}
		opt.InitAddress = []string{strings.TrimSpace(u.Path)}
	case "rediss", "valkeys":
		opt.TLSConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
	case "redis", "valkey":
	default:
		return opt, fmt.Errorf("redis: invalid URL scheme: %s", u.Scheme)
	}
	if opt.InitAddress == nil {
		host, addr := parseAddr(u.Host)
		opt.InitAddress = []string{addr}
		if opt.TLSConfig != nil {
			opt.TLSConfig.ServerName = host
		}
	}
	if u.User != nil {
		opt.Username = u.User.Username()
		opt.Password, _ = u.User.Password()
	}
	if u.Scheme != "unix" {
		if ps := strings.Split(u.Path, "/"); len(ps) == 2 {
			if opt.SelectDB, err = strconv.Atoi(ps[1]); err != nil {
				return opt, fmt.Errorf("redis: invalid database number: %q", ps[1])
			}
		} else if len(ps) > 2 {
			return opt, fmt.Errorf("redis: invalid URL path: %s", u.Path)
		}
	}
	q := u.Query()
	if q.Has("db") {
		if opt.SelectDB, err = strconv.Atoi(q.Get("db")); err != nil {
			return opt, fmt.Errorf("redis: invalid database number: %q", q.Get("db"))
		}
	}
	if q.Has("dial_timeout") {
		if opt.Dialer.Timeout, err = time.ParseDuration(q.Get("dial_timeout")); err != nil {
			return opt, fmt.Errorf("redis: invalid dial timeout: %q", q.Get("dial_timeout"))
		}
	}
	if q.Has("write_timeout") {
		if opt.Dialer.Timeout, err = time.ParseDuration(q.Get("write_timeout")); err != nil {
			return opt, fmt.Errorf("redis: invalid write timeout: %q", q.Get("write_timeout"))
		}
	}
	for _, addr := range q["addr"] {
		_, addr = parseAddr(addr)
		opt.InitAddress = append(opt.InitAddress, addr)
	}
	if opt.TLSConfig != nil && q.Has("skip_verify") {
		skipVerifyParam := q.Get("skip_verify")
		if skipVerifyParam == "" {
			opt.TLSConfig.InsecureSkipVerify = true
		} else {
			skipVerify, err := strconv.ParseBool(skipVerifyParam)
			if err != nil {
				return opt, fmt.Errorf("redis: invalid skip verify: %q", skipVerifyParam)
			}
			opt.TLSConfig.InsecureSkipVerify = skipVerify
		}
	}
	opt.AlwaysRESP2 = q.Get("protocol") == "2"
	opt.DisableCache = q.Get("client_cache") == "0"
	opt.DisableRetry = q.Get("max_retries") == "0"
	opt.ClientName = q.Get("client_name")
	opt.Sentinel.MasterSet = q.Get("master_set")
	return
}

func MustParseURL(str string) ClientOption {
	opt, err := ParseURL(str)
	if err != nil {
		panic(err)
	}
	return opt
}
