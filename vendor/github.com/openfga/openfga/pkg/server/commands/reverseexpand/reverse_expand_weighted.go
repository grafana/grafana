package reverseexpand

import (
	"context"
	"errors"
	"fmt"
	"sync"

	aq "github.com/emirpasic/gods/queues/arrayqueue"
	"go.opentelemetry.io/otel/trace"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	weightedGraph "github.com/openfga/language/pkg/go/graph"

	"github.com/openfga/openfga/internal/checkutil"
	"github.com/openfga/openfga/internal/concurrency"
	"github.com/openfga/openfga/internal/graph"
	"github.com/openfga/openfga/internal/stack"
	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/telemetry"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

const (
	listObjectsResultChannelLength = 100
)

var (
	ErrEmptyStack           = errors.New("unexpected empty stack")
	ErrLowestWeightFail     = errors.New("failed to get lowest weight edge")
	ErrConstructUsersetFail = errors.New("failed to construct userset")
)

type ExecutionError struct {
	operation string
	object    string
	relation  string
	user      string
	cause     error
}

func (e *ExecutionError) Error() string {
	return fmt.Sprintf("failed to execute: operation: %s: object: %s: relation: %s: user: %s: cause: %s",
		e.operation,
		e.object,
		e.relation,
		e.user,
		e.cause.Error(),
	)
}

// typeRelEntry represents a step in the path taken to reach a leaf node.
// As reverseExpand traverses from a requested type#rel to its leaf nodes, it stack.Pushes typeRelEntry structs to a stack.
// After reaching a leaf, this stack is consumed by the `queryForTuples` function to build the precise chain of
// database queries needed to find the resulting objects.
type typeRelEntry struct {
	typeRel string // e.g. "organization#admin"

	// Only present for userset relations. Will be the userset relation string itself.
	// For `rel admin: [team#member]`, usersetRelation is "member"
	usersetRelation string
}

// queryJob represents a single task in the reverse expansion process.
// It holds the `foundObject` from a previous step in the traversal
// and the `ReverseExpandRequest` containing the current state of the request.
type queryJob struct {
	foundObject string
	req         *ReverseExpandRequest
}

// jobQueue is a thread-safe queue for managing `queryJob` instances.
// It's used to hold jobs that need to be processed during the recursive
// `queryForTuples` operation, allowing concurrent processing of branches
// in the authorization graph.
type jobQueue struct {
	queue aq.Queue
	mu    sync.Mutex
}

func newJobQueue() *jobQueue {
	return &jobQueue{queue: *aq.New()}
}

func (q *jobQueue) Empty() bool {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.queue.Empty()
}

func (q *jobQueue) enqueue(value ...queryJob) {
	q.mu.Lock()
	defer q.mu.Unlock()
	for _, item := range value {
		q.queue.Enqueue(item)
	}
}

func (q *jobQueue) dequeue() (queryJob, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()

	val, ok := q.queue.Dequeue()
	if !ok {
		return queryJob{}, false
	}
	job, ok := val.(queryJob)
	if !ok {
		return queryJob{}, false
	}

	return job, true
}

// loopOverEdges iterates over a set of weightedGraphEdges and acts as a dispatcher,
// processing each edge according to its type to continue the reverse expansion process.
//
// While traversing, loopOverEdges appends relation entries to a stack for use in querying after traversal is complete.
// It will continue to dispatch and traverse the graph until it reaches a DirectEdge, which
// leads to a leaf node in the authorization graph. Once a DirectEdge is found, loopOverEdges invokes
// queryForTuples, passing it the stack of relations it constructed on the way to that particular leaf.
//
// For each edge, it creates a new ReverseExpandRequest, preserving the context of the overall query
// but updating the traversal state (the 'stack') based on the edge being processed.
//
// The behavior is determined by the edge type:
//
//   - DirectEdge: This represents a direct path to data. Here we initiate a call to
//     `queryForTuples` to query the datastore for tuples that match the relationship path
//     accumulated in the stack. This is the end of the traversal.
//
//   - ComputedEdge, RewriteEdge, and TTUEdge: These represent indirections in the authorization model.
//     The function modifies the traversal 'stack' to reflect the next relationship that needs to be resolved.
//     It then calls `dispatch` to continue traversing the graph with this new state until it reaches a DirectEdge.
func (c *ReverseExpandQuery) loopOverEdges(
	ctx context.Context,
	req *ReverseExpandRequest,
	edges []*weightedGraph.WeightedAuthorizationModelEdge,
	needsCheck bool,
	resolutionMetadata *ResolutionMetadata,
	resultChan chan<- *ReverseExpandResult,
	sourceUserType string,
) error {
	pool := concurrency.NewPool(ctx, int(c.resolveNodeBreadthLimit))

	for _, edge := range edges {
		newReq := req.clone()
		newReq.weightedEdge = edge

		toNode := edge.GetTo()
		goingToUserset := toNode.GetNodeType() == weightedGraph.SpecificTypeAndRelation

		// Going to a userset presents risk of infinite loop. Checking the edge and the traversal stack
		// ensures we don't perform the same traversal multiple times.
		if goingToUserset {
			key := edge.GetFrom().GetUniqueLabel() + toNode.GetUniqueLabel() + edge.GetTuplesetRelation() + stack.String(newReq.relationStack)
			_, loaded := c.visitedUsersetsMap.LoadOrStore(key, struct{}{})
			if loaded {
				// we've already visited this userset through this edge, exit to avoid an infinite cycle
				continue
			}
		}

		switch edge.GetEdgeType() {
		case weightedGraph.DirectEdge:
			if goingToUserset {
				// Attach the userset relation to the previous stack entry
				//  type team:
				//		define member: [user]
				//	type org:
				//		define teammate: [team#member]
				// A direct edge here is org#teammate --> team#member
				// so if we find team:fga for this user, we need to know to check for
				// team:fga#member when we check org#teammate
				if newReq.relationStack == nil {
					return ErrEmptyStack
				}
				entry, newStack := stack.Pop(newReq.relationStack)
				entry.usersetRelation = tuple.GetRelation(toNode.GetUniqueLabel())

				newStack = stack.Push(newStack, entry)
				newStack = stack.Push(newStack, typeRelEntry{typeRel: toNode.GetUniqueLabel()})
				newReq.relationStack = newStack

				// Now continue traversing
				pool.Go(func(ctx context.Context) error {
					return c.dispatch(ctx, newReq, resultChan, needsCheck, resolutionMetadata)
				})
				continue
			}

			// We have reached a leaf node in the graph (e.g. `user` or `user:*`),
			// and the traversal for this path is complete. Now we use the stack of relations
			// we've built to query the datastore for matching tuples.
			pool.Go(func(ctx context.Context) error {
				return c.queryForTuples(
					ctx,
					newReq,
					needsCheck,
					resultChan,
					"",
				)
			})
		case weightedGraph.ComputedEdge:
			// A computed edge is an alias (e.g., `define viewer: editor`).
			// We replace the current relation on the stack (`viewer`) with the computed one (`editor`),
			// as tuples are only written against `editor`.
			if toNode.GetNodeType() != weightedGraph.OperatorNode {
				if newReq.relationStack == nil {
					return ErrEmptyStack
				}
				_, newStack := stack.Pop(newReq.relationStack)
				newStack = stack.Push(newStack, typeRelEntry{typeRel: toNode.GetUniqueLabel()})
				newReq.relationStack = newStack
			}

			pool.Go(func(ctx context.Context) error {
				return c.dispatch(ctx, newReq, resultChan, needsCheck, resolutionMetadata)
			})
		case weightedGraph.TTUEdge:
			// Replace the existing type#rel on the stack with the tuple-to-userset relation:
			//
			// 	type document
			//		define parent: [folder]
			//		define viewer: admin from parent
			//
			// We need to remove document#viewer from the stack and replace it with the tupleset relation (`document#parent`).
			// Then we have to add the .To() relation `folder#admin`.
			// The stack becomes `[document#parent, folder#admin]`, and on evaluation we will first
			// query for folder#admin, then if folders exist we will see if they are related to
			// any documents as #parent.
			if newReq.relationStack == nil {
				return ErrEmptyStack
			}
			_, newStack := stack.Pop(newReq.relationStack)

			// stack.Push tupleset relation (`document#parent`)
			tuplesetRel := typeRelEntry{typeRel: edge.GetTuplesetRelation()}
			newStack = stack.Push(newStack, tuplesetRel)

			// stack.Push target type#rel (`folder#admin`)
			newStack = stack.Push(newStack, typeRelEntry{typeRel: toNode.GetUniqueLabel()})
			newReq.relationStack = newStack

			pool.Go(func(ctx context.Context) error {
				return c.dispatch(ctx, newReq, resultChan, needsCheck, resolutionMetadata)
			})
		case weightedGraph.RewriteEdge:
			// Behaves just like ComputedEdge above
			// Operator nodes (union, intersection, exclusion) are not real types, they never get added
			// to the stack.
			if toNode.GetNodeType() != weightedGraph.OperatorNode {
				if newReq.relationStack == nil {
					return ErrEmptyStack
				}
				_, newStack := stack.Pop(newReq.relationStack)
				newStack = stack.Push(newStack, typeRelEntry{typeRel: toNode.GetUniqueLabel()})
				newReq.relationStack = newStack

				pool.Go(func(ctx context.Context) error {
					return c.dispatch(ctx, newReq, resultChan, needsCheck, resolutionMetadata)
				})
				// continue to the next edge
				break
			}

			// If the edge is an operator node, we need to handle it differently.
			switch toNode.GetLabel() {
			case weightedGraph.IntersectionOperator:
				err := c.intersectionHandler(pool, newReq, resultChan, toNode, sourceUserType, resolutionMetadata)
				if err != nil {
					return err
				}
			case weightedGraph.ExclusionOperator:
				err := c.exclusionHandler(ctx, pool, newReq, resultChan, toNode, sourceUserType, resolutionMetadata)
				if err != nil {
					return err
				}
			case weightedGraph.UnionOperator:
				pool.Go(func(ctx context.Context) error {
					return c.dispatch(ctx, newReq, resultChan, needsCheck, resolutionMetadata)
				})
			default:
				return fmt.Errorf("unsupported operator node: %s", toNode.GetLabel())
			}
		case weightedGraph.TTULogicalEdge, weightedGraph.DirectLogicalEdge:
			pool.Go(func(ctx context.Context) error {
				return c.dispatch(ctx, newReq, resultChan, needsCheck, resolutionMetadata)
			})
		default:
			return fmt.Errorf("unsupported edge type: %v", edge.GetEdgeType())
		}
	}

	// In order to maintain the current ListObjects behavior, in the case of timeout in reverse_expand_weighted
	// we will return partial results.
	// For more detail, see here: https://openfga.dev/api/service#/Relationship%20Queries/ListObjects
	err := pool.Wait()
	if err != nil {
		var executionError *ExecutionError
		if errors.As(err, &executionError) {
			if errors.Is(executionError.cause, context.Canceled) || errors.Is(executionError.cause, context.DeadlineExceeded) {
				return nil
			}
		}
	}
	return err
}

// queryForTuples performs all datastore-related reverse expansion logic. After a leaf node has been found in loopOverEdges,
// this function works backwards from a specified user (using the stack created in loopOverEdges)
// and an initial relationship edge to find all the objects that the given user has the given relationship with.
//
// This function orchestrates the concurrent execution of individual query jobs. It initializes a memoization
// map (`jobDedupeMap`) to prevent redundant database queries and a job queue to manage pending tasks.
// It kicks off the initial query and then continuously processes jobs from the queue using a concurrency pool
// until all branches leading up from the leaf have been explored.
func (c *ReverseExpandQuery) queryForTuples(
	ctx context.Context,
	req *ReverseExpandRequest,
	needsCheck bool,
	resultChan chan<- *ReverseExpandResult,
	foundObject string,
) error {
	span := trace.SpanFromContext(ctx)

	queryJobQueue := newJobQueue()

	// Now kick off the chain of queries
	items, err := c.executeQueryJob(ctx, queryJob{req: req, foundObject: foundObject}, resultChan, needsCheck)
	if err != nil {
		telemetry.TraceError(span, err)
		return err
	}

	// Populate the jobQueue with the initial jobs
	queryJobQueue.enqueue(items...)

	// We could potentially have c.resolveNodeBreadthLimit active routines reaching this point.
	// Limit querying routines to avoid explosion of routines.
	pool := concurrency.NewPool(ctx, int(c.resolveNodeBreadthLimit))

	for !queryJobQueue.Empty() {
		job, ok := queryJobQueue.dequeue()
		if !ok {
			// this shouldn't be possible
			return nil
		}

		// Each goroutine will take its first job from the original queue above
		// and then continue generating and processing jobs until there are no more.
		pool.Go(func(ctx context.Context) error {
			localQueue := newJobQueue()
			localQueue.enqueue(job)

			// While this goroutine's queue has items, keep looking for more
			for !localQueue.Empty() {
				nextJob, ok := localQueue.dequeue()
				if !ok {
					break
				}
				newItems, err := c.executeQueryJob(ctx, nextJob, resultChan, needsCheck)
				if err != nil {
					return err
				}
				localQueue.enqueue(newItems...)
			}

			return nil
		})
	}

	err = pool.Wait()
	if err != nil {
		telemetry.TraceError(span, err)
		return err
	}

	return nil
}

// executeQueryJob represents a single recursive step in the reverse expansion query process.
// It takes a `queryJob`, which encapsulates the current state of the traversal (found object,
// and the reverse expand request with its relation stack).
// The method constructs a database query based on the current relation at the top of the stack
// and the `foundObject` from the previous step. It queries the datastore, and for each result:
//   - If the relation stack is empty, it means a candidate object has been found, which is then sent to `resultChan`.
//   - If matching tuples are found, it prepares new `queryJob` instances to continue the traversal further up the graph,
//     using the newly found object as the `foundObject` for the next step.
//   - If no matching objects are found in the datastore, this branch of reverse expand is a dead end, and no more jobs are needed.
func (c *ReverseExpandQuery) executeQueryJob(
	ctx context.Context,
	job queryJob,
	resultChan chan<- *ReverseExpandResult,
	needsCheck bool,
) ([]queryJob, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}

	// Ensure we're always working with a copy
	currentReq := job.req.clone()

	userFilter, err := buildUserFilter(currentReq, job.foundObject)
	if err != nil {
		return nil, err
	}

	if currentReq.relationStack == nil {
		return nil, ErrEmptyStack
	}

	// Now pop the top relation off of the stack for querying
	entry, newStack := stack.Pop(currentReq.relationStack)
	typeRel := entry.typeRel

	currentReq.relationStack = newStack

	objectType, relation := tuple.SplitObjectRelation(typeRel)

	filteredIter, err := c.buildFilteredIterator(ctx, currentReq, objectType, relation, userFilter)
	if err != nil {
		return nil, err
	}
	defer filteredIter.Stop()

	var nextJobs []queryJob

	for {
		tupleKey, err := filteredIter.Next(ctx)
		if err != nil {
			if errors.Is(err, storage.ErrIteratorDone) {
				break
			}
			return nil, err
		}

		// This will be a "type:id" e.g. "document:roadmap"
		foundObject := tupleKey.GetObject()

		// If there are no more type#rel to look for in the stack that means we have hit the base case
		// and this object is a candidate for return to the user.
		if currentReq.relationStack == nil {
			c.trySendCandidate(ctx, needsCheck, foundObject, resultChan)
			continue
		}

		// For non-recursive relations (majority of cases), if there are more items on the stack, we continue
		// the evaluation one level higher up the tree with the `foundObject`.
		nextJobs = append(nextJobs, queryJob{foundObject: foundObject, req: currentReq})
	}

	return nextJobs, err
}

func buildUserFilter(
	req *ReverseExpandRequest,
	object string,
) ([]*openfgav1.ObjectRelation, error) {
	var filter *openfgav1.ObjectRelation
	// This is true on every call to queryFunc except the first, since we only trigger subsequent
	// calls if we successfully found an object.
	if object != "" {
		if req.relationStack == nil {
			return nil, ErrEmptyStack
		}

		entry := stack.Peek(req.relationStack)
		filter = &openfgav1.ObjectRelation{Object: object}
		if entry.usersetRelation != "" {
			filter.Relation = entry.usersetRelation
		}
	} else {
		// This else block ONLY hits on the first call to queryFunc.
		toNode := req.weightedEdge.GetTo()

		switch toNode.GetNodeType() {
		case weightedGraph.SpecificType: // Direct User Reference. To() -> "user"
			// req.User will always be either a UserRefObject or UserRefTypedWildcard here. Queries that come in for
			// pure usersets do not take this code path. e.g. ListObjects(team:fga#member, document, viewer) will not make it here.
			var userID string
			val, ok := req.User.(*UserRefObject)
			if ok {
				userID = val.Object.GetId()
			} else {
				// It might be a wildcard user, which is ok
				_, ok = req.User.(*UserRefTypedWildcard)
				if !ok {
					return nil, fmt.Errorf("unexpected user type when building User filter: %T", val)
				}
				return []*openfgav1.ObjectRelation{}, nil
			}

			filter = &openfgav1.ObjectRelation{Object: tuple.BuildObject(toNode.GetUniqueLabel(), userID)}

		case weightedGraph.SpecificTypeWildcard: // Wildcard Referece To() -> "user:*"
			filter = &openfgav1.ObjectRelation{Object: toNode.GetUniqueLabel()}
		}
	}

	return []*openfgav1.ObjectRelation{filter}, nil
}

// buildFilteredIterator constructs the iterator used when reverse_expand queries for tuples.
// The returned iterator MUST have .Stop() called on it.
func (c *ReverseExpandQuery) buildFilteredIterator(
	ctx context.Context,
	req *ReverseExpandRequest,
	objectType string,
	relation string,
	userFilter []*openfgav1.ObjectRelation,
) (storage.TupleKeyIterator, error) {
	iter, err := c.datastore.ReadStartingWithUser(ctx, req.StoreID, storage.ReadStartingWithUserFilter{
		ObjectType: objectType,
		Relation:   relation,
		UserFilter: userFilter,
	}, storage.ReadStartingWithUserOptions{
		Consistency: storage.ConsistencyOptions{
			Preference: req.Consistency,
		},
	})
	if err != nil {
		return nil, err
	}

	// filter out invalid tuples yielded by the database iterator
	return storage.NewConditionsFilteredTupleKeyIterator(
		storage.NewFilteredTupleKeyIterator(
			storage.NewTupleKeyIteratorFromTupleIterator(iter),
			validation.FilterInvalidTuples(c.typesystem),
		),
		checkutil.BuildTupleKeyConditionFilter(ctx, req.Context, c.typesystem),
	), nil
}

// findCandidatesForLowestWeightEdge finds the candidate objects for the lowest weight edge for intersection or exclusion.
func (c *ReverseExpandQuery) findCandidatesForLowestWeightEdge(
	pool *concurrency.Pool,
	req *ReverseExpandRequest,
	tmpResultChan chan<- *ReverseExpandResult,
	edge *weightedGraph.WeightedAuthorizationModelEdge,
	sourceUserType string,
	resolutionMetadata *ResolutionMetadata,
) {
	// We need to create a new stack with the top item from the original request's stack
	// and use it to get the candidates for the lowest weight edge.
	// If the edge is a tuple to userset edge, we need to later check the candidates against the
	// original relationStack with the top item removed.
	var topItemStack stack.Stack[typeRelEntry]
	if req.relationStack != nil {
		topItem, newStack := stack.Pop(req.relationStack)
		req.relationStack = newStack
		topItemStack = stack.Push(nil, topItem)
	}

	edges, err := c.typesystem.GetInternalEdges(edge, sourceUserType)
	if err != nil {
		return
	}

	// getting list object candidates from the lowest weight edge and have its result
	// pass through tmpResultChan.
	pool.Go(func(ctx context.Context) error {
		defer close(tmpResultChan)
		// stack with only the top item in it
		newReq := req.clone()
		newReq.relationStack = topItemStack
		err := c.shallowClone().loopOverEdges(
			ctx,
			newReq,
			edges,
			false,
			resolutionMetadata,
			tmpResultChan,
			sourceUserType,
		)
		return err
	})
}

// checkCandidateInfo holds the information (req, userset, relation) needed to construct check request on a candidate object.
type checkCandidateInfo struct {
	req                *ReverseExpandRequest
	userset            *openfgav1.Userset
	relation           string
	isAllowed          bool
	resolutionMetadata *ResolutionMetadata
}

// callCheckForCandidates calls check on the list objects candidate against non lowest weight edges.
func (c *ReverseExpandQuery) callCheckForCandidate(
	ctx context.Context,
	tmpResult *ReverseExpandResult,
	resultChan chan<- *ReverseExpandResult,
	info checkCandidateInfo,
) error {
	info.resolutionMetadata.CheckCounter.Add(1)
	handlerFunc := c.localCheckResolver.CheckRewrite(ctx,
		&graph.ResolveCheckRequest{
			StoreID:              info.req.StoreID,
			AuthorizationModelID: c.typesystem.GetAuthorizationModelID(),
			TupleKey:             tuple.NewTupleKey(tmpResult.Object, info.relation, info.req.User.String()),
			ContextualTuples:     info.req.ContextualTuples,
			Context:              info.req.Context,
			Consistency:          info.req.Consistency,
			RequestMetadata:      graph.NewCheckRequestMetadata(),
		}, info.userset)
	tmpCheckResult, err := handlerFunc(ctx)
	if err != nil {
		operation := "intersection"
		if !info.isAllowed {
			operation = "exclusion"
		}

		return &ExecutionError{
			operation: operation,
			object:    tmpResult.Object,
			relation:  info.relation,
			user:      info.req.User.String(),
			cause:     err,
		}
	}

	// If the allowed value does not match what we expect, we skip this candidate.
	// eg, for intersection we expect the check result to be true
	// and for exclusion we expect the check result to be false.
	if tmpCheckResult.GetAllowed() != info.isAllowed {
		return nil
	}

	// If the original stack only had 1 value, we can trySendCandidate right away (nothing more to check)
	if stack.Len(info.req.relationStack) == 0 {
		c.trySendCandidate(ctx, false, tmpResult.Object, resultChan)
		return nil
	}

	// If the original stack had more than 1 value, we need to query the parent values
	// new stack with top item in stack
	err = c.queryForTuples(ctx, info.req, false, resultChan, tmpResult.Object)
	if err != nil {
		return err
	}
	return nil
}

// callCheckForCandidates calls check on the list objects candidates against non lowest weight edges.
func (c *ReverseExpandQuery) callCheckForCandidates(
	pool *concurrency.Pool,
	tmpResultChan <-chan *ReverseExpandResult,
	resultChan chan<- *ReverseExpandResult,
	info checkCandidateInfo,
) {
	pool.Go(func(ctx context.Context) error {
		// note that we create a separate goroutine pool instead of the main pool
		// to avoid starvation on the main pool as there could be many candidates
		// arriving concurrently.
		tmpResultPool := concurrency.NewPool(ctx, int(c.resolveNodeBreadthLimit))

		for tmpResult := range tmpResultChan {
			tmpResultPool.Go(func(ctx context.Context) error {
				return c.callCheckForCandidate(ctx, tmpResult, resultChan, info)
			})
		}
		return tmpResultPool.Wait()
	})
}

// invoke loopOverWeightedEdges to get list objects candidate. Check
// will then be invoked on the non-lowest weight edges against these
// list objects candidates. If check returns true, then the list
// object candidates are true candidates and will be returned via
// resultChan. If check returns false, then these list object candidates
// are invalid because it does not satisfy all paths for intersection.
func (c *ReverseExpandQuery) intersectionHandler(
	pool *concurrency.Pool,
	req *ReverseExpandRequest,
	resultChan chan<- *ReverseExpandResult,
	intersectionNode *weightedGraph.WeightedAuthorizationModelNode,
	sourceUserType string,
	resolutionMetadata *ResolutionMetadata,
) error {
	if intersectionNode == nil || intersectionNode.GetNodeType() != weightedGraph.OperatorNode || intersectionNode.GetLabel() != weightedGraph.IntersectionOperator {
		return fmt.Errorf("%w: operation: intersection: %s", errors.ErrUnsupported, "invalid intersection node")
	}

	// verify if the node has weight to the sourceUserType

	edges, err := c.typesystem.GetEdgesFromNode(intersectionNode, sourceUserType)
	if err != nil {
		return err
	}

	// when the intersection node has a weight to the sourceUserType then it means all the group edges has weight to the sourceUserType
	intersectionEdges, err := typesystem.GetEdgesForIntersection(edges, sourceUserType)
	if err != nil {
		return fmt.Errorf("%w: operation: intersection: %s", ErrLowestWeightFail, err.Error())
	}

	// note that we should never see a case where no edges to call LO
	// i.e., len(intersectionEdges.LowestEdges) == 0 or we cannot call check (i.e., len(intersectionEdges.SiblingEdges) == 0)
	// because typesystem.GetEdgesFromNode should have returned an error

	tmpResultChan := make(chan *ReverseExpandResult, listObjectsResultChannelLength)
	intersectEdges := intersectionEdges.SiblingEdges
	usersets := make([]*openfgav1.Userset, 0, len(intersectEdges))

	// the check's relation should be the same for all intersect edges.
	// It is derived from the definition's relation of the intersect edge
	checkRelation := ""
	for _, intersectEdge := range intersectEdges {
		// no matter how many direct edges we have, or ttu edges  they for typesystem only required this
		// no matter how many parent types have for the same ttu rel from parent will be only one created in the typesystem
		// for any other case, does not have more than one edge, the logical groupings only occur in direct edges or ttu edges
		userset, err := c.typesystem.ConstructUserset(intersectEdge, sourceUserType)
		if err != nil {
			// this should never happen
			return fmt.Errorf("%w: operation: intersection: %s", ErrConstructUsersetFail, err.Error())
		}
		usersets = append(usersets, userset)
		var intersectRelation string
		_, intersectRelation = tuple.SplitObjectRelation(intersectEdge.GetRelationDefinition())
		if checkRelation != "" && checkRelation != intersectRelation {
			// this should never happen
			return fmt.Errorf("%w: operation: intersection: %s", errors.ErrUnsupported, "multiple relations in intersection is not supported")
		}
		checkRelation = intersectRelation
	}

	var userset *openfgav1.Userset
	switch len(usersets) {
	case 0:
		return fmt.Errorf("%w: empty connected edges", ErrConstructUsersetFail) // defensive; should be handled by the early return above
	case 1:
		userset = usersets[0]
	default:
		userset = typesystem.Intersection(usersets...)
	}

	// Concurrently find candidates and call check on them as they are found
	c.findCandidatesForLowestWeightEdge(pool, req, tmpResultChan, intersectionEdges.LowestEdge, sourceUserType, resolutionMetadata)
	c.callCheckForCandidates(pool, tmpResultChan, resultChan,
		checkCandidateInfo{req: req, userset: userset, relation: checkRelation, isAllowed: true, resolutionMetadata: resolutionMetadata})
	return nil
}

// invoke loopOverWeightedEdges to get list objects candidate. Check
// will then be invoked on the excluded edge against these
// list objects candidates. If check returns false, then the list
// object candidates are true candidates and will be returned via
// resultChan. If check returns true, then these list object candidates
// are invalid because it does not satisfy all paths for exclusion.
func (c *ReverseExpandQuery) exclusionHandler(
	ctx context.Context,
	pool *concurrency.Pool,
	req *ReverseExpandRequest,
	resultChan chan<- *ReverseExpandResult,
	exclusionNode *weightedGraph.WeightedAuthorizationModelNode,
	sourceUserType string,
	resolutionMetadata *ResolutionMetadata,
) error {
	if exclusionNode == nil || exclusionNode.GetNodeType() != weightedGraph.OperatorNode || exclusionNode.GetLabel() != weightedGraph.ExclusionOperator {
		return fmt.Errorf("%w: operation: exclusion: %s", errors.ErrUnsupported, "invalid exclusion node")
	}

	// verify if the node has weight to the sourceUserType
	exclusionEdges, err := c.typesystem.GetEdgesFromNode(exclusionNode, sourceUserType)
	if err != nil {
		return err
	}

	edges, err := typesystem.GetEdgesForExclusion(exclusionEdges, sourceUserType)
	if err != nil {
		return fmt.Errorf("%w: operation: exclusion: %s", ErrLowestWeightFail, err.Error())
	}

	// This means the exclusion edge does not have a path to the terminal type.
	// e.g. `B` in `A but not B` is not relevant to this query.
	if edges.ExcludedEdge == nil {
		baseEdges, err := c.typesystem.GetInternalEdges(edges.BaseEdge, sourceUserType)
		if err != nil {
			return fmt.Errorf("%w: operation: exclusion: failed to get base edges: %s", ErrLowestWeightFail, err.Error())
		}

		newReq := req.clone()
		return c.shallowClone().loopOverEdges(
			ctx,
			newReq,
			baseEdges,
			false,
			resolutionMetadata,
			resultChan,
			sourceUserType,
		)
	}

	tmpResultChan := make(chan *ReverseExpandResult, listObjectsResultChannelLength)
	var checkRelation string
	_, checkRelation = tuple.SplitObjectRelation(edges.ExcludedEdge.GetRelationDefinition())
	userset, err := c.typesystem.ConstructUserset(edges.ExcludedEdge, sourceUserType)
	if err != nil {
		// This should never happen.
		return fmt.Errorf("%w: operation: exclusion: %s", ErrConstructUsersetFail, err.Error())
	}

	// Concurrently find candidates and call check on them as they are found
	c.findCandidatesForLowestWeightEdge(pool, req, tmpResultChan, edges.BaseEdge, sourceUserType, resolutionMetadata)
	c.callCheckForCandidates(pool, tmpResultChan, resultChan,
		checkCandidateInfo{req: req, userset: userset, relation: checkRelation, isAllowed: false, resolutionMetadata: resolutionMetadata})
	return nil
}
