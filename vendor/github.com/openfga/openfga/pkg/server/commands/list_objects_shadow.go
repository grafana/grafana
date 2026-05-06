package commands

import (
	"context"
	"errors"
	"maps"
	"slices"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.uber.org/zap"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/graph"
	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/typesystem"
)

const ListObjectsShadowExecute = "ShadowedListObjectsQuery.Execute"

type shadowedListObjectsQuery struct {
	main          ListObjectsResolver
	shadow        ListObjectsResolver
	shadowTimeout time.Duration // A time.Duration specifying the maximum amount of time to wait for the shadow list_objects query to complete. If the shadow query exceeds this shadowTimeout, it will be cancelled, and its result will be ignored, but the shadowTimeout event will be logged.
	maxDeltaItems int           // The maximum number of items to log in the delta between the main and shadow results. This prevents excessive logging in case of large differences.
	logger        logger.Logger
	// only used for testing signals
	wg *sync.WaitGroup
}

type ShadowListObjectsQueryOption func(d *ShadowListObjectsQueryConfig)

// WithShadowListObjectsQueryEnabled sets whether the shadow list_objects query should use optimizations.
func WithShadowListObjectsQueryEnabled(enabled bool) ShadowListObjectsQueryOption {
	return func(c *ShadowListObjectsQueryConfig) {
		c.shadowEnabled = enabled
	}
}

// WithShadowListObjectsQueryTimeout sets the shadowTimeout for the shadow list_objects query.
func WithShadowListObjectsQueryTimeout(timeout time.Duration) ShadowListObjectsQueryOption {
	return func(c *ShadowListObjectsQueryConfig) {
		c.shadowTimeout = timeout
	}
}

func WithShadowListObjectsQueryLogger(logger logger.Logger) ShadowListObjectsQueryOption {
	return func(c *ShadowListObjectsQueryConfig) {
		c.logger = logger
	}
}

func WithShadowListObjectsQueryMaxDeltaItems(maxDeltaItems int) ShadowListObjectsQueryOption {
	return func(c *ShadowListObjectsQueryConfig) {
		c.maxDeltaItems = maxDeltaItems
	}
}

type ShadowListObjectsQueryConfig struct {
	shadowEnabled bool          // A boolean flag to globally enable or disable the shadow mode for list_objects queries. When false, the shadow query will not be executed.
	shadowTimeout time.Duration // A time.Duration specifying the maximum amount of time to wait for the shadow list_objects query to complete. If the shadow query exceeds this shadowTimeout, it will be cancelled, and its result will be ignored, but the shadowTimeout event will be logged.
	maxDeltaItems int           // The maximum number of items to log in the delta between the main and shadow results. This prevents excessive logging in case of large differences.
	logger        logger.Logger
}

func NewShadowListObjectsQueryConfig(opts ...ShadowListObjectsQueryOption) *ShadowListObjectsQueryConfig {
	result := &ShadowListObjectsQueryConfig{
		shadowEnabled: false,                  // Disabled by default
		shadowTimeout: 1 * time.Second,        // Default shadowTimeout for shadow queries
		logger:        logger.NewNoopLogger(), // Default to a noop logger
		maxDeltaItems: 100,                    // Default max delta items to log
	}
	for _, opt := range opts {
		opt(result)
	}
	return result
}

// NewListObjectsQueryWithShadowConfig creates a new ListObjectsResolver that can run in shadow mode based on the provided ShadowListObjectsQueryConfig.
func NewListObjectsQueryWithShadowConfig(
	ds storage.RelationshipTupleReader,
	checkResolver graph.CheckResolver,
	shadowConfig *ShadowListObjectsQueryConfig,
	storeID string,
	opts ...ListObjectsQueryOption,
) (ListObjectsResolver, error) {
	if shadowConfig != nil && shadowConfig.shadowEnabled {
		return newShadowedListObjectsQuery(ds, checkResolver, shadowConfig, storeID, opts...)
	}

	return NewListObjectsQuery(ds, checkResolver, storeID, opts...)
}

// newShadowedListObjectsQuery creates a new ListObjectsResolver that runs two queries in parallel: one with the pipeline enabled and one without.
func newShadowedListObjectsQuery(
	ds storage.RelationshipTupleReader,
	checkResolver graph.CheckResolver,
	shadowConfig *ShadowListObjectsQueryConfig,
	storeID string,
	opts ...ListObjectsQueryOption,
) (ListObjectsResolver, error) {
	if shadowConfig == nil {
		return nil, errors.New("shadowConfig must be set")
	}
	standard, err := NewListObjectsQuery(ds, checkResolver, storeID,
		// force disable pipeline
		slices.Concat(opts, []ListObjectsQueryOption{WithListObjectsPipelineEnabled(false)})...,
	)
	if err != nil {
		return nil, err
	}
	optimized, err := NewListObjectsQuery(ds, checkResolver, storeID,
		// enable pipeline
		slices.Concat(opts, []ListObjectsQueryOption{WithListObjectsPipelineEnabled(true), WithListObjectsUseShadowCache(true)})...,
	)
	if err != nil {
		return nil, err
	}

	result := &shadowedListObjectsQuery{
		main:          standard,
		shadow:        optimized,
		shadowTimeout: shadowConfig.shadowTimeout,
		logger:        shadowConfig.logger,
		maxDeltaItems: shadowConfig.maxDeltaItems,
		wg:            &sync.WaitGroup{}, // only used for testing signals
	}

	return result, nil
}

func (q *shadowedListObjectsQuery) Execute(
	ctx context.Context,
	req *openfgav1.ListObjectsRequest,
) (*ListObjectsResponse, error) {
	cloneCtx := context.WithoutCancel(ctx) // needs typesystem and datastore etc

	startTime := time.Now()
	res, err := q.main.Execute(ctx, req)
	if err != nil {
		return nil, err
	}
	latency := time.Since(startTime)

	// If shadow mode is not shadowEnabled, just execute the main query
	if q.checkShadowModePreconditions(cloneCtx, req) {
		q.wg.Add(1) // only used for testing signals
		go func() {
			startTime = time.Now()
			defer func() {
				defer q.wg.Done() // only used for testing signals
				if r := recover(); r != nil {
					q.logger.ErrorWithContext(cloneCtx, "panic recovered",
						loShadowLogFields(req,
							zap.Duration("main_latency", latency),
							zap.Duration("shadow_latency", time.Since(startTime)),
							zap.Int("main_result_count", len(res.Objects)),
							zap.Any("error", r),
						)...,
					)
				}
			}()

			q.executeShadowModeAndCompareResults(cloneCtx, req, res, latency)
		}()
	}
	return res, err
}

func (q *shadowedListObjectsQuery) ExecuteStreamed(ctx context.Context, req *openfgav1.StreamedListObjectsRequest, srv openfgav1.OpenFGAService_StreamedListObjectsServer) (*ListObjectsResolutionMetadata, error) {
	return q.main.ExecuteStreamed(ctx, req, srv)
}

// executeShadowMode executes the main and shadow functions in parallel, returning the result of the main function if shadow mode is not shadowEnabled or if the shadow function fails.
// It compares the results of the main and shadow functions, logging any differences.
// If the shadow function takes longer than shadowTimeout, it will be cancelled, and its result will be ignored, but the shadowTimeout event will be logged.
// This function is designed to be run in a separate goroutine to avoid blocking the main execution flow.
func (q *shadowedListObjectsQuery) executeShadowModeAndCompareResults(ctx context.Context, req *openfgav1.ListObjectsRequest, mainResult *ListObjectsResponse, latency time.Duration) {
	ctx, span := tracer.Start(ctx, "shadow")
	defer span.End()

	shadowCtx, shadowCancel := context.WithTimeout(ctx, q.shadowTimeout)
	defer shadowCancel()

	startTime := time.Now()
	shadowRes, errShadow := q.shadow.Execute(shadowCtx, req)
	shadowLatency := time.Since(startTime)

	var mainQueryCount uint32
	var mainItemCount uint64
	var mainResultObjects []string
	if mainResult != nil {
		mainQueryCount = mainResult.ResolutionMetadata.DatastoreQueryCount.Load()
		mainItemCount = mainResult.ResolutionMetadata.DatastoreItemCount.Load()
		mainResultObjects = mainResult.Objects
	}

	if errShadow != nil {
		q.logger.WarnWithContext(ctx, "shadowed list objects error",
			loShadowLogFields(req,
				zap.Duration("main_latency", latency),
				zap.Duration("shadow_latency", shadowLatency),
				zap.Int("main_result_count", len(mainResultObjects)),
				zap.Any("error", errShadow),
			)...,
		)
		return
	}

	var resultShadowed []string
	var shadowQueryCount uint32
	var shadowItemCount uint64
	if shadowRes != nil {
		resultShadowed = shadowRes.Objects
		shadowQueryCount = shadowRes.ResolutionMetadata.DatastoreQueryCount.Load()
		shadowItemCount = shadowRes.ResolutionMetadata.DatastoreItemCount.Load()
	}

	mapResultMain := keyMapFromSlice(mainResultObjects)
	mapResultShadow := keyMapFromSlice(resultShadowed)

	fields := []zap.Field{
		zap.Duration("main_latency", latency),
		zap.Duration("shadow_latency", shadowLatency),
		zap.Int("main_result_count", len(mainResultObjects)),
		zap.Int("shadow_result_count", len(resultShadowed)),
		zap.Uint32("main_datastore_query_count", mainQueryCount),
		zap.Uint32("shadow_datastore_query_count", shadowQueryCount),
		zap.Uint64("main_datastore_item_count", mainItemCount),
		zap.Uint64("shadow_datastore_item_count", shadowItemCount),
	}

	// compare sorted string arrays - sufficient for equality check
	if !maps.Equal(mapResultMain, mapResultShadow) {
		span.SetAttributes(attribute.Bool("matches", false))
		delta := calculateDelta(mapResultMain, mapResultShadow)
		totalDelta := len(delta)
		// Limit the delta to maxDeltaItems
		if totalDelta > q.maxDeltaItems {
			delta = delta[:q.maxDeltaItems]
		}

		fields = append(
			fields,
			zap.Bool("is_match", false),
			zap.Int("total_delta", totalDelta),
			zap.Any("delta", delta),
		)

		// log the differences if the shadow query failed or if the results are not equal
		q.logger.WarnWithContext(ctx, "shadowed list objects result difference",
			loShadowLogFields(req, fields...)...,
		)
	} else {
		span.SetAttributes(attribute.Bool("matches", true))
		fields = append(
			fields,
			zap.Bool("is_match", true),
		)

		q.logger.InfoWithContext(ctx, "shadowed list objects result matches",
			loShadowLogFields(req, fields...)...,
		)
	}
}

// checkShadowModePreconditions checks if the shadow mode preconditions are met:
//   - If the weighted graph does not exist, skip the shadow query.
func (q *shadowedListObjectsQuery) checkShadowModePreconditions(ctx context.Context, req *openfgav1.ListObjectsRequest) bool {
	typesys, ok := typesystem.TypesystemFromContext(ctx)
	if !ok {
		return false
	}

	if typesys.GetWeightedGraph() == nil {
		q.logger.InfoWithContext(ctx, "shadowed list objects query skipped due to missing weighted graph",
			loShadowLogFields(req)...,
		)
		return false
	}

	return true
}

func loShadowLogFields(req *openfgav1.ListObjectsRequest, fields ...zap.Field) []zap.Field {
	return append([]zap.Field{
		zap.String("func", ListObjectsShadowExecute),
		zap.Any("request", req),
		zap.String("store_id", req.GetStoreId()),
		zap.String("model_id", req.GetAuthorizationModelId()),
	}, fields...)
}

// keyMapFromSlice creates a map from a slice of strings, where each string is a key in the map.
func keyMapFromSlice(slice []string) map[string]struct{} {
	result := make(map[string]struct{}, len(slice))
	for _, item := range slice {
		result[item] = struct{}{}
	}
	return result
}

// calculateDelta calculates the delta between two maps of string keys.
func calculateDelta(mapResultMain map[string]struct{}, mapResultShadow map[string]struct{}) []string {
	delta := make([]string, 0, len(mapResultMain)+len(mapResultShadow))
	// Find objects in shadow but not in main
	for key := range mapResultMain {
		if _, exists := mapResultShadow[key]; !exists {
			delta = append(delta, "-"+key) // object in main but not in shadow
		}
	}
	for key := range mapResultShadow {
		if _, exists := mapResultMain[key]; !exists {
			delta = append(delta, "+"+key) // object in shadow but not in main
		}
	}
	// Sort the delta for consistent result
	slices.Sort(delta)
	return delta
}
