// Provenance-includes-location: https://github.com/cortexproject/cortex/blob/master/pkg/ring/batch.go

package ring

import (
	"context"
	"fmt"
	"sync"

	"go.uber.org/atomic"

	grpcUtils "github.com/grafana/dskit/grpcutil"
)

type batchTracker struct {
	rpcsPending atomic.Int32
	rpcsFailed  atomic.Int32
	done        chan struct{}
	err         chan error
}

type instance struct {
	desc         InstanceDesc
	itemTrackers []*itemTracker
	indexes      []int
}

type itemTracker struct {
	minSuccess   int
	maxFailures  int
	succeeded    atomic.Int32
	failedClient atomic.Int32
	failedServer atomic.Int32
	remaining    atomic.Int32
	err          atomic.Error
}

func (i *itemTracker) recordError(err error, isClientError func(error) bool) int32 {
	i.err.Store(err)

	if isClientError(err) {
		return i.failedClient.Inc()
	}
	return i.failedServer.Inc()
}

func isHTTPStatus4xx(err error) bool {
	code := grpcUtils.ErrorToStatusCode(err)
	return code/100 == 4
}

// DoBatchRing defines the interface required by a ring implementation to use DoBatch() and DoBatchWithOptions().
type DoBatchRing interface {
	// Get returns a ReplicationSet containing the instances to which the input key should be sharded to
	// for the input Operation.
	//
	// The input buffers may be referenced in the returned ReplicationSet. This means that it's unsafe to call
	// Get() multiple times passing the same buffers if ReplicationSet is retained between two different Get()
	// calls. In this cas, you can pass nil buffers.
	Get(key uint32, op Operation, bufInstances []InstanceDesc, bufStrings1, bufStrings2 []string) (ReplicationSet, error)

	// ReplicationFactor returns the number of instances each key is expected to be sharded to.
	ReplicationFactor() int

	// InstancesCount returns the number of instances in the ring eligible to get any key sharded to.
	InstancesCount() int
}

// DoBatch is a deprecated version of DoBatchWithOptions where grpc errors containing status codes 4xx are treated as client errors.
// Deprecated. Use DoBatchWithOptions instead.
func DoBatch(ctx context.Context, op Operation, r DoBatchRing, keys []uint32, callback func(InstanceDesc, []int) error, cleanup func()) error {
	return DoBatchWithOptions(ctx, op, r, keys, callback, DoBatchOptions{
		Cleanup:       cleanup,
		IsClientError: isHTTPStatus4xx,
	})
}

// DoBatchOptions defines options for the DoBatchWithOptions call.
// Zero value options are valid, as well as individual zero valued fields.
type DoBatchOptions struct {
	// Cleanup is always called, either on an error before starting the batches or after they are all finished.
	// If nil, a noop will be called.
	Cleanup func()

	// IsClientError classifies errors returned by `callback()` into client or server errors.
	// See `batchTracker.record()` function for details about how errors are combined into final error returned by DoBatchWithClientError.
	// If nil, a default implementation is used that classifies grpc errors containing status codes 4xx as client errors.
	IsClientError func(error) bool

	// Go will be used to spawn the callback goroutines, and can be used to use a worker pool like concurrency.ReusableGoroutinesPool.
	Go func(func())
}

func (o *DoBatchOptions) replaceZeroValuesWithDefaults() {
	if o.Cleanup == nil {
		o.Cleanup = func() {}
	}
	if o.IsClientError == nil {
		o.IsClientError = isHTTPStatus4xx
	}
	if o.Go == nil {
		o.Go = func(f func()) { go f() }
	}
}

// DoBatchWithOptions request against a set of keys in the ring, handling replication and failures.
// For example if we want to write N items where they may all hit different instances,
// and we want them all replicated R ways with quorum writes,
// we track the relationship between batch RPCs and the items within them.
//
// See comments on DoBatchOptions for available options for this call.
//
// Not implemented as a method on Ring, so we can test separately.
func DoBatchWithOptions(ctx context.Context, op Operation, r DoBatchRing, keys []uint32, callback func(InstanceDesc, []int) error, o DoBatchOptions) error {
	o.replaceZeroValuesWithDefaults()

	if r.InstancesCount() <= 0 {
		o.Cleanup()
		return fmt.Errorf("DoBatch: InstancesCount <= 0")
	}
	expectedTrackersPerInstance := len(keys) * (r.ReplicationFactor() + 1) / r.InstancesCount()
	itemTrackers := make([]itemTracker, len(keys))
	instances := make(map[string]instance, r.InstancesCount())

	var (
		bufDescs [GetBufferSize]InstanceDesc
		bufHosts [GetBufferSize]string
		bufZones [GetBufferSize]string
	)
	for i, key := range keys {
		// Get call below takes ~1 microsecond for ~500 instances.
		// Checking every 10K calls would be every 10ms.
		if i%10e3 == 0 {
			if err := context.Cause(ctx); err != nil {
				o.Cleanup()
				return err
			}
		}

		replicationSet, err := r.Get(key, op, bufDescs[:0], bufHosts[:0], bufZones[:0])
		if err != nil {
			o.Cleanup()
			return err
		}
		itemTrackers[i].minSuccess = len(replicationSet.Instances) - replicationSet.MaxErrors
		itemTrackers[i].maxFailures = replicationSet.MaxErrors
		itemTrackers[i].remaining.Store(int32(len(replicationSet.Instances)))

		for _, desc := range replicationSet.Instances {
			curr, found := instances[desc.Addr]
			if !found {
				curr.itemTrackers = make([]*itemTracker, 0, expectedTrackersPerInstance)
				curr.indexes = make([]int, 0, expectedTrackersPerInstance)
			}
			instances[desc.Addr] = instance{
				desc:         desc,
				itemTrackers: append(curr.itemTrackers, &itemTrackers[i]),
				indexes:      append(curr.indexes, i),
			}
		}
	}

	// One last check before calling the callbacks: it doesn't make sense if context is canceled.
	if err := context.Cause(ctx); err != nil {
		o.Cleanup()
		return err
	}

	tracker := batchTracker{
		done: make(chan struct{}, 1),
		err:  make(chan error, 1),
	}
	tracker.rpcsPending.Store(int32(len(itemTrackers)))

	var wg sync.WaitGroup

	wg.Add(len(instances))
	for _, i := range instances {
		i := i
		o.Go(func() {
			err := callback(i.desc, i.indexes)
			tracker.record(i.itemTrackers, err, o.IsClientError)
			wg.Done()
		})
	}

	// Perform cleanup at the end.
	o.Go(func() {
		wg.Wait()
		o.Cleanup()
	})

	select {
	case err := <-tracker.err:
		return err
	case <-tracker.done:
		return nil
	case <-ctx.Done():
		return context.Cause(ctx)
	}
}

func (b *batchTracker) record(itemTrackers []*itemTracker, err error, isClientError func(error) bool) {
	// If we reach the required number of successful puts on this item, then decrement the
	// number of pending items by one.
	//
	// The use of atomic increments here is needed as:
	// * rpcsPending and rpcsFailed guarantee only a single goroutine will write to either channel
	// * succeeded, failedClient, failedServer and remaining guarantee that the "return decision" is made atomically
	// avoiding race condition
	for _, it := range itemTrackers {
		if err != nil {
			// Track the number of errors by error family, and if it exceeds maxFailures
			// shortcut the waiting rpc.
			errCount := it.recordError(err, isClientError)
			// We should return an error if we reach the maxFailure (quorum) on a given error family OR
			// we don't have any remaining instances to try. In the following we use ClientError and ServerError
			// to denote errors, for which isClientError() returns true and false respectively.
			//
			// Ex: Success, ClientError, ServerError -> return ServerError
			// Ex: ClientError, ClientError, Success -> return ClientError
			// Ex: ServerError, Success, ServerError -> return ServerError
			//
			// The reason for searching for quorum in ClientError and ServerError errors separately is to give a more accurate
			// response to the initial request. So if a quorum of instances rejects the request with ClientError, then the request should be rejected
			// even if less-than-quorum instances indicated a failure to process the request (via ServerError).
			// The speculation is that had the unavailable instances been available,
			// they would have rejected the request with a ClientError as well.
			// Conversely, if a quorum of instances failed to process the request via ServerError and less-than-quorum
			// instances rejected it with ClientError, then we do not have quorum to reject the request as a ClientError. Instead,
			// we return the last ServerError error for debuggability.
			if errCount > int32(it.maxFailures) || it.remaining.Dec() == 0 {
				if b.rpcsFailed.Inc() == 1 {
					b.err <- err
				}
			}
		} else {
			// If we successfully process items in minSuccess instances,
			// then wake up the waiting rpc, so it can return early.
			succeeded := it.succeeded.Inc()
			if succeeded == int32(it.minSuccess) {
				if b.rpcsPending.Dec() == 0 {
					b.done <- struct{}{}
				}
				continue
			}

			// If we successfully called this particular instance, but we don't have any remaining instances to try,
			// and we failed to call minSuccess instances, then we need to return the last error.
			if succeeded < int32(it.minSuccess) {
				if it.remaining.Dec() == 0 {
					if b.rpcsFailed.Inc() == 1 {
						b.err <- it.err.Load()
					}
				}
			}
		}
	}
}
