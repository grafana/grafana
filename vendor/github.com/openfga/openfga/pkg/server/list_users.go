package server

import (
	"context"
	"errors"
	"strings"
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
	"github.com/openfga/openfga/pkg/server/commands/listusers"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/telemetry"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

// ListUsers returns all users (e.g. subjects) matching a specific user filter criteria
// that have a specific relation with some object.
func (s *Server) ListUsers(
	ctx context.Context,
	req *openfgav1.ListUsersRequest,
) (*openfgav1.ListUsersResponse, error) {
	start := time.Now()
	ctx, span := tracer.Start(ctx, apimethod.ListUsers.String(), trace.WithAttributes(
		attribute.String("store_id", req.GetStoreId()),
		attribute.String("object", tuple.BuildObject(req.GetObject().GetType(), req.GetObject().GetId())),
		attribute.String("relation", req.GetRelation()),
		attribute.String("user_filters", userFiltersToString(req.GetUserFilters())),
		attribute.String("consistency", req.GetConsistency().String()),
	))
	defer span.End()

	if !validator.RequestIsValidatedFromContext(ctx) {
		if err := req.Validate(); err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
	}

	// TODO: This should be apimethod.ListUsers, but is it considered a breaking change to move?
	const methodName = "listusers"

	ctx = telemetry.ContextWithRPCInfo(ctx, telemetry.RPCInfo{
		Service: s.serviceName,
		Method:  methodName,
	})

	err := s.checkAuthz(ctx, req.GetStoreId(), apimethod.ListUsers)
	if err != nil {
		return nil, err
	}

	typesys, err := s.resolveTypesystem(ctx, req.GetStoreId(), req.GetAuthorizationModelId())
	if err != nil {
		return nil, err
	}

	err = listusers.ValidateListUsersRequest(ctx, req, typesys)
	if err != nil {
		return nil, err
	}

	ctx = typesystem.ContextWithTypesystem(ctx, typesys)

	listUsersQuery := listusers.NewListUsersQuery(s.datastore,
		req.GetContextualTuples(),
		listusers.WithResolveNodeLimit(s.resolveNodeLimit),
		listusers.WithResolveNodeBreadthLimit(s.resolveNodeBreadthLimit),
		listusers.WithListUsersQueryLogger(s.logger),
		listusers.WithListUsersMaxResults(s.listUsersMaxResults),
		listusers.WithListUsersDeadline(s.listUsersDeadline),
		listusers.WithListUsersMaxConcurrentReads(s.maxConcurrentReadsForListUsers),
		listusers.WithDispatchThrottlerConfig(threshold.Config{
			Throttler:    s.listUsersDispatchThrottler,
			Enabled:      s.listUsersDispatchThrottlingEnabled,
			Threshold:    s.listUsersDispatchDefaultThreshold,
			MaxThreshold: s.listUsersDispatchThrottlingMaxThreshold,
		}),
		listusers.WithListUsersDatastoreThrottler(s.listUsersDatastoreThrottleThreshold, s.listUsersDatastoreThrottleDuration),
	)

	resp, err := listUsersQuery.ListUsers(ctx, req)
	if err != nil {
		telemetry.TraceError(span, err)

		switch {
		case errors.Is(err, graph.ErrResolutionDepthExceeded):
			return nil, serverErrors.ErrAuthorizationModelResolutionTooComplex
		case errors.Is(err, condition.ErrEvaluationFailed):
			return nil, serverErrors.ValidationError(err)
		default:
			return nil, serverErrors.HandleError("", err)
		}
	}

	datastoreQueryCount := float64(resp.Metadata.DatastoreQueryCount)

	grpc_ctxtags.Extract(ctx).Set(datastoreQueryCountHistogramName, datastoreQueryCount)
	span.SetAttributes(attribute.Float64(datastoreQueryCountHistogramName, datastoreQueryCount))
	datastoreQueryCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(datastoreQueryCount)

	datastoreItemCount := float64(resp.Metadata.DatastoreItemCount)

	grpc_ctxtags.Extract(ctx).Set(datastoreItemCountHistogramName, datastoreItemCount)
	span.SetAttributes(attribute.Float64(datastoreItemCountHistogramName, datastoreItemCount))
	datastoreItemCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(datastoreItemCount)

	dispatchCount := float64(resp.Metadata.DispatchCounter.Load())
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
		utils.Bucketize(uint(dispatchCount), s.requestDurationByDispatchCountHistogramBuckets),
		req.GetConsistency().String(),
	).Observe(float64(time.Since(start).Milliseconds()))

	wasRequestThrottled := resp.GetMetadata().WasThrottled.Load()
	if wasRequestThrottled {
		throttledRequestCounter.WithLabelValues(s.serviceName, methodName).Inc()
	}

	return &openfgav1.ListUsersResponse{
		Users: resp.GetUsers(),
	}, nil
}

func userFiltersToString(filter []*openfgav1.UserTypeFilter) string {
	var s strings.Builder
	for _, f := range filter {
		s.WriteString(f.GetType())
		if f.GetRelation() != "" {
			s.WriteString("#" + f.GetRelation())
		}
	}
	return s.String()
}
