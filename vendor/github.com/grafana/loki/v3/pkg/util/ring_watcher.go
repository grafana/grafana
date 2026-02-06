package util

import (
	"context"
	"fmt"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
)

const (
	RingKeyOfLeader = 0
)

type ringWatcher struct {
	log           log.Logger
	ring          ring.ReadRing
	notifications DNSNotifications
	lookupPeriod  time.Duration
	addresses     []string
}

// NewRingWatcher creates a new Ring watcher and returns a service that is wrapping it.
func NewRingWatcher(log log.Logger, ring ring.ReadRing, lookupPeriod time.Duration, notifications DNSNotifications) (services.Service, error) {
	w := &ringWatcher{
		log:           log,
		ring:          ring,
		notifications: notifications,
		lookupPeriod:  lookupPeriod,
	}
	return services.NewBasicService(nil, w.watchLoop, nil), nil
}

// watchLoop watches for changes in DNS and sends notifications.
func (w *ringWatcher) watchLoop(servCtx context.Context) error {

	syncTicker := time.NewTicker(w.lookupPeriod)
	defer syncTicker.Stop()

	for {
		select {
		case <-servCtx.Done():
			return nil
		case <-syncTicker.C:
			w.lookupAddresses()
		}
	}
}

func (w *ringWatcher) lookupAddresses() {
	addrs, err := w.getAddresses()
	if err != nil {
		level.Error(w.log).Log("msg", "error getting addresses from ring", "err", err)
	}

	if len(addrs) == 0 {
		return
	}
	toAdd := make([]string, 0, len(addrs))
	for i, newAddr := range addrs {
		alreadyExists := false
		for _, currAddr := range w.addresses {
			if currAddr == newAddr {
				alreadyExists = true
			}
		}
		if !alreadyExists {
			toAdd = append(toAdd, addrs[i])
		}
	}
	toRemove := make([]string, 0, len(w.addresses))
	for i, existingAddr := range w.addresses {
		stillExists := false
		for _, newAddr := range addrs {
			if newAddr == existingAddr {
				stillExists = true
			}
		}
		if !stillExists {
			toRemove = append(toRemove, w.addresses[i])
		}
	}

	for _, ta := range toAdd {
		level.Debug(w.log).Log("msg", fmt.Sprintf("adding connection to address: %s", ta))
		w.notifications.AddressAdded(ta)
	}

	for _, tr := range toRemove {
		level.Debug(w.log).Log("msg", fmt.Sprintf("removing connection to address: %s", tr))
		w.notifications.AddressRemoved(tr)
	}

	w.addresses = addrs

}

func (w *ringWatcher) getAddresses() ([]string, error) {

	// We use ring.Write combined with the `ring.NewIgnoreUnhealthyInstancesReplicationStrategy`
	// during ring creation to fetch at least 1 and ideally $REPLICATION_FACTOR nodes from the ring.
	// If the ideal nodes for the desired token position are unhealthy, ring.Write ensures
	// we continue to traverse the ring looking for more, until we've acquired $REPLICATION_FACTOR
	// nodes or the ring is exhausted.
	op := ring.Write

	bufDescs, bufHosts, bufZones := ring.MakeBuffersForGet()
	rs, err := w.ring.Get(RingKeyOfLeader, op, bufDescs, bufHosts, bufZones)
	if err != nil {
		return nil, err
	}

	return rs.GetAddresses(), nil
}
