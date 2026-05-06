package commands

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/build"
	"github.com/openfga/openfga/internal/cachecontroller"
	"github.com/openfga/openfga/internal/concurrency"
	"github.com/openfga/openfga/internal/condition"
	openfgaErrors "github.com/openfga/openfga/internal/errors"
	"github.com/openfga/openfga/internal/graph"
	"github.com/openfga/openfga/internal/shared"
	"github.com/openfga/openfga/internal/throttler"
	"github.com/openfga/openfga/internal/throttler/threshold"
	"github.com/openfga/openfga/internal/utils/apimethod"
	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/featureflags"
	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/server/commands/reverseexpand"
	"github.com/openfga/openfga/pkg/server/commands/reverseexpand/pipeline"
	serverconfig "github.com/openfga/openfga/pkg/server/config"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/storagewrappers"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

const streamedBufferSize = 100

var (
	furtherEvalRequiredCounter = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: build.ProjectName,
		Name:      "list_objects_further_eval_required_count",
		Help:      "Number of objects in a ListObjects call that needed to issue a Check call to determine a final result",
	})

	noFurtherEvalRequiredCounter = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: build.ProjectName,
		Name:      "list_objects_no_further_eval_required_count",
		Help:      "Number of objects in a ListObjects call that needed to issue a Check call to determine a final result",
	})
)

type ListObjectsQuery struct {
	datastore               storage.RelationshipTupleReader
	ff                      featureflags.Client
	logger                  logger.Logger
	listObjectsDeadline     time.Duration
	listObjectsMaxResults   uint32
	resolveNodeLimit        uint32
	resolveNodeBreadthLimit uint32
	maxConcurrentReads      uint32

	dispatchThrottlerConfig threshold.Config

	datastoreThrottlingEnabled bool
	datastoreThrottleThreshold int
	datastoreThrottleDuration  time.Duration

	checkResolver            graph.CheckResolver
	cacheSettings            serverconfig.CacheSettings
	sharedDatastoreResources *shared.SharedDatastoreResources

	optimizationsEnabled bool // Indicates if experimental optimizations are enabled for ListObjectsResolver
	useShadowCache       bool // Indicates that the shadow cache should be used instead of the main cache

	pipelineEnabled   bool // Indicates whether to run with the pipeline optimized code
	chunkSize         int
	bufferSize        int
	numProcs          int
	pipeExtendAfter   time.Duration
	pipeMaxExtensions int
}

type ListObjectsResolver interface {
	// Execute the ListObjectsQuery, returning a list of object IDs up to a maximum of q.listObjectsMaxResults
	// or until q.listObjectsDeadline is hit, whichever happens first.
	Execute(ctx context.Context, req *openfgav1.ListObjectsRequest) (*ListObjectsResponse, error)

	// ExecuteStreamed executes the ListObjectsQuery, returning a stream of object IDs.
	// It ignores the value of q.listObjectsMaxResults and returns all available results
	// until q.listObjectsDeadline is hit.
	ExecuteStreamed(ctx context.Context, req *openfgav1.StreamedListObjectsRequest, srv openfgav1.OpenFGAService_StreamedListObjectsServer) (*ListObjectsResolutionMetadata, error)
}

type ListObjectsResolutionMetadata struct {
	// The total number of database reads from reverse_expand and Check (if any) to complete the ListObjects request
	DatastoreQueryCount atomic.Uint32

	// The total number of items read from the database during a ListObjects request.
	DatastoreItemCount atomic.Uint64

	// The total number of dispatches aggregated from reverse_expand and check resolutions (if any) to complete the ListObjects request
	DispatchCounter atomic.Uint32

	// DispatchThrottled indicates whether this request was throttled by dispatch count.
	DispatchThrottled atomic.Bool

	// DatastoreThrottled indicates whether the request was throttled by the Datastore.
	DatastoreThrottled atomic.Bool

	// WasWeightedGraphUsed indicates whether the weighted graph was used as the algorithm for the ListObjects request.
	WasWeightedGraphUsed atomic.Bool

	// CheckCounter is the total number of check requests made during the ListObjects execution for the optimized path
	CheckCounter atomic.Uint32
}

type ListObjectsResponse struct {
	Objects            []string
	ResolutionMetadata ListObjectsResolutionMetadata
}

type ListObjectsQueryOption func(d *ListObjectsQuery)

func WithListObjectsDeadline(deadline time.Duration) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.listObjectsDeadline = deadline
	}
}

func WithDispatchThrottlerConfig(config threshold.Config) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.dispatchThrottlerConfig = config
	}
}

func WithListObjectsMaxResults(maxResults uint32) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.listObjectsMaxResults = maxResults
	}
}

// WithResolveNodeLimit see server.WithResolveNodeLimit.
func WithResolveNodeLimit(limit uint32) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.resolveNodeLimit = limit
	}
}

// WithResolveNodeBreadthLimit see server.WithResolveNodeBreadthLimit.
func WithResolveNodeBreadthLimit(limit uint32) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.resolveNodeBreadthLimit = limit
	}
}

func WithLogger(l logger.Logger) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.logger = l
	}
}

// WithMaxConcurrentReads see server.WithMaxConcurrentReadsForListObjects.
func WithMaxConcurrentReads(limit uint32) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.maxConcurrentReads = limit
	}
}

func WithListObjectsCache(sharedDatastoreResources *shared.SharedDatastoreResources, cacheSettings serverconfig.CacheSettings) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.cacheSettings = cacheSettings
		d.sharedDatastoreResources = sharedDatastoreResources
	}
}

func WithListObjectsDatastoreThrottler(enabled bool, threshold int, duration time.Duration) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.datastoreThrottlingEnabled = enabled
		d.datastoreThrottleThreshold = threshold
		d.datastoreThrottleDuration = duration
	}
}

func WithFeatureFlagClient(client featureflags.Client) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		if client != nil {
			d.ff = client
			return
		}

		d.ff = featureflags.NewNoopFeatureFlagClient()
	}
}

func WithListObjectsUseShadowCache(useShadowCache bool) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.useShadowCache = useShadowCache
	}
}

func WithListObjectsPipelineEnabled(value bool) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.pipelineEnabled = value
	}
}

func WithListObjectsChunkSize(value int) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.chunkSize = value
	}
}

func WithListObjectsBufferSize(value int) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.bufferSize = value
	}
}

func WithListObjectsNumProcs(value int) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.numProcs = value
	}
}

func WithListObjectsPipeExtension(extendAfter time.Duration, maxExtensions int) ListObjectsQueryOption {
	return func(d *ListObjectsQuery) {
		d.pipeExtendAfter = extendAfter
		d.pipeMaxExtensions = maxExtensions
	}
}

func NewListObjectsQuery(
	ds storage.RelationshipTupleReader,
	checkResolver graph.CheckResolver,
	storeID string,
	opts ...ListObjectsQueryOption,
) (*ListObjectsQuery, error) {
	if ds == nil {
		return nil, fmt.Errorf("the provided datastore parameter 'ds' must be non-nil")
	}

	if checkResolver == nil {
		return nil, fmt.Errorf("the provided CheckResolver parameter 'checkResolver' must be non-nil")
	}

	query := &ListObjectsQuery{
		datastore:               ds,
		logger:                  logger.NewNoopLogger(),
		listObjectsDeadline:     serverconfig.DefaultListObjectsDeadline,
		listObjectsMaxResults:   serverconfig.DefaultListObjectsMaxResults,
		resolveNodeLimit:        serverconfig.DefaultResolveNodeLimit,
		resolveNodeBreadthLimit: serverconfig.DefaultResolveNodeBreadthLimit,
		maxConcurrentReads:      serverconfig.DefaultMaxConcurrentReadsForListObjects,
		dispatchThrottlerConfig: threshold.Config{
			Throttler:    throttler.NewNoopThrottler(),
			Enabled:      serverconfig.DefaultListObjectsDispatchThrottlingEnabled,
			Threshold:    serverconfig.DefaultListObjectsDispatchThrottlingDefaultThreshold,
			MaxThreshold: serverconfig.DefaultListObjectsDispatchThrottlingMaxThreshold,
		},
		checkResolver: checkResolver,
		cacheSettings: serverconfig.NewDefaultCacheSettings(),
		sharedDatastoreResources: &shared.SharedDatastoreResources{
			CacheController: cachecontroller.NewNoopCacheController(),
		},
		optimizationsEnabled: false,
		useShadowCache:       false,
		ff:                   featureflags.NewNoopFeatureFlagClient(),
	}

	for _, opt := range opts {
		opt(query)
	}

	if query.ff.Boolean(serverconfig.ExperimentalListObjectsOptimizations, storeID) {
		query.optimizationsEnabled = true
	}

	return query, nil
}

type ListObjectsResult struct {
	ObjectID string
	Err      error
}

// listObjectsRequest captures the RPC request definition interface for the ListObjects API.
// The unary and streaming RPC definitions implement this interface, and so it can be used
// interchangeably for a canonical representation between the two.
type listObjectsRequest interface {
	GetStoreId() string
	GetAuthorizationModelId() string
	GetType() string
	GetRelation() string
	GetUser() string
	GetContextualTuples() *openfgav1.ContextualTupleKeys
	GetContext() *structpb.Struct
	GetConsistency() openfgav1.ConsistencyPreference
}

// evaluate fires of evaluation of the ListObjects query by delegating to
// [[reverseexpand.ReverseExpand#Execute]] and resolving the results yielded
// from it. If any results yielded by reverse expansion require further eval,
// then these results get dispatched to Check to resolve the residual outcome.
//
// The resultsChan is **always** closed by evaluate when it is done with its work,
// which is either when all results have been yielded, the deadline has been met,
// or some other terminal error case has occurred.
func (q *ListObjectsQuery) evaluate(
	ctx context.Context,
	req listObjectsRequest,
	resultsChan chan<- ListObjectsResult,
	maxResults uint32,
	resolutionMetadata *ListObjectsResolutionMetadata,
) error {
	targetObjectType := req.GetType()
	targetRelation := req.GetRelation()

	typesys, ok := typesystem.TypesystemFromContext(ctx)
	if !ok {
		return fmt.Errorf("%w: typesystem missing in context", openfgaErrors.ErrUnknown)
	}

	handler := func() {
		userObj, userRel := tuple.SplitObjectRelation(req.GetUser())
		userObjType, userObjID := tuple.SplitObject(userObj)

		var sourceUserRef reverseexpand.IsUserRef
		sourceUserRef = &reverseexpand.UserRefObject{
			Object: &openfgav1.Object{
				Type: userObjType,
				Id:   userObjID,
			},
		}

		if tuple.IsTypedWildcard(userObj) {
			sourceUserRef = &reverseexpand.UserRefTypedWildcard{Type: tuple.GetType(userObj)}
		}

		if userRel != "" {
			sourceUserRef = &reverseexpand.UserRefObjectRelation{
				ObjectRelation: &openfgav1.ObjectRelation{
					Object:   userObj,
					Relation: userRel,
				},
			}
		}

		var bufferSize uint32
		cappedMaxResults := uint32(math.Min(float64(maxResults), 1000)) // cap max results at 1000
		bufferSize = uint32(math.Max(float64(cappedMaxResults/10), 10)) // 10% of max results, but make it at least 10

		reverseExpandResultsChan := make(chan *reverseexpand.ReverseExpandResult, bufferSize)
		objectsFound := atomic.Uint32{}

		ds := storagewrappers.NewRequestStorageWrapperWithCache(
			q.datastore,
			req.GetContextualTuples().GetTupleKeys(),
			&storagewrappers.Operation{
				Method:            apimethod.ListObjects,
				Concurrency:       q.maxConcurrentReads,
				ThrottlingEnabled: q.datastoreThrottlingEnabled,
				ThrottleThreshold: q.datastoreThrottleThreshold,
				ThrottleDuration:  q.datastoreThrottleDuration,
			},
			storagewrappers.DataResourceConfiguration{
				Resources:      q.sharedDatastoreResources,
				CacheSettings:  q.cacheSettings,
				UseShadowCache: q.useShadowCache,
			},
		)

		reverseExpandQuery := reverseexpand.NewReverseExpandQuery(
			ds,
			typesys,
			reverseexpand.WithResolveNodeLimit(q.resolveNodeLimit),
			reverseexpand.WithDispatchThrottlerConfig(q.dispatchThrottlerConfig),
			reverseexpand.WithResolveNodeBreadthLimit(q.resolveNodeBreadthLimit),
			reverseexpand.WithLogger(q.logger),
			reverseexpand.WithCheckResolver(q.checkResolver),
			reverseexpand.WithListObjectOptimizationsEnabled(q.optimizationsEnabled),
		)

		reverseExpandDoneWithError := make(chan struct{}, 1)
		cancelCtx, cancel := context.WithCancel(ctx)
		defer cancel()
		pool := concurrency.NewPool(cancelCtx, int(1+q.resolveNodeBreadthLimit))

		pool.Go(func(ctx context.Context) error {
			reverseExpandResolutionMetadata := reverseexpand.NewResolutionMetadata()
			err := reverseExpandQuery.Execute(ctx, &reverseexpand.ReverseExpandRequest{
				StoreID:          req.GetStoreId(),
				ObjectType:       targetObjectType,
				Relation:         targetRelation,
				User:             sourceUserRef,
				ContextualTuples: req.GetContextualTuples().GetTupleKeys(),
				Context:          req.GetContext(),
				Consistency:      req.GetConsistency(),
			}, reverseExpandResultsChan, reverseExpandResolutionMetadata)
			if err != nil {
				reverseExpandDoneWithError <- struct{}{}
				return err
			}
			resolutionMetadata.DispatchCounter.Add(reverseExpandResolutionMetadata.DispatchCounter.Load())
			if !resolutionMetadata.DispatchThrottled.Load() && reverseExpandResolutionMetadata.DispatchThrottled.Load() {
				resolutionMetadata.DispatchThrottled.Store(true)
			}
			resolutionMetadata.CheckCounter.Add(reverseExpandResolutionMetadata.CheckCounter.Load())
			resolutionMetadata.WasWeightedGraphUsed.Store(reverseExpandResolutionMetadata.WasWeightedGraphUsed.Load())
			return nil
		})

	ConsumerReadLoop:
		for {
			select {
			case <-reverseExpandDoneWithError:
				cancel() // cancel any inflight work if e.g. model too complex
				break ConsumerReadLoop
			case <-ctx.Done():
				cancel() // cancel any inflight work if e.g. deadline exceeded
				break ConsumerReadLoop
			case res, channelOpen := <-reverseExpandResultsChan:
				if !channelOpen {
					// don't cancel here. Reverse Expand has finished finding candidate object IDs
					// but since we haven't collected "maxResults",
					// we need to wait until all the inflight Checks finish in the hopes that
					// we collect a few more object IDs.
					// if we send a cancellation now, we might miss those.
					break ConsumerReadLoop
				}

				if (maxResults != 0) && objectsFound.Load() >= maxResults {
					cancel() // cancel any inflight work if we already found enough results
					break ConsumerReadLoop
				}

				if res.ResultStatus == reverseexpand.NoFurtherEvalStatus {
					noFurtherEvalRequiredCounter.Inc()
					trySendObject(ctx, res.Object, &objectsFound, maxResults, resultsChan)
					continue
				}

				furtherEvalRequiredCounter.Inc()

				pool.Go(func(ctx context.Context) error {
					resp, checkRequestMetadata, err := NewCheckCommand(q.datastore, q.checkResolver, typesys,
						WithCheckCommandLogger(q.logger),
						WithCheckCommandMaxConcurrentReads(q.maxConcurrentReads),
						WithCheckDatastoreThrottler(
							q.datastoreThrottlingEnabled,
							q.datastoreThrottleThreshold,
							q.datastoreThrottleDuration,
						),
					).
						Execute(ctx, &CheckCommandParams{
							StoreID:          req.GetStoreId(),
							TupleKey:         tuple.NewCheckRequestTupleKey(res.Object, req.GetRelation(), req.GetUser()),
							ContextualTuples: req.GetContextualTuples(),
							Context:          req.GetContext(),
							Consistency:      req.GetConsistency(),
						})
					if err != nil {
						return err
					}
					resolutionMetadata.DatastoreQueryCount.Add(resp.GetResolutionMetadata().DatastoreQueryCount)
					resolutionMetadata.DatastoreItemCount.Add(resp.GetResolutionMetadata().DatastoreItemCount)
					resolutionMetadata.DispatchCounter.Add(checkRequestMetadata.DispatchCounter.Load())
					if !resolutionMetadata.DispatchThrottled.Load() && checkRequestMetadata.DispatchThrottled.Load() {
						resolutionMetadata.DispatchThrottled.Store(true)
					}
					if resp.Allowed {
						trySendObject(ctx, res.Object, &objectsFound, maxResults, resultsChan)
					}
					return nil
				})
			}
		}

		err := pool.Wait()
		if err != nil {
			if !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, context.Canceled) {
				resultsChan <- ListObjectsResult{Err: err}
			}
			// TODO set header to indicate "deadline exceeded"
		}
		close(resultsChan)
		dsMeta := ds.GetMetadata()
		resolutionMetadata.DatastoreQueryCount.Add(dsMeta.DatastoreQueryCount)
		resolutionMetadata.DatastoreItemCount.Add(dsMeta.DatastoreItemCount)
		resolutionMetadata.DatastoreThrottled.Store(dsMeta.WasThrottled)
	}

	go handler()

	return nil
}

func trySendObject(ctx context.Context, object string, objectsFound *atomic.Uint32, maxResults uint32, resultsChan chan<- ListObjectsResult) {
	if maxResults != 0 {
		if objectsFound.Add(1) > maxResults {
			return
		}
	}
	concurrency.TrySendThroughChannel(ctx, ListObjectsResult{ObjectID: object}, resultsChan)
}

// Execute the ListObjectsQuery, returning a list of object IDs up to a maximum of q.listObjectsMaxResults
// or until q.listObjectsDeadline is hit, whichever happens first.
func (q *ListObjectsQuery) Execute(
	ctx context.Context,
	req *openfgav1.ListObjectsRequest,
) (*ListObjectsResponse, error) {
	maxResults := q.listObjectsMaxResults

	timeoutCtx := ctx
	if q.listObjectsDeadline != 0 {
		var cancel context.CancelFunc
		timeoutCtx, cancel = context.WithTimeout(ctx, q.listObjectsDeadline)
		defer cancel()
	}

	targetObjectType := req.GetType()
	targetRelation := req.GetRelation()

	typesys, ok := typesystem.TypesystemFromContext(ctx)
	if !ok {
		return nil, fmt.Errorf("%w: typesystem missing in context", openfgaErrors.ErrUnknown)
	}

	if !typesystem.IsSchemaVersionSupported(typesys.GetSchemaVersion()) {
		return nil, serverErrors.ValidationError(typesystem.ErrInvalidSchemaVersion)
	}

	for _, ctxTuple := range req.GetContextualTuples().GetTupleKeys() {
		if err := validation.ValidateTupleForWrite(typesys, ctxTuple); err != nil {
			return nil, serverErrors.HandleTupleValidateError(err)
		}
	}

	_, err := typesys.GetRelation(targetObjectType, targetRelation)
	if err != nil {
		if errors.Is(err, typesystem.ErrObjectTypeUndefined) {
			return nil, serverErrors.TypeNotFound(targetObjectType)
		}

		if errors.Is(err, typesystem.ErrRelationUndefined) {
			return nil, serverErrors.RelationNotFound(targetRelation, targetObjectType, nil)
		}

		return nil, serverErrors.HandleError("", err)
	}

	if err := validation.ValidateUser(typesys, req.GetUser()); err != nil {
		return nil, serverErrors.ValidationError(fmt.Errorf("invalid 'user' value: %w", err))
	}

	if req.GetConsistency() != openfgav1.ConsistencyPreference_HIGHER_CONSISTENCY {
		if q.cacheSettings.ShouldCacheListObjectsIterators() {
			// Kick off background job to check if cache records are stale, invalidating where needed
			q.sharedDatastoreResources.CacheController.InvalidateIfNeeded(ctx, req.GetStoreId())
		}
		if q.cacheSettings.ShouldShadowCacheListObjectsIterators() {
			q.sharedDatastoreResources.ShadowCacheController.InvalidateIfNeeded(ctx, req.GetStoreId())
		}
	}

	wgraph := typesys.GetWeightedGraph()

	if wgraph != nil && q.pipelineEnabled {
		ds := storagewrappers.NewRequestStorageWrapperWithCache(
			q.datastore,
			req.GetContextualTuples().GetTupleKeys(),
			&storagewrappers.Operation{
				Method:            apimethod.ListObjects,
				Concurrency:       q.maxConcurrentReads,
				ThrottlingEnabled: q.datastoreThrottlingEnabled,
				ThrottleThreshold: q.datastoreThrottleThreshold,
				ThrottleDuration:  q.datastoreThrottleDuration,
			},
			storagewrappers.DataResourceConfiguration{
				Resources:      q.sharedDatastoreResources,
				CacheSettings:  q.cacheSettings,
				UseShadowCache: q.useShadowCache,
			},
		)

		backend := &pipeline.Backend{
			Datastore:  ds,
			StoreID:    req.GetStoreId(),
			TypeSystem: typesys,
			Context:    req.GetContext(),
			Graph:      wgraph,
			Preference: req.GetConsistency(),
		}

		var options []pipeline.Option

		if q.chunkSize > 0 {
			options = append(options, pipeline.WithChunkSize(q.chunkSize))
		}

		if q.bufferSize > 0 {
			options = append(options, pipeline.WithBufferSize(q.bufferSize))
		}

		if q.numProcs > 0 {
			options = append(options, pipeline.WithNumProcs(q.numProcs))
		}

		if q.pipeExtendAfter > 0 {
			options = append(options, pipeline.WithPipeExtension(q.pipeExtendAfter, q.pipeMaxExtensions))
		}

		pl, err := pipeline.New(backend, options...)
		if err != nil {
			return nil, serverErrors.ValidationError(err)
		}

		var source pipeline.Source
		var target pipeline.Target

		if source, ok = pl.Source(targetObjectType, targetRelation); !ok {
			return nil, serverErrors.ValidationError(fmt.Errorf("object: %s relation: %s not in graph", targetObjectType, targetRelation))
		}

		userParts := strings.Split(req.GetUser(), "#")

		objectParts := strings.Split(userParts[0], ":")
		objectType := objectParts[0]
		objectID := objectParts[1]

		if len(userParts) > 1 {
			objectType += "#" + userParts[1]
		}

		if target, ok = pl.Target(objectType, objectID); !ok {
			return nil, serverErrors.ValidationError(fmt.Errorf("user: %s relation: %s not in graph", objectType, objectID))
		}

		seq := pl.Build(timeoutCtx, source, target)

		var res ListObjectsResponse

		for obj := range seq {
			if timeoutCtx.Err() != nil {
				break
			}

			// If the error is from a context cancelation, the current
			// behavior for ListObjects is to not report it.
			if obj.Err != nil && !errors.Is(obj.Err, context.Canceled) && !errors.Is(obj.Err, context.DeadlineExceeded) {
				return nil, serverErrors.HandleError("", obj.Err)
			}

			res.Objects = append(res.Objects, obj.Value)

			// Check if we've reached the max results limit
			if maxResults > 0 && uint32(len(res.Objects)) >= maxResults {
				break
			}
		}

		dsMeta := ds.GetMetadata()
		res.ResolutionMetadata.DatastoreQueryCount.Add(dsMeta.DatastoreQueryCount)
		res.ResolutionMetadata.DatastoreItemCount.Add(dsMeta.DatastoreItemCount)
		return &res, nil
	}

	// --------- OLD STUFF -----------
	resultsChan := make(chan ListObjectsResult, 1)
	if maxResults > 0 {
		resultsChan = make(chan ListObjectsResult, maxResults)
	}

	var listObjectsResponse ListObjectsResponse

	err = q.evaluate(timeoutCtx, req, resultsChan, maxResults, &listObjectsResponse.ResolutionMetadata)
	if err != nil {
		return nil, err
	}

	listObjectsResponse.Objects = make([]string, 0, maxResults)

	var errs error

	for result := range resultsChan {
		if result.Err != nil {
			if errors.Is(result.Err, graph.ErrResolutionDepthExceeded) {
				return nil, serverErrors.ErrAuthorizationModelResolutionTooComplex
			}

			if errors.Is(result.Err, condition.ErrEvaluationFailed) {
				errs = errors.Join(errs, result.Err)
				continue
			}

			return nil, serverErrors.HandleError("", result.Err)
		}

		listObjectsResponse.Objects = append(listObjectsResponse.Objects, result.ObjectID)
	}

	if len(listObjectsResponse.Objects) < int(maxResults) && errs != nil {
		return nil, errs
	}

	return &listObjectsResponse, nil
}

// ExecuteStreamed executes the ListObjectsQuery, returning a stream of object IDs.
// It ignores the value of q.listObjectsMaxResults and returns all available results
// until q.listObjectsDeadline is hit.
func (q *ListObjectsQuery) ExecuteStreamed(ctx context.Context, req *openfgav1.StreamedListObjectsRequest, srv openfgav1.OpenFGAService_StreamedListObjectsServer) (*ListObjectsResolutionMetadata, error) {
	maxResults := uint32(math.MaxUint32)

	timeoutCtx := ctx
	if q.listObjectsDeadline != 0 {
		var cancel context.CancelFunc
		timeoutCtx, cancel = context.WithTimeout(ctx, q.listObjectsDeadline)
		defer cancel()
	}

	var resolutionMetadata ListObjectsResolutionMetadata

	targetObjectType := req.GetType()
	targetRelation := req.GetRelation()

	typesys, ok := typesystem.TypesystemFromContext(ctx)
	if !ok {
		return nil, fmt.Errorf("%w: typesystem missing in context", openfgaErrors.ErrUnknown)
	}

	if !typesystem.IsSchemaVersionSupported(typesys.GetSchemaVersion()) {
		return nil, serverErrors.ValidationError(typesystem.ErrInvalidSchemaVersion)
	}

	for _, ctxTuple := range req.GetContextualTuples().GetTupleKeys() {
		if err := validation.ValidateTupleForWrite(typesys, ctxTuple); err != nil {
			return nil, serverErrors.HandleTupleValidateError(err)
		}
	}

	_, err := typesys.GetRelation(targetObjectType, targetRelation)
	if err != nil {
		if errors.Is(err, typesystem.ErrObjectTypeUndefined) {
			return nil, serverErrors.TypeNotFound(targetObjectType)
		}

		if errors.Is(err, typesystem.ErrRelationUndefined) {
			return nil, serverErrors.RelationNotFound(targetRelation, targetObjectType, nil)
		}

		return nil, serverErrors.HandleError("", err)
	}

	if err := validation.ValidateUser(typesys, req.GetUser()); err != nil {
		return nil, serverErrors.ValidationError(fmt.Errorf("invalid 'user' value: %w", err))
	}

	wgraph := typesys.GetWeightedGraph()

	if wgraph != nil && q.pipelineEnabled {
		ds := storagewrappers.NewRequestStorageWrapperWithCache(
			q.datastore,
			req.GetContextualTuples().GetTupleKeys(),
			&storagewrappers.Operation{
				Method:            apimethod.ListObjects,
				Concurrency:       q.maxConcurrentReads,
				ThrottlingEnabled: q.datastoreThrottlingEnabled,
				ThrottleThreshold: q.datastoreThrottleThreshold,
				ThrottleDuration:  q.datastoreThrottleDuration,
			},
			storagewrappers.DataResourceConfiguration{
				Resources:      q.sharedDatastoreResources,
				CacheSettings:  q.cacheSettings,
				UseShadowCache: q.useShadowCache,
			},
		)

		backend := &pipeline.Backend{
			Datastore:  ds,
			StoreID:    req.GetStoreId(),
			TypeSystem: typesys,
			Context:    req.GetContext(),
			Graph:      wgraph,
			Preference: req.GetConsistency(),
		}

		var options []pipeline.Option

		if q.chunkSize > 0 {
			options = append(options, pipeline.WithChunkSize(q.chunkSize))
		}

		if q.bufferSize > 0 {
			options = append(options, pipeline.WithBufferSize(q.bufferSize))
		}

		if q.numProcs > 0 {
			options = append(options, pipeline.WithNumProcs(q.numProcs))
		}

		if q.pipeExtendAfter > 0 {
			options = append(options, pipeline.WithPipeExtension(q.pipeExtendAfter, q.pipeMaxExtensions))
		}

		pl, err := pipeline.New(backend, options...)
		if err != nil {
			return nil, serverErrors.ValidationError(err)
		}

		var source pipeline.Source
		var target pipeline.Target

		if source, ok = pl.Source(targetObjectType, targetRelation); !ok {
			return nil, serverErrors.ValidationError(fmt.Errorf("object: %s relation: %s not in graph", targetObjectType, targetRelation))
		}

		userParts := strings.Split(req.GetUser(), "#")

		objectParts := strings.Split(userParts[0], ":")
		objectType := objectParts[0]
		objectID := objectParts[1]

		if len(userParts) > 1 {
			objectType += "#" + userParts[1]
		}

		if target, ok = pl.Target(objectType, objectID); !ok {
			return nil, serverErrors.ValidationError(fmt.Errorf("user: %s relation: %s not in graph", objectType, objectID))
		}

		seq := pl.Build(timeoutCtx, source, target)

		var listObjectsCount uint32 = 0

		for obj := range seq {
			if timeoutCtx.Err() != nil {
				break
			}

			// If the error is from a context cancelation, the current
			// behavior for ListObjects is to not report it.
			if obj.Err != nil && !errors.Is(obj.Err, context.Canceled) && !errors.Is(obj.Err, context.DeadlineExceeded) {
				if errors.Is(obj.Err, condition.ErrEvaluationFailed) {
					return nil, serverErrors.ValidationError(obj.Err)
				}
				return nil, serverErrors.HandleError("", obj.Err)
			}

			if err := srv.Send(&openfgav1.StreamedListObjectsResponse{
				Object: obj.Value,
			}); err != nil {
				return nil, serverErrors.HandleError("", err)
			}

			listObjectsCount++

			// Check if we've reached the max results limit
			if maxResults > 0 && listObjectsCount >= maxResults {
				break
			}
		}

		dsMeta := ds.GetMetadata()
		resolutionMetadata.DatastoreQueryCount.Add(dsMeta.DatastoreQueryCount)
		resolutionMetadata.DatastoreItemCount.Add(dsMeta.DatastoreItemCount)
		return &resolutionMetadata, nil
	}

	// make a buffered channel so that writer goroutines aren't blocked when attempting to send a result
	resultsChan := make(chan ListObjectsResult, streamedBufferSize)

	err = q.evaluate(timeoutCtx, req, resultsChan, maxResults, &resolutionMetadata)
	if err != nil {
		return nil, err
	}

	for result := range resultsChan {
		if result.Err != nil {
			if errors.Is(result.Err, graph.ErrResolutionDepthExceeded) {
				return nil, serverErrors.ErrAuthorizationModelResolutionTooComplex
			}

			if errors.Is(result.Err, condition.ErrEvaluationFailed) {
				return nil, serverErrors.ValidationError(result.Err)
			}

			return nil, serverErrors.HandleError("", result.Err)
		}

		if err := srv.Send(&openfgav1.StreamedListObjectsResponse{
			Object: result.ObjectID,
		}); err != nil {
			return nil, serverErrors.HandleError("", err)
		}
	}

	return &resolutionMetadata, nil
}
