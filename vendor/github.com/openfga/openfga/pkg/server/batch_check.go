package server

import (
	"context"
	"errors"

	grpc_ctxtags "github.com/grpc-ecosystem/go-grpc-middleware/tags"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/condition"
	"github.com/openfga/openfga/internal/graph"
	"github.com/openfga/openfga/internal/utils/apimethod"
	"github.com/openfga/openfga/pkg/middleware/validator"
	"github.com/openfga/openfga/pkg/server/commands"
	"github.com/openfga/openfga/pkg/server/config"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/telemetry"
)

func (s *Server) BatchCheck(ctx context.Context, req *openfgav1.BatchCheckRequest) (*openfgav1.BatchCheckResponse, error) {
	ctx, span := tracer.Start(ctx, apimethod.BatchCheck.String(), trace.WithAttributes(
		attribute.KeyValue{Key: "store_id", Value: attribute.StringValue(req.GetStoreId())},
		attribute.KeyValue{Key: "batch_size", Value: attribute.IntValue(len(req.GetChecks()))},
		attribute.KeyValue{Key: "consistency", Value: attribute.StringValue(req.GetConsistency().String())},
	))
	defer span.End()

	if !validator.RequestIsValidatedFromContext(ctx) {
		if err := req.Validate(); err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
	}

	ctx = telemetry.ContextWithRPCInfo(ctx, telemetry.RPCInfo{
		Service: s.serviceName,
		Method:  apimethod.BatchCheck.String(),
	})

	storeID := req.GetStoreId()
	err := s.checkAuthz(ctx, storeID, apimethod.BatchCheck)
	if err != nil {
		return nil, err
	}

	typesys, err := s.resolveTypesystem(ctx, storeID, req.GetAuthorizationModelId())
	if err != nil {
		return nil, err
	}

	builder := s.getCheckResolverBuilder(req.GetStoreId())
	checkResolver, checkResolverCloser, err := builder.Build()
	if err != nil {
		return nil, err
	}
	defer checkResolverCloser()

	cmd := commands.NewBatchCheckCommand(
		s.datastore,
		checkResolver,
		typesys,
		commands.WithBatchCheckCacheOptions(s.sharedDatastoreResources, s.cacheSettings),
		commands.WithBatchCheckCommandLogger(s.logger),
		commands.WithBatchCheckMaxChecksPerBatch(s.maxChecksPerBatchCheck),
		commands.WithBatchCheckMaxConcurrentChecks(s.maxConcurrentChecksPerBatch),
		commands.WithBatchCheckDatastoreThrottler(
			s.featureFlagClient.Boolean(config.ExperimentalDatastoreThrottling, storeID),
			s.checkDatastoreThrottleThreshold,
			s.checkDatastoreThrottleDuration,
		),
	)

	result, metadata, err := cmd.Execute(ctx, &commands.BatchCheckCommandParams{
		AuthorizationModelID: typesys.GetAuthorizationModelID(),
		Checks:               req.GetChecks(),
		Consistency:          req.GetConsistency(),
		StoreID:              storeID,
	})

	if err != nil {
		telemetry.TraceError(span, err)
		var batchValidationError *commands.BatchCheckValidationError
		if errors.As(err, &batchValidationError) {
			return nil, serverErrors.ValidationError(err)
		}

		return nil, err
	}

	methodName := "batchcheck"

	dispatchCount := float64(metadata.DispatchCount)
	grpc_ctxtags.Extract(ctx).Set(dispatchCountHistogramName, dispatchCount)
	span.SetAttributes(attribute.Float64(dispatchCountHistogramName, dispatchCount))
	dispatchCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(dispatchCount)

	var throttled bool

	if metadata.ThrottleCount > 0 {
		throttled = true
		throttledRequestCounter.WithLabelValues(s.serviceName, methodName).Add(float64(metadata.ThrottleCount))
	}
	grpc_ctxtags.Extract(ctx).Set("request.throttled", throttled)

	queryCount := float64(metadata.DatastoreQueryCount)
	span.SetAttributes(attribute.Float64(datastoreQueryCountHistogramName, queryCount))
	datastoreQueryCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(queryCount)

	datastoreItemCount := float64(metadata.DatastoreItemCount)
	span.SetAttributes(attribute.Float64(datastoreItemCountHistogramName, datastoreItemCount))
	datastoreItemCountHistogram.WithLabelValues(
		s.serviceName,
		methodName,
	).Observe(datastoreItemCount)

	duplicateChecks := "duplicate_checks"
	span.SetAttributes(attribute.Int(duplicateChecks, metadata.DuplicateCheckCount))
	grpc_ctxtags.Extract(ctx).Set(duplicateChecks, metadata.DuplicateCheckCount)

	var batchResult = map[string]*openfgav1.BatchCheckSingleResult{}
	for correlationID, outcome := range result {
		batchResult[string(correlationID)] = transformCheckResultToProto(outcome)
		s.emitCheckDurationMetric(outcome.CheckResponse.GetResolutionMetadata(), methodName)
	}

	grpc_ctxtags.Extract(ctx).Set(datastoreQueryCountHistogramName, metadata.DatastoreQueryCount)
	grpc_ctxtags.Extract(ctx).Set(datastoreItemCountHistogramName, metadata.DatastoreItemCount)

	return &openfgav1.BatchCheckResponse{Result: batchResult}, nil
}

// transformCheckResultToProto transforms the internal BatchCheckOutcome into the external-facing
// BatchCheckSingleResult struct for transmission back via the api.
func transformCheckResultToProto(outcome *commands.BatchCheckOutcome) *openfgav1.BatchCheckSingleResult {
	singleResult := &openfgav1.BatchCheckSingleResult{}

	if outcome.Err != nil {
		singleResult.CheckResult = &openfgav1.BatchCheckSingleResult_Error{
			Error: transformCheckCommandErrorToBatchCheckError(outcome.Err),
		}
	} else {
		singleResult.CheckResult = &openfgav1.BatchCheckSingleResult_Allowed{
			Allowed: outcome.CheckResponse.Allowed,
		}
	}

	return singleResult
}

func transformCheckCommandErrorToBatchCheckError(cmdErr error) *openfgav1.CheckError {
	var invalidRelationError *commands.InvalidRelationError
	var invalidTupleError *commands.InvalidTupleError
	var throttledError *commands.ThrottledError

	err := &openfgav1.CheckError{Message: cmdErr.Error()}

	// switch to map the possible errors to their specific GRPC codes in the proto definition
	switch {
	case errors.As(cmdErr, &invalidRelationError):
		err.Code = &openfgav1.CheckError_InputError{InputError: openfgav1.ErrorCode_validation_error}
	case errors.As(cmdErr, &invalidTupleError):
		err.Code = &openfgav1.CheckError_InputError{InputError: openfgav1.ErrorCode_invalid_tuple}
	case errors.Is(cmdErr, graph.ErrResolutionDepthExceeded):
		err.Code = &openfgav1.CheckError_InputError{InputError: openfgav1.ErrorCode_authorization_model_resolution_too_complex}
	case errors.Is(cmdErr, condition.ErrEvaluationFailed):
		err.Code = &openfgav1.CheckError_InputError{InputError: openfgav1.ErrorCode_validation_error}
	case errors.As(cmdErr, &throttledError):
		err.Code = &openfgav1.CheckError_InputError{InputError: openfgav1.ErrorCode_validation_error}
	case errors.Is(cmdErr, context.DeadlineExceeded):
		err.Code = &openfgav1.CheckError_InternalError{InternalError: openfgav1.InternalErrorCode_deadline_exceeded}
	default:
		err.Code = &openfgav1.CheckError_InternalError{InternalError: openfgav1.InternalErrorCode_internal_error}
	}

	return err
}
