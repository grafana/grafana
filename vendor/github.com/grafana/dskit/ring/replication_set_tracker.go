package ring

import (
	"context"
	"errors"
	"math/rand"
	"sync"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"go.uber.org/atomic"
)

type replicationSetResultTracker interface {
	// Signals an instance has done the execution, either successful (no error)
	// or failed (with error).
	done(instance *InstanceDesc, err error)

	// Returns true if the minimum number of successful results have been received.
	succeeded() bool

	// Returns true if the maximum number of failed executions have been reached.
	failed() bool

	// Returns true if the result returned by instance is part of the minimal set of all results
	// required to meet the quorum requirements of this tracker.
	// This method should only be called for instances that have returned a successful result,
	// calling this method for an instance that returned an error may return unpredictable results.
	// This method should only be called after succeeded returns true for the first time and before
	// calling done any further times.
	shouldIncludeResultFrom(instance *InstanceDesc) bool

	// Starts an initial set of requests sufficient to meet the quorum requirements of this tracker.
	// Further requests will be started if necessary when done is called with a non-nil error.
	// Calling this method multiple times may lead to unpredictable behaviour.
	// Calling both this method and releaseAllRequests may lead to unpredictable behaviour.
	// This method must only be called before calling done.
	startMinimumRequests()

	// Starts additional request(s) as defined by the quorum requirements of this tracker.
	// For example, a zone-aware tracker would start requests for another zone, whereas a
	// non-zone-aware tracker would start a request for another instance.
	// This method must only be called after calling startMinimumRequests or startAllRequests.
	// If requests for all instances have already been started, this method does nothing.
	// This method must only be called before calling done.
	startAdditionalRequests()

	// Starts requests for all instances.
	// Calling this method multiple times may lead to unpredictable behaviour.
	// Calling both this method and releaseMinimumRequests may lead to unpredictable behaviour.
	// This method must only be called before calling done.
	startAllRequests()

	// Blocks until the request for this instance should be started.
	// Returns nil if the request should be started, or a non-nil error if the request is not required
	// or ctx has been cancelled.
	// Must only be called after releaseMinimumRequests or releaseAllRequests returns.
	// Calling this method multiple times for the same instance may lead to unpredictable behaviour.
	awaitStart(ctx context.Context, instance *InstanceDesc) error
}

type replicationSetContextTracker interface {
	// Returns a context.Context and context.CancelFunc for instance.
	// The context.CancelFunc will only cancel the context for this instance (ie. if this tracker
	// is zone-aware, calling the context.CancelFunc should not cancel contexts for other instances
	// in the same zone).
	contextFor(instance *InstanceDesc) (context.Context, context.CancelCauseFunc)

	// Cancels the context for instance previously obtained with contextFor.
	// This method may cancel the context for other instances if those other instances are part of
	// the same zone and this tracker is zone-aware.
	cancelContextFor(instance *InstanceDesc, cause error)

	// Cancels all contexts previously obtained with contextFor.
	cancelAllContexts(cause error)
}

var errResultNotNeeded = errors.New("result from this instance is not needed")

type defaultResultTracker struct {
	minSucceeded     int
	numSucceeded     int
	numErrors        int
	maxErrors        int
	instances        []InstanceDesc
	instanceRelease  map[*InstanceDesc]chan struct{}
	pendingInstances []*InstanceDesc
	logger           log.Logger
}

func newDefaultResultTracker(instances []InstanceDesc, maxErrors int, logger log.Logger) *defaultResultTracker {
	return &defaultResultTracker{
		minSucceeded: len(instances) - maxErrors,
		numSucceeded: 0,
		numErrors:    0,
		maxErrors:    maxErrors,
		instances:    instances,
		logger:       logger,
	}
}

func (t *defaultResultTracker) done(instance *InstanceDesc, err error) {
	if err == nil {
		t.numSucceeded++

		if t.succeeded() {
			t.onSucceeded()
		}
	} else {
		level.Warn(t.logger).Log(
			"msg", "instance failed",
			"instanceAddr", instance.Addr,
			"instanceID", instance.Id,
			"err", err,
		)

		t.numErrors++
		t.startAdditionalRequestsDueTo("failure of other instance")
	}
}

func (t *defaultResultTracker) succeeded() bool {
	return t.numSucceeded >= t.minSucceeded
}

func (t *defaultResultTracker) onSucceeded() {
	// We don't need any of the requests that are waiting to be released. Signal that they should abort.
	for _, i := range t.pendingInstances {
		close(t.instanceRelease[i])
	}

	t.pendingInstances = nil
}

func (t *defaultResultTracker) failed() bool {
	return t.numErrors > t.maxErrors
}

func (t *defaultResultTracker) shouldIncludeResultFrom(_ *InstanceDesc) bool {
	return true
}

func (t *defaultResultTracker) startMinimumRequests() {
	t.instanceRelease = make(map[*InstanceDesc]chan struct{}, len(t.instances))

	for i := range t.instances {
		instance := &t.instances[i]
		t.instanceRelease[instance] = make(chan struct{}, 1)
	}

	releaseOrder := rand.Perm(len(t.instances))
	t.pendingInstances = make([]*InstanceDesc, 0, t.maxErrors)

	for _, instanceIdx := range releaseOrder {
		instance := &t.instances[instanceIdx]

		if len(t.pendingInstances) < t.maxErrors {
			t.pendingInstances = append(t.pendingInstances, instance)
		} else {
			level.Debug(t.logger).Log("msg", "starting request to instance", "reason", "initial requests", "instanceAddr", instance.Addr, "instanceID", instance.Id)
			t.instanceRelease[instance] <- struct{}{}
		}
	}

	// If we've already succeeded (which should only happen if the replica set is misconfigured with MaxErrors >= the number of instances),
	// then make sure we don't block requests forever.
	if t.succeeded() {
		t.onSucceeded()
	}
}

func (t *defaultResultTracker) startAdditionalRequests() {
	t.startAdditionalRequestsDueTo("hedging")
}

func (t *defaultResultTracker) startAdditionalRequestsDueTo(reason string) {
	if len(t.pendingInstances) > 0 {
		// There are some outstanding requests we could make before we reach maxErrors. Release the next one.
		i := t.pendingInstances[0]
		level.Debug(t.logger).Log("msg", "starting request to instance", "reason", reason, "instanceAddr", i.Addr, "instanceID", i.Id)
		t.instanceRelease[i] <- struct{}{}
		t.pendingInstances = t.pendingInstances[1:]
	}
}

func (t *defaultResultTracker) startAllRequests() {
	t.instanceRelease = make(map[*InstanceDesc]chan struct{}, len(t.instances))

	for i := range t.instances {
		instance := &t.instances[i]
		level.Debug(t.logger).Log("msg", "starting request to instance", "reason", "initial requests", "instanceAddr", instance.Addr, "instanceID", instance.Id)
		t.instanceRelease[instance] = make(chan struct{}, 1)
		t.instanceRelease[instance] <- struct{}{}
	}
}

func (t *defaultResultTracker) awaitStart(ctx context.Context, instance *InstanceDesc) error {
	select {
	case <-ctx.Done():
		return context.Cause(ctx)
	case _, ok := <-t.instanceRelease[instance]:
		if ok {
			return nil
		}

		return errResultNotNeeded
	}
}

type defaultContextTracker struct {
	ctx         context.Context
	cancelFuncs map[*InstanceDesc]context.CancelCauseFunc
}

func newDefaultContextTracker(ctx context.Context, instances []InstanceDesc) *defaultContextTracker {
	return &defaultContextTracker{
		ctx:         ctx,
		cancelFuncs: make(map[*InstanceDesc]context.CancelCauseFunc, len(instances)),
	}
}

func (t *defaultContextTracker) contextFor(instance *InstanceDesc) (context.Context, context.CancelCauseFunc) {
	ctx, cancel := context.WithCancelCause(t.ctx)
	t.cancelFuncs[instance] = cancel
	return ctx, cancel
}

func (t *defaultContextTracker) cancelContextFor(instance *InstanceDesc, cause error) {
	if cancel, ok := t.cancelFuncs[instance]; ok {
		cancel(cause)
		delete(t.cancelFuncs, instance)
	}
}

func (t *defaultContextTracker) cancelAllContexts(cause error) {
	for instance, cancel := range t.cancelFuncs {
		cancel(cause)
		delete(t.cancelFuncs, instance)
	}
}

// zoneAwareResultTracker tracks the results per zone.
// All instances in a zone must succeed in order for the zone to succeed.
type zoneAwareResultTracker struct {
	waitingByZone       map[string]int
	failuresByZone      map[string]int
	minSuccessfulZones  int
	maxUnavailableZones int
	zoneRelease         map[string]chan struct{}
	zoneShouldStart     map[string]*atomic.Bool
	pendingZones        []string
	zoneSorter          ZoneSorter
	logger              log.Logger
}

type ZoneSorter func(zones []string) []string

func newZoneAwareResultTracker(instances []InstanceDesc, maxUnavailableZones int, zoneSorter ZoneSorter, logger log.Logger) *zoneAwareResultTracker {
	t := &zoneAwareResultTracker{
		waitingByZone:       make(map[string]int),
		failuresByZone:      make(map[string]int),
		maxUnavailableZones: maxUnavailableZones,
		zoneSorter:          zoneSorter,
		logger:              logger,
	}

	for _, instance := range instances {
		t.waitingByZone[instance.Zone]++
	}

	t.minSuccessfulZones = len(t.waitingByZone) - maxUnavailableZones

	if t.minSuccessfulZones < 0 {
		t.minSuccessfulZones = 0
	}

	if t.zoneSorter == nil {
		t.zoneSorter = defaultZoneSorter
	}

	return t
}

func defaultZoneSorter(zones []string) []string {
	rand.Shuffle(len(zones), func(i, j int) {
		zones[i], zones[j] = zones[j], zones[i]
	})

	return zones
}

func (t *zoneAwareResultTracker) done(instance *InstanceDesc, err error) {
	t.waitingByZone[instance.Zone]--

	if err == nil {
		if t.succeeded() {
			t.onSucceeded()
		}
	} else {
		t.failuresByZone[instance.Zone]++

		if t.failuresByZone[instance.Zone] == 1 {
			level.Warn(t.logger).Log(
				"msg", "request to instance has failed, zone cannot contribute to quorum",
				"zone", instance.Zone,
				"failingInstanceAddr", instance.Addr,
				"failingInstanceID", instance.Id,
				"err", err,
			)

			// If this was the first failure for this zone, release another zone's requests and signal they should start.
			t.startAdditionalRequestsDueTo("failure of other zone")
		}
	}
}

func (t *zoneAwareResultTracker) succeeded() bool {
	successfulZones := 0

	// The execution succeeded once we successfully received a successful result
	// from "all zones - max unavailable zones".
	for zone, numWaiting := range t.waitingByZone {
		if numWaiting == 0 && t.failuresByZone[zone] == 0 {
			successfulZones++
		}
	}

	return successfulZones >= t.minSuccessfulZones
}

func (t *zoneAwareResultTracker) onSucceeded() {
	// We don't need any of the requests that are waiting to be released. Signal that they should abort.
	for _, zone := range t.pendingZones {
		t.releaseZone(zone, false)
	}

	t.pendingZones = nil
}

func (t *zoneAwareResultTracker) failed() bool {
	failedZones := len(t.failuresByZone)
	return failedZones > t.maxUnavailableZones
}

func (t *zoneAwareResultTracker) shouldIncludeResultFrom(instance *InstanceDesc) bool {
	return t.failuresByZone[instance.Zone] == 0 && t.waitingByZone[instance.Zone] == 0
}

func (t *zoneAwareResultTracker) startMinimumRequests() {
	t.createReleaseChannels()

	allZones := make([]string, 0, len(t.waitingByZone))

	for zone := range t.waitingByZone {
		allZones = append(allZones, zone)
	}

	allZones = t.zoneSorter(allZones)

	for i := 0; i < t.minSuccessfulZones; i++ {
		level.Debug(t.logger).Log("msg", "starting requests to zone", "reason", "initial requests", "zone", allZones[i])
		t.releaseZone(allZones[i], true)
	}

	t.pendingZones = allZones[t.minSuccessfulZones:]

	// If we've already succeeded (which should only happen if the replica set is misconfigured with MaxUnavailableZones >= the number of zones),
	// then make sure we don't block requests forever.
	if t.succeeded() {
		t.onSucceeded()
	}
}

func (t *zoneAwareResultTracker) startAdditionalRequests() {
	t.startAdditionalRequestsDueTo("hedging")
}

func (t *zoneAwareResultTracker) startAdditionalRequestsDueTo(reason string) {
	if len(t.pendingZones) > 0 {
		// If there are more zones we could try before reaching maxUnavailableZones, release another zone's requests and signal they should start.
		level.Debug(t.logger).Log("msg", "starting requests to zone", "reason", reason, "zone", t.pendingZones[0])
		t.releaseZone(t.pendingZones[0], true)
		t.pendingZones = t.pendingZones[1:]
	}
}

func (t *zoneAwareResultTracker) startAllRequests() {
	t.createReleaseChannels()

	for zone := range t.waitingByZone {
		level.Debug(t.logger).Log("msg", "starting requests to zone", "reason", "initial requests", "zone", zone)
		t.releaseZone(zone, true)
	}
}

func (t *zoneAwareResultTracker) createReleaseChannels() {
	t.zoneRelease = make(map[string]chan struct{}, len(t.waitingByZone))
	t.zoneShouldStart = make(map[string]*atomic.Bool, len(t.waitingByZone))

	for zone := range t.waitingByZone {
		t.zoneRelease[zone] = make(chan struct{})
		t.zoneShouldStart[zone] = atomic.NewBool(false)
	}
}

func (t *zoneAwareResultTracker) releaseZone(zone string, shouldStart bool) {
	t.zoneShouldStart[zone].Store(shouldStart)
	close(t.zoneRelease[zone])
}

func (t *zoneAwareResultTracker) awaitStart(ctx context.Context, instance *InstanceDesc) error {
	select {
	case <-ctx.Done():
		return context.Cause(ctx)
	case <-t.zoneRelease[instance.Zone]:
		if t.zoneShouldStart[instance.Zone].Load() {
			return nil
		}

		return errResultNotNeeded
	}
}

type zoneAwareContextTracker struct {
	contexts    map[*InstanceDesc]context.Context
	cancelFuncs map[*InstanceDesc]context.CancelCauseFunc
}

func newZoneAwareContextTracker(ctx context.Context, instances []InstanceDesc) *zoneAwareContextTracker {
	t := &zoneAwareContextTracker{
		contexts:    make(map[*InstanceDesc]context.Context, len(instances)),
		cancelFuncs: make(map[*InstanceDesc]context.CancelCauseFunc, len(instances)),
	}

	for i := range instances {
		instance := &instances[i]
		ctx, cancel := context.WithCancelCause(ctx)
		t.contexts[instance] = ctx
		t.cancelFuncs[instance] = cancel
	}

	return t
}

func (t *zoneAwareContextTracker) contextFor(instance *InstanceDesc) (context.Context, context.CancelCauseFunc) {
	return t.contexts[instance], t.cancelFuncs[instance]
}

func (t *zoneAwareContextTracker) cancelContextFor(instance *InstanceDesc, cause error) {
	// Why not create a per-zone parent context to make this easier?
	// If we create a per-zone parent context, we'd need to have some way to cancel the per-zone context when the last of the individual
	// contexts in a zone are cancelled using the context.CancelFunc returned from contextFor.
	for i, cancel := range t.cancelFuncs {
		if i.Zone == instance.Zone {
			cancel(cause)
			delete(t.contexts, i)
			delete(t.cancelFuncs, i)
		}
	}
}

func (t *zoneAwareContextTracker) cancelAllContexts(cause error) {
	for instance, cancel := range t.cancelFuncs {
		cancel(cause)
		delete(t.contexts, instance)
		delete(t.cancelFuncs, instance)
	}
}

type inflightInstanceTracker struct {
	mx       sync.Mutex
	inflight [][]*InstanceDesc

	// expectMoreInstances is true if more instances are expected to be added to the tracker.
	expectMoreInstances bool
}

func newInflightInstanceTracker(sets []ReplicationSet) *inflightInstanceTracker {
	// Init the inflight tracker.
	inflight := make([][]*InstanceDesc, len(sets))
	for idx, set := range sets {
		inflight[idx] = make([]*InstanceDesc, 0, len(set.Instances))
	}

	return &inflightInstanceTracker{
		inflight:            inflight,
		expectMoreInstances: true,
	}
}

// addInstance adds the instance for replicationSetIdx to the tracker.
//
// addInstance is idempotent.
func (t *inflightInstanceTracker) addInstance(replicationSetIdx int, instance *InstanceDesc) {
	t.mx.Lock()
	defer t.mx.Unlock()

	// Check if the instance has already been added.
	for _, curr := range t.inflight[replicationSetIdx] {
		if curr == instance {
			return
		}
	}

	t.inflight[replicationSetIdx] = append(t.inflight[replicationSetIdx], instance)
}

// removeInstance removes the instance for replicationSetIdx from the tracker.
//
// removeInstance is idempotent.
func (t *inflightInstanceTracker) removeInstance(replicationSetIdx int, instance *InstanceDesc) {
	t.mx.Lock()
	defer t.mx.Unlock()

	for i, curr := range t.inflight[replicationSetIdx] {
		if curr == instance {
			instances := t.inflight[replicationSetIdx]
			t.inflight[replicationSetIdx] = append(instances[:i], instances[i+1:]...)

			// We can safely break the loop because we don't expect multiple occurrences of the same instance.
			return
		}
	}
}

// allInstancesAdded signals the tracker that all expected instances have been added.
//
// allInstancesAdded is idempotent.
func (t *inflightInstanceTracker) allInstancesAdded() {
	t.mx.Lock()
	defer t.mx.Unlock()

	t.expectMoreInstances = false
}

// allInstancesCompleted returns true if and only if no more instances are expected to be
// added to the tracker and all previously tracked instances have been removed calling removeInstance().
func (t *inflightInstanceTracker) allInstancesCompleted() bool {
	t.mx.Lock()
	defer t.mx.Unlock()

	// We can't assert all instances have completed if it's still possible
	// to add new ones to the tracker.
	if t.expectMoreInstances {
		return false
	}

	// Ensure there are no inflight instances for any replication set.
	for _, instances := range t.inflight {
		if len(instances) > 0 {
			return false
		}
	}

	return true
}
