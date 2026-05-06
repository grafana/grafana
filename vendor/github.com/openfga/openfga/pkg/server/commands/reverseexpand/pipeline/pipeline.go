package pipeline

import (
	"context"
	"errors"
	"iter"
	"maps"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	weightedGraph "github.com/openfga/language/pkg/go/graph"

	"github.com/openfga/openfga/internal/bitutil"
	"github.com/openfga/openfga/internal/checkutil"
	"github.com/openfga/openfga/internal/containers"
	"github.com/openfga/openfga/internal/pipe"
	"github.com/openfga/openfga/internal/seq"
	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/server/commands/reverseexpand/pipeline/track"
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

const (
	defaultBufferSize int = 1 << 7
	defaultChunkSize  int = 100
	defaultNumProcs   int = 3
)

var (
	ErrInvalidBufferSize = errors.New("buffer size must be a power of two")
	ErrInvalidChunkSize  = errors.New("chunk size must be greater than zero")
	ErrInvalidNumProcs   = errors.New("process number must be greater than zero")
)

func handleIdentity(_ context.Context, _ *Edge, items []string) iter.Seq[Item] {
	return seq.Transform(seq.Sequence(items...), strToItem)
}

type Option func(*Pipeline) error

// WithBufferSize is a function that sets the value for a pipeline's workers' internal
// pipe buffer size. The value must be a power of two. (e.g. 1, 2, 4, 8, 16, 32...)
// The default value of the buffer size is 128. If an invalid value is provided as size
// then the default value will be applied.
func WithBufferSize(size int) Option {
	return func(p *Pipeline) error {
		if !bitutil.PowerOfTwo(size) {
			return ErrInvalidBufferSize
		}

		p.bufferSize = size
		return nil
	}
}

func WithChunkSize(size int) Option {
	return func(p *Pipeline) error {
		if size < 1 {
			return ErrInvalidChunkSize
		}

		p.chunkSize = size
		return nil
	}
}

func WithNumProcs(num int) Option {
	return func(p *Pipeline) error {
		if num < 1 {
			return ErrInvalidNumProcs
		}

		p.numProcs = num
		return nil
	}
}

// WithPipeExtension enables functionality to dynamically extend the size of pipes
// between workers as needed up to a defined number of times. Each extension doubles
// the size of a pipe's internal buffer. A pipe is only extended if a call to send on
// the pipe blocks for longer than the extendAfter duration.
//
// This functionality is disabled by default. To enable, set extendAfter to a duration
// greater than 0 and set maxExtensions to a value greater than 0, or to -1 to
// make the number of extensions unbounded.
func WithPipeExtension(extendAfter time.Duration, maxExtensions int) Option {
	return func(p *Pipeline) error {
		p.pipeExtendAfter = extendAfter
		p.pipeMaxExtensions = maxExtensions
		return nil
	}
}

func New(backend *Backend, options ...Option) (*Pipeline, error) {
	p := &Pipeline{
		backend:           backend,
		bufferSize:        defaultBufferSize,
		chunkSize:         defaultChunkSize,
		numProcs:          defaultNumProcs,
		pipeExtendAfter:   pipe.DefaultExtendAfter,
		pipeMaxExtensions: pipe.DefaultMaxExtensions,
	}

	for _, option := range options {
		if err := option(p); err != nil {
			return nil, err
		}
	}

	p.bufferPool = newBufferPool(p.chunkSize)
	return p, nil
}

type bufferPool struct {
	size int
	pool sync.Pool
}

func (b *bufferPool) Get() *[]Item {
	return b.pool.Get().(*[]Item)
}

func (b *bufferPool) Put(buffer *[]Item) {
	b.pool.Put(buffer)
}

func (b *bufferPool) create() any {
	tmp := make([]Item, b.size)
	return &tmp
}

func newBufferPool(size int) *bufferPool {
	var b bufferPool
	b.size = size
	b.pool.New = b.create
	return &b
}

type Message struct {
	Value       []Item
	ReceiptFunc func()
	once        sync.Once
}

func (m *Message) finalize() {
	if m.ReceiptFunc != nil {
		m.ReceiptFunc()
	}
}

func (m *Message) Done() {
	m.once.Do(m.finalize)
	m.Value = nil
	m.ReceiptFunc = nil
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
func (b *Backend) handleDirectEdge(ctx context.Context, edge *Edge, items []string) iter.Seq[Item] {
	parts := strings.Split(edge.GetRelationDefinition(), "#")
	nodeType := parts[0]
	nodeRelation := parts[1]

	userParts := strings.Split(edge.GetTo().GetLabel(), "#")

	var userRelation string

	if len(userParts) > 1 {
		userRelation = userParts[1]
	}

	userFilter := make([]*openfgav1.ObjectRelation, len(items))

	for i, item := range items {
		userFilter[i] = &openfgav1.ObjectRelation{
			Object:   item,
			Relation: userRelation,
		}
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

	return results
}

// handleTTUEdge is a function that interprets input on a TTU edge and provides output from
// a query to the backend datastore.
func (b *Backend) handleTTUEdge(ctx context.Context, edge *Edge, items []string) iter.Seq[Item] {
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

	for _, item := range items {
		userFilter = append(userFilter, &openfgav1.ObjectRelation{
			Object:   item,
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
				if storage.IterIsDoneOrCancelled(err) {
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

// baseResolver is a struct that implements the Resolver interface and acts as the standard resolver for most
// workers. A baseResolver handles both recursive and non-recursive edges concurrently.
type baseResolver struct {
	// interpreter is an `interpreter` that transforms a sender's input into output which it broadcasts to all
	// of the parent worker's listeners.
	interpreter interpreter

	// tracker may be owned or shared with other resolvers. It is used to report messages from this resovler
	// that are still in-flight.
	tracker *track.Tracker

	// reporter may be owned or shared with other resolvers. It is used to report on the status of the resolver.
	reporter *track.Reporter

	// bufferPool is intended to be shared with other resovlers. It is used to manage a pool of Item slices
	// so that additional allocations can be avoided.
	bufferPool *bufferPool

	// numProcs indicates the number of goroutines to spawn for processing each sender.
	numProcs int
}

// process is a function that reads output from a single sender, processes the output through an interpreter, and
// then sends the interpreter's output to each listener. The sender's output is deduplicated across all process functions
// for the same edge when the sender is for a cyclical edge because values of a cycle may be reentrant. Output from the
// interpreter is always deduplicated across all process functions because input from two different senders may produce
// the same output value(s).
func (r *baseResolver) process(ctx context.Context, snd Sender[*Edge, *Message], listeners []Listener[*Edge, *Message], inputBuffer *containers.AtomicMap[string, struct{}], outputBuffer *containers.AtomicMap[string, struct{}]) int64 {
	var sentCount int64

	edge := snd.Key()

	edgeTo := "nil"
	edgeFrom := "nil"

	if edge != nil {
		edgeTo = edge.GetTo().GetUniqueLabel()
		edgeFrom = edge.GetFrom().GetUniqueLabel()
	}

	attrs := []attribute.KeyValue{
		attribute.String("edge.to", edgeTo),
		attribute.String("edge.from", edgeFrom),
	}

	var msg *Message

	for snd.Recv(&msg) {
		if ctx.Err() != nil {
			msg.Done()
			continue
		}

		errs := make([]Item, 0, len(msg.Value))
		unseen := make([]string, 0, len(msg.Value))

		messageAttrs := make([]attribute.KeyValue, 1, 1+len(attrs))
		messageAttrs[0] = attribute.Int("items.count", len(msg.Value))
		messageAttrs = append(messageAttrs, attrs...)

		ctx, span := pipelineTracer.Start(ctx, "message.received", trace.WithAttributes(messageAttrs...))

		for _, item := range msg.Value {
			if item.Err != nil {
				errs = append(errs, item)
				continue
			}

			if inputBuffer != nil {
				// Deduplicate the sender's output using the buffer shared by all processors
				// of this sender.
				if _, loaded := inputBuffer.LoadOrStore(item.Value, struct{}{}); !loaded {
					unseen = append(unseen, item.Value)
				}
				continue
			}
			unseen = append(unseen, item.Value)
		}

		results := r.interpreter.Interpret(ctx, edge, unseen)

		// Combine the initial errors with the interpreted output.
		results = seq.Flatten(seq.Sequence(errs...), results)

		results = seq.Filter(results, func(item Item) bool {
			if item.Err != nil {
				return true
			}

			// Deduplicate the interpreted values using the buffer shared by all processors
			// of all senders.
			_, loaded := outputBuffer.LoadOrStore(item.Value, struct{}{})
			return !loaded
		})

		// Grab a buffer from the pool for reading. The buffer's size
		// is set by the bufferPool.
		buffer := r.bufferPool.Get()
		reader := seq.NewSeqReader(results)

		for {
			count := reader.Read(*buffer)

			if count == 0 {
				// No more values to read from the iter.Seq.
				break
			}

			for i := range len(listeners) {
				// Grab a buffer that will be specific to this message.
				values := r.bufferPool.Get()
				// This copy is done so that the content of the message buffer is
				// not altered when the read buffer has new values written to it.
				copy(*values, (*buffer)[:count])

				// Increment the resolver's tracker to account for the new message.
				r.tracker.Inc()
				m := Message{
					// Only slice the values in the read buffer up to what was actually read.
					Value: (*values)[:count],
					ReceiptFunc: func() {
						// Decrement the resolver's tracker because the message is no longer
						// in-flight.
						r.tracker.Dec()
						// Relase the message specific buffer back into the buffer pool.
						r.bufferPool.Put(values)
					},
				}

				if !listeners[i].Send(&m) {
					// If the message was not sent, we need to release the message resources.
					m.Done()
				}
			}
			sentCount += int64(count)
		}
		reader.Close()

		// Release the read buffer back to the buffer pool.
		r.bufferPool.Put(buffer)

		// Release the received message's resources.
		msg.Done()
		span.End()
	}
	return sentCount
}

// Resolve is a function that orchestrates the processing of all sender output, broadcasting the result of that processing
// to all listeners. The Resolve function will block until all of its non-cyclical senders have been exhausted and the status
// of the instance's reporter is equal to `true` and the count of its tracker reaches `0`.
func (r *baseResolver) Resolve(ctx context.Context, senders []Sender[*Edge, *Message], listeners []Listener[*Edge, *Message]) {
	ctx, span := pipelineTracer.Start(ctx, "baseResolver.Resolve")
	defer span.End()

	// This output buffer is shared across all processors of all senders, and is used
	// for output deduplication.
	var outputBuffer containers.AtomicMap[string, struct{}]
	defer outputBuffer.Clear()

	var sentCount atomic.Int64

	// Any senders with a non-recursive edge will be processed in the "standard" queue.
	var wgStandard sync.WaitGroup

	// Any senders with a recursive edge will be processed in the "recursive" queue.
	var wgRecursive sync.WaitGroup

	for _, snd := range senders {
		edge := snd.Key()

		var isCyclical bool

		if edge != nil {
			isCyclical = len(edge.GetRecursiveRelation()) > 0 || edge.IsPartOfTupleCycle()
		}

		if isCyclical {
			// The sender's edge is either recursive or part of a tuple cycle.

			// Only if the sender is for a cyclical edge do we want to deduplicate the
			// sender's output. This buffer is shared between all processors of this
			// sender.
			var inputBuffer containers.AtomicMap[string, struct{}]

			for range r.numProcs {
				wgRecursive.Add(1)
				go func() {
					defer wgRecursive.Done()
					sentCount.Add(r.process(ctx, snd, listeners, &inputBuffer, &outputBuffer))
				}()
			}
			continue
		}

		// The sender's edge is not recursive or part of a tuple cycle.
		for range r.numProcs {
			wgStandard.Add(1)
			go func() {
				defer wgStandard.Done()
				sentCount.Add(r.process(ctx, snd, listeners, nil, &outputBuffer))
			}()
		}
	}

	// All standard senders are guaranteed to end at some point.
	wgStandard.Wait()

	// Now that all standard senders have been exhaused, this resolver is ready
	// to end once all other resolvers that are part of the same cycle are ready.
	r.reporter.Report(false)

	// Wait for all related resolvers' status to be set to `false`.
	r.reporter.Wait(func(s bool) bool {
		return !s
	})

	// Wait until all messages from related resolvers have finished processing.
	r.tracker.Wait(func(i int64) bool {
		return i < 1
	})

	// Close all listeners to release any processors that are stuck on a full
	// listener buffer. Without this, an early termination could cause a deadlock
	// when the listener's internal buffer remains full.
	for _, lst := range listeners {
		lst.Close()
	}

	// Ensure that all recursive processors have ended.
	wgRecursive.Wait()

	span.SetAttributes(attribute.Int64("items.count", sentCount.Load()))
}

type edgeHandler func(context.Context, *Edge, []string) iter.Seq[Item]

// txBag is a type that implements the interface pipe.Tx[T]
// for the type containers.Bag[T].
type txBag[T any] containers.Bag[T]

// Send implements the pipe.Tx[T] interface.
func (tx *txBag[T]) Send(t T) bool {
	bag := (*containers.Bag[T])(tx)
	bag.Add(t)
	return true
}

// exclusionResolver is a struct that resolves senders to an exclusion operation.
type exclusionResolver struct {
	interpreter interpreter
	tracker     *track.Tracker
	reporter    *track.Reporter
	bufferPool  *bufferPool
	numProcs    int
}

// process is a function that processes the output of a single sender through an interpreter. All output from
// the interpreter is collected in the items Bag and a cleanup Bag is used to collect all resource cleaning functions
// for later use by the Resolve function. As soon as a message is received from the sender, its values are swapped
// to a buffer that is local to the current iteration, and the message resources are released immediately.
// Messages are not sent to the listeners at this point.
func (r *exclusionResolver) process(ctx context.Context, snd Sender[*Edge, *Message], items pipe.Tx[Item], cleanup *containers.Bag[func()]) {
	edge := snd.Key()

	edgeTo := "nil"
	edgeFrom := "nil"

	if edge != nil {
		edgeTo = edge.GetTo().GetUniqueLabel()
		edgeFrom = edge.GetFrom().GetUniqueLabel()
	}

	attrs := []attribute.KeyValue{
		attribute.String("edge.to", edgeTo),
		attribute.String("edge.from", edgeFrom),
	}

	var msg *Message

	for snd.Recv(&msg) {
		if ctx.Err() != nil {
			msg.Done()
			continue
		}
		// Increment the tracker to account for an in-flight message.
		r.tracker.Inc()
		values := r.bufferPool.Get()
		// Copy values from message to local buffer so that the message
		// can release its buffer back to the pool.
		copy(*values, msg.Value)
		size := len(msg.Value)

		// Release message resources.
		msg.Done()

		unseen := make([]string, 0, size)

		messageAttrs := make([]attribute.KeyValue, 1, 1+len(attrs))
		messageAttrs[0] = attribute.Int("items.count", size)
		messageAttrs = append(messageAttrs, attrs...)

		ctx, span := pipelineTracer.Start(ctx, "message.received", trace.WithAttributes(messageAttrs...))

		// Only take the number of values that existed in the original
		// message. Reading beyond that will corrupt pipeline state.
		for _, item := range (*values)[:size] {
			if item.Err != nil {
				items.Send(item)
				continue
			}
			unseen = append(unseen, item.Value)
		}
		// When returning the buffer to the pool, its length must remain
		// unaltered, lest the chunk size no longer be respected.
		r.bufferPool.Put(values)

		results := r.interpreter.Interpret(ctx, edge, unseen)

		for item := range results {
			items.Send(item)
		}

		// Save the tracker decrementation for later execution in the Resolve
		// function. This is critical to ensure that resolvers sharing this
		// instance's tracker observe the appropriate count for the entirely
		// of processing.
		cleanup.Add(r.tracker.Dec)
		span.End()
	}
}

func (r *exclusionResolver) Resolve(ctx context.Context, senders []Sender[*Edge, *Message], listeners []Listener[*Edge, *Message]) {
	ctx, span := pipelineTracer.Start(ctx, "exclusionResolver.Resolve")
	defer span.End()

	defer r.reporter.Report(false)

	if len(senders) != 2 {
		panic("exclusion resolver requires two senders")
	}

	var excluded containers.Bag[Item]

	var cleanup containers.Bag[func()]

	var wgExclude sync.WaitGroup

	pipeInclude := pipe.Must[Item](1 << 7) // create a pipe with an initial capacity of 128
	pipeInclude.SetExtensionConfig(0, -1)  // allow pipe to grow to an unbounded capacity with no wait

	var counter atomic.Int32
	counter.Store(int32(r.numProcs))
	for range r.numProcs {
		go func() {
			defer func() {
				if counter.Add(-1) < 1 {
					_ = pipeInclude.Close()
				}
			}()
			r.process(ctx, senders[0], pipeInclude, &cleanup)
		}()
	}

	for range r.numProcs {
		wgExclude.Add(1)
		go func() {
			defer wgExclude.Done()
			r.process(ctx, senders[1], (*txBag[Item])(&excluded), &cleanup)
		}()
	}

	wgExclude.Wait()

	var errs []Item

	exclusions := make(map[string]struct{})

	for item := range excluded.Seq() {
		if item.Err != nil {
			errs = append(errs, item)
			continue
		}
		exclusions[item.Value] = struct{}{}
	}

	results := seq.Filter(pipeInclude.Seq(), func(item Item) bool {
		if item.Err != nil {
			return true
		}

		_, ok := exclusions[item.Value]
		return !ok
	})

	results = seq.Flatten(seq.Sequence(errs...), results)

	var sentCount int

	buffer := r.bufferPool.Get()
	reader := seq.NewSeqReader(results)

	for {
		count := reader.Read(*buffer)

		if count == 0 {
			break
		}

		for i := range len(listeners) {
			values := r.bufferPool.Get()
			copy(*values, (*buffer)[:count])

			r.tracker.Inc()
			m := Message{
				Value: (*values)[:count],
				ReceiptFunc: func() {
					r.tracker.Dec()
					r.bufferPool.Put(values)
				},
			}

			if !listeners[i].Send(&m) {
				m.Done()
			}
		}
		sentCount += count
	}
	reader.Close()
	r.bufferPool.Put(buffer)

	span.SetAttributes(attribute.Int("items.count", sentCount))

	for fn := range cleanup.Seq() {
		fn()
	}

	for _, lst := range listeners {
		lst.Close()
	}
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
	Interpret(ctx context.Context, edge *Edge, items []string) iter.Seq[Item]
}

type intersectionResolver struct {
	interpreter interpreter
	tracker     *track.Tracker
	reporter    *track.Reporter
	bufferPool  *bufferPool
	numProcs    int
}

func (r *intersectionResolver) process(ctx context.Context, snd Sender[*Edge, *Message], items *containers.Bag[Item], cleanup *containers.Bag[func()]) {
	edge := snd.Key()

	edgeTo := "nil"
	edgeFrom := "nil"

	if edge != nil {
		edgeTo = edge.GetTo().GetUniqueLabel()
		edgeFrom = edge.GetFrom().GetUniqueLabel()
	}

	attrs := []attribute.KeyValue{
		attribute.String("edge.to", edgeTo),
		attribute.String("edge.from", edgeFrom),
	}

	var msg *Message

	for snd.Recv(&msg) {
		if ctx.Err() != nil {
			msg.Done()
			continue
		}
		r.tracker.Add(1)
		values := r.bufferPool.Get()
		copy(*values, msg.Value)
		size := len(msg.Value)
		msg.Done()

		var results iter.Seq[Item]
		unseen := make([]string, 0, size)

		messageAttrs := make([]attribute.KeyValue, 1, 1+len(attrs))
		messageAttrs[0] = attribute.Int("items.count", size)
		messageAttrs = append(messageAttrs, attrs...)

		ctx, span := pipelineTracer.Start(ctx, "message.received", trace.WithAttributes(messageAttrs...))

		for _, item := range (*values)[:size] {
			if item.Err != nil {
				items.Add(item)
				continue
			}
			unseen = append(unseen, item.Value)
		}
		r.bufferPool.Put(values)

		results = r.interpreter.Interpret(ctx, edge, unseen)

		for item := range results {
			items.Add(item)
		}

		cleanup.Add(r.tracker.Dec)
		span.End()
	}
}

func (r *intersectionResolver) Resolve(ctx context.Context, senders []Sender[*Edge, *Message], listeners []Listener[*Edge, *Message]) {
	ctx, span := pipelineTracer.Start(ctx, "intersectionResolver.Resolve")
	defer span.End()

	defer r.reporter.Report(false)

	var wg sync.WaitGroup

	bags := make([]containers.Bag[Item], len(senders))

	var cleanup containers.Bag[func()]

	for i, snd := range senders {
		for range r.numProcs {
			wg.Add(1)
			go func() {
				defer wg.Done()
				r.process(ctx, snd, &bags[i], &cleanup)
			}()
		}
	}
	wg.Wait()

	var errs []Item

	output := make(map[string]struct{})

	for item := range bags[0].Seq() {
		if item.Err != nil {
			errs = append(errs, item)
			continue
		}
		output[item.Value] = struct{}{}
	}

	for i := 1; i < len(bags); i++ {
		found := make(map[string]struct{}, len(output))
		for item := range bags[i].Seq() {
			if item.Err != nil {
				errs = append(errs, item)
				continue
			}

			if _, ok := output[item.Value]; ok {
				found[item.Value] = struct{}{}
			}
		}
		output = found
	}

	results := seq.Transform(maps.Keys(output), strToItem)

	results = seq.Flatten(seq.Sequence(errs...), results)

	var sentCount int

	buffer := r.bufferPool.Get()
	reader := seq.NewSeqReader(results)

	for {
		count := reader.Read(*buffer)

		if count == 0 {
			break
		}

		for i := range len(listeners) {
			values := r.bufferPool.Get()
			copy(*values, (*buffer)[:count])

			r.tracker.Inc()
			m := Message{
				Value: (*values)[:count],
				ReceiptFunc: func() {
					r.tracker.Dec()
					r.bufferPool.Put(values)
				},
			}

			if !listeners[i].Send(&m) {
				m.Done()
			}
		}
		sentCount += count
	}
	reader.Close()
	r.bufferPool.Put(buffer)

	span.SetAttributes(attribute.Int("items.count", sentCount))

	for fn := range cleanup.Seq() {
		fn()
	}

	for _, lst := range listeners {
		lst.Close()
	}
}

type omniInterpreter struct {
	hndNil           edgeHandler
	hndDirect        edgeHandler
	hndTTU           edgeHandler
	hndComputed      edgeHandler
	hndRewrite       edgeHandler
	hndDirectLogical edgeHandler
	hndTTULogical    edgeHandler
}

func (o *omniInterpreter) Interpret(ctx context.Context, edge *Edge, items []string) iter.Seq[Item] {
	if len(items) == 0 {
		return emptySequence
	}

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

// Pipeline is a struct that is used to construct logical pipelines that traverse all connections
// within a graph from a given source type and relation to a given target type and identifier.
//
// A pipeline consists of a variable number of workers that process data concurrently. Within
// a pipeline, dataflows from the worker that receives the initial input down to any workers
// that have a subscription to its output. Data continues to flow into downstream workers
// through their subscriptions to upstream workers until it arrives at the consumer of the
// pipeline.
type Pipeline struct {
	// provides operations that require interacting with dependencies
	// such as a database or a graph.
	backend *Backend

	// bufferSize is a value that indicates the size of the message buffer
	// that exists between each worker and its subscribers. When a buffer
	// becomes full, send operations on that subscription will block until
	// messages are removed from the buffer or the subscription is closed.
	//
	// This value must be a valid power of two. (e.g. 1, 2, 4, 8, 16, 32...)
	// The default value is 128. This value can be changed by constructing
	// a pipeline using NewPipeline and providing the option WithBufferSize.
	bufferSize int

	// chunkSize is a value that indicates the maximum size of tuples
	// accummulated from a datastore query before sending the tuples
	// as a message to the next node in the pipeline.
	//
	// As an example, if the chunkSize is set to 100, then a new message
	// is sent for every 100 tuples returned from a datastore query.
	//
	// The default value is 100. This value can be changed by constructing
	// a pipeline using NewPipeline and providing the option WithChunkSize.
	chunkSize int

	bufferPool *bufferPool

	// numProcs is a value that indicates the maximum number of goroutines
	// that will be allocated to processing each subscription for a pipeline
	// worker.
	//
	// The default value is 3. This value can be changed by constructing
	// a pipeline using NewPipeline and providing the option WithNumProcs.
	numProcs int

	// pipeExtendAfter is the duration before extending full pipe buffers
	pipeExtendAfter time.Duration

	// pipeMaxExtensions is the max number of times pipe buffers can extend
	pipeMaxExtensions int
}

type pipelineWorker = Worker[*Edge, *Message, *Message]
type workerPool = map[*Node]*pipelineWorker

// Build is a function that constructs the actual pipeline which is returned as an iter.Seq[Item].
// The pipeline will not begin generating values until the returned sequence is iterated over. This
// is to prevent unnecessary work and resource accummulation in the event that the sequence is never
// iterated.
func (pl *Pipeline) Build(ctx context.Context, source Source, target Target) iter.Seq[Item] {
	ctx, span := pipelineTracer.Start(ctx, "pipeline.build")
	defer span.End()

	ctx, cancel := context.WithCancel(ctx)

	workers := make(workerPool)

	p := path{
		source: (*Node)(source),
		target: target,
	}
	pl.resolve(p, workers)

	sourceWorker, ok := workers[(*Node)(source)]
	if !ok {
		panic("no such source worker")
	}

	results := sourceWorker.Subscribe(nil)

	return func(yield func(Item) bool) {
		ctx, span := pipelineTracer.Start(ctx, "pipeline.iterate")
		defer span.End()

		if ctx.Err() != nil {
			// Exit early if the context was already canceled.
			// No goroutines have been created up to this point
			// so no cleanup is necessary.
			return
		}

		var wg sync.WaitGroup

		defer wg.Wait()
		defer cancel()

		// Workers are started here so that the pipeline does
		// not begin producing objects until the caller has begun
		// to iterate over the sequence. This prevents unnecessary
		// processing in the event that the caller decides not to
		// iterate over the sequence.
		for _, w := range workers {
			w.Start(ctx)
		}

		wg.Add(1)
		go func() {
			defer wg.Done()
			<-ctx.Done()
			// Wait for all workers to finish.
			for _, w := range workers {
				w.Wait()
			}
		}()

		var abandoned bool

		for msg := range results.Seq() {
			if ctx.Err() == nil {
				for _, item := range msg.Value {
					if !yield(item) {
						// The caller has ended sequence iteration early.
						// Cancel the context so that the pipeline begins
						// its shutdown process.
						abandoned = true
						cancel()
						break
					}
				}
			}
			msg.Done()
		}

		if !abandoned && ctx.Err() != nil {
			// Context was canceled so there is no guarantee that all
			// objects have been returned. An error must be signaled
			// here to indicate the possibility of a partial result.
			yield(Item{Err: ctx.Err()})
		}
	}
}

func (pl *Pipeline) Source(name, relation string) (Source, bool) {
	sourceNode, ok := pl.backend.Graph.GetNodeByID(name + "#" + relation)
	return (Source)(sourceNode), ok
}

func (pl *Pipeline) Target(name, identifier string) (Target, bool) {
	if identifier == "*" {
		name += ":*"
		identifier = ""
	}
	targetNode, ok := pl.backend.Graph.GetNodeByID(name)

	return Target{
		node: targetNode,
		id:   identifier,
	}, ok
}

type path struct {
	source     *Node
	target     Target
	tracker    *track.Tracker
	statusPool *track.StatusPool
}

func (pl *Pipeline) resolve(p path, workers workerPool) *pipelineWorker {
	if w, ok := workers[p.source]; ok {
		return w
	}

	if p.tracker == nil {
		p.tracker = new(track.Tracker)
	}

	if p.statusPool == nil {
		p.statusPool = new(track.StatusPool)
	}

	var w pipelineWorker
	w.bufferSize = pl.bufferSize
	w.pipeExtendAfter = pl.pipeExtendAfter
	w.pipeMaxExtensions = pl.pipeMaxExtensions

	reporter := p.statusPool.Register()
	reporter.Report(true)

	omni := &omniInterpreter{
		hndNil:           handleIdentity,
		hndDirect:        pl.backend.handleDirectEdge,
		hndTTU:           pl.backend.handleTTUEdge,
		hndComputed:      handleIdentity,
		hndRewrite:       handleIdentity,
		hndDirectLogical: handleIdentity,
		hndTTULogical:    handleIdentity,
	}

	switch p.source.GetNodeType() {
	case nodeTypeSpecificType,
		nodeTypeSpecificTypeAndRelation,
		nodeTypeSpecificTypeWildcard,
		nodeTypeLogicalDirectGrouping,
		nodeTypeLogicalTTUGrouping:
		w.Resolver = &baseResolver{
			interpreter: omni,
			tracker:     p.tracker,
			reporter:    reporter,
			bufferPool:  pl.bufferPool,
			numProcs:    pl.numProcs,
		}
	case nodeTypeOperator:
		switch p.source.GetLabel() {
		case weightedGraph.IntersectionOperator:
			w.Resolver = &intersectionResolver{
				interpreter: omni,
				tracker:     p.tracker,
				reporter:    reporter,
				bufferPool:  pl.bufferPool,
				numProcs:    pl.numProcs,
			}
		case weightedGraph.UnionOperator:
			w.Resolver = &baseResolver{
				interpreter: omni,
				tracker:     p.tracker,
				reporter:    reporter,
				bufferPool:  pl.bufferPool,
				numProcs:    pl.numProcs,
			}
		case weightedGraph.ExclusionOperator:
			w.Resolver = &exclusionResolver{
				interpreter: omni,
				tracker:     p.tracker,
				reporter:    reporter,
				bufferPool:  pl.bufferPool,
				numProcs:    pl.numProcs,
			}
		default:
			panic("unsupported operator node for reverse expand worker")
		}
	default:
		panic("unsupported node type for reverse expand worker")
	}

	workers[p.source] = &w

	switch p.source.GetNodeType() {
	case nodeTypeSpecificType, nodeTypeSpecificTypeAndRelation:
		if p.source == p.target.node {
			items := []Item{{Value: p.target.Object()}}
			p.tracker.Add(1)
			m := Message{
				Value:       items,
				ReceiptFunc: p.tracker.Dec,
			}
			w.Listen(&sender[*Edge, *Message]{
				nil,
				pipe.StaticRx(&m),
			})
		}
	case nodeTypeSpecificTypeWildcard:
		label := p.source.GetLabel()
		typePart := strings.Split(label, ":")[0]

		if p.source == p.target.node || typePart == p.target.node.GetLabel() {
			// source node is the target node or has the same type as the target.
			items := []Item{{Value: typePart + ":*"}}
			p.tracker.Add(1)
			m := Message{
				Value:       items,
				ReceiptFunc: p.tracker.Dec,
			}
			w.Listen(&sender[*Edge, *Message]{
				nil,
				pipe.StaticRx(&m),
			})
		}
	}

	edges, ok := pl.backend.Graph.GetEdgesFromNode(p.source)
	if !ok {
		return &w
	}

	for _, edge := range edges {
		nextPath := p

		if len(edge.GetRecursiveRelation()) == 0 && !edge.IsPartOfTupleCycle() {
			nextPath.tracker = nil
			nextPath.statusPool = nil
		}

		nextPath.source = edge.GetTo()

		to := pl.resolve(nextPath, workers)
		w.Listen(to.Subscribe(edge))
	}

	return &w
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
type Resolver[K any, T any, U any] interface {

	// resolve is a function that consumes messages from the
	// provided senders, and broadcasts the results of processing
	// the consumed messages to the provided listeners.
	Resolve(context.Context, []Sender[K, T], []Listener[K, U])
}

type Source *Node

type Sender[K any, T any] interface {
	Key() K
	pipe.Rx[T]
}

// sender is a struct that contains fields relevant to the producing
// end of a pipeline connection.
type sender[K any, T any] struct {
	key K
	pipe.Rx[T]
}

func (s *sender[K, T]) Key() K {
	return s.key
}

type Listener[K any, T any] interface {
	Key() K
	pipe.TxCloser[T]
}

// listener is a struct that contains fields relevant to the listening
// end of a pipeline connection.
type listener[K any, T any] struct {
	key K
	pipe.TxCloser[T]
}

func (l *listener[K, T]) Key() K {
	return l.key
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

func (t *Target) Object() string {
	objectParts := strings.Split(t.node.GetLabel(), "#")
	var objectType string
	if len(objectParts) > 0 {
		objectType = objectParts[0]
	}
	var value string

	switch t.node.GetNodeType() {
	case nodeTypeSpecificTypeWildcard:
		// the ':*' is part of the type
	case nodeTypeSpecificType, nodeTypeSpecificTypeAndRelation:
		value = ":" + t.id
	}
	return objectType + value
}

type Worker[K any, T any, U any] struct {
	senders   []Sender[K, T]
	listeners []Listener[K, U]
	Resolver  Resolver[K, T, U]
	finite    func()
	init      sync.Once
	wg        sync.WaitGroup

	// bufferSize is the value that will be set for the worker's internal pipe buffer.
	// The value must be a power of two; any other value will cause a panic.
	bufferSize int

	pipeExtendAfter   time.Duration
	pipeMaxExtensions int
}

func (w *Worker[K, T, U]) Close() {
	if w.finite != nil {
		w.finite()
	}
}

func (w *Worker[K, T, U]) Listen(s Sender[K, T]) {
	w.senders = append(w.senders, s)
}

func (w *Worker[K, T, U]) initialize(ctx context.Context) {
	ctx, span := pipelineTracer.Start(ctx, "worker")
	ctx, cancel := context.WithCancel(ctx)

	w.finite = sync.OnceFunc(func() {
		cancel()
		for _, lst := range w.listeners {
			lst.Close()
		}
	})

	w.wg.Add(1)
	go func() {
		defer span.End()
		defer w.wg.Done()
		defer w.Close()
		w.Resolver.Resolve(ctx, w.senders, w.listeners)
	}()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		defer w.Close()
		<-ctx.Done()
	}()
}

func (w *Worker[K, T, U]) Start(ctx context.Context) {
	w.init.Do(func() {
		w.initialize(ctx)
	})
}

func (w *Worker[K, T, U]) Subscribe(key K) Sender[K, U] {
	p := pipe.Must[U](w.bufferSize)

	// Configure extension behavior if set on pipeline
	if w.pipeExtendAfter > 0 {
		p.SetExtensionConfig(w.pipeExtendAfter, w.pipeMaxExtensions)
	}

	w.listeners = append(w.listeners, &listener[K, U]{
		key,
		p,
	})

	return &sender[K, U]{
		key,
		p,
	}
}

func (w *Worker[K, T, U]) Wait() {
	w.wg.Wait()
}
