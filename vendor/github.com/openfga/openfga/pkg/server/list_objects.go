package server

import (
	"context"
	"errors"
	"time"

	grpc_ctxtags "github.com/grpc-ecosystem/go-grpc-middleware/tags"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/condition"
	"github.com/openfga/openfga/internal/graph"
	"github.com/openfga/openfga/internal/throttler/threshold"
	"github.com/openfga/openfga/internal/utils"
	"github.com/openfga/openfga/internal/utils/apimethod"
	"github.com/openfga/openfga/pkg/middleware/validator"
	"github.com/openfga/openfga/pkg/server/commands"
	serverconfig "github.com/openfga/openfga/pkg/server/config"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/telemetry"
	"github.com/openfga/openfga/pkg/typesystem"
)

func (s *Server) ListObjects(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	start := time.Now()

	targetObjectType := req.GetType()
	storeID := req.GetStoreId()

	ctx, span := tracer.Start(ctx, apimethod.ListObjects.String(), trace.WithAttributes(
		attribute.String("store_id", storeID),
		attribute.String("object_type", targetObjectType),
		attribute.String("relation", req.GetRelation()),
		attribute.String("user", req.GetUser()),
		attribute.String("consistency", req.GetConsistency().String()),
	))
	defer span.End()

	if !validator.RequestIsValidatedFromContext(ctx) {
		if err := req.Validate(); err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
	}

	// TODO: This should be apimethod.ListObjects, but is it considered a breaking change to move?
	const methodName = "listobjects"

	ctx = telemetry.ContextWithRPCInfo(ctx, telemetry.RPCInfo{
		Service: s.serviceName,
		Method:  methodName,
	})

	err := s.checkAuthz(ctx, storeID, apimethod.ListObjects)
	if err != nil {
		return nil, err
	}

	typesys, err := s.resolveTypesystem(ctx, storeID, req.GetAuthorizationModelId())
	if err != nil {
		return nil, err
	}
	req.AuthorizationModelId = typesys.GetAuthorizationModelID() // the resolved model id

	builder := s.getListObjectsCheckResolverBuilder(storeID)
	checkResolver, checkResolverCloser, err := builder.Build()
	if err != nil {
		return nil, err
	}
	defer checkResolverCloser()

	q, err := commands.NewListObjectsQueryWithShadowConfig(
		s.datastore,
		checkResolver,
		commands.NewShadowListObjectsQueryConfig(
			commands.WithShadowListObjectsQueryEnabled(s.featureFlagClient.Boolean(serverconfig.ExperimentalShadowListObjects, req.GetStoreId())),
			commands.WithShadowListObjectsQueryTimeout(s.shadowListObjectsQueryTimeout),
			commands.WithShadowListObjectsQueryMaxDeltaItems(s.shadowListObjectsQueryMaxDeltaItems),
			commands.WithShadowListObjectsQueryLogger(s.logger),
		),
		storeID,
		commands.WithLogger(s.logger),
		commands.WithListObjectsDeadline(s.listObjectsDeadline),
		commands.WithListObjectsMaxResults(s.listObjectsMaxResults),
		commands.WithDispatchThrottlerConfig(threshold.Config{
			Throttler:    s.listObjectsDispatchThrottler,
			Enabled:      s.listObjectsDispatchThrottlingEnabled,
			Threshold:    s.listObjectsDispatchDefaultThreshold,
			MaxThreshold: s.listObjectsDispatchThrottlingMaxThreshold,
		}),
		commands.WithResolveNodeLimit(s.resolveNodeLimit),
		commands.WithResolveNodeBreadthLimit(s.resolveNodeBreadthLimit),
		commands.WithMaxConcurrentReads(s.maxConcurrentReadsForListObjects),
		commands.WithListObjectsCache(s.sharedDatastoreResources, s.cacheSettings),
		commands.WithListObjectsDatastoreThrottler(
			s.featureFlagClient.Boolean(serverconfig.ExperimentalDatastoreThrottling, storeID),
			s.listObjectsDatastoreThrottleThreshold,
			s.listObjectsDatastoreThrottleDuration,
		),
		commands.WithListObjectsPipelineEnabled(s.featureFlagClient.Boolean(serverconfig.ExperimentalPipelineListObjects, storeID)),
		commands.WithListObjectsChunkSize(s.listObjectsChunkSize),
		commands.WithListObjectsBufferSize(s.listObjectsBufferSize),
		commands.WithListObjectsNumProcs(s.listObjectsNumProcs),
		commands.WithListObjectsPipeExtension(s.listObjectsPipeExtendAfter, s.listObjectsPipeMaxExtensions),
		commands.WithFeatureFlagClient(s.featureFlagClient),
	)
	if err != nil {
		return nil, serverErrors.NewInternalError("", err)
	}

	result, err := q.Execute(
		typesystem.ContextWithTypesystem(ctx, typesys),
		&openfgav1.ListObjectsRequest{
			StoreId:              storeID,
			ContextualTuples:     req.GetContextualTuples(),
			AuthorizationModelId: req.GetAuthorizationModelId(),
			Type:                 targetObjectType,
			Relation:             req.GetRelation(),
			User:                 req.GetUser(),
			Context:              req.GetContext(),
			Consistency:          req.GetConsistency(),
		},
	)
	if err != nil {
		telemetry.TraceError(span, err)
		if errors.Is(err, condition.ErrEvaluationFailed) {
			return nil, serverErrors.ValidationError(err)
		}

		return nil, err
	}
	datastoreQueryCount := float64(result.ResolutionMetadata.DatastoreQueryCount.Load())

	grpc_ctxtags.Extract(ctx).Set(datastoreQueryCountHistogramName, datastoreQueryCount)
	span.SetAttributes(attribute.Float64(datastoreQueryCountHistogramName, datastoreQueryCount))
	datastoreQueryCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(datastoreQueryCount)

	datastoreItemCount := float64(result.ResolutionMetadata.DatastoreItemCount.Load())

	grpc_ctxtags.Extract(ctx).Set(datastoreItemCountHistogramName, datastoreItemCount)
	span.SetAttributes(attribute.Float64(datastoreItemCountHistogramName, datastoreItemCount))
	datastoreItemCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(datastoreItemCount)

	dispatchCount := float64(result.ResolutionMetadata.DispatchCounter.Load())

	grpc_ctxtags.Extract(ctx).Set(dispatchCountHistogramName, dispatchCount)
	span.SetAttributes(attribute.Float64(dispatchCountHistogramName, dispatchCount))
	dispatchCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(dispatchCount)

	requestDurationHistogram.WithLabelValues(
		s.serviceName,
		methodName,
		utils.Bucketize(uint(datastoreQueryCount), s.requestDurationByQueryHistogramBuckets),
		utils.Bucketize(uint(result.ResolutionMetadata.DispatchCounter.Load()), s.requestDurationByDispatchCountHistogramBuckets),
		req.GetConsistency().String(),
	).Observe(float64(time.Since(start).Milliseconds()))

	wasDispatchThrottled := result.ResolutionMetadata.DispatchThrottled.Load()
	grpc_ctxtags.Extract(ctx).Set("request.dispatch_throttled", wasDispatchThrottled)

	wasDatastoreThrottled := result.ResolutionMetadata.DatastoreThrottled.Load()
	grpc_ctxtags.Extract(ctx).Set("request.datastore_throttled", wasDatastoreThrottled)

	if wasDispatchThrottled {
		throttledRequestCounter.WithLabelValues(s.serviceName, methodName, throttleTypeDispatch).Inc()
	}
	if wasDatastoreThrottled {
		throttledRequestCounter.WithLabelValues(s.serviceName, methodName, throttleTypeDatastore).Inc()
	}

	listObjectsOptimzationLabel := "non-weighted"
	if result.ResolutionMetadata.WasWeightedGraphUsed.Load() {
		listObjectsOptimzationLabel = "weighted"
	}
	listObjectsOptimizationCounter.WithLabelValues(listObjectsOptimzationLabel).Inc()

	checkCounter := float64(result.ResolutionMetadata.CheckCounter.Load())
	grpc_ctxtags.Extract(ctx).Set(listObjectsCheckCountName, checkCounter)

	return &openfgav1.ListObjectsResponse{
		Objects: result.Objects,
	}, nil
}

func (s *Server) StreamedListObjects(req *openfgav1.StreamedListObjectsRequest, srv openfgav1.OpenFGAService_StreamedListObjectsServer) error {
	start := time.Now()

	ctx := srv.Context()
	storeID := req.GetStoreId()

	ctx, span := tracer.Start(ctx, apimethod.StreamedListObjects.String(), trace.WithAttributes(
		attribute.String("store_id", storeID),
		attribute.String("object_type", req.GetType()),
		attribute.String("relation", req.GetRelation()),
		attribute.String("user", req.GetUser()),
		attribute.String("consistency", req.GetConsistency().String()),
	))
	defer span.End()

	if !validator.RequestIsValidatedFromContext(ctx) {
		if err := req.Validate(); err != nil {
			return status.Error(codes.InvalidArgument, err.Error())
		}
	}

	// TODO: This should be apimethod.StreamedListObjects, but is it considered a breaking change to move?
	const methodName = "streamedlistobjects"

	ctx = telemetry.ContextWithRPCInfo(ctx, telemetry.RPCInfo{
		Service: s.serviceName,
		Method:  methodName,
	})

	err := s.checkAuthz(ctx, storeID, apimethod.StreamedListObjects)
	if err != nil {
		return err
	}

	typesys, err := s.resolveTypesystem(ctx, storeID, req.GetAuthorizationModelId())
	if err != nil {
		return err
	}
	req.AuthorizationModelId = typesys.GetAuthorizationModelID() // the resolved model id

	builder := s.getListObjectsCheckResolverBuilder(storeID)
	checkResolver, checkResolverCloser, err := builder.Build()
	if err != nil {
		return err
	}
	defer checkResolverCloser()

	q, err := commands.NewListObjectsQueryWithShadowConfig(
		s.datastore,
		checkResolver,
		commands.NewShadowListObjectsQueryConfig(
			commands.WithShadowListObjectsQueryEnabled(s.featureFlagClient.Boolean(serverconfig.ExperimentalShadowListObjects, storeID)),
			commands.WithShadowListObjectsQueryTimeout(s.shadowListObjectsQueryTimeout),
			commands.WithShadowListObjectsQueryMaxDeltaItems(s.shadowListObjectsQueryMaxDeltaItems),
			commands.WithShadowListObjectsQueryLogger(s.logger),
		),
		storeID,
		commands.WithLogger(s.logger),
		commands.WithListObjectsDeadline(s.listObjectsDeadline),
		commands.WithDispatchThrottlerConfig(threshold.Config{
			Throttler:    s.listObjectsDispatchThrottler,
			Enabled:      s.listObjectsDispatchThrottlingEnabled,
			Threshold:    s.listObjectsDispatchDefaultThreshold,
			MaxThreshold: s.listObjectsDispatchThrottlingMaxThreshold,
		}),
		commands.WithListObjectsMaxResults(s.listObjectsMaxResults),
		commands.WithResolveNodeLimit(s.resolveNodeLimit),
		commands.WithResolveNodeBreadthLimit(s.resolveNodeBreadthLimit),
		commands.WithMaxConcurrentReads(s.maxConcurrentReadsForListObjects),
		commands.WithListObjectsPipelineEnabled(s.featureFlagClient.Boolean(serverconfig.ExperimentalPipelineListObjects, storeID)),
		commands.WithListObjectsChunkSize(s.listObjectsChunkSize),
		commands.WithListObjectsBufferSize(s.listObjectsBufferSize),
		commands.WithListObjectsNumProcs(s.listObjectsNumProcs),
		commands.WithListObjectsPipeExtension(s.listObjectsPipeExtendAfter, s.listObjectsPipeMaxExtensions),
		commands.WithFeatureFlagClient(s.featureFlagClient),
	)
	if err != nil {
		return serverErrors.NewInternalError("", err)
	}

	resolutionMetadata, err := q.ExecuteStreamed(
		typesystem.ContextWithTypesystem(ctx, typesys),
		req,
		srv,
	)
	if err != nil {
		telemetry.TraceError(span, err)
		return err
	}
	datastoreQueryCount := float64(resolutionMetadata.DatastoreQueryCount.Load())

	grpc_ctxtags.Extract(ctx).Set(datastoreQueryCountHistogramName, datastoreQueryCount)
	span.SetAttributes(attribute.Float64(datastoreQueryCountHistogramName, datastoreQueryCount))
	datastoreQueryCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(datastoreQueryCount)

	datastoreItemCount := float64(resolutionMetadata.DatastoreItemCount.Load())

	grpc_ctxtags.Extract(ctx).Set(datastoreItemCountHistogramName, datastoreItemCount)
	span.SetAttributes(attribute.Float64(datastoreItemCountHistogramName, datastoreItemCount))
	datastoreItemCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(datastoreItemCount)

	dispatchCount := float64(resolutionMetadata.DispatchCounter.Load())

	grpc_ctxtags.Extract(ctx).Set(dispatchCountHistogramName, dispatchCount)
	span.SetAttributes(attribute.Float64(dispatchCountHistogramName, dispatchCount))
	dispatchCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(dispatchCount)

	requestDurationHistogram.WithLabelValues(
		s.serviceName,
		methodName,
		utils.Bucketize(uint(datastoreQueryCount), s.requestDurationByQueryHistogramBuckets),
		utils.Bucketize(uint(resolutionMetadata.DispatchCounter.Load()), s.requestDurationByDispatchCountHistogramBuckets),
		req.GetConsistency().String(),
	).Observe(float64(time.Since(start).Milliseconds()))

	wasDispatchThrottled := resolutionMetadata.DispatchThrottled.Load()
	grpc_ctxtags.Extract(ctx).Set("request.dispatch_throttled", wasDispatchThrottled)

	wasDatastoreThrottled := resolutionMetadata.DatastoreThrottled.Load()
	grpc_ctxtags.Extract(ctx).Set("request.datastore_throttled", wasDatastoreThrottled)

	if wasDispatchThrottled {
		throttledRequestCounter.WithLabelValues(s.serviceName, methodName, throttleTypeDispatch).Inc()
	}
	if wasDatastoreThrottled {
		throttledRequestCounter.WithLabelValues(s.serviceName, methodName, throttleTypeDatastore).Inc()
	}

	return nil
}

func (s *Server) getListObjectsCheckResolverBuilder(storeID string) *graph.CheckResolverOrderedBuilder {
	checkCacheOptions, checkDispatchThrottlingOptions := s.getCheckResolverOptions()

	return graph.NewOrderedCheckResolvers([]graph.CheckResolverOrderedBuilderOpt{
		graph.WithLocalCheckerOpts([]graph.LocalCheckerOption{
			graph.WithResolveNodeBreadthLimit(s.resolveNodeBreadthLimit),
			graph.WithOptimizations(s.featureFlagClient.Boolean(serverconfig.ExperimentalCheckOptimizations, storeID)),
			graph.WithMaxResolutionDepth(s.resolveNodeLimit),
		}...),
		graph.WithCachedCheckResolverOpts(s.cacheSettings.ShouldCacheCheckQueries(), checkCacheOptions...),
		graph.WithDispatchThrottlingCheckResolverOpts(s.checkDispatchThrottlingEnabled, checkDispatchThrottlingOptions...),
	}...)
}
