package util

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/dskit/grpcutil"
	"github.com/grafana/dskit/services"
	"github.com/pkg/errors"

	util_log "github.com/grafana/loki/v3/pkg/util/log"
)

// Notifications about address resolution. All notifications are sent on the same goroutine.
type DNSNotifications interface {
	// New address has been discovered by DNS watcher for supplied hostname.
	AddressAdded(address string)

	// Previously-discovered address is no longer resolved for the hostname.
	AddressRemoved(address string)
}

type dnsWatcher struct {
	watcher       grpcutil.Watcher
	notifications DNSNotifications
}

// NewDNSWatcher creates a new DNS watcher and returns a service that is wrapping it.
func NewDNSWatcher(address string, dnsLookupPeriod time.Duration, notifications DNSNotifications) (services.Service, error) {
	resolver, err := grpcutil.NewDNSResolverWithFreq(dnsLookupPeriod, util_log.Logger)
	if err != nil {
		return nil, err
	}

	watcher, err := resolver.Resolve(address, "")
	if err != nil {
		return nil, err
	}

	w := &dnsWatcher{
		watcher:       watcher,
		notifications: notifications,
	}
	return services.NewBasicService(nil, w.watchDNSLoop, nil), nil
}

// watchDNSLoop watches for changes in DNS and sends notifications.
func (w *dnsWatcher) watchDNSLoop(servCtx context.Context) error {
	go func() {
		// Close the watcher, when this service is asked to stop.
		// Closing the watcher makes watchDNSLoop exit, since it only iterates on watcher updates, and has no other
		// way to stop. We cannot close the watcher in `stopping` method, because it is only called *after*
		// watchDNSLoop exits.
		<-servCtx.Done()
		w.watcher.Close()
	}()

	for {
		updates, err := w.watcher.Next()
		if err != nil {
			// watcher.Next returns error when Close is called, but we call Close when our context is done.
			// we don't want to report error in that case.
			if servCtx.Err() != nil {
				return nil
			}
			return errors.Wrapf(err, "error from DNS watcher")
		}

		for _, update := range updates {
			switch update.Op {
			case grpcutil.Add:
				w.notifications.AddressAdded(update.Addr)

			case grpcutil.Delete:
				w.notifications.AddressRemoved(update.Addr)

			default:
				return fmt.Errorf("unknown op: %v", update.Op)
			}
		}
	}
}
