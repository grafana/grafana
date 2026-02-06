package reverseexpand

import (
	"context"
	"errors"
	"iter"
	"maps"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	weightedGraph "github.com/openfga/language/pkg/go/graph"

	"github.com/openfga/openfga/internal/checkutil"
	"github.com/openfga/openfga/internal/seq"
	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/typesystem"
)

type (
	Edge  = weightedGraph.WeightedAuthorizationModelEdge
	Graph = weightedGraph.WeightedAuthorizationModelGraph
	Node  = weightedGraph.WeightedAuthorizationModelNode
)

var (
	pipelineTracer = otel.Tracer("pipeline")

	edgeTypeComputed      = weightedGraph.ComputedEdge
	edgeTypeDirect        = weightedGraph.DirectEdge
	edgeTypeDirectLogical = weightedGraph.DirectLogicalEdge
	edgeTypeRewrite       = weightedGraph.RewriteEdge
	edgeTypeTTU           = weightedGraph.TTUEdge
	edgeTypeTTULogical    = weightedGraph.TTULogicalEdge

	// EmptySequence represents an `iter.Seq[Item]` that does nothing.
	emptySequence = func(yield func(Item) bool) {}

	nodeTypeLogicalDirectGrouping   = weightedGraph.LogicalDirectGrouping
	nodeTypeLogicalTTUGrouping      = weightedGraph.LogicalTTUGrouping
	nodeTypeOperator                = weightedGraph.OperatorNode
	nodeTypeSpecificType            = weightedGraph.SpecificType
	nodeTypeSpecificTypeAndRelation = weightedGraph.SpecificTypeAndRelation
	nodeTypeSpecificTypeWildcard    = weightedGraph.SpecificTypeWildcard
)

func handleIdentity(_ context.Context, _ *Edge, items []Item) iter.Seq[Item] {
	return seq.Sequence(items...)
}

func handleLeafNode(node *Node) edgeHandler {
	return func(_ context.Context, _ *Edge, items []Item) iter.Seq[Item] {
		objectParts := strings.Split(node.GetLabel(), "#")
		if len(objectParts) < 1 {
			return seq.Sequence(Item{Err: errors.New("empty label in node")})
		}

		objectType := objectParts[0]

		results := seq.Transform(seq.Sequence(items...), func(item Item) Item {
			var value string

			switch node.GetNodeType() {
			case nodeTypeSpecificTypeWildcard:
				value = ""
			case nodeTypeSpecificType, nodeTypeSpecificTypeAndRelation:
				value = ":" + item.Value
			default:
				return Item{Err: errors.New("unsupported leaf node type")}
			}
			item.Value = objectType + value
			return item
		})
		return results
	}
}

func handleUnsupported(_ context.Context, _ *Edge, _ []Item) iter.Seq[Item] {
	return seq.Sequence(Item{Err: errors.New("unsupported state")})
}

func NewPipeline(backend *Backend, options ...PipelineOption) *Pipeline {
	p := &Pipeline{
		backend:   backend,
		chunkSize: 100,
		numProcs:  3,
	}

	for _, option := range options {
		option(p)
	}
	return p
}

func WithChunkSize(size int) PipelineOption {
	if size < 0 {
		size = 0
	}

	return func(p *Pipeline) {
		p.chunkSize = size
	}
}

func WithNumProcs(num int) PipelineOption {
	if num < 1 {
		num = 1
	}

	return func(p *Pipeline) {
		p.numProcs = num
	}
}

// Backend is a struct that serves as a container for all backend elements
// necessary for creating and running a `Pipeline`.
type Backend struct {
	Datastore  storage.RelationshipTupleReader
	StoreID    string
	TypeSystem *typesystem.TypeSystem
	Context    *structpb.Struct
	Graph      *Graph
	Preference openfgav1.ConsistencyPreference
}

// handleDirectEdge is a function that interprets input on a direct edge and provides output from
// a query to the backend datastore.
func (b *Backend) handleDirectEdge(ctx context.Context, edge *Edge, items []Item) iter.Seq[Item] {
	parts := strings.Split(edge.GetRelationDefinition(), "#")
	nodeType := parts[0]
	nodeRelation := parts[1]

	userParts := strings.Split(edge.GetTo().GetLabel(), "#")

	var userRelation string

	if len(userParts) > 1 {
		userRelation = userParts[1]
	}

	var userFilter []*openfgav1.ObjectRelation

	var errs []Item

	for _, item := range items {
		if item.Err != nil {
			errs = append(errs, item)
			continue
		}

		userFilter = append(userFilter, &openfgav1.ObjectRelation{
			Object:   item.Value,
			Relation: userRelation,
		})
	}

	var results iter.Seq[Item]

	if len(userFilter) > 0 {
		input := queryInput{
			objectType:     nodeType,
			objectRelation: nodeRelation,
			userFilter:     userFilter,
			conditions:     edge.GetConditions(),
		}
		results = b.query(ctx, input)
	} else {
		results = emptySequence
	}

	if len(errs) > 0 {
		results = seq.Flatten(seq.Sequence(errs...), results)
	}
	return results
}

// handleTTUEdge is a function that interprets input on a TTU edge and provides output from
// a query to the backend datastore.
func (b *Backend) handleTTUEdge(ctx context.Context, edge *Edge, items []Item) iter.Seq[Item] {
	parts := strings.Split(edge.GetTuplesetRelation(), "#")
	if len(parts) < 2 {
		return seq.Sequence(Item{Err: errors.New("invalid tupleset relation")})
	}
	tuplesetType := parts[0]
	tuplesetRelation := parts[1]

	tuplesetNode, ok := b.Graph.GetNodeByID(edge.GetTuplesetRelation())
	if !ok {
		return seq.Sequence(Item{Err: errors.New("tupleset node not in graph")})
	}

	edges, ok := b.Graph.GetEdgesFromNode(tuplesetNode)
	if !ok {
		return seq.Sequence(Item{Err: errors.New("no edges found for tupleset node")})
	}

	targetParts := strings.Split(edge.GetTo().GetLabel(), "#")
	if len(targetParts) < 1 {
		return seq.Sequence(Item{Err: errors.New("empty edge label")})
	}
	targetType := targetParts[0]

	var targetEdge *Edge

	for _, e := range edges {
		if e.GetTo().GetLabel() == targetType {
			targetEdge = e
			break
		}
	}

	if targetEdge == nil {
		return seq.Sequence(Item{Err: errors.New("ttu target type is not an edge of tupleset")})
	}

	var userFilter []*openfgav1.ObjectRelation

	var errs []Item

	for _, item := range items {
		if item.Err != nil {
			errs = append(errs, item)
			continue
		}

		userFilter = append(userFilter, &openfgav1.ObjectRelation{
			Object:   item.Value,
			Relation: "",
		})
	}

	var results iter.Seq[Item]

	if len(userFilter) > 0 {
		input := queryInput{
			objectType:     tuplesetType,
			objectRelation: tuplesetRelation,
			userFilter:     userFilter,
			conditions:     targetEdge.GetConditions(),
		}
		results = b.query(ctx, input)
	} else {
		results = emptySequence
	}

	if len(errs) > 0 {
		results = seq.Flatten(seq.Sequence(errs...), results)
	}
	return results
}

func (b *Backend) query(ctx context.Context, input queryInput) iter.Seq[Item] {
	ctx, cancel := context.WithCancel(ctx)

	it, err := b.Datastore.ReadStartingWithUser(
		ctx,
		b.StoreID,
		storage.ReadStartingWithUserFilter{
			ObjectType: input.objectType,
			Relation:   input.objectRelation,
			UserFilter: input.userFilter,
			Conditions: input.conditions,
		},
		storage.ReadStartingWithUserOptions{
			Consistency: storage.ConsistencyOptions{
				Preference: b.Preference,
			},
		},
	)

	if err != nil {
		cancel()
		return seq.Sequence(Item{Err: err})
	}

	// If more than one element exists, at least one element is guaranteed to be a condition.
	// OR
	// If only one element exists, and it is not `NoCond`, then it is guaranteed to be a condition.
	hasConditions := len(input.conditions) > 1 || (len(input.conditions) > 0 && input.conditions[0] != weightedGraph.NoCond)

	var itr storage.TupleKeyIterator

	if hasConditions {
		itr = storage.NewConditionsFilteredTupleKeyIterator(
			storage.NewFilteredTupleKeyIterator(
				storage.NewTupleKeyIteratorFromTupleIterator(it),
				validation.FilterInvalidTuples(b.TypeSystem),
			),
			checkutil.BuildTupleKeyConditionFilter(ctx, b.Context, b.TypeSystem),
		)
	} else {
		itr = storage.NewFilteredTupleKeyIterator(
			storage.NewTupleKeyIteratorFromTupleIterator(it),
			validation.FilterInvalidTuples(b.TypeSystem),
		)
	}

	return func(yield func(Item) bool) {
		defer cancel()
		defer itr.Stop()

		for ctx.Err() == nil {
			t, err := itr.Next(ctx)

			var item Item

			if err != nil {
				if err == storage.ErrIteratorDone {
					break
				}

				item.Err = err

				yield(item)
				break
			}

			if t == nil {
				continue
			}

			item.Value = t.GetObject()

			if !yield(item) {
				break
			}
		}
	}
}

// baseResolver is a struct that implements the `resolver` interface and acts as the standard resolver for most
// workers. A baseResolver handles both recursive and non-recursive edges concurrently. The baseResolver's "ready"
// status will remain `true` until all of its senders that produce input from external sources have finished, and
// there exist no more in-flight messages for the parent worker. When recursive edges exist, the parent worker for
// this resolver type requires its internal watchdog process to initiate a shutdown.
type baseResolver struct {
	// reporter is a Reporter provided when registering with the baseResolver's StatusPool. The registration happens
	// once, when the baseResolver is created, so this value will remain constant for the lifetime of the instance.
	reporter Reporter

	ctx context.Context

	// interpreter is an `interpreter` that transforms a sender's input into output which it broadcasts to all
	// of the parent worker's listeners.
	interpreter interpreter

	// mutexes each protect map access for a buffer within inBuffers at the same index.
	mutexes []sync.Mutex

	// inBuffers contains a slice of maps, used as hash sets, for deduplicating each individual sender's
	// input feed. Each buffer's index corresponds to its associated sender's index. Each sender needs
	// a separate deduplication buffer because it is valid for the same object to be receieved on multiple
	// edges producing to the same node. This is specifically true in the case of recursive edges, where
	// a single resolver may have multiple recursive edges that must receive the same objects.
	inBuffers []map[string]struct{}

	errBuffers []map[string]struct{}

	// outMu protects map access to outBuffer.
	outMu sync.Mutex

	// outBuffer contains a map, used as a hash set, for deduplicating each resolver's output. A single
	// resolver should only output an object once.
	outBuffer map[string]struct{}

	// status is a *StatusPool instance that tracks the status of the baseResolver instance. This *StatusPool value
	// may or may not be shared with other resolver instances and workers. When the current resolver is part of a
	// recursive chain, then this *StatusPool value is shared with each of the participating resolvers. The status
	// of a baseResolver is assumed to be `true` from the point of initialization, until all "standard" senders have completed.
	// A baseResolver's status can be `false` while "recursive" senders are still actively processing messages. In that
	// case, the parent worker is kept alive by the overall status of the *StatusPool instance, and the count of messages
	// in-flight.
	status *StatusPool
}

func (r *baseResolver) process(ndx int, snd *sender, listeners []*listener) loopFunc {
	return func(msg message[group]) bool {
		// Loop while the sender has a potential to yield a message.
		var results iter.Seq[Item]
		var outGroup group
		var items, unseen []Item

		attrs := []attribute.KeyValue{
			attribute.String("resolver", "base"),
			attribute.Int("item.count", len(msg.Value.Items)),
			attribute.Int("sender.index", ndx),
		}

		edgeTo := "nil"
		edgeFrom := "nil"

		edge := snd.edge()
		if edge != nil {
			edgeTo = edge.GetTo().GetUniqueLabel()
			edgeFrom = edge.GetFrom().GetUniqueLabel()
		}

		attrs = append(
			attrs,
			attribute.String("edge.to", edgeTo),
			attribute.String("edge.from", edgeFrom),
		)

		ctx, span := pipelineTracer.Start(r.ctx, "message.received", trace.WithAttributes(attrs...))
		defer span.End()

		// If the edge is recursive or part of a tuple cycle,
		// deduplicate items received in this group based on the buffer for this sender.
		if edge != nil && (len(edge.GetRecursiveRelation()) > 0 || edge.IsPartOfTupleCycle()) {
			for _, item := range msg.Value.Items {
				if item.Err != nil {
					r.mutexes[ndx].Lock()
					if _, ok := r.errBuffers[ndx][item.Err.Error()]; ok {
						r.mutexes[ndx].Unlock()
						continue
					}
					r.errBuffers[ndx][item.Err.Error()] = struct{}{}
					r.mutexes[ndx].Unlock()
					unseen = append(unseen, item)
					continue
				}

				r.mutexes[ndx].Lock()
				if _, ok := r.inBuffers[ndx][item.Value]; ok {
					r.mutexes[ndx].Unlock()
					continue
				}
				r.inBuffers[ndx][item.Value] = struct{}{}
				r.mutexes[ndx].Unlock()
				unseen = append(unseen, item)
			}
		} else {
			unseen = msg.Value.Items
		}

		// If there are no unseen items, skip processing.
		if len(unseen) == 0 {
			msg.done()
			return true
		}

		results = r.interpreter.interpret(ctx, edge, unseen)

		// Deduplicate the output and potentially send in chunks.
		for item := range results {
			if r.ctx.Err() != nil {
				break
			}

			if item.Err != nil {
				goto AfterDedup
			}

			r.outMu.Lock()
			if _, ok := r.outBuffer[item.Value]; ok {
				r.outMu.Unlock()
				continue
			}
			r.outBuffer[item.Value] = struct{}{}
			r.outMu.Unlock()

		AfterDedup:
			items = append(items, item)

			if len(items) < snd.chunks() || snd.chunks() == 0 {
				continue
			}

			g := group{
				Items: items,
			}

			items = nil

			for _, lst := range listeners {
				lst.send(g)
			}
		}

		if len(items) == 0 {
			msg.done()
			return true
		}

		outGroup.Items = items

		for _, lst := range listeners {
			lst.send(outGroup)
		}

		msg.done()
		return true
	}
}

func (r *baseResolver) resolve(senders []*sender, listeners []*listener) {
	r.mutexes = make([]sync.Mutex, len(senders))
	r.inBuffers = make([]map[string]struct{}, len(senders))
	r.errBuffers = make([]map[string]struct{}, len(senders))
	r.outBuffer = make(map[string]struct{})

	for ndx := range len(senders) {
		r.inBuffers[ndx] = make(map[string]struct{})
		r.errBuffers[ndx] = make(map[string]struct{})
	}

	// Any senders with a non-recursive edge will be processed in the "standard" queue.
	var standard []func()

	// Any senders with a recursive edge will be processed in the "recursive" queue.
	var recursive []func()

	for ndx := range len(senders) {
		snd := senders[ndx]

		// Any sender with an edge that has a value for its recursive relation will be treated
		// as recursive, so long as it is not part of a tuple cycle. When the edge is part of
		// a tuple cycle, treating it as recursive would cause the parent worker to be closed
		// too early.
		isRecursive := snd.edge() != nil && len(snd.edge().GetRecursiveRelation()) > 0 && !snd.edge().IsPartOfTupleCycle()

		for range snd.procs() {
			proc := func() {
				snd.loop(r.process(ndx, snd, listeners))
			}

			if isRecursive {
				recursive = append(recursive, proc)
				continue
			}
			standard = append(standard, proc)
		}
	}

	var wgStandard sync.WaitGroup

	for _, proc := range standard {
		wgStandard.Add(1)
		go func() {
			defer wgStandard.Done()
			proc()
		}()
	}

	var wgRecursive sync.WaitGroup

	for _, proc := range recursive {
		wgRecursive.Add(1)
		go func() {
			defer wgRecursive.Done()
			proc()
		}()
	}

	// All standard senders are guaranteed to end at some point, with the exception of the presence
	// of a tuple cycle.
	wgStandard.Wait()

	// Once the standard senders have all finished processing, we set the resolver's status to `false`
	// indicating that the worker is ready for cleanup once all messages have finished processing.
	r.reporter.Report(false)

	// Recursive senders will process infinitely until the parent worker's watchdog goroutine kills
	// them.
	wgRecursive.Wait()
}

type edgeHandler func(context.Context, *Edge, []Item) iter.Seq[Item]

type exclusionResolver struct {
	reporter    Reporter
	ctx         context.Context
	interpreter interpreter
	status      *StatusPool
	trk         tracker
}

func (r *exclusionResolver) resolve(senders []*sender, listeners []*listener) {
	defer func() {
		r.trk.Add(-1)
		r.reporter.Report(false)
	}()

	r.trk.Add(1)

	if len(senders) != 2 {
		panic("exclusion resolver requires two senders")
	}
	var wg sync.WaitGroup

	included := make(map[string]struct{})
	excluded := make(map[string]struct{})

	var includedErrs []Item
	var excludedErrs []Item

	var procIncluded loopFunc
	var procExcluded loopFunc

	procIncluded = func(msg message[group]) bool {
		attrs := []attribute.KeyValue{
			attribute.String("resolver", "exclusion"),
			attribute.Int("item.count", len(msg.Value.Items)),
			attribute.Int("sender.index", 0),
		}

		edgeTo := "nil"
		edgeFrom := "nil"

		if senders[0].edge() != nil {
			edgeTo = senders[0].edge().GetTo().GetUniqueLabel()
			edgeFrom = senders[0].edge().GetFrom().GetUniqueLabel()
		}

		attrs = append(
			attrs,
			attribute.String("edge.to", edgeTo),
			attribute.String("edge.from", edgeFrom),
		)

		ctx, span := pipelineTracer.Start(r.ctx, "message.received", trace.WithAttributes(attrs...))
		defer span.End()

		results := r.interpreter.interpret(ctx, senders[0].edge(), msg.Value.Items)

		for item := range results {
			if r.ctx.Err() != nil {
				break
			}

			if item.Err != nil {
				includedErrs = append(includedErrs, item)
				continue
			}
			included[item.Value] = struct{}{}
		}
		msg.done()
		return true
	}

	procExcluded = func(msg message[group]) bool {
		attrs := []attribute.KeyValue{
			attribute.String("resolver", "exclusion"),
			attribute.Int("item.count", len(msg.Value.Items)),
			attribute.Int("sender.index", 1),
		}

		edgeTo := "nil"
		edgeFrom := "nil"

		if senders[1].edge() != nil {
			edgeTo = senders[1].edge().GetTo().GetUniqueLabel()
			edgeFrom = senders[1].edge().GetFrom().GetUniqueLabel()
		}

		attrs = append(
			attrs,
			attribute.String("edge.to", edgeTo),
			attribute.String("edge.from", edgeFrom),
		)

		ctx, span := pipelineTracer.Start(r.ctx, "message.received", trace.WithAttributes(attrs...))
		defer span.End()

		results := r.interpreter.interpret(ctx, senders[1].edge(), msg.Value.Items)

		for item := range results {
			if item.Err != nil {
				excludedErrs = append(excludedErrs, item)
				continue
			}
			excluded[item.Value] = struct{}{}
		}
		msg.done()
		return true
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		senders[0].loop(procIncluded)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		senders[1].loop(procExcluded)
	}()

	wg.Wait()

	var allErrs []Item

	allErrs = append(allErrs, includedErrs...)
	allErrs = append(allErrs, excludedErrs...)

	filteredSeq := seq.Filter(maps.Keys(included), func(v string) bool {
		_, ok := excluded[v]
		return !ok
	})

	flattenedSeq := seq.Flatten(seq.Sequence(allErrs...), seq.Transform(filteredSeq, strToItem))

	var items []Item

	for item := range flattenedSeq {
		items = append(items, item)
	}

	outGroup := group{
		Items: items,
	}

	for _, lst := range listeners {
		lst.send(outGroup)
	}
}

// group is a struct that acts as a container for a set of `Item` values.
type group struct {
	Items []Item
}

// Item is a struct that contains an object `string` as its `Value` or an
// encountered error as its `Err`. Item is the primary container used to
// communicate values as they pass through a `Pipeline`.
type Item struct {
	Value string
	Err   error
}

// interpreter is an interface that exposes a method for interpreting input for an edge into output.
type interpreter interface {
	interpret(ctx context.Context, edge *Edge, items []Item) iter.Seq[Item]
}

type intersectionResolver struct {
	reporter    Reporter
	ctx         context.Context
	interpreter interpreter
	status      *StatusPool
	trk         tracker
}

func (r *intersectionResolver) resolve(senders []*sender, listeners []*listener) {
	defer func() {
		r.trk.Add(-1)
		r.reporter.Report(false)
	}()

	r.trk.Add(1)

	var wg sync.WaitGroup

	objects := make(map[string]struct{})
	output := make([]map[string]struct{}, len(senders))

	for i := range senders {
		output[i] = make(map[string]struct{})
	}

	errs := make([][]Item, len(senders))

	for i, snd := range senders {
		wg.Add(1)
		go func(i int, snd *sender) {
			defer wg.Done()

			snd.loop(func(msg message[group]) bool {
				attrs := []attribute.KeyValue{
					attribute.String("resolver", "intersection"),
					attribute.Int("item.count", len(msg.Value.Items)),
					attribute.Int("sender.index", i),
				}

				edgeTo := "nil"
				edgeFrom := "nil"

				if snd.edge() != nil {
					edgeTo = snd.edge().GetTo().GetUniqueLabel()
					edgeFrom = snd.edge().GetFrom().GetUniqueLabel()
				}

				attrs = append(
					attrs,
					attribute.String("edge.to", edgeTo),
					attribute.String("edge.from", edgeFrom),
				)

				ctx, span := pipelineTracer.Start(r.ctx, "message.received", trace.WithAttributes(attrs...))
				defer span.End()

				// If there are no items, skip processing
				if len(msg.Value.Items) == 0 {
					msg.done()
					return true
				}

				results := r.interpreter.interpret(ctx, snd.edge(), msg.Value.Items)

				for item := range results {
					if r.ctx.Err() != nil {
						break
					}

					if item.Err != nil {
						errs[i] = append(errs[i], item)
					}
					output[i][item.Value] = struct{}{}
				}
				msg.done()
				return true
			})
		}(i, snd)
	}
	wg.Wait()

OutputLoop:
	for obj := range output[0] {
		for i := 1; i < len(output); i++ {
			if _, ok := output[i][obj]; !ok {
				continue OutputLoop
			}
		}
		objects[obj] = struct{}{}
	}

	var allErrs []Item

	for _, errList := range errs {
		allErrs = append(allErrs, errList...)
	}

	seq := seq.Flatten(seq.Sequence(allErrs...), seq.Transform(maps.Keys(objects), strToItem))

	var items []Item

	for item := range seq {
		items = append(items, item)
	}

	outGroup := group{
		Items: items,
	}

	for _, lst := range listeners {
		lst.send(outGroup)
	}
}

// listener is a struct that contains fields relevant to the listening
// end of a pipeline connection.
type listener struct {
	cons consumer[group]

	// node is the weighted graph node that is listening.
	node *Node
}

func (lst *listener) send(g group) {
	lst.cons.send(g)
}

func (lst *listener) cancel() {
	lst.cons.cancel()
}

func (lst *listener) close() {
	lst.cons.close()
}

type loopFunc func(message[group]) bool

type omniInterpreter struct {
	hndNil           edgeHandler
	hndDirect        edgeHandler
	hndTTU           edgeHandler
	hndComputed      edgeHandler
	hndRewrite       edgeHandler
	hndDirectLogical edgeHandler
	hndTTULogical    edgeHandler
}

func (o *omniInterpreter) interpret(ctx context.Context, edge *Edge, items []Item) iter.Seq[Item] {
	var results iter.Seq[Item]

	if edge == nil {
		results = o.hndNil(ctx, edge, items)
		return results
	}

	switch edge.GetEdgeType() {
	case edgeTypeDirect:
		results = o.hndDirect(ctx, edge, items)
	case edgeTypeTTU:
		results = o.hndTTU(ctx, edge, items)
	case edgeTypeComputed:
		results = o.hndComputed(ctx, edge, items)
	case edgeTypeRewrite:
		results = o.hndRewrite(ctx, edge, items)
	case edgeTypeDirectLogical:
		results = o.hndDirectLogical(ctx, edge, items)
	case edgeTypeTTULogical:
		results = o.hndTTULogical(ctx, edge, items)
	default:
		return seq.Sequence(Item{Err: errors.New("unexpected edge type")})
	}
	return results
}

type Pipeline struct {
	backend   *Backend
	chunkSize int
	numProcs  int
}

func (p *Pipeline) Build(ctx context.Context, source Source, target Target) iter.Seq[Item] {
	ctxParent, span := pipelineTracer.Start(ctx, "pipeline")

	ctxNoCancel := context.WithoutCancel(ctxParent)
	ctxCancel, cancel := context.WithCancel(ctxNoCancel)

	pth := path{
		// Removing the cancel on this context ensures that
		// workers created during `path::resolve` will not
		// end when the parent context cancels. This is important
		// because it ensures that the watchdog goroutine is
		// responsible for shutting down workers.
		ctx:     ctxNoCancel,
		pipe:    p,
		workers: make(map[*Node]*worker),
	}
	pth.resolve((*Node)(source), target, nil, nil)

	sourceWorker, ok := pth.workers[(*Node)(source)]
	if !ok {
		panic("no such source worker")
	}

	var wg sync.WaitGroup

	results := sourceWorker.subscribe(nil)

	for _, w := range pth.workers {
		w.start()
	}

	wg.Add(1)
	go func() {
		defer wg.Done()

		for {
			var inactiveCount int

			for _, w := range pth.workers {
				if !w.active() {
					w.close()
					inactiveCount++
				}
			}

			if inactiveCount == len(pth.workers) {
				break
			}

			messageCount := pth.trk.Load()

			if messageCount < 1 || ctxCancel.Err() != nil {
				// cancel all running workers
				for _, w := range pth.workers {
					w.cancel()
				}

				// wait for all workers to finish
				for _, w := range pth.workers {
					w.wait()
				}
				break
			}

			runtime.Gosched()
		}
	}()

	return func(yield func(Item) bool) {
		defer span.End()
		defer wg.Wait()
		defer cancel()

		for msg := range results.seq(ctxParent) {
			for _, item := range msg.Value.Items {
				if !yield(item) {
					msg.done()
					return
				}
			}
			msg.done()
		}
	}
}

func (p *Pipeline) Source(name, relation string) (Source, bool) {
	sourceNode, ok := p.backend.Graph.GetNodeByID(name + "#" + relation)
	return (Source)(sourceNode), ok
}

func (p *Pipeline) Target(name, identifier string) (Target, bool) {
	if identifier == "*" {
		name += ":*"
		identifier = ""
	}
	targetNode, ok := p.backend.Graph.GetNodeByID(name)

	return Target{
		node: targetNode,
		id:   identifier,
	}, ok
}

type PipelineOption func(*Pipeline)

type path struct {
	ctx     context.Context
	pipe    *Pipeline
	workers map[*Node]*worker
	trk     atomic.Int64
}

func (p *path) resolve(source *Node, target Target, trk tracker, status *StatusPool) {
	if _, ok := p.workers[source]; ok {
		return
	}

	if trk == nil {
		trk = newEchoTracker(&p.trk)
	}

	if status == nil {
		status = new(StatusPool)
	}

	w := p.worker(source, trk, status)

	p.workers[source] = w

	switch source.GetNodeType() {
	case nodeTypeSpecificType, nodeTypeSpecificTypeAndRelation:
		if source == target.node {
			// source node is the target node.
			var grp group
			grp.Items = []Item{{Value: target.id}}
			w.listen(nil, newStaticProducer(&p.trk, grp), p.pipe.chunkSize, 1) // only one value to consume, so only one processor necessary.
		}
	case nodeTypeSpecificTypeWildcard:
		label := source.GetLabel()
		typePart := strings.Split(label, ":")[0]

		if source == target.node || typePart == target.node.GetLabel() {
			// source node is the target node or has the same type as the target.
			var grp group
			grp.Items = []Item{{Value: "*"}}
			w.listen(nil, newStaticProducer(&p.trk, grp), p.pipe.chunkSize, 1) // only one value to consume, so only one processor necessary.
		}
	}

	edges, ok := p.pipe.backend.Graph.GetEdgesFromNode(source)
	if !ok {
		return
	}

	for _, edge := range edges {
		var track tracker
		var stat *StatusPool

		isRecursive := len(edge.GetRecursiveRelation()) > 0

		if isRecursive {
			track = w.trk
			stat = status
		}

		p.resolve(edge.GetTo(), target, track, stat)

		w.listen(edge, p.workers[edge.GetTo()].subscribe(source), p.pipe.chunkSize, p.pipe.numProcs)
	}
}

func (p *path) worker(node *Node, trk tracker, status *StatusPool) *worker {
	var w worker

	nodeName := "nil"
	if node != nil {
		nodeName = node.GetUniqueLabel()
	}

	ctx, span := pipelineTracer.Start(p.ctx, "worker", trace.WithAttributes(attribute.String("name", nodeName)))

	ctx, cancel := context.WithCancel(ctx)

	w.finite = sync.OnceFunc(func() {
		defer span.End()
		cancel()
		for _, lst := range w.listeners {
			lst.close()
		}
	})

	w.node = node
	w.status = status
	w.trk = trk

	var r resolver

	reporter := status.Register()
	reporter.Report(true)

	switch node.GetNodeType() {
	case nodeTypeSpecificTypeAndRelation:
		omni := &omniInterpreter{
			hndNil:           handleLeafNode(node),
			hndDirect:        p.pipe.backend.handleDirectEdge,
			hndTTU:           p.pipe.backend.handleTTUEdge,
			hndComputed:      handleIdentity,
			hndRewrite:       handleIdentity,
			hndDirectLogical: handleUnsupported,
			hndTTULogical:    handleUnsupported,
		}

		r = &baseResolver{
			reporter:    reporter,
			ctx:         ctx,
			interpreter: omni,
			status:      status,
		}
	case nodeTypeSpecificType:
		omni := &omniInterpreter{
			hndNil:           handleLeafNode(node),
			hndDirect:        handleUnsupported,
			hndTTU:           handleUnsupported,
			hndComputed:      handleUnsupported,
			hndRewrite:       handleUnsupported,
			hndDirectLogical: handleUnsupported,
			hndTTULogical:    handleUnsupported,
		}

		r = &baseResolver{
			reporter:    reporter,
			ctx:         ctx,
			interpreter: omni,
			status:      status,
		}
	case nodeTypeSpecificTypeWildcard:
		omni := &omniInterpreter{
			hndNil:           handleLeafNode(node),
			hndDirect:        handleUnsupported,
			hndTTU:           handleUnsupported,
			hndComputed:      handleUnsupported,
			hndRewrite:       handleUnsupported,
			hndDirectLogical: handleUnsupported,
			hndTTULogical:    handleUnsupported,
		}

		r = &baseResolver{
			reporter:    reporter,
			ctx:         ctx,
			interpreter: omni,
			status:      status,
		}
	case nodeTypeOperator:
		switch node.GetLabel() {
		case weightedGraph.IntersectionOperator:
			omni := &omniInterpreter{
				hndNil:           handleUnsupported,
				hndDirect:        p.pipe.backend.handleDirectEdge,
				hndTTU:           p.pipe.backend.handleTTUEdge,
				hndComputed:      handleIdentity,
				hndRewrite:       handleIdentity,
				hndDirectLogical: handleIdentity,
				hndTTULogical:    handleIdentity,
			}

			r = &intersectionResolver{
				reporter:    reporter,
				ctx:         ctx,
				interpreter: omni,
				status:      status,
				trk:         trk,
			}
		case weightedGraph.UnionOperator:
			omni := &omniInterpreter{
				hndNil:           handleUnsupported,
				hndDirect:        p.pipe.backend.handleDirectEdge,
				hndTTU:           p.pipe.backend.handleTTUEdge,
				hndComputed:      handleIdentity,
				hndRewrite:       handleIdentity,
				hndDirectLogical: handleIdentity,
				hndTTULogical:    handleIdentity,
			}

			r = &baseResolver{
				reporter:    reporter,
				ctx:         ctx,
				interpreter: omni,
				status:      status,
			}
		case weightedGraph.ExclusionOperator:
			omni := &omniInterpreter{
				hndNil:           handleUnsupported,
				hndDirect:        p.pipe.backend.handleDirectEdge,
				hndTTU:           p.pipe.backend.handleTTUEdge,
				hndComputed:      handleIdentity,
				hndRewrite:       handleIdentity,
				hndDirectLogical: handleIdentity,
				hndTTULogical:    handleIdentity,
			}

			r = &exclusionResolver{
				reporter:    reporter,
				ctx:         ctx,
				interpreter: omni,
				status:      status,
				trk:         trk,
			}
		default:
			panic("unsupported operator node for reverse expand worker")
		}
	case nodeTypeLogicalDirectGrouping:
		omni := &omniInterpreter{
			hndNil:           handleUnsupported,
			hndDirect:        p.pipe.backend.handleDirectEdge,
			hndTTU:           handleUnsupported,
			hndComputed:      handleUnsupported,
			hndRewrite:       handleUnsupported,
			hndDirectLogical: handleUnsupported,
			hndTTULogical:    handleUnsupported,
		}

		r = &baseResolver{
			reporter:    reporter,
			ctx:         ctx,
			interpreter: omni,
			status:      status,
		}
	case nodeTypeLogicalTTUGrouping:
		omni := &omniInterpreter{
			hndNil:           handleUnsupported,
			hndDirect:        handleUnsupported,
			hndTTU:           p.pipe.backend.handleTTUEdge,
			hndComputed:      handleUnsupported,
			hndRewrite:       handleUnsupported,
			hndDirectLogical: handleUnsupported,
			hndTTULogical:    handleUnsupported,
		}

		r = &baseResolver{
			reporter:    reporter,
			ctx:         ctx,
			interpreter: omni,
			status:      status,
		}
	default:
		panic("unsupported node type for reverse expand worker")
	}

	w.resolver = r

	pw := &w

	p.workers[node] = pw

	return pw
}

type queryInput struct {
	objectType     string
	objectRelation string
	userFilter     []*openfgav1.ObjectRelation
	conditions     []string
}

// resolver is an interface that is consumed by a worker struct.
// A resolver is responsible for consuming messages from a worker's
// senders and broadcasting the result of processing the consumed
// messages to the worker's listeners.
type resolver interface {
	// resolve is a function that consumes messages from the
	// provided senders, and broadcasts the results of processing
	// the consumed messages to the provided listeners.
	resolve(senders []*sender, listeners []*listener)
}

type Source *Node

// sender is a struct that contains fields relevant to the producing
// end of a pipeline connection.
type sender struct {
	// edge is the weighted graph edge that is producing.
	e *Edge

	prod producer[group]

	// chunkSize is the target number of items to include in each
	// outbound message. A value less than 1 indicates an unlimited
	// number of items per message.
	chunkSize int

	numProcs int
}

func (s *sender) chunks() int {
	return s.chunkSize
}

func (s *sender) edge() *Edge {
	return s.e
}

func (s *sender) loop(fn loopFunc) {
	// A background context is used here because the sender's underlying pipe
	// relies on a cancelation from its consuming end for a shutdown signal.
	// This sequence does not need an additional cancelation signal for that
	// reason.
	for msg := range s.prod.seq(context.Background()) {
		if !fn(msg) {
			break
		}
	}
}

func (s *sender) procs() int {
	return s.numProcs
}

// strtoItem is a function that accepts a string input and returns an Item
// that contains the input as its `Value` value.
func strToItem(s string) Item {
	return Item{Value: s}
}

type Target struct {
	node *Node
	id   string
}

type worker struct {
	node      *Node
	senders   []*sender
	listeners []*listener
	resolver  resolver
	trk       tracker
	status    *StatusPool
	finite    func()
	wg        sync.WaitGroup
}

func (w *worker) active() bool {
	return w.status.Status() || w.trk.Load() != 0
}

func (w *worker) cancel() {
	for _, lst := range w.listeners {
		lst.cancel()
	}
}

func (w *worker) close() {
	w.finite()
}

func (w *worker) listen(edge *Edge, p producer[group], chunkSize int, numProcs int) {
	w.senders = append(w.senders, &sender{
		e:         edge,
		prod:      p,
		chunkSize: chunkSize,
		numProcs:  numProcs,
	})
}

func (w *worker) start() {
	w.wg.Add(1)

	go func() {
		defer w.wg.Done()
		defer w.close()

		w.resolver.resolve(w.senders, w.listeners)
	}()
}

func (w *worker) subscribe(node *Node) producer[group] {
	p := newPipe(w.trk)

	w.listeners = append(w.listeners, &listener{
		cons: p,
		node: node,
	})

	return p
}

func (w *worker) wait() {
	w.wg.Wait()
}
