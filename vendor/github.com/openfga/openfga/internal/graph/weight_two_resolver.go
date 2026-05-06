package graph

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/emirpasic/gods/sets/hashset"
	"github.com/sourcegraph/conc/panics"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/checkutil"
	"github.com/openfga/openfga/internal/concurrency"
	"github.com/openfga/openfga/internal/iterator"
	"github.com/openfga/openfga/internal/planner"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

const IteratorMinBatchThreshold = 100
const BaseIndex = 0
const DifferenceIndex = 1
const weightTwoResolver = "weight2"

// This strategy is configured to show that it has proven fast and consistent.
var weight2Plan = &planner.PlanConfig{
	Name:         weightTwoResolver,
	InitialGuess: 20 * time.Millisecond,
	// High Lambda: Represents strong confidence in the initial guess. It's like
	// starting with the belief of having already seen 10 good runs.
	Lambda: 10.0,
	// High Alpha, Low Beta: Creates a very NARROW belief about variance.
	// This tells the planner: "I am very confident that the performance is
	// consistently close to 10ms". A single slow run will be a huge surprise
	// and will dramatically shift this belief.

	// High expected precision: 𝐸[𝜏]= 𝛼/𝛽 = 20/2 = 10
	// Low expected variance: E[σ2]= β/(α−1) =2/9 = 0.105, narrow jitter
	// A slow sample will look like an outlier and move the posterior noticeably but overall this prior exploits.
	Alpha: 20,
	Beta:  2,
}

var ErrShortCircuit = errors.New("short circuit")

type fastPathSetHandler func(context.Context, *iterator.Streams, chan<- *iterator.Msg)

func (c *LocalChecker) weight2Userset(_ context.Context, req *ResolveCheckRequest, usersets []*openfgav1.RelationReference, iter storage.TupleKeyIterator, _ string) CheckHandlerFunc {
	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		cancellableCtx, cancel := context.WithCancel(ctx)
		defer cancel()

		leftChans, err := produceLeftChannels(cancellableCtx, req, usersets, checkutil.BuildUsersetV2RelationFunc())
		if err != nil {
			return nil, err
		}

		if len(leftChans) == 0 {
			return &ResolveCheckResponse{
				Allowed: false,
			}, nil
		}

		return c.weight2(ctx, leftChans, storage.WrapIterator(storage.UsersetKind, iter))
	}
}

func (c *LocalChecker) weight2TTU(ctx context.Context, req *ResolveCheckRequest, rewrite *openfgav1.Userset, iter storage.TupleKeyIterator, _ string) CheckHandlerFunc {
	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		typesys, _ := typesystem.TypesystemFromContext(ctx)
		objectType := tuple.GetType(req.GetTupleKey().GetObject())
		tuplesetRelation := rewrite.GetTupleToUserset().GetTupleset().GetRelation()
		computedRelation := rewrite.GetTupleToUserset().GetComputedUserset().GetRelation()

		possibleParents, err := typesys.GetDirectlyRelatedUserTypes(objectType, tuplesetRelation)
		if err != nil {
			return nil, err
		}

		cancellableCtx, cancel := context.WithCancel(ctx)
		defer cancel()

		leftChans, err := produceLeftChannels(cancellableCtx, req, possibleParents, checkutil.BuildTTUV2RelationFunc(computedRelation))
		if err != nil {
			return nil, err
		}

		if len(leftChans) == 0 {
			return &ResolveCheckResponse{
				Allowed: false,
			}, nil
		}

		return c.weight2(ctx, leftChans, storage.WrapIterator(storage.TTUKind, iter))
	}
}

// weight2 attempts to find the intersection across 2 producers (channels) of ObjectIDs.
// In the case of a TTU:
// Right channel is the result set of the Read of ObjectID/Relation that yields the User's ObjectID.
// Left channel is the result set of ReadStartingWithUser of User/Relation that yields Object's ObjectID.
// From the perspective of the model, the left hand side of a TTU is the computed relationship being expanded.
func (c *LocalChecker) weight2(ctx context.Context, leftChans []<-chan *iterator.Msg, iter storage.TupleMapper) (*ResolveCheckResponse, error) {
	ctx, span := tracer.Start(ctx, "weight2")
	defer span.End()
	cancellableCtx, cancel := context.WithCancel(ctx)
	leftChan := iterator.FanInIteratorChannels(cancellableCtx, leftChans)
	rightChan := streamedLookupUsersetFromIterator(cancellableCtx, iter)
	rightOpen := true
	leftOpen := true

	defer func() {
		cancel()
		iter.Stop()
		if !leftOpen {
			return
		}
		iterator.Drain(leftChan)
	}()

	res := &ResolveCheckResponse{
		Allowed: false,
	}

	rightSet := hashset.New()
	leftSet := hashset.New()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case r, ok := <-rightChan:
		if !ok {
			return res, ctx.Err()
		}
		if r.err != nil {
			return nil, r.err
		}
		rightSet.Add(r.userset)
	}

	var lastErr error

ConsumerLoop:
	for leftOpen || rightOpen {
		select {
		case <-ctx.Done():
			lastErr = ctx.Err()
			break ConsumerLoop
		case msg, ok := <-leftChan:
			if !ok {
				leftOpen = false
				if leftSet.Size() == 0 {
					if ctx.Err() != nil {
						lastErr = ctx.Err()
					}
					break ConsumerLoop
				}
				break
			}
			if msg.Err != nil {
				lastErr = msg.Err
				break ConsumerLoop
			}
			for {
				t, err := msg.Iter.Next(ctx)
				if err != nil {
					msg.Iter.Stop()
					if storage.IterIsDoneOrCancelled(err) {
						break
					}
					lastErr = err
					continue
				}
				if processUsersetMessage(t, leftSet, rightSet) {
					msg.Iter.Stop()
					res.Allowed = true
					lastErr = nil
					break ConsumerLoop
				}
			}
		case msg, ok := <-rightChan:
			if !ok {
				rightOpen = false
				break
			}
			if msg.err != nil {
				lastErr = msg.err
				continue
			}
			if processUsersetMessage(msg.userset, rightSet, leftSet) {
				res.Allowed = true
				lastErr = nil
				break ConsumerLoop
			}
		}
	}
	return res, lastErr
}

func produceLeftChannels(
	ctx context.Context,
	req *ResolveCheckRequest,
	relationReferences []*openfgav1.RelationReference,
	relationFunc checkutil.V2RelationFunc,
) ([]<-chan *iterator.Msg, error) {
	typesys, _ := typesystem.TypesystemFromContext(ctx)
	leftChans := make([]<-chan *iterator.Msg, 0, len(relationReferences))
	for _, parentType := range relationReferences {
		relation := relationFunc(parentType)
		rel, err := typesys.GetRelation(parentType.GetType(), relation)
		if err != nil {
			continue
		}
		r := req.clone()
		r.TupleKey = &openfgav1.TupleKey{
			Object: tuple.BuildObject(parentType.GetType(), "ignore"),
			// depending on relationFunc, it will return the parentType's relation (userset) or computedRelation (TTU)
			Relation: relation,
			User:     r.GetTupleKey().GetUser(),
		}
		leftChan, err := fastPathRewrite(ctx, r, rel.GetRewrite())
		if err != nil {
			// if the resolver already started it needs to be drained
			if len(leftChans) > 0 {
				iterator.Drain(iterator.FanInIteratorChannels(ctx, leftChans))
			}
			return nil, err
		}
		leftChans = append(leftChans, leftChan)
	}
	return leftChans, nil
}

func fastPathNoop(_ context.Context, _ *ResolveCheckRequest) (chan *iterator.Msg, error) {
	iterChan := make(chan *iterator.Msg)
	close(iterChan)
	return iterChan, nil
}

// fastPathDirect assumes that req.Object + req.Relation is a directly assignable relation, e.g. define viewer: [user, user:*].
// It returns a channel with one element, and then closes the channel.
// The element is an iterator over all objects that are directly related to the user or the wildcard (if applicable).
func fastPathDirect(ctx context.Context, req *ResolveCheckRequest) (chan *iterator.Msg, error) {
	typesys, _ := typesystem.TypesystemFromContext(ctx)
	ds, _ := storage.RelationshipTupleReaderFromContext(ctx)
	tk := req.GetTupleKey()
	objRel := tuple.ToObjectRelationString(tuple.GetType(tk.GetObject()), tk.GetRelation())
	i, err := checkutil.IteratorReadStartingFromUser(ctx, typesys, ds, req, objRel, nil, true)
	if err != nil {
		return nil, err
	}
	iterChan := make(chan *iterator.Msg, 1)
	iter := storage.WrapIterator(storage.ObjectIDKind, i)
	if !concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Iter: iter}, iterChan) {
		iter.Stop() // will not be received to be cleaned up
	}
	close(iterChan)
	return iterChan, nil
}

func fastPathComputed(ctx context.Context, req *ResolveCheckRequest, rewrite *openfgav1.Userset) (chan *iterator.Msg, error) {
	typesys, _ := typesystem.TypesystemFromContext(ctx)
	computedRelation := rewrite.GetComputedUserset().GetRelation()

	childRequest := req.clone()
	childRequest.TupleKey.Relation = computedRelation

	objectType := tuple.GetType(childRequest.GetTupleKey().GetObject())
	rel, err := typesys.GetRelation(objectType, computedRelation)
	if err != nil {
		return nil, err
	}

	return fastPathRewrite(ctx, childRequest, rel.GetRewrite())
}

// add the nextItemInSliceStreams to specified batch. If batch is full, try to send batch to outChan and clear slice.
// If nextItemInSliceStreams has error, will also send message to specified outChan.
func addNextItemInSliceStreamsToBatch(ctx context.Context, streamSlices []*iterator.Stream, streamsToProcess []int, batch []string, outChan chan<- *iterator.Msg) ([]string, error) {
	item, err := iterator.NextItemInSliceStreams(ctx, streamSlices, streamsToProcess)
	if err != nil {
		concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
		return nil, err
	}
	if item != "" {
		batch = append(batch, item)
	}
	if len(batch) > IteratorMinBatchThreshold {
		concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Iter: storage.NewStaticIterator[string](batch)}, outChan)
		batch = make([]string, 0)
	}
	return batch, nil
}

func fastPathUnion(ctx context.Context, streams *iterator.Streams, outChan chan<- *iterator.Msg) {
	batch := make([]string, 0)

	defer func() {
		// flush
		if len(batch) > 0 {
			concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Iter: storage.NewStaticIterator[string](batch)}, outChan)
		}
		close(outChan)
		streams.Stop()
	}()

	/*
		collect iterators from all channels, until all drained
		start performing union algorithm across the heads, if an iterator is empty, poll once again the source
		ask to see if the channel has a new iterator, otherwise consider it done
	*/

	for streams.GetActiveStreamsCount() > 0 {
		if ctx.Err() != nil {
			return
		}
		iterStreams, err := streams.CleanDone(ctx)
		if err != nil {
			concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
			return
		}
		allIters := true
		minObject := ""
		itersWithEqualObject := make([]int, 0)
		for idx, stream := range iterStreams {
			v, err := stream.Head(ctx)
			if err != nil {
				if storage.IterIsDoneOrCancelled(err) {
					allIters = false
					// we need to ensure we have all iterators at all times
					break
				}
				concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
				return
			}
			// initialize
			if idx == 0 {
				minObject = v
			}

			if minObject == v {
				itersWithEqualObject = append(itersWithEqualObject, idx)
			} else if minObject > v {
				minObject = v
				itersWithEqualObject = []int{idx}
			}
		}

		if !allIters {
			// we need to ensure we have all iterators at all times
			continue
		}

		// all iterators with the same value move forward
		batch, err = addNextItemInSliceStreamsToBatch(ctx, iterStreams, itersWithEqualObject, batch, outChan)
		if err != nil {
			// We are relying on the fact that we have called .Head(ctx) earlier
			// and no one else should have called the iterator (especially since it is
			// protected by mutex). Therefore, it is impossible for the iterator to return
			// Done here. Hence, any error received here should be considered as legitimate
			// errors.
			return
		}
	}
}

func fastPathIntersection(ctx context.Context, streams *iterator.Streams, outChan chan<- *iterator.Msg) {
	batch := make([]string, 0)

	defer func() {
		// flush
		if len(batch) > 0 {
			concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Iter: storage.NewStaticIterator[string](batch)}, outChan)
		}
		close(outChan)
		streams.Stop()
	}()
	/*
		collect iterators from all channels, once none are nil
		start performing intersection algorithm across the heads, if an iterator is drained
		ask to see if the channel has a new iterator, otherwise consider it done
		exit if one of the channels closes as there is no more possible intersection of all
	*/

	childrenTotal := streams.GetActiveStreamsCount()
	for streams.GetActiveStreamsCount() == childrenTotal {
		if ctx.Err() != nil {
			return
		}
		iterStreams, err := streams.CleanDone(ctx)
		if err != nil {
			concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
			return
		}
		if len(iterStreams) != childrenTotal {
			// short circuit
			return
		}

		maxObject := ""
		itersWithEqualObject := make([]int, 0)
		allIters := true
		for idx, stream := range iterStreams {
			v, err := stream.Head(ctx)
			if err != nil {
				if storage.IterIsDoneOrCancelled(err) {
					allIters = false
					// we need to ensure we have all iterators at all times
					break
				}
				concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
				return
			}

			if idx == 0 {
				maxObject = v
			}

			if maxObject == v {
				itersWithEqualObject = append(itersWithEqualObject, idx)
			} else if maxObject < v {
				maxObject = v
				itersWithEqualObject = []int{idx}
			}
		}
		if !allIters {
			// we need to ensure we have all iterators at all times
			continue
		}

		// all children have the same value
		if len(itersWithEqualObject) == childrenTotal {
			// all iterators have the same value thus flush entry and move iterators
			batch, err = addNextItemInSliceStreamsToBatch(ctx, iterStreams, itersWithEqualObject, batch, outChan)
			if err != nil {
				// We are relying on the fact that we have called .Head(ctx) earlier
				// and no one else should have called the iterator (especially since it is
				// protected by mutex). Therefore, it is impossible for the iterator to return
				// Done here. Hence, any error received here should be considered as legitimate
				// errors.
				return
			}
			continue
		}

		// move all iterators to less than the MAX to be >= than MAX
		for _, stream := range iterStreams {
			err = stream.SkipToTargetObject(ctx, maxObject)
			if err != nil {
				concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
				return
			}
		}
	}
}

func fastPathDifference(ctx context.Context, streams *iterator.Streams, outChan chan<- *iterator.Msg) {
	batch := make([]string, 0)

	defer func() {
		// flush
		if len(batch) > 0 {
			concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Iter: storage.NewStaticIterator[string](batch)}, outChan)
		}
		close(outChan)
		streams.Stop()
	}()

	// both base and difference are still remaining
	for streams.GetActiveStreamsCount() == 2 {
		if ctx.Err() != nil {
			return
		}
		iterStreams, err := streams.CleanDone(ctx)
		if err != nil {
			concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
			return
		}
		if len(iterStreams) != 2 {
			// short circuit
			break
		}

		allIters := true
		base := ""
		diff := ""
		for idx, stream := range iterStreams {
			v, err := stream.Head(ctx)
			if err != nil {
				if storage.IterIsDoneOrCancelled(err) {
					allIters = false
					// we need to ensure we have all iterators at all times
					break
				}
				concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
				return
			}
			if idx == BaseIndex {
				base = v
			}
			if idx == DifferenceIndex {
				diff = v
			}
		}

		if !allIters {
			// we need to ensure we have all iterators at all times
			continue
		}

		// move both iterator heads
		if base == diff {
			_, err = iterator.NextItemInSliceStreams(ctx, iterStreams, []int{BaseIndex, DifferenceIndex})
			if err != nil {
				// We are relying on the fact that we have called .Head(ctx) earlier
				// and no one else should have called the iterator (especially since it is
				// protected by mutex). Therefore, it is impossible for the iterator to return
				// Done here. Hence, any error received here should be considered as legitimate
				// errors.
				concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
				return
			}
			continue
		}

		if diff > base {
			batch, err = addNextItemInSliceStreamsToBatch(ctx, iterStreams, []int{BaseIndex}, batch, outChan)
			if err != nil {
				// We are relying on the fact that we have called .Head(ctx) earlier
				// and no one else should have called the iterator (especially since it is
				// protected by mutex). Therefore, it is impossible for the iterator to return
				// Done here. Hence, any error received here should be considered as legitimate
				// errors.
				return
			}
			continue
		}

		// diff < base, then move the diff to catch up with base
		err = iterStreams[DifferenceIndex].SkipToTargetObject(ctx, base)
		if err != nil {
			concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
			return
		}
	}

	iterStreams, err := streams.CleanDone(ctx)
	if err != nil {
		concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
		return
	}

	// drain the base
	if len(iterStreams) == 1 && iterStreams[BaseIndex].Idx() == BaseIndex {
		for len(iterStreams) == 1 {
			stream := iterStreams[BaseIndex]
			items, err := stream.Drain(ctx)
			if err != nil {
				concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
				return
			}
			batch = append(batch, items...)
			if len(batch) > IteratorMinBatchThreshold {
				concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Iter: storage.NewStaticIterator[string](batch)}, outChan)
				batch = make([]string, 0)
			}
			iterStreams, err = streams.CleanDone(ctx)
			if err != nil {
				concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: err}, outChan)
				return
			}
		}
	}
}

// fastPathOperationSetup returns a channel with a number of elements that is >= the number of children.
// Each element is an iterator.
// The caller must wait until the channel is closed.
func fastPathOperationSetup(ctx context.Context, req *ResolveCheckRequest, resolver fastPathSetHandler, children ...*openfgav1.Userset) (chan *iterator.Msg, error) {
	iterStreams := make([]*iterator.Stream, 0, len(children))
	for idx, child := range children {
		producerChan, err := fastPathRewrite(ctx, req, child)
		if err != nil {
			return nil, err
		}
		iterStreams = append(iterStreams, iterator.NewStream(idx, producerChan))
	}

	outChan := make(chan *iterator.Msg, len(children))
	go func() {
		recoveredError := panics.Try(func() {
			resolver(ctx, iterator.NewStreams(iterStreams), outChan)
		})

		if recoveredError != nil {
			concurrency.TrySendThroughChannel(ctx, &iterator.Msg{Err: fmt.Errorf("%w: %w", ErrPanic, recoveredError.AsError())}, outChan)
		}
	}()
	return outChan, nil
}

// fastPathRewrite returns a channel that will contain an unknown but finite number of elements.
// The channel is closed at the end.
func fastPathRewrite(
	ctx context.Context,
	req *ResolveCheckRequest,
	rewrite *openfgav1.Userset,
) (chan *iterator.Msg, error) {
	switch rw := rewrite.GetUserset().(type) {
	case *openfgav1.Userset_This:
		return fastPathDirect(ctx, req)
	case *openfgav1.Userset_ComputedUserset:
		return fastPathComputed(ctx, req, rewrite)
	case *openfgav1.Userset_Union:
		return fastPathOperationSetup(ctx, req, fastPathUnion, rw.Union.GetChild()...)
	case *openfgav1.Userset_Intersection:
		return fastPathOperationSetup(ctx, req, fastPathIntersection, rw.Intersection.GetChild()...)
	case *openfgav1.Userset_Difference:
		return fastPathOperationSetup(ctx, req, fastPathDifference, rw.Difference.GetBase(), rw.Difference.GetSubtract())
	case *openfgav1.Userset_TupleToUserset:
		return fastPathNoop(ctx, req)
	default:
		return nil, ErrUnknownSetOperator
	}
}
