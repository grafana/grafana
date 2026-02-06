// Copyright 2016 Michal Witkowski. All Rights Reserved.
// See LICENSE for licensing terms.

package conntrack

import (
	"context"
	"fmt"
	"net"
	"sync"

	"golang.org/x/net/trace"
)

var (
	dialerNameKey = "conntrackDialerKey"
)

type dialerOpts struct {
	name                  string
	monitoring            bool
	tracing               bool
	parentDialContextFunc dialerContextFunc
}

type dialerOpt func(*dialerOpts)

type dialerContextFunc func(context.Context, string, string) (net.Conn, error)

// DialWithName sets the name of the dialer for tracking and monitoring.
// This is the name for the dialer (default is `default`), but for `NewDialContextFunc` can be overwritten from the
// Context using `DialNameToContext`.
func DialWithName(name string) dialerOpt {
	return func(opts *dialerOpts) {
		opts.name = name
	}
}

// DialWithoutMonitoring turns *off* Prometheus monitoring for this dialer.
func DialWithoutMonitoring() dialerOpt {
	return func(opts *dialerOpts) {
		opts.monitoring = false
	}
}

// DialWithTracing turns *on* the /debug/events tracing of the dial calls.
func DialWithTracing() dialerOpt {
	return func(opts *dialerOpts) {
		opts.tracing = true
	}
}

// DialWithDialer allows you to override the `net.Dialer` instance used to actually conduct the dials.
func DialWithDialer(parentDialer *net.Dialer) dialerOpt {
	return DialWithDialContextFunc(parentDialer.DialContext)
}

// DialWithDialContextFunc allows you to override func gets used for the actual dialing. The default is `net.Dialer.DialContext`.
func DialWithDialContextFunc(parentDialerFunc dialerContextFunc) dialerOpt {
	return func(opts *dialerOpts) {
		opts.parentDialContextFunc = parentDialerFunc
	}
}

// DialNameFromContext returns the name of the dialer from the context of the DialContext func, if any.
func DialNameFromContext(ctx context.Context) string {
	val, ok := ctx.Value(dialerNameKey).(string)
	if !ok {
		return ""
	}
	return val
}

// DialNameToContext returns a context that will contain a dialer name override.
func DialNameToContext(ctx context.Context, dialerName string) context.Context {
	return context.WithValue(ctx, dialerNameKey, dialerName)
}

// NewDialContextFunc returns a `DialContext` function that tracks outbound connections.
// The signature is compatible with `http.Tranport.DialContext` and is meant to be used there.
func NewDialContextFunc(optFuncs ...dialerOpt) func(context.Context, string, string) (net.Conn, error) {
	opts := &dialerOpts{name: defaultName, monitoring: true, parentDialContextFunc: (&net.Dialer{}).DialContext}
	for _, f := range optFuncs {
		f(opts)
	}
	if opts.monitoring {
		PreRegisterDialerMetrics(opts.name)
	}
	return func(ctx context.Context, network string, addr string) (net.Conn, error) {
		name := opts.name
		if ctxName := DialNameFromContext(ctx); ctxName != "" {
			name = ctxName
		}
		return dialClientConnTracker(ctx, network, addr, name, opts)
	}
}

// NewDialFunc returns a `Dial` function that tracks outbound connections.
// The signature is compatible with `http.Tranport.Dial` and is meant to be used there for Go < 1.7.
func NewDialFunc(optFuncs ...dialerOpt) func(string, string) (net.Conn, error) {
	dialContextFunc := NewDialContextFunc(optFuncs...)
	return func(network string, addr string) (net.Conn, error) {
		return dialContextFunc(context.TODO(), network, addr)
	}
}

type clientConnTracker struct {
	net.Conn
	opts       *dialerOpts
	dialerName string
	event      trace.EventLog
	mu         sync.Mutex
}

func dialClientConnTracker(ctx context.Context, network string, addr string, dialerName string, opts *dialerOpts) (net.Conn, error) {
	var event trace.EventLog
	if opts.tracing {
		event = trace.NewEventLog(fmt.Sprintf("net.ClientConn.%s", dialerName), fmt.Sprintf("%v", addr))
	}
	if opts.monitoring {
		reportDialerConnAttempt(dialerName)
	}
	conn, err := opts.parentDialContextFunc(ctx, network, addr)
	if err != nil {
		if event != nil {
			event.Errorf("failed dialing: %v", err)
			event.Finish()
		}
		if opts.monitoring {
			reportDialerConnFailed(dialerName, err)
		}
		return nil, err
	}
	if event != nil {
		event.Printf("established: %s -> %s", conn.LocalAddr(), conn.RemoteAddr())
	}
	if opts.monitoring {
		reportDialerConnEstablished(dialerName)
	}
	tracker := &clientConnTracker{
		Conn:       conn,
		opts:       opts,
		dialerName: dialerName,
		event:      event,
	}
	return tracker, nil
}

func (ct *clientConnTracker) Close() error {
	err := ct.Conn.Close()
	ct.mu.Lock()
	if ct.event != nil {
		if err != nil {
			ct.event.Errorf("failed closing: %v", err)
		} else {
			ct.event.Printf("closing")
		}
		ct.event.Finish()
		ct.event = nil
	}
	ct.mu.Unlock()
	if ct.opts.monitoring {
		reportDialerConnClosed(ct.dialerName)
	}
	return err
}
