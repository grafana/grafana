package graph

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/emirpasic/gods/sets/hashset"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/checkutil"
	"github.com/openfga/openfga/internal/concurrency"
	"github.com/openfga/openfga/internal/planner"
	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

const recursiveResolver = "recursive"

// In general these values tell the query planner that the recursive strategy usually performs around 150 ms but occasionally spikes.
// However, even when it spikes we want to keep it using it or exploring it despite variance, rather than over-penalizing single slow runs.
var recursivePlan = &planner.PlanConfig{
	Name:         recursiveResolver,
	InitialGuess: 150 * time.Millisecond,
	// Medium Lambda: Represents medium confidence in the initial guess. It's like
	// starting with the belief of having already seen 3 good runs.
	Lambda: 3.0,
	// UNCERTAINTY ABOUT CONSISTENCY: The gap between p50 and p99 is large.
	// Moderate Alpha/Beta values create a balanced belief curve, telling the planner
	// to expect variations but with higher confidence than before.
	// Higher expected precision: E[τ]= α/β = 3.0/2.0 = 1.5.
	// Moderate expected variance: E[σ²]= β/(α−1) = 2.0/(3.0−1) = 1.0. This allows for variance but is less jittery than previous settings.
	// Tighter tolerance for spread: α = 3 indicates a narrower uncertainty than α = 2, meaning we are more certain about the variance range.
	// When α > β, we expect higher precision and more controlled variance.
	Alpha: 3.0,
	Beta:  2.0,
}

type recursiveMapping struct {
	kind                        storage.TupleMapperKind
	tuplesetRelation            string
	allowedUserTypeRestrictions []*openfgav1.RelationReference
}

func (c *LocalChecker) recursiveUserset(_ context.Context, req *ResolveCheckRequest, _ []*openfgav1.RelationReference, rightIter storage.TupleKeyIterator, _ string) CheckHandlerFunc {
	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		typesys, _ := typesystem.TypesystemFromContext(ctx)

		directlyRelatedUsersetTypes, _ := typesys.DirectlyRelatedUsersets(tuple.GetType(req.GetTupleKey().GetObject()), req.GetTupleKey().GetRelation())
		objectProvider := newRecursiveUsersetObjectProvider(typesys)

		return c.recursiveFastPath(ctx, req, rightIter, &recursiveMapping{
			kind:                        storage.UsersetKind,
			allowedUserTypeRestrictions: directlyRelatedUsersetTypes,
		}, objectProvider)
	}
}

// recursiveTTU solves a union relation of the form "{operand1} OR ... {operandN} OR {recursive TTU}"
// rightIter gives the iterator for the recursive TTU.
func (c *LocalChecker) recursiveTTU(_ context.Context, req *ResolveCheckRequest, rewrite *openfgav1.Userset, rightIter storage.TupleKeyIterator, _ string) CheckHandlerFunc {
	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		typesys, _ := typesystem.TypesystemFromContext(ctx)

		ttu := rewrite.GetTupleToUserset()

		objectProvider := newRecursiveTTUObjectProvider(typesys, ttu)

		return c.recursiveFastPath(ctx, req, rightIter, &recursiveMapping{
			kind:             storage.TTUKind,
			tuplesetRelation: ttu.GetTupleset().GetRelation(),
		}, objectProvider)
	}
}

func (c *LocalChecker) recursiveFastPath(ctx context.Context, req *ResolveCheckRequest, iter storage.TupleKeyIterator, mapping *recursiveMapping, objectProvider objectProvider) (*ResolveCheckResponse, error) {
	ctx, span := tracer.Start(ctx, "recursiveFastPath")
	defer span.End()
	usersetFromUser := hashset.New()
	usersetFromObject := hashset.New()

	cancellableCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	objectToUsersetIter := storage.WrapIterator(mapping.kind, iter)
	defer objectToUsersetIter.Stop()
	objectToUsersetMessageChan := streamedLookupUsersetFromIterator(cancellableCtx, objectToUsersetIter)

	res := &ResolveCheckResponse{
		Allowed: false,
	}

	// check to see if there are any recursive userset assigned. If not,
	// we don't even need to check the terminal type side.

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case objectToUsersetMessage, ok := <-objectToUsersetMessageChan:
		if !ok {
			return res, ctx.Err()
		}
		if objectToUsersetMessage.err != nil {
			return nil, objectToUsersetMessage.err
		}
		usersetFromObject.Add(objectToUsersetMessage.userset)
	}

	userToUsersetMessageChan, err := objectProvider.Begin(cancellableCtx, req)
	if err != nil {
		return nil, err
	}
	defer objectProvider.End()

	userToUsersetDone := false
	objectToUsersetDone := false

	// NOTE: This loop initializes the terminal type and the first level of depth as this is a breadth first traversal.
	// To maintain simplicity the terminal type will be fully loaded, but it could arguably be loaded async.
	for !userToUsersetDone || !objectToUsersetDone {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case userToUsersetMessage, ok := <-userToUsersetMessageChan:
			if !ok {
				userToUsersetDone = true
				if usersetFromUser.Size() == 0 {
					return res, ctx.Err()
				}
				break
			}
			if userToUsersetMessage.err != nil {
				return nil, userToUsersetMessage.err
			}
			if processUsersetMessage(userToUsersetMessage.userset, usersetFromUser, usersetFromObject) {
				res.Allowed = true
				return res, nil
			}
		case objectToUsersetMessage, ok := <-objectToUsersetMessageChan:
			if !ok {
				// usersetFromObject must not be empty because we would have caught it earlier.
				objectToUsersetDone = true
				break
			}
			if objectToUsersetMessage.err != nil {
				return nil, objectToUsersetMessage.err
			}
			if processUsersetMessage(objectToUsersetMessage.userset, usersetFromObject, usersetFromUser) {
				res.Allowed = true
				return res, nil
			}
		}
	}

	newReq := req.clone()
	return c.recursiveMatchUserUserset(ctx, newReq, mapping, usersetFromObject, usersetFromUser)
}

func buildRecursiveMapper(ctx context.Context, req *ResolveCheckRequest, mapping *recursiveMapping) (storage.TupleMapper, error) {
	var iter storage.TupleIterator
	var err error
	typesys, _ := typesystem.TypesystemFromContext(ctx)
	ds, _ := storage.RelationshipTupleReaderFromContext(ctx)
	consistencyOpts := storage.ConsistencyOptions{
		Preference: req.GetConsistency(),
	}

	switch mapping.kind {
	case storage.UsersetKind:
		objectType := req.GetTupleKey().GetObject()
		relation := req.GetTupleKey().GetRelation()
		iter, err = ds.ReadUsersetTuples(ctx, req.GetStoreID(), storage.ReadUsersetTuplesFilter{
			Object:                      objectType,
			Relation:                    relation,
			AllowedUserTypeRestrictions: mapping.allowedUserTypeRestrictions,
		}, storage.ReadUsersetTuplesOptions{Consistency: consistencyOpts})
	case storage.TTUKind:
		objectType := req.GetTupleKey().GetObject()
		iter, err = ds.Read(ctx, req.GetStoreID(),
			storage.ReadFilter{Object: objectType, Relation: mapping.tuplesetRelation, User: ""},
			storage.ReadOptions{Consistency: consistencyOpts})
	default:
		return nil, errors.New("unsupported mapper kind")
	}
	if err != nil {
		return nil, err
	}
	filteredIter := storage.NewConditionsFilteredTupleKeyIterator(
		storage.NewFilteredTupleKeyIterator(
			storage.NewTupleKeyIteratorFromTupleIterator(iter),
			validation.FilterInvalidTuples(typesys),
		),
		checkutil.BuildTupleKeyConditionFilter(ctx, req.GetContext(), typesys),
	)
	return storage.WrapIterator(mapping.kind, filteredIter), nil
}

func (c *LocalChecker) recursiveMatchUserUserset(ctx context.Context, req *ResolveCheckRequest, mapping *recursiveMapping, currentLevelFromObject *hashset.Set, usersetFromUser *hashset.Set) (*ResolveCheckResponse, error) {
	ctx, span := tracer.Start(ctx, "recursiveMatchUserUserset", trace.WithAttributes(
		attribute.Int("first_level_size", currentLevelFromObject.Size()),
		attribute.Int("terminal_type_size", usersetFromUser.Size()),
	))
	defer span.End()
	checkOutcomeChan := make(chan checkOutcome, c.concurrencyLimit)

	cancellableCtx, cancel := context.WithCancel(ctx)
	wg := sync.WaitGroup{}
	defer func() {
		cancel()
		// We need to wait always to avoid a goroutine leak.
		wg.Wait()
	}()
	wg.Add(1)
	go func() {
		c.breadthFirstRecursiveMatch(cancellableCtx, req, mapping, &sync.Map{}, currentLevelFromObject, usersetFromUser, checkOutcomeChan)
		wg.Done()
	}()

	var finalErr error
	finalResult := &ResolveCheckResponse{
		Allowed: false,
	}

ConsumerLoop:
	for {
		select {
		case <-ctx.Done():
			break ConsumerLoop
		case outcome, ok := <-checkOutcomeChan:
			if !ok {
				break ConsumerLoop
			}
			if outcome.err != nil {
				finalErr = outcome.err
				break // continue
			}

			if outcome.resp.Allowed {
				finalErr = nil
				finalResult = outcome.resp
				break ConsumerLoop
			}
		}
	}
	// context cancellation from upstream (e.g. client)
	if ctx.Err() != nil {
		finalErr = ctx.Err()
	}

	if finalErr != nil {
		return nil, finalErr
	}

	return finalResult, nil
}

// Note that visited does not necessary means that there are cycles.  For the following model,
// type user
// type group
//
//	relations
//	  define member: [user, group#member]
//
// We have something like
// group:1#member@group:2#member
// group:1#member@group:3#member
// group:2#member@group:a#member
// group:3#member@group:a#member
// Note that both group:2#member and group:3#member has group:a#member. However, they are not cycles.
func (c *LocalChecker) breadthFirstRecursiveMatch(ctx context.Context, req *ResolveCheckRequest, mapping *recursiveMapping, visitedUserset *sync.Map, currentUsersetLevel *hashset.Set, usersetFromUser *hashset.Set, checkOutcomeChan chan checkOutcome) {
	req.GetRequestMetadata().Depth++
	if req.GetRequestMetadata().Depth == c.maxResolutionDepth {
		concurrency.TrySendThroughChannel(ctx, checkOutcome{err: ErrResolutionDepthExceeded}, checkOutcomeChan)
		close(checkOutcomeChan)
		return
	}
	if currentUsersetLevel.Size() == 0 || ctx.Err() != nil {
		// nothing else to search for or upstream cancellation
		close(checkOutcomeChan)
		return
	}
	relation := req.GetTupleKey().GetRelation()
	user := req.GetTupleKey().GetUser()

	pool := concurrency.NewPool(ctx, c.concurrencyLimit)
	mu := &sync.Mutex{}
	nextUsersetLevel := hashset.New()

	for _, usersetInterface := range currentUsersetLevel.Values() {
		userset := usersetInterface.(string)
		_, visited := visitedUserset.LoadOrStore(userset, struct{}{})
		if visited {
			continue
		}
		newReq := req.clone()
		newReq.TupleKey = tuple.NewTupleKey(userset, relation, user)
		mapper, err := buildRecursiveMapper(ctx, newReq, mapping)

		if err != nil {
			concurrency.TrySendThroughChannel(ctx, checkOutcome{err: err}, checkOutcomeChan)
			continue
		}
		// if the pool is short-circuited, the iterator should be stopped
		defer mapper.Stop()
		pool.Go(func(ctx context.Context) error {
			objectToUsersetMessageChan := streamedLookupUsersetFromIterator(ctx, mapper)
			for usersetMsg := range objectToUsersetMessageChan {
				if usersetMsg.err != nil {
					concurrency.TrySendThroughChannel(ctx, checkOutcome{err: usersetMsg.err}, checkOutcomeChan)
					return nil
				}
				userset := usersetMsg.userset
				if usersetFromUser.Contains(userset) {
					concurrency.TrySendThroughChannel(ctx, checkOutcome{resp: &ResolveCheckResponse{
						Allowed: true,
					}}, checkOutcomeChan)
					return ErrShortCircuit // cancel will be propagated to the remaining goroutines
				}
				mu.Lock()
				nextUsersetLevel.Add(userset)
				mu.Unlock()
			}
			return nil
		})
	}

	// wait for all checks to wrap up
	// if a match was found, clean up
	if err := pool.Wait(); errors.Is(err, ErrShortCircuit) {
		close(checkOutcomeChan)
		return
	}
	c.breadthFirstRecursiveMatch(ctx, req, mapping, visitedUserset, nextUsersetLevel, usersetFromUser, checkOutcomeChan)
}
