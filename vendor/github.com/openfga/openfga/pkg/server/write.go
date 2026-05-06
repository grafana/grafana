package server

import (
	"context"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/utils/apimethod"
	"github.com/openfga/openfga/pkg/authclaims"
	"github.com/openfga/openfga/pkg/middleware/validator"
	"github.com/openfga/openfga/pkg/server/commands"
	"github.com/openfga/openfga/pkg/telemetry"
)

func (s *Server) Write(ctx context.Context, req *openfgav1.WriteRequest) (*openfgav1.WriteResponse, error) {
	start := time.Now()

	ctx, span := tracer.Start(ctx, apimethod.Write.String(), trace.WithAttributes(
		attribute.String("store_id", req.GetStoreId()),
	))
	defer span.End()

	if !validator.RequestIsValidatedFromContext(ctx) {
		if err := req.Validate(); err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
	}

	ctx = telemetry.ContextWithRPCInfo(ctx, telemetry.RPCInfo{
		Service: s.serviceName,
		Method:  apimethod.Write.String(),
	})

	storeID := req.GetStoreId()

	typesys, err := s.resolveTypesystem(ctx, storeID, req.GetAuthorizationModelId())
	if err != nil {
		return nil, err
	}
	req.AuthorizationModelId = typesys.GetAuthorizationModelID() // the resolved model id

	err = s.checkWriteAuthz(ctx, req, typesys)
	if err != nil {
		return nil, err
	}

	cmd := commands.NewWriteCommand(
		s.datastore,
		commands.WithWriteCmdLogger(s.logger),
	)
	resp, err := cmd.Execute(ctx, &openfgav1.WriteRequest{
		StoreId:              storeID,
		AuthorizationModelId: typesys.GetAuthorizationModelID(), // the resolved model id
		Writes:               req.GetWrites(),
		Deletes:              req.GetDeletes(),
	})

	// For now, we only measure the duration if it passes the authz step to make the comparison
	// apple to apple.
	writeDurationHistogram.WithLabelValues(
		strconv.FormatBool(s.IsAccessControlEnabled() && !authclaims.SkipAuthzCheckFromContext(ctx)),
		req.GetWrites().GetOnDuplicate(),
		req.GetDeletes().GetOnMissing(),
	).Observe(float64(time.Since(start).Milliseconds()))

	return resp, err
}
