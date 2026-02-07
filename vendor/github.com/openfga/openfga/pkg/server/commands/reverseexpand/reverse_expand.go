// Package reverseexpand contains the code that handles the ReverseExpand API
package reverseexpand

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	weightedGraph "github.com/openfga/language/pkg/go/graph"

	"github.com/openfga/openfga/internal/concurrency"
	"github.com/openfga/openfga/internal/condition/eval"
	"github.com/openfga/openfga/internal/graph"
	"github.com/openfga/openfga/internal/stack"
	"github.com/openfga/openfga/internal/throttler"
	"github.com/openfga/openfga/internal/throttler/threshold"
	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/logger"
	serverconfig "github.com/openfga/openfga/pkg/server/config"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/telemetry"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

var tracer = otel.Tracer("openfga/pkg/server/commands/reverse_expand")

type ReverseExpandRequest struct {
	StoreID          string
	ObjectType       string
	Relation         string
	User             IsUserRef
	ContextualTuples []*openfgav1.TupleKey // TODO remove
	Context          *structpb.Struct
	Consistency      openfgav1.ConsistencyPreference

	edge              *graph.RelationshipEdge
	skipWeightedGraph bool

	weightedEdge  *weightedGraph.WeightedAuthorizationModelEdge
	relationStack stack.Stack[typeRelEntry]
}

func (r *ReverseExpandRequest) clone() *ReverseExpandRequest {
	if r == nil {
		return nil
	}
	copyRequest := *r
	return &copyRequest
}

type IsUserRef interface {
	isUserRef()
	GetObjectType() string
	String() string
}

type UserRefObject struct {
	Object *openfgav1.Object
}

var _ IsUserRef = (*UserRefObject)(nil)

func (u *UserRefObject) isUserRef() {}

func (u *UserRefObject) GetObjectType() string {
	return u.Object.GetType()
}

func (u *UserRefObject) String() string {
	return tuple.BuildObject(u.Object.GetType(), u.Object.GetId())
}

type UserRefTypedWildcard struct {
	Type string
}

var _ IsUserRef = (*UserRefTypedWildcard)(nil)

func (*UserRefTypedWildcard) isUserRef() {}

func (u *UserRefTypedWildcard) GetObjectType() string {
	return u.Type
}

func (u *UserRefTypedWildcard) String() string {
	return tuple.TypedPublicWildcard(u.Type)
}

type UserRefObjectRelation struct {
	ObjectRelation *openfgav1.ObjectRelation
	Condition      *openfgav1.RelationshipCondition
}

func (*UserRefObjectRelation) isUserRef() {}

func (u *UserRefObjectRelation) GetObjectType() string {
	return tuple.GetType(u.ObjectRelation.GetObject())
}

func (u *UserRefObjectRelation) String() string {
	return tuple.ToObjectRelationString(
		u.ObjectRelation.GetObject(),
		u.ObjectRelation.GetRelation(),
	)
}

type UserRef struct {

	// Types that are assignable to Ref
	//  *UserRef_Object
	//  *UserRef_TypedWildcard
	//  *UserRef_ObjectRelation
	Ref IsUserRef
}

type ReverseExpandQuery struct {
	logger                  logger.Logger
	datastore               storage.RelationshipTupleReader
	typesystem              *typesystem.TypeSystem
	resolveNodeLimit        uint32
	resolveNodeBreadthLimit uint32

	dispatchThrottlerConfig threshold.Config

	// visitedUsersetsMap map prevents visiting the same userset through the same edge twice
	visitedUsersetsMap *sync.Map
	// candidateObjectsMap map prevents returning the same object twice
	candidateObjectsMap *sync.Map

	// queryDedupeMap prevents multiple branches of exploration from running
	// the same queries, since multiple leaf nodes can have a common ancestor
	queryDedupeMap *sync.Map

	// localCheckResolver allows reverse expand to call check locally
	localCheckResolver   graph.CheckRewriteResolver
	optimizationsEnabled bool
}

type ReverseExpandQueryOption func(d *ReverseExpandQuery)

func WithResolveNodeLimit(limit uint32) ReverseExpandQueryOption {
	return func(d *ReverseExpandQuery) {
		d.resolveNodeLimit = limit
	}
}

func WithDispatchThrottlerConfig(config threshold.Config) ReverseExpandQueryOption {
	return func(d *ReverseExpandQuery) {
		d.dispatchThrottlerConfig = config
	}
}

func WithResolveNodeBreadthLimit(limit uint32) ReverseExpandQueryOption {
	return func(d *ReverseExpandQuery) {
		d.resolveNodeBreadthLimit = limit
	}
}

func WithCheckResolver(resolver graph.CheckResolver) ReverseExpandQueryOption {
	return func(d *ReverseExpandQuery) {
		localCheckResolver, found := graph.LocalCheckResolver(resolver)
		if found {
			d.localCheckResolver = localCheckResolver
		}
	}
}

func WithListObjectOptimizationsEnabled(enabled bool) ReverseExpandQueryOption {
	return func(d *ReverseExpandQuery) {
		d.optimizationsEnabled = enabled
	}
}

// TODO accept ReverseExpandRequest so we can build the datastore object right away.
func NewReverseExpandQuery(ds storage.RelationshipTupleReader, ts *typesystem.TypeSystem, opts ...ReverseExpandQueryOption) *ReverseExpandQuery {
	query := &ReverseExpandQuery{
		logger:                  logger.NewNoopLogger(),
		datastore:               ds,
		typesystem:              ts,
		resolveNodeLimit:        serverconfig.DefaultResolveNodeLimit,
		resolveNodeBreadthLimit: serverconfig.DefaultResolveNodeBreadthLimit,
		dispatchThrottlerConfig: threshold.Config{
			Throttler:    throttler.NewNoopThrottler(),
			Enabled:      serverconfig.DefaultListObjectsDispatchThrottlingEnabled,
			Threshold:    serverconfig.DefaultListObjectsDispatchThrottlingDefaultThreshold,
			MaxThreshold: serverconfig.DefaultListObjectsDispatchThrottlingMaxThreshold,
		},
		candidateObjectsMap: new(sync.Map),
		visitedUsersetsMap:  new(sync.Map),
		queryDedupeMap:      new(sync.Map),
		localCheckResolver:  graph.NewLocalChecker(),
	}

	for _, opt := range opts {
		opt(query)
	}

	return query
}

type ConditionalResultStatus int

const (
	RequiresFurtherEvalStatus ConditionalResultStatus = iota
	NoFurtherEvalStatus
)

type ReverseExpandResult struct {
	Object       string
	ResultStatus ConditionalResultStatus
}

type ResolutionMetadata struct {
	// The number of times we are expanding from each node to find set of objects
	DispatchCounter *atomic.Uint32

	// WasThrottled indicates whether the request was throttled
	WasThrottled *atomic.Bool

	// WasWeightedGraphUsed indicates whether the weighted graph was used as the algorithm for the ReverseExpand request.
	WasWeightedGraphUsed *atomic.Bool

	// The number of times internal check was called for the optimization path
	CheckCounter *atomic.Uint32
}

func NewResolutionMetadata() *ResolutionMetadata {
	return &ResolutionMetadata{
		DispatchCounter:      new(atomic.Uint32),
		WasThrottled:         new(atomic.Bool),
		WasWeightedGraphUsed: new(atomic.Bool),
		CheckCounter:         new(atomic.Uint32),
	}
}

func WithLogger(logger logger.Logger) ReverseExpandQueryOption {
	return func(d *ReverseExpandQuery) {
		d.logger = logger
	}
}

// shallowClone creates an identical copy of reverseExpandQuery except
// candidateObjectsMap as list object candidates need to be validated
// via check.
func (c *ReverseExpandQuery) shallowClone() *ReverseExpandQuery {
	if c == nil {
		return nil
	}
	copy := *c
	copy.candidateObjectsMap = new(sync.Map)
	return &copy
}

// Execute yields all the objects of the provided objectType that the
// given user possibly has, a specific relation with and sends those
// objects to resultChan. It MUST guarantee no duplicate objects sent.
//
// This function respects context timeouts and cancellations. If an
// error is encountered (e.g. context timeout) before resolving all
// objects, then the provided channel will NOT be closed, and it will
// return the error.
//
// If no errors occur, then Execute will yield all of the objects on
// the provided channel and then close the channel to signal that it
// is done.
func (c *ReverseExpandQuery) Execute(
	ctx context.Context,
	req *ReverseExpandRequest,
	resultChan chan<- *ReverseExpandResult,
	resolutionMetadata *ResolutionMetadata,
) error {
	ctx = storage.ContextWithRelationshipTupleReader(ctx, c.datastore)
	err := c.execute(ctx, req, resultChan, false, resolutionMetadata)
	if err != nil {
		return err
	}

	close(resultChan)
	return nil
}

func (c *ReverseExpandQuery) dispatch(
	ctx context.Context,
	req *ReverseExpandRequest,
	resultChan chan<- *ReverseExpandResult,
	intersectionOrExclusionInPreviousEdges bool,
	resolutionMetadata *ResolutionMetadata,
) error {
	newcount := resolutionMetadata.DispatchCounter.Add(1)
	if c.dispatchThrottlerConfig.Enabled {
		c.throttle(ctx, newcount, resolutionMetadata)
	}
	return c.execute(ctx, req, resultChan, intersectionOrExclusionInPreviousEdges, resolutionMetadata)
}

func (c *ReverseExpandQuery) execute(
	ctx context.Context,
	req *ReverseExpandRequest,
	resultChan chan<- *ReverseExpandResult,
	intersectionOrExclusionInPreviousEdges bool,
	resolutionMetadata *ResolutionMetadata,
) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}

	ctx, span := tracer.Start(ctx, "reverseExpand.Execute", trace.WithAttributes(
		attribute.String("target_type", req.ObjectType),
		attribute.String("target_relation", req.Relation),
		attribute.String("source", req.User.String()),
	))
	defer span.End()

	if req.edge != nil {
		span.SetAttributes(attribute.String("edge", req.edge.String()))
	}

	depth, ok := graph.ResolutionDepthFromContext(ctx)
	if !ok {
		ctx = graph.ContextWithResolutionDepth(ctx, 0)
	} else {
		if depth >= c.resolveNodeLimit {
			return graph.ErrResolutionDepthExceeded
		}

		ctx = graph.ContextWithResolutionDepth(ctx, depth+1)
	}

	var sourceUserRef *openfgav1.RelationReference
	var sourceUserType, sourceUserObj string

	// e.g. 'user:bob'
	if val, ok := req.User.(*UserRefObject); ok {
		sourceUserType = val.Object.GetType()
		sourceUserObj = tuple.BuildObject(sourceUserType, val.Object.GetId())
		sourceUserRef = typesystem.DirectRelationReference(sourceUserType, "")
	}

	// e.g. 'user:*'
	if val, ok := req.User.(*UserRefTypedWildcard); ok {
		sourceUserType = val.Type
		sourceUserRef = typesystem.WildcardRelationReference(sourceUserType)
	}

	// e.g. 'group:eng#member'
	if userset, ok := req.User.(*UserRefObjectRelation); ok {
		sourceUserType = tuple.GetType(userset.ObjectRelation.GetObject())
		sourceUserObj = userset.ObjectRelation.GetObject()
		sourceUserRef = typesystem.DirectRelationReference(sourceUserType, userset.ObjectRelation.GetRelation())

		// Queries that come in explicitly looking for userset relations will skip weighted graph for now.
		// e.g. ListObjects(document, viewer, team:fga#member)
		req.skipWeightedGraph = true

		if req.edge != nil {
			key := fmt.Sprintf("%s#%s", sourceUserObj, req.edge.String())
			if _, loaded := c.visitedUsersetsMap.LoadOrStore(key, struct{}{}); loaded {
				// we've already visited this userset through this edge, exit to avoid an infinite cycle
				return nil
			}
		}

		// ReverseExpand(type=document, rel=viewer, user=document:1#viewer) will return "document:1"
		if tuple.UsersetMatchTypeAndRelation(userset.String(), req.Relation, req.ObjectType) {
			c.trySendCandidate(ctx, intersectionOrExclusionInPreviousEdges, sourceUserObj, resultChan)
		}
	}

	targetObjRef := typesystem.DirectRelationReference(req.ObjectType, req.Relation)

	if c.optimizationsEnabled && !req.skipWeightedGraph {
		var typeRel string
		if req.weightedEdge != nil {
			typeRel = req.weightedEdge.GetTo().GetUniqueLabel()
		} else { // true on first call to ReverseExpand
			typeRel = tuple.ToObjectRelationString(targetObjRef.GetType(), targetObjRef.GetRelation())
			node, ok := c.typesystem.GetNode(typeRel)
			if !ok {
				// The weighted graph is not guaranteed to be present.
				// If there's no weighted graph, which can happen for models with disconnected types, we will log an error below
				// and then fall back to the non-weighted version of reverse_expand
				c.logger.InfoWithContext(ctx, "unable to find node in weighted graph", zap.String("node_id", typeRel))
				req.skipWeightedGraph = true
			} else {
				weight, _ := node.GetWeight(sourceUserType)
				if weight == weightedGraph.Infinite {
					c.logger.InfoWithContext(ctx, "reverse_expand graph may contain cycle, skipping weighted graph", zap.String("node_id", typeRel))
					req.skipWeightedGraph = true
				}
			}
		}

		if !req.skipWeightedGraph {
			if req.weightedEdge == nil { // true on the first invocation only
				req.relationStack = stack.Push(nil, typeRelEntry{typeRel: typeRel})
			}

			edges, _ := c.typesystem.GetConnectedEdges(
				typeRel,
				sourceUserType,
			)
			// error should never happen as if the weighted graph failed to build, req.skipWeightedGraph would
			// have prevented us from entering this block

			// Set value to indicate that the weighted graph was used
			resolutionMetadata.WasWeightedGraphUsed.Store(true)

			return c.loopOverEdges(
				ctx,
				req,
				edges,
				intersectionOrExclusionInPreviousEdges,
				resolutionMetadata,
				resultChan,
				sourceUserType,
			)
		}
	}

	g := graph.New(c.typesystem)

	edges, err := g.GetPrunedRelationshipEdges(targetObjRef, sourceUserRef)
	if err != nil {
		return err
	}

	pool := concurrency.NewPool(ctx, int(c.resolveNodeBreadthLimit))

	var errs error

LoopOnEdges:
	for _, edge := range edges {
		innerLoopEdge := edge
		intersectionOrExclusionInPreviousEdges := intersectionOrExclusionInPreviousEdges || innerLoopEdge.TargetReferenceInvolvesIntersectionOrExclusion
		r := &ReverseExpandRequest{
			StoreID:           req.StoreID,
			ObjectType:        req.ObjectType,
			Relation:          req.Relation,
			User:              req.User,
			ContextualTuples:  req.ContextualTuples,
			Context:           req.Context,
			edge:              innerLoopEdge,
			Consistency:       req.Consistency,
			skipWeightedGraph: req.skipWeightedGraph,
		}
		switch innerLoopEdge.Type {
		case graph.DirectEdge:
			pool.Go(func(ctx context.Context) error {
				return c.reverseExpandDirect(ctx, r, resultChan, intersectionOrExclusionInPreviousEdges, resolutionMetadata)
			})
		case graph.ComputedUsersetEdge:
			// follow the computed_userset edge, no new goroutine needed since it's not I/O intensive
			r.User = &UserRefObjectRelation{
				ObjectRelation: &openfgav1.ObjectRelation{
					Object:   sourceUserObj,
					Relation: innerLoopEdge.TargetReference.GetRelation(),
				},
			}
			err = c.dispatch(ctx, r, resultChan, intersectionOrExclusionInPreviousEdges, resolutionMetadata)
			if err != nil {
				errs = errors.Join(errs, err)
				break LoopOnEdges
			}
		case graph.TupleToUsersetEdge:
			pool.Go(func(ctx context.Context) error {
				return c.reverseExpandTupleToUserset(ctx, r, resultChan, intersectionOrExclusionInPreviousEdges, resolutionMetadata)
			})
		default:
			return fmt.Errorf("unsupported edge type: %v", innerLoopEdge.Type)
		}
	}

	errs = errors.Join(errs, pool.Wait())
	if errs != nil {
		telemetry.TraceError(span, errs)
		return errs
	}

	return nil
}

func (c *ReverseExpandQuery) reverseExpandTupleToUserset(
	ctx context.Context,
	req *ReverseExpandRequest,
	resultChan chan<- *ReverseExpandResult,
	intersectionOrExclusionInPreviousEdges bool,
	resolutionMetadata *ResolutionMetadata,
) error {
	ctx, span := tracer.Start(ctx, "reverseExpandTupleToUserset", trace.WithAttributes(
		attribute.String("edge", req.edge.String()),
		attribute.String("source.user", req.User.String()),
	))
	var err error
	defer func() {
		if err != nil {
			telemetry.TraceError(span, err)
		}
		span.End()
	}()

	err = c.readTuplesAndExecute(ctx, req, resultChan, intersectionOrExclusionInPreviousEdges, resolutionMetadata)
	return err
}

func (c *ReverseExpandQuery) reverseExpandDirect(
	ctx context.Context,
	req *ReverseExpandRequest,
	resultChan chan<- *ReverseExpandResult,
	intersectionOrExclusionInPreviousEdges bool,
	resolutionMetadata *ResolutionMetadata,
) error {
	ctx, span := tracer.Start(ctx, "reverseExpandDirect", trace.WithAttributes(
		attribute.String("edge", req.edge.String()),
		attribute.String("source.user", req.User.String()),
	))
	var err error
	defer func() {
		if err != nil {
			telemetry.TraceError(span, err)
		}
		span.End()
	}()

	err = c.readTuplesAndExecute(ctx, req, resultChan, intersectionOrExclusionInPreviousEdges, resolutionMetadata)
	return err
}

func (c *ReverseExpandQuery) shouldCheckPublicAssignable(targetReference *openfgav1.RelationReference, userRef IsUserRef) (bool, error) {
	_, userIsUserset := userRef.(*UserRefObjectRelation)
	if userIsUserset {
		// if the user is an userset, by definition it is not public assignable
		return false, nil
	}
	publiclyAssignable, err := c.typesystem.IsPubliclyAssignable(targetReference, userRef.GetObjectType())
	if err != nil {
		return false, err
	}
	return publiclyAssignable, nil
}

func (c *ReverseExpandQuery) readTuplesAndExecute(
	ctx context.Context,
	req *ReverseExpandRequest,
	resultChan chan<- *ReverseExpandResult,
	intersectionOrExclusionInPreviousEdges bool,
	resolutionMetadata *ResolutionMetadata,
) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}

	ctx, span := tracer.Start(ctx, "readTuplesAndExecute")
	defer span.End()

	var userFilter []*openfgav1.ObjectRelation
	var relationFilter string

	switch req.edge.Type {
	case graph.DirectEdge:
		relationFilter = req.edge.TargetReference.GetRelation()
		targetUserObjectType := req.User.GetObjectType()

		publiclyAssignable, err := c.shouldCheckPublicAssignable(req.edge.TargetReference, req.User)
		if err != nil {
			return err
		}

		if publiclyAssignable {
			// e.g. 'user:*'
			userFilter = append(userFilter, &openfgav1.ObjectRelation{
				Object: tuple.TypedPublicWildcard(targetUserObjectType),
			})
		}

		// e.g. 'user:bob'
		if val, ok := req.User.(*UserRefObject); ok {
			userFilter = append(userFilter, &openfgav1.ObjectRelation{
				Object: tuple.BuildObject(val.Object.GetType(), val.Object.GetId()),
			})
		}

		// e.g. 'group:eng#member'
		if val, ok := req.User.(*UserRefObjectRelation); ok {
			userFilter = append(userFilter, val.ObjectRelation)
		}
	case graph.TupleToUsersetEdge:
		relationFilter = req.edge.TuplesetRelation
		// a TTU edge can only have a userset as a source node
		// e.g. 'group:eng#member'
		if val, ok := req.User.(*UserRefObjectRelation); ok {
			userFilter = append(userFilter, &openfgav1.ObjectRelation{
				Object: val.ObjectRelation.GetObject(),
			})
		} else {
			panic("unexpected source for reverse expansion of tuple to userset")
		}
	default:
		panic("unsupported edge type")
	}

	// find all tuples of the form req.edge.TargetReference.Type:...#relationFilter@userFilter
	iter, err := c.datastore.ReadStartingWithUser(ctx, req.StoreID, storage.ReadStartingWithUserFilter{
		ObjectType: req.edge.TargetReference.GetType(),
		Relation:   relationFilter,
		UserFilter: userFilter,
	}, storage.ReadStartingWithUserOptions{
		Consistency: storage.ConsistencyOptions{
			Preference: req.Consistency,
		},
	})
	if err != nil {
		return err
	}

	// filter out invalid tuples yielded by the database iterator
	filteredIter := storage.NewFilteredTupleKeyIterator(
		storage.NewTupleKeyIteratorFromTupleIterator(iter),
		validation.FilterInvalidTuples(c.typesystem),
	)
	defer filteredIter.Stop()

	pool := concurrency.NewPool(ctx, int(c.resolveNodeBreadthLimit))

	var errs error

LoopOnIterator:
	for {
		tk, err := filteredIter.Next(ctx)
		if err != nil {
			if errors.Is(err, storage.ErrIteratorDone) {
				break
			}
			errs = errors.Join(errs, err)
			break LoopOnIterator
		}

		cond, _ := c.typesystem.GetCondition(tk.GetCondition().GetName())
		condMet, err := eval.EvaluateTupleCondition(ctx, tk, cond, req.Context)
		if err != nil {
			errs = errors.Join(errs, err)
			continue
		}

		if !condMet {
			continue
		}

		foundObject := tk.GetObject()
		var newRelation string

		switch req.edge.Type {
		case graph.DirectEdge:
			newRelation = tk.GetRelation()
		case graph.TupleToUsersetEdge:
			newRelation = req.edge.TargetReference.GetRelation()
		default:
			panic("unsupported edge type")
		}

		pool.Go(func(ctx context.Context) error {
			return c.dispatch(ctx, &ReverseExpandRequest{
				StoreID:    req.StoreID,
				ObjectType: req.ObjectType,
				Relation:   req.Relation,
				User: &UserRefObjectRelation{
					ObjectRelation: &openfgav1.ObjectRelation{
						Object:   foundObject,
						Relation: newRelation,
					},
					Condition: tk.GetCondition(),
				},
				ContextualTuples: req.ContextualTuples,
				Context:          req.Context,
				edge:             req.edge,
				Consistency:      req.Consistency,
			}, resultChan, intersectionOrExclusionInPreviousEdges, resolutionMetadata)
		})
	}

	errs = errors.Join(errs, pool.Wait())
	if errs != nil {
		telemetry.TraceError(span, errs)
		return errs
	}

	return nil
}

func (c *ReverseExpandQuery) trySendCandidate(
	ctx context.Context,
	intersectionOrExclusionInPreviousEdges bool,
	candidateObject string,
	candidateChan chan<- *ReverseExpandResult,
) {
	_, span := tracer.Start(ctx, "trySendCandidate", trace.WithAttributes(
		attribute.String("object", candidateObject),
		attribute.Bool("sent", false),
	))
	defer span.End()

	if _, ok := c.candidateObjectsMap.LoadOrStore(candidateObject, struct{}{}); !ok {
		resultStatus := NoFurtherEvalStatus
		if intersectionOrExclusionInPreviousEdges {
			span.SetAttributes(attribute.Bool("requires_further_eval", true))
			resultStatus = RequiresFurtherEvalStatus
		}

		result := &ReverseExpandResult{Object: candidateObject, ResultStatus: resultStatus}
		ok = concurrency.TrySendThroughChannel(ctx, result, candidateChan)
		if ok {
			span.SetAttributes(attribute.Bool("sent", true))
		}
	}
}

func (c *ReverseExpandQuery) throttle(ctx context.Context, currentNumDispatch uint32, metadata *ResolutionMetadata) {
	span := trace.SpanFromContext(ctx)

	shouldThrottle := threshold.ShouldThrottle(
		ctx,
		currentNumDispatch,
		c.dispatchThrottlerConfig.Threshold,
		c.dispatchThrottlerConfig.MaxThreshold,
	)

	span.SetAttributes(
		attribute.Int("dispatch_count", int(currentNumDispatch)),
		attribute.Bool("is_throttled", shouldThrottle))

	if shouldThrottle {
		metadata.WasThrottled.Store(true)
		c.dispatchThrottlerConfig.Throttler.Throttle(ctx)
	}
}
