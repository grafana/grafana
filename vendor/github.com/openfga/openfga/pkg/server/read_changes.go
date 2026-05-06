package server

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/utils/apimethod"
	"github.com/openfga/openfga/pkg/middleware/validator"
	"github.com/openfga/openfga/pkg/server/commands"
	"github.com/openfga/openfga/pkg/telemetry"
)

func (s *Server) ReadChanges(ctx context.Context, req *openfgav1.ReadChangesRequest) (*openfgav1.ReadChangesResponse, error) {
	ctx, span := tracer.Start(ctx, apimethod.ReadChanges.String(), trace.WithAttributes(
		attribute.String("store_id", req.GetStoreId()),
		attribute.KeyValue{Key: "type", Value: attribute.StringValue(req.GetType())},
	))
	defer span.End()

	if !validator.RequestIsValidatedFromContext(ctx) {
		if err := req.Validate(); err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
	}

	if p := req.GetPageSize(); p != nil {
		pageSize := p.GetValue()
		if pageSize < 1 || pageSize > s.readChangesMaxPageSize {
			return nil, status.Errorf(
				codes.InvalidArgument,
				"invalid ReadChangesRequest.PageSize: value must be inside range [1, %d]",
				s.readChangesMaxPageSize,
			)
		}
	}

	ctx = telemetry.ContextWithRPCInfo(ctx, telemetry.RPCInfo{
		Service: s.serviceName,
		Method:  apimethod.ReadChanges.String(),
	})

	err := s.checkAuthz(ctx, req.GetStoreId(), apimethod.ReadChanges)
	if err != nil {
		return nil, err
	}

	q := commands.NewReadChangesQuery(s.datastore,
		commands.WithReadChangesQueryLogger(s.logger),
		commands.WithReadChangesQueryEncoder(s.encoder),
		commands.WithContinuationTokenSerializer(s.tokenSerializer),
		commands.WithReadChangeQueryHorizonOffset(s.changelogHorizonOffset),
	)
	return q.Execute(ctx, req)
}
