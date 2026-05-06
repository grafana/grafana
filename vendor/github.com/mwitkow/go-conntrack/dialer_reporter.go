// Copyright 2016 Michal Witkowski. All Rights Reserved.
// See LICENSE for licensing terms.

package conntrack

import (
	"context"
	"net"
	"os"
	"syscall"

	prom "github.com/prometheus/client_golang/prometheus"
)

type failureReason string

const (
	failedResolution  = "resolution"
	failedConnRefused = "refused"
	failedTimeout     = "timeout"
	failedUnknown     = "unknown"
)

var (
	dialerAttemptedTotal = prom.NewCounterVec(
		prom.CounterOpts{
			Namespace: "net",
			Subsystem: "conntrack",
			Name:      "dialer_conn_attempted_total",
			Help:      "Total number of connections attempted by the given dialer a given name.",
		}, []string{"dialer_name"})

	dialerConnEstablishedTotal = prom.NewCounterVec(
		prom.CounterOpts{
			Namespace: "net",
			Subsystem: "conntrack",
			Name:      "dialer_conn_established_total",
			Help:      "Total number of connections successfully established by the given dialer a given name.",
		}, []string{"dialer_name"})

	dialerConnFailedTotal = prom.NewCounterVec(
		prom.CounterOpts{
			Namespace: "net",
			Subsystem: "conntrack",
			Name:      "dialer_conn_failed_total",
			Help:      "Total number of connections failed to dial by the dialer a given name.",
		}, []string{"dialer_name", "reason"})

	dialerConnClosedTotal = prom.NewCounterVec(
		prom.CounterOpts{
			Namespace: "net",
			Subsystem: "conntrack",
			Name:      "dialer_conn_closed_total",
			Help:      "Total number of connections closed which originated from the dialer of a given name.",
		}, []string{"dialer_name"})
)

func init() {
	prom.MustRegister(dialerAttemptedTotal)
	prom.MustRegister(dialerConnEstablishedTotal)
	prom.MustRegister(dialerConnFailedTotal)
	prom.MustRegister(dialerConnClosedTotal)
}

// preRegisterDialerMetrics pre-populates Prometheus labels for the given dialer name, to avoid Prometheus missing labels issue.
func PreRegisterDialerMetrics(dialerName string) {
	dialerAttemptedTotal.WithLabelValues(dialerName)
	dialerConnEstablishedTotal.WithLabelValues(dialerName)
	for _, reason := range []failureReason{failedTimeout, failedResolution, failedConnRefused, failedUnknown} {
		dialerConnFailedTotal.WithLabelValues(dialerName, string(reason))
	}
	dialerConnClosedTotal.WithLabelValues(dialerName)
}

func reportDialerConnAttempt(dialerName string) {
	dialerAttemptedTotal.WithLabelValues(dialerName).Inc()
}

func reportDialerConnEstablished(dialerName string) {
	dialerConnEstablishedTotal.WithLabelValues(dialerName).Inc()
}

func reportDialerConnClosed(dialerName string) {
	dialerConnClosedTotal.WithLabelValues(dialerName).Inc()
}

func reportDialerConnFailed(dialerName string, err error) {
	if netErr, ok := err.(*net.OpError); ok {
		switch nestErr := netErr.Err.(type) {
		case *net.DNSError:
			dialerConnFailedTotal.WithLabelValues(dialerName, string(failedResolution)).Inc()
			return
		case *os.SyscallError:
			if nestErr.Err == syscall.ECONNREFUSED {
				dialerConnFailedTotal.WithLabelValues(dialerName, string(failedConnRefused)).Inc()
			}
			dialerConnFailedTotal.WithLabelValues(dialerName, string(failedUnknown)).Inc()
			return
		}
		if netErr.Timeout() {
			dialerConnFailedTotal.WithLabelValues(dialerName, string(failedTimeout)).Inc()
		}
	} else if err == context.Canceled || err == context.DeadlineExceeded {
		dialerConnFailedTotal.WithLabelValues(dialerName, string(failedTimeout)).Inc()
		return
	}
	dialerConnFailedTotal.WithLabelValues(dialerName, string(failedUnknown)).Inc()
}
