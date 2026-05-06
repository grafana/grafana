package graph

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/emirpasic/gods/sets/hashset"
	"github.com/sourcegraph/conc/panics"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/checkutil"
	"github.com/openfga/openfga/internal/concurrency"
	openfgaErrors "github.com/openfga/openfga/internal/errors"
	"github.com/openfga/openfga/internal/planner"
	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/logger"
	serverconfig "github.com/openfga/openfga/pkg/server/config"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/telemetry"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

var tracer = otel.Tracer("internal/graph/check")

type setOperatorType int

var (
	ErrUnknownSetOperator = fmt.Errorf("%w: unexpected set operator type encountered", openfgaErrors.ErrUnknown)
	ErrPanic              = errors.New("panic captured")
)

const (
	unionSetOperator setOperatorType = iota
	intersectionSetOperator
	exclusionSetOperator
)

type checkOutcome struct {
	resp *ResolveCheckResponse
	err  error
}

type LocalChecker struct {
	delegate             CheckResolver
	concurrencyLimit     int
	upstreamTimeout      time.Duration
	planner              planner.Manager
	logger               logger.Logger
	optimizationsEnabled bool
	maxResolutionDepth   uint32
}

type LocalCheckerOption func(d *LocalChecker)

// WithResolveNodeBreadthLimit see server.WithResolveNodeBreadthLimit.
func WithResolveNodeBreadthLimit(limit uint32) LocalCheckerOption {
	return func(d *LocalChecker) {
		d.concurrencyLimit = int(limit)
	}
}

func WithOptimizations(enabled bool) LocalCheckerOption {
	return func(d *LocalChecker) {
		d.optimizationsEnabled = enabled
	}
}

func WithPlanner(p planner.Manager) LocalCheckerOption {
	return func(d *LocalChecker) {
		d.planner = p
	}
}

func WithLocalCheckerLogger(logger logger.Logger) LocalCheckerOption {
	return func(d *LocalChecker) {
		d.logger = logger
	}
}

func WithMaxResolutionDepth(depth uint32) LocalCheckerOption {
	return func(d *LocalChecker) {
		d.maxResolutionDepth = depth
	}
}

func WithUpstreamTimeout(timeout time.Duration) LocalCheckerOption {
	return func(d *LocalChecker) {
		d.upstreamTimeout = timeout
	}
}

// NewLocalChecker constructs a LocalChecker that can be used to evaluate a Check
// request locally.
//
// Developers wanting a LocalChecker with other optional layers (e.g caching and others)
// are encouraged to use [[NewOrderedCheckResolvers]] instead.
func NewLocalChecker(opts ...LocalCheckerOption) *LocalChecker {
	checker := &LocalChecker{
		concurrencyLimit:   serverconfig.DefaultResolveNodeBreadthLimit,
		maxResolutionDepth: serverconfig.DefaultResolveNodeLimit,
		upstreamTimeout:    serverconfig.DefaultRequestTimeout,
		logger:             logger.NewNoopLogger(),
		planner:            planner.NewNoopPlanner(),
	}
	// by default, a LocalChecker delegates/dispatches subproblems to itself (e.g. local dispatch) unless otherwise configured.
	checker.delegate = checker

	for _, opt := range opts {
		opt(checker)
	}

	return checker
}

// SetDelegate sets this LocalChecker's dispatch delegate.
func (c *LocalChecker) SetDelegate(delegate CheckResolver) {
	c.delegate = delegate
}

// GetDelegate sets this LocalChecker's dispatch delegate.
func (c *LocalChecker) GetDelegate() CheckResolver {
	return c.delegate
}

// CheckHandlerFunc defines a function that evaluates a CheckResponse or returns an error
// otherwise.
type CheckHandlerFunc func(ctx context.Context) (*ResolveCheckResponse, error)

// CheckFuncReducer defines a function that combines or reduces one or more CheckHandlerFunc into
// a single CheckResponse with a maximum limit on the number of concurrent evaluations that can be
// in flight at any given time.
type CheckFuncReducer func(ctx context.Context, concurrencyLimit int, handlers ...CheckHandlerFunc) (*ResolveCheckResponse, error)

// runHandler safely executes a CheckHandlerFunc, recovers from any panics,
// and returns the result as a checkOutcome.
func runHandler(ctx context.Context, handler CheckHandlerFunc) checkOutcome {
	var res *ResolveCheckResponse
	var err error

	recoveredErr := panics.Try(func() {
		res, err = handler(ctx)
	})
	if recoveredErr != nil {
		err = fmt.Errorf("%w: %w", ErrPanic, recoveredErr.AsError())
	}

	return checkOutcome{res, err}
}

// union implements a CheckFuncReducer that requires any of the provided CheckHandlerFunc to resolve
// to an allowed outcome. The first allowed outcome causes premature termination of the reducer.
func union(ctx context.Context, concurrencyLimit int, handlers ...CheckHandlerFunc) (resp *ResolveCheckResponse, err error) {
	cancellableCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	pool := concurrency.NewPool(cancellableCtx, concurrencyLimit)
	out := make(chan checkOutcome, len(handlers))

	for _, handler := range handlers {
		h := handler
		pool.Go(func(ctx context.Context) error {
			concurrency.TrySendThroughChannel(cancellableCtx, runHandler(ctx, h), out)
			return nil
		})
	}

	go func() {
		_ = pool.Wait()
		close(out)
	}()

	var finalErr error
	finalResult := &ResolveCheckResponse{Allowed: false}

	for i := 0; i < len(handlers); i++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()

		case outcome, ok := <-out:
			if !ok {
				break
			}

			if outcome.err != nil {
				finalErr = outcome.err
				continue // Continue to see if we find an 'Allowed: true'
			}

			if outcome.resp.GetResolutionMetadata().CycleDetected {
				finalResult.ResolutionMetadata.CycleDetected = true
			}

			if outcome.resp.Allowed {
				// Short-circuit success. defer cancel() will clean up workers.
				return outcome.resp, nil
			}
		}
	}

	if finalErr != nil {
		return nil, finalErr
	}

	return finalResult, nil
}

// intersection implements a CheckFuncReducer that requires all of the provided CheckHandlerFunc to resolve
// to an allowed outcome. The first falsey causes premature termination of the reducer. Errors are swallowed if there is a false outcome.
func intersection(ctx context.Context, concurrencyLimit int, handlers ...CheckHandlerFunc) (resp *ResolveCheckResponse, err error) {
	if len(handlers) < 2 {
		return nil, fmt.Errorf("%w, expected at least two rewrite operands for intersection operator, but got '%d'", openfgaErrors.ErrUnknown, len(handlers))
	}

	cancellableCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	pool := concurrency.NewPool(cancellableCtx, concurrencyLimit)
	out := make(chan checkOutcome, len(handlers))

	for _, handler := range handlers {
		h := handler // Capture loop variable for the goroutine
		pool.Go(func(ctx context.Context) error {
			concurrency.TrySendThroughChannel(cancellableCtx, runHandler(ctx, h), out)
			return nil
		})
	}

	go func() {
		_ = pool.Wait()
		close(out)
	}()

	var finalErr error
	finalResult := &ResolveCheckResponse{
		Allowed: true,
	}

	for i := 0; i < len(handlers); i++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()

		case outcome, ok := <-out:
			if !ok {
				break
			}

			if outcome.err != nil {
				// Store the first error we see, but don't exit yet.
				// A definitive 'false' result from another handler can override this.
				if finalErr == nil {
					finalErr = outcome.err
				}
				continue
			}

			if outcome.resp.GetResolutionMetadata().CycleDetected || !outcome.resp.Allowed {
				// Short-circuit failure. defer cancel() will clean up workers.
				finalResult.Allowed = false
				finalResult.ResolutionMetadata.CycleDetected = outcome.resp.GetResolutionMetadata().CycleDetected
				return finalResult, nil
			}
		}
	}

	// If we've processed all handlers without a definitive 'false',
	// then any error we encountered along the way is the final result.
	if finalErr != nil {
		return nil, finalErr
	}

	// If the loop completes without any "false" outcomes or errors, the result is "true".
	return finalResult, nil
}

// exclusion implements a CheckFuncReducer that requires a 'base' CheckHandlerFunc to resolve to an allowed
// outcome and a 'sub' CheckHandlerFunc to resolve to a falsey outcome.
func exclusion(ctx context.Context, _ int, handlers ...CheckHandlerFunc) (*ResolveCheckResponse, error) {
	if len(handlers) != 2 {
		return nil, fmt.Errorf("%w, expected two rewrite operands for exclusion operator, but got '%d'", openfgaErrors.ErrUnknown, len(handlers))
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	baseChan := make(chan checkOutcome, 1)
	subChan := make(chan checkOutcome, 1)

	go func() {
		concurrency.TrySendThroughChannel(ctx, runHandler(ctx, handlers[0]), baseChan)
		close(baseChan)
	}()
	go func() {
		concurrency.TrySendThroughChannel(ctx, runHandler(ctx, handlers[1]), subChan)
		close(subChan)
	}()

	var baseErr, subErr error

	// Loop until we have received one result from each of the two channels.
	resultsReceived := 0
	for resultsReceived < 2 {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()

		case res, ok := <-baseChan:
			if !ok {
				baseChan = nil // Stop selecting this case.
				continue
			}
			resultsReceived++

			if res.err != nil {
				baseErr = res.err
				continue
			}

			// Short-circuit: If base is false, the whole expression is false.
			if res.resp.GetCycleDetected() || !res.resp.GetAllowed() {
				return &ResolveCheckResponse{Allowed: false, ResolutionMetadata: ResolveCheckResponseMetadata{CycleDetected: res.resp.GetCycleDetected()}}, nil
			}

		case res, ok := <-subChan:
			if !ok {
				subChan = nil // Stop selecting this case.
				continue
			}
			resultsReceived++

			if res.err != nil {
				subErr = res.err
				continue
			}

			// Short-circuit: If subtract is true, the whole expression is false.
			if res.resp.GetCycleDetected() || res.resp.GetAllowed() {
				return &ResolveCheckResponse{Allowed: false, ResolutionMetadata: ResolveCheckResponseMetadata{CycleDetected: res.resp.GetCycleDetected()}}, nil
			}
		}
	}

	// At this point, we are guaranteed to have both results (or to have already short-circuited).
	if baseErr != nil {
		return nil, baseErr
	}
	if subErr != nil {
		return nil, subErr
	}

	// The only way to get here is if base was (Allowed: true) and subtract was (Allowed: false).
	return &ResolveCheckResponse{Allowed: true}, nil
}

// Close is a noop.
func (c *LocalChecker) Close() {
}

// dispatch dispatches the given request to the CheckResolver this LocalChecker was constructed with.
func (c *LocalChecker) dispatch(_ context.Context, req *ResolveCheckRequest) CheckHandlerFunc {
	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		req.GetRequestMetadata().Depth++
		resp, err := c.delegate.ResolveCheck(ctx, req)
		if err != nil {
			return nil, err
		}
		return resp, nil
	}
}

var _ CheckResolver = (*LocalChecker)(nil)

// ResolveCheck implements [[CheckResolver.ResolveCheck]].
func (c *LocalChecker) ResolveCheck(
	ctx context.Context,
	req *ResolveCheckRequest,
) (*ResolveCheckResponse, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}

	ctx, span := tracer.Start(ctx, "ResolveCheck", trace.WithAttributes(
		attribute.String("store_id", req.GetStoreID()),
		attribute.String("resolver_type", "LocalChecker"),
		attribute.String("tuple_key", tuple.TupleKeyWithConditionToString(req.GetTupleKey())),
	))
	defer span.End()

	if req.GetRequestMetadata().Depth == c.maxResolutionDepth {
		return nil, ErrResolutionDepthExceeded
	}

	cycle := c.hasCycle(req)
	if cycle {
		span.SetAttributes(attribute.Bool("cycle_detected", true))
		return &ResolveCheckResponse{
			Allowed: false,
			ResolutionMetadata: ResolveCheckResponseMetadata{
				CycleDetected: true,
			},
		}, nil
	}

	tupleKey := req.GetTupleKey()
	object := tupleKey.GetObject()
	relation := tupleKey.GetRelation()

	if tuple.IsSelfDefining(req.GetTupleKey()) {
		return &ResolveCheckResponse{
			Allowed: true,
		}, nil
	}

	typesys, ok := typesystem.TypesystemFromContext(ctx)
	if !ok {
		return nil, fmt.Errorf("%w: typesystem missing in context", openfgaErrors.ErrUnknown)
	}
	_, ok = storage.RelationshipTupleReaderFromContext(ctx)
	if !ok {
		return nil, fmt.Errorf("%w: relationship tuple reader datastore missing in context", openfgaErrors.ErrUnknown)
	}

	objectType, _ := tuple.SplitObject(object)
	rel, err := typesys.GetRelation(objectType, relation)
	if err != nil {
		return nil, fmt.Errorf("relation '%s' undefined for object type '%s'", relation, objectType)
	}

	hasPath, err := typesys.PathExists(tupleKey.GetUser(), relation, objectType)
	if err != nil {
		return nil, err
	}
	if !hasPath {
		return &ResolveCheckResponse{
			Allowed: false,
		}, nil
	}

	resp, err := c.CheckRewrite(ctx, req, rel.GetRewrite())(ctx)
	if err != nil {
		telemetry.TraceError(span, err)
		return nil, err
	}

	return resp, nil
}

// hasCycle returns true if a cycle has been found. It modifies the request object.
func (c *LocalChecker) hasCycle(req *ResolveCheckRequest) bool {
	key := tuple.TupleKeyToString(req.GetTupleKey())
	if req.VisitedPaths == nil {
		req.VisitedPaths = map[string]struct{}{}
	}

	_, cycleDetected := req.VisitedPaths[key]
	if cycleDetected {
		return true
	}

	req.VisitedPaths[key] = struct{}{}
	return false
}

func (c *LocalChecker) checkPublicAssignable(ctx context.Context, req *ResolveCheckRequest) CheckHandlerFunc {
	typesys, _ := typesystem.TypesystemFromContext(ctx)
	ds, _ := storage.RelationshipTupleReaderFromContext(ctx)
	storeID := req.GetStoreID()
	reqTupleKey := req.GetTupleKey()
	userType := tuple.GetType(reqTupleKey.GetUser())
	wildcardRelationReference := typesystem.WildcardRelationReference(userType)
	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		ctx, span := tracer.Start(ctx, "checkPublicAssignable")
		defer span.End()

		response := &ResolveCheckResponse{
			Allowed: false,
		}

		opts := storage.ReadUsersetTuplesOptions{
			Consistency: storage.ConsistencyOptions{
				Preference: req.GetConsistency(),
			},
		}

		// We want to query via ReadUsersetTuples instead of ReadUserTuple tuples to take
		// advantage of the storage wrapper cache
		// (https://github.com/openfga/openfga/blob/af054d9693bd7ebd0420456b144c2fb6888aaf87/internal/graph/storagewrapper.go#L139).
		// In the future, if storage wrapper cache is available for ReadUserTuple, we can switch it to ReadUserTuple.
		iter, err := ds.ReadUsersetTuples(ctx, storeID, storage.ReadUsersetTuplesFilter{
			Object:                      reqTupleKey.GetObject(),
			Relation:                    reqTupleKey.GetRelation(),
			AllowedUserTypeRestrictions: []*openfgav1.RelationReference{wildcardRelationReference},
		}, opts)
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
		defer filteredIter.Stop()

		_, err = filteredIter.Next(ctx)
		if err != nil {
			if errors.Is(err, storage.ErrIteratorDone) {
				return response, nil
			}
			return nil, err
		}
		// when we get to here, it means there is public wild card assigned
		span.SetAttributes(attribute.Bool("allowed", true))
		response.Allowed = true
		return response, nil
	}
}

func (c *LocalChecker) checkDirectUserTuple(ctx context.Context, req *ResolveCheckRequest) CheckHandlerFunc {
	typesys, _ := typesystem.TypesystemFromContext(ctx)

	reqTupleKey := req.GetTupleKey()

	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		ctx, span := tracer.Start(ctx, "checkDirectUserTuple",
			trace.WithAttributes(attribute.String("tuple_key", tuple.TupleKeyWithConditionToString(reqTupleKey))))
		defer span.End()

		response := &ResolveCheckResponse{
			Allowed: false,
		}

		ds, _ := storage.RelationshipTupleReaderFromContext(ctx)
		storeID := req.GetStoreID()

		opts := storage.ReadUserTupleOptions{
			Consistency: storage.ConsistencyOptions{
				Preference: req.GetConsistency(),
			},
		}
		t, err := ds.ReadUserTuple(ctx, storeID, storage.ReadUserTupleFilter{Object: reqTupleKey.GetObject(), Relation: reqTupleKey.GetRelation(), User: reqTupleKey.GetUser()}, opts)
		if err != nil {
			if errors.Is(err, storage.ErrNotFound) {
				return response, nil
			}

			return nil, err
		}

		// filter out invalid tuples yielded by the database query
		tupleKey := t.GetKey()
		err = validation.ValidateTupleForRead(typesys, tupleKey)
		if err != nil {
			return response, nil
		}
		tupleKeyConditionFilter := checkutil.BuildTupleKeyConditionFilter(ctx, req.Context, typesys)
		conditionMet, err := tupleKeyConditionFilter(tupleKey)
		if err != nil {
			telemetry.TraceError(span, err)
			return nil, err
		}
		if conditionMet {
			span.SetAttributes(attribute.Bool("allowed", true))
			response.Allowed = true
		}
		return response, nil
	}
}

// helper function to return whether checkDirectUserTuple should run.
func shouldCheckDirectTuple(ctx context.Context, reqTupleKey *openfgav1.TupleKey) bool {
	typesys, _ := typesystem.TypesystemFromContext(ctx)

	objectType := tuple.GetType(reqTupleKey.GetObject())
	relation := reqTupleKey.GetRelation()

	isDirectlyRelated, _ := typesys.IsDirectlyRelated(
		typesystem.DirectRelationReference(objectType, relation),                                                           // target
		typesystem.DirectRelationReference(tuple.GetType(reqTupleKey.GetUser()), tuple.GetRelation(reqTupleKey.GetUser())), // source
	)

	return isDirectlyRelated
}

// helper function to return whether checkPublicAssignable should run.
func shouldCheckPublicAssignable(ctx context.Context, reqTupleKey *openfgav1.TupleKey) bool {
	typesys, _ := typesystem.TypesystemFromContext(ctx)

	objectType := tuple.GetType(reqTupleKey.GetObject())
	relation := reqTupleKey.GetRelation()

	// if the user tuple is userset, by definition it cannot be a wildcard
	if tuple.IsObjectRelation(reqTupleKey.GetUser()) {
		return false
	}

	isPubliclyAssignable, _ := typesys.IsPubliclyAssignable(
		typesystem.DirectRelationReference(objectType, relation), // target
		tuple.GetType(reqTupleKey.GetUser()),
	)
	return isPubliclyAssignable
}

func (c *LocalChecker) profiledCheckHandler(keyPlan planner.Selector, strategy *planner.PlanConfig, resolver CheckHandlerFunc) CheckHandlerFunc {
	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		start := time.Now()
		res, err := resolver(ctx)
		if err != nil {
			// penalize plans that timeout from the upstream context
			if errors.Is(err, context.DeadlineExceeded) {
				keyPlan.UpdateStats(strategy, c.upstreamTimeout)
			}
			return nil, err
		}
		keyPlan.UpdateStats(strategy, time.Since(start))
		return res, nil
	}
}

func (c *LocalChecker) checkDirectUsersetTuples(ctx context.Context, req *ResolveCheckRequest) CheckHandlerFunc {
	typesys, _ := typesystem.TypesystemFromContext(ctx)
	reqTupleKey := req.GetTupleKey()

	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		ctx, span := tracer.Start(ctx, "checkDirectUsersetTuples", trace.WithAttributes(
			attribute.String("userset", tuple.ToObjectRelationString(reqTupleKey.GetObject(), reqTupleKey.GetRelation())),
		))
		defer span.End()

		objectType, relation := tuple.GetType(reqTupleKey.GetObject()), reqTupleKey.GetRelation()
		userType := tuple.GetType(reqTupleKey.GetUser())

		directlyRelatedUsersetTypes, _ := typesys.DirectlyRelatedUsersets(objectType, relation)
		isUserset := tuple.IsObjectRelation(reqTupleKey.GetUser())

		// if user in request is userset, we do not have additional strategies to apply
		if isUserset {
			iter, err := checkutil.IteratorReadUsersetTuples(ctx, req, directlyRelatedUsersetTypes)
			if err != nil {
				return nil, err
			}
			defer iter.Stop()

			return c.defaultUserset(ctx, req, directlyRelatedUsersetTypes, iter, "")(ctx)
		}

		possibleStrategies := map[string]*planner.PlanConfig{
			defaultResolver: defaultPlan,
		}

		var b strings.Builder
		b.WriteString("userset|")
		b.WriteString(req.GetAuthorizationModelID())
		b.WriteString("|")
		b.WriteString(objectType)
		b.WriteString("|")
		b.WriteString(relation)
		b.WriteString("|")
		b.WriteString(userType)
		b.WriteString("|")

		// if the type#relation is resolvable recursively, then it can only be resolved recursively
		if typesys.UsersetUseRecursiveResolver(objectType, relation, userType) {
			iter, err := checkutil.IteratorReadUsersetTuples(ctx, req, directlyRelatedUsersetTypes)
			if err != nil {
				return nil, err
			}
			defer iter.Stop()

			possibleStrategies[defaultResolver] = defaultRecursivePlan
			possibleStrategies[recursiveResolver] = recursivePlan

			// If a strategy was already selected by a parent call for the recursive use case, use it without re-planning.
			// This prevents the planner from being called again during recursive dispatch calls.
			selectedStrategy := req.GetSelectedStrategy()
			switch selectedStrategy {
			case defaultResolver:
				return c.defaultUserset(ctx, req, directlyRelatedUsersetTypes, iter, selectedStrategy)(ctx)
			case recursiveResolver:
				return c.recursiveUserset(ctx, req, directlyRelatedUsersetTypes, iter, selectedStrategy)(ctx)
			default: // in case is not selected
			}

			b.WriteString("infinite")
			key := b.String()
			keyPlan := c.planner.GetPlanSelector(key)
			plan := keyPlan.Select(possibleStrategies)

			resolver := c.defaultUserset
			if plan.Name == recursiveResolver {
				resolver = c.recursiveUserset
			}
			return c.profiledCheckHandler(keyPlan, plan, resolver(ctx, req, directlyRelatedUsersetTypes, iter, plan.Name))(ctx)
		}

		var resolvers []CheckHandlerFunc

		var remainingUsersetTypes []*openfgav1.RelationReference
		keyPlanPrefix := b.String()
		possibleStrategies[weightTwoResolver] = weight2Plan

		// Check if a strategy was already selected by a parent call
		selectedStrategy := req.GetSelectedStrategy()

		for _, userset := range directlyRelatedUsersetTypes {
			if !typesys.UsersetUseWeight2Resolver(objectType, relation, userType, userset) {
				remainingUsersetTypes = append(remainingUsersetTypes, userset)
				continue
			}
			usersets := []*openfgav1.RelationReference{userset}
			iter, err := checkutil.IteratorReadUsersetTuples(ctx, req, usersets)
			if err != nil {
				return nil, err
			}
			// NOTE: we collect defers given that the iterator won't be consumed until `union` resolves at the end.
			defer iter.Stop()

			// If a strategy was already selected, use it without re-planning
			if selectedStrategy != "" {
				if _, exists := possibleStrategies[selectedStrategy]; exists {
					resolver := c.defaultUserset
					if selectedStrategy == weightTwoResolver {
						resolver = c.weight2Userset
					}
					resolvers = append(resolvers, resolver(ctx, req, usersets, iter, selectedStrategy))
					continue
				}
			}

			var k strings.Builder
			k.WriteString(keyPlanPrefix)
			k.WriteString("userset|")
			k.WriteString(userset.String())
			key := k.String()
			keyPlan := c.planner.GetPlanSelector(key)
			strategy := keyPlan.Select(possibleStrategies)

			resolver := c.defaultUserset
			if strategy.Name == weightTwoResolver {
				resolver = c.weight2Userset
			}
			resolvers = append(resolvers, c.profiledCheckHandler(keyPlan, strategy, resolver(ctx, req, usersets, iter, strategy.Name)))
		}
		// for all usersets could not be resolved through weight2 resolver, resolve them all through the default resolver.
		// they all resolved as a group rather than individually.
		if len(remainingUsersetTypes) > 0 {
			iter, err := checkutil.IteratorReadUsersetTuples(ctx, req, remainingUsersetTypes)
			if err != nil {
				return nil, err
			}
			defer iter.Stop()
			resolvers = append(resolvers, c.defaultUserset(ctx, req, remainingUsersetTypes, iter, ""))
		}

		return union(ctx, c.concurrencyLimit, resolvers...)
	}
}

// checkDirect composes three CheckHandlerFunc which evaluate direct relationships with the provided
// 'object#relation'. The first handler looks up direct matches on the provided 'object#relation@user',
// the second handler looks up wildcard matches on the provided 'object#relation@user:*',
// while the third handler looks up relationships between the target 'object#relation' and any usersets
// related to it.
func (c *LocalChecker) checkDirect(parentctx context.Context, req *ResolveCheckRequest) CheckHandlerFunc {
	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		ctx, span := tracer.Start(ctx, "checkDirect")
		defer span.End()

		typesys, _ := typesystem.TypesystemFromContext(parentctx) // note: use of 'parentctx' not 'ctx' - this is important

		reqTupleKey := req.GetTupleKey()
		objectType := tuple.GetType(reqTupleKey.GetObject())
		relation := reqTupleKey.GetRelation()

		// directlyRelatedUsersetTypes could be "group#member"
		directlyRelatedUsersetTypes, _ := typesys.DirectlyRelatedUsersets(objectType, relation)

		var checkFuncs []CheckHandlerFunc

		if shouldCheckDirectTuple(ctx, req.GetTupleKey()) {
			checkFuncs = []CheckHandlerFunc{c.checkDirectUserTuple(parentctx, req)}
		}

		if shouldCheckPublicAssignable(ctx, reqTupleKey) {
			checkFuncs = append(checkFuncs, c.checkPublicAssignable(parentctx, req))
		}

		if len(directlyRelatedUsersetTypes) > 0 {
			checkFuncs = append(checkFuncs, c.checkDirectUsersetTuples(parentctx, req))
		}

		resp, err := union(ctx, c.concurrencyLimit, checkFuncs...)
		if err != nil {
			telemetry.TraceError(span, err)
			return nil, err
		}

		return resp, nil
	}
}

// checkComputedUserset evaluates the Check request with the rewritten relation (e.g. the computed userset relation).
func (c *LocalChecker) checkComputedUserset(_ context.Context, req *ResolveCheckRequest, rewrite *openfgav1.Userset) CheckHandlerFunc {
	rewrittenTupleKey := tuple.NewTupleKey(
		req.GetTupleKey().GetObject(),
		rewrite.GetComputedUserset().GetRelation(),
		req.GetTupleKey().GetUser(),
	)

	childRequest := req.clone()
	childRequest.TupleKey = rewrittenTupleKey

	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		ctx, span := tracer.Start(ctx, "checkComputedUserset")
		defer span.End()
		// No dispatch here, as we don't want to increase resolution depth.
		return c.ResolveCheck(ctx, childRequest)
	}
}

// checkTTU looks up all tuples of the target tupleset relation on the provided object and for each one
// of them evaluates the computed userset of the TTU rewrite rule for them.
func (c *LocalChecker) checkTTU(parentctx context.Context, req *ResolveCheckRequest, rewrite *openfgav1.Userset) CheckHandlerFunc {
	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		ctx, span := tracer.Start(ctx, "checkTTU")
		defer span.End()

		typesys, _ := typesystem.TypesystemFromContext(parentctx) // note: use of 'parentctx' not 'ctx' - this is important

		ds, _ := storage.RelationshipTupleReaderFromContext(parentctx)

		objectType, relation := tuple.GetType(req.GetTupleKey().GetObject()), req.GetTupleKey().GetRelation()

		userType := tuple.GetType(req.GetTupleKey().GetUser())

		ctx = typesystem.ContextWithTypesystem(ctx, typesys)
		ctx = storage.ContextWithRelationshipTupleReader(ctx, ds)

		tuplesetRelation := rewrite.GetTupleToUserset().GetTupleset().GetRelation()
		computedRelation := rewrite.GetTupleToUserset().GetComputedUserset().GetRelation()

		tk := req.GetTupleKey()
		object := tk.GetObject()

		span.SetAttributes(
			attribute.String("tupleset_relation", tuple.ToObjectRelationString(tuple.GetType(object), tuplesetRelation)),
			attribute.String("computed_relation", computedRelation),
		)

		opts := storage.ReadOptions{
			Consistency: storage.ConsistencyOptions{
				Preference: req.GetConsistency(),
			},
		}

		storeID := req.GetStoreID()
		iter, err := ds.Read(
			ctx,
			storeID,
			storage.ReadFilter{Object: object, Relation: tuplesetRelation, User: ""},
			opts,
		)
		if err != nil {
			return nil, err
		}

		// filter out invalid tuples yielded by the database iterator
		filteredIter := storage.NewConditionsFilteredTupleKeyIterator(
			storage.NewFilteredTupleKeyIterator(
				storage.NewTupleKeyIteratorFromTupleIterator(iter),
				validation.FilterInvalidTuples(typesys),
			),
			checkutil.BuildTupleKeyConditionFilter(ctx, req.GetContext(), typesys),
		)
		defer filteredIter.Stop()

		resolver := c.defaultTTU
		possibleStrategies := map[string]*planner.PlanConfig{
			defaultResolver: defaultPlan,
		}
		isUserset := tuple.IsObjectRelation(tk.GetUser())

		if !isUserset {
			if typesys.TTUUseWeight2Resolver(objectType, relation, userType, rewrite.GetTupleToUserset()) {
				possibleStrategies[weightTwoResolver] = weight2Plan
				resolver = c.weight2TTU
			} else if typesys.TTUUseRecursiveResolver(objectType, relation, userType, rewrite.GetTupleToUserset()) {
				possibleStrategies[defaultResolver] = defaultRecursivePlan
				possibleStrategies[recursiveResolver] = recursivePlan
				resolver = c.recursiveTTU
			}
		}

		if len(possibleStrategies) == 1 {
			// short circuit, no additional resolvers are available
			return resolver(ctx, req, rewrite, filteredIter, "")(ctx)
		}

		// If a strategy was already selected by a parent call, use it without re-planning.
		// This prevents the planner from being called again during recursive dispatch calls.
		if selectedStrategy := req.GetSelectedStrategy(); selectedStrategy != "" {
			if _, exists := possibleStrategies[selectedStrategy]; exists {
				switch selectedStrategy {
				case defaultResolver:
					resolver = c.defaultTTU
				case weightTwoResolver:
					resolver = c.weight2TTU
				case recursiveResolver:
					resolver = c.recursiveTTU
				}
				return resolver(ctx, req, rewrite, filteredIter, selectedStrategy)(ctx)
			}
			// If the selected strategy is not in the possible strategies, fall through to planner
		}

		var b strings.Builder
		b.WriteString("ttu|")
		b.WriteString(req.GetAuthorizationModelID())
		b.WriteString("|")
		b.WriteString(objectType)
		b.WriteString("|")
		b.WriteString(relation)
		b.WriteString("|")
		b.WriteString(userType)
		b.WriteString("|")
		b.WriteString(tuplesetRelation)
		b.WriteString("|")
		b.WriteString(computedRelation)
		planKey := b.String()
		keyPlan := c.planner.GetPlanSelector(planKey)
		strategy := keyPlan.Select(possibleStrategies)

		switch strategy.Name {
		case defaultResolver:
			resolver = c.defaultTTU
		case weightTwoResolver:
			resolver = c.weight2TTU
		case recursiveResolver:
			resolver = c.recursiveTTU
		}

		return c.profiledCheckHandler(keyPlan, strategy, resolver(ctx, req, rewrite, filteredIter, strategy.Name))(ctx)
	}
}

func (c *LocalChecker) checkSetOperation(
	ctx context.Context,
	req *ResolveCheckRequest,
	setOpType setOperatorType,
	reducer CheckFuncReducer,
	children ...*openfgav1.Userset,
) CheckHandlerFunc {
	var handlers []CheckHandlerFunc

	var reducerKey string
	switch setOpType {
	case unionSetOperator, intersectionSetOperator, exclusionSetOperator:
		if setOpType == unionSetOperator {
			reducerKey = "union"
		}

		if setOpType == intersectionSetOperator {
			reducerKey = "intersection"
		}

		if setOpType == exclusionSetOperator {
			reducerKey = "exclusion"
		}

		for _, child := range children {
			handlers = append(handlers, c.CheckRewrite(ctx, req, child))
		}
	default:
		return func(ctx context.Context) (*ResolveCheckResponse, error) {
			return nil, ErrUnknownSetOperator
		}
	}

	return func(ctx context.Context) (*ResolveCheckResponse, error) {
		var err error
		var resp *ResolveCheckResponse
		ctx, span := tracer.Start(ctx, reducerKey)
		defer func() {
			if err != nil {
				telemetry.TraceError(span, err)
			}
			span.End()
		}()

		resp, err = reducer(ctx, c.concurrencyLimit, handlers...)
		return resp, err
	}
}

func (c *LocalChecker) CheckRewrite(
	ctx context.Context,
	req *ResolveCheckRequest,
	rewrite *openfgav1.Userset,
) CheckHandlerFunc {
	switch rw := rewrite.GetUserset().(type) {
	case *openfgav1.Userset_This:
		return c.checkDirect(ctx, req)
	case *openfgav1.Userset_ComputedUserset:
		return c.checkComputedUserset(ctx, req, rewrite)
	case *openfgav1.Userset_TupleToUserset:
		return c.checkTTU(ctx, req, rewrite)
	case *openfgav1.Userset_Union:
		return c.checkSetOperation(ctx, req, unionSetOperator, union, rw.Union.GetChild()...)
	case *openfgav1.Userset_Intersection:
		return c.checkSetOperation(ctx, req, intersectionSetOperator, intersection, rw.Intersection.GetChild()...)
	case *openfgav1.Userset_Difference:
		return c.checkSetOperation(ctx, req, exclusionSetOperator, exclusion, rw.Difference.GetBase(), rw.Difference.GetSubtract())
	default:
		return func(ctx context.Context) (*ResolveCheckResponse, error) {
			return nil, ErrUnknownSetOperator
		}
	}
}

// TODO: make these subsequent functions generic and move outside this package.

type usersetMessage struct {
	userset string
	err     error
}

// streamedLookupUsersetFromIterator returns a channel with all the usersets given by the input iterator.
// It closes the channel in the end.
func streamedLookupUsersetFromIterator(ctx context.Context, iter storage.TupleMapper) <-chan usersetMessage {
	usersetMessageChan := make(chan usersetMessage, 100)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				concurrency.TrySendThroughChannel(ctx, usersetMessage{err: fmt.Errorf("%w: %s", ErrPanic, r)}, usersetMessageChan)
			}

			close(usersetMessageChan)
		}()

		for {
			res, err := iter.Next(ctx)
			if err != nil {
				if storage.IterIsDoneOrCancelled(err) {
					return
				}
				concurrency.TrySendThroughChannel(ctx, usersetMessage{err: err}, usersetMessageChan)
				return
			}
			concurrency.TrySendThroughChannel(ctx, usersetMessage{userset: res}, usersetMessageChan)
		}
	}()

	return usersetMessageChan
}

// processUsersetMessage will add the userset in the primarySet.
// In addition, it returns whether the userset exists in secondarySet.
// This is used to find the intersection between userset from user and userset from object.
func processUsersetMessage(userset string,
	primarySet *hashset.Set,
	secondarySet *hashset.Set) bool {
	primarySet.Add(userset)
	return secondarySet.Contains(userset)
}
