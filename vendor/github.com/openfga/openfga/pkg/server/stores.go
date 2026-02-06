package server

import (
	"context"
	"net/http"
	"strconv"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/utils/apimethod"
	httpmiddleware "github.com/openfga/openfga/pkg/middleware/http"
	"github.com/openfga/openfga/pkg/middleware/validator"
	"github.com/openfga/openfga/pkg/server/commands"
	"github.com/openfga/openfga/pkg/telemetry"
)

func (s *Server) CreateStore(ctx context.Context, req *openfgav1.CreateStoreRequest) (*openfgav1.CreateStoreResponse, error) {
	ctx, span := tracer.Start(ctx, apimethod.CreateStore.String())
	defer span.End()

	if !validator.RequestIsValidatedFromContext(ctx) {
		if err := req.Validate(); err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
	}

	ctx = telemetry.ContextWithRPCInfo(ctx, telemetry.RPCInfo{
		Service: s.serviceName,
		Method:  apimethod.CreateStore.String(),
	})

	err := s.checkCreateStoreAuthz(ctx)
	if err != nil {
		return nil, err
	}

	c := commands.NewCreateStoreCommand(s.datastore, commands.WithCreateStoreCmdLogger(s.logger))
	res, err := c.Execute(ctx, req)
	if err != nil {
		return nil, err
	}

	s.transport.SetHeader(ctx, httpmiddleware.XHttpCode, strconv.Itoa(http.StatusCreated))

	return res, nil
}

func (s *Server) DeleteStore(ctx context.Context, req *openfgav1.DeleteStoreRequest) (*openfgav1.DeleteStoreResponse, error) {
	ctx, span := tracer.Start(ctx, apimethod.DeleteStore.String(), trace.WithAttributes(
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
		Method:  apimethod.DeleteStore.String(),
	})

	err := s.checkAuthz(ctx, req.GetStoreId(), apimethod.DeleteStore)
	if err != nil {
		return nil, err
	}

	cmd := commands.NewDeleteStoreCommand(s.datastore, commands.WithDeleteStoreCmdLogger(s.logger))
	res, err := cmd.Execute(ctx, req)
	if err != nil {
		return nil, err
	}

	s.transport.SetHeader(ctx, httpmiddleware.XHttpCode, strconv.Itoa(http.StatusNoContent))

	return res, nil
}

func (s *Server) GetStore(ctx context.Context, req *openfgav1.GetStoreRequest) (*openfgav1.GetStoreResponse, error) {
	ctx, span := tracer.Start(ctx, apimethod.GetStore.String(), trace.WithAttributes(
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
		Method:  apimethod.GetStore.String(),
	})

	err := s.checkAuthz(ctx, req.GetStoreId(), apimethod.GetStore)
	if err != nil {
		return nil, err
	}

	q := commands.NewGetStoreQuery(s.datastore, commands.WithGetStoreQueryLogger(s.logger))
	return q.Execute(ctx, req)
}

func (s *Server) ListStores(ctx context.Context, req *openfgav1.ListStoresRequest) (*openfgav1.ListStoresResponse, error) {
	method := "ListStores"
	ctx, span := tracer.Start(ctx, method)
	defer span.End()

	if !validator.RequestIsValidatedFromContext(ctx) {
		if err := req.Validate(); err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
	}

	ctx = telemetry.ContextWithRPCInfo(ctx, telemetry.RPCInfo{
		Service: s.serviceName,
		Method:  method,
	})

	storeIDs, err := s.getAccessibleStores(ctx)
	if err != nil {
		return nil, err
	}

	// even though we have the list of store IDs, we need to call ListStoresQuery to fetch the entire metadata of the store.
	q := commands.NewListStoresQuery(s.datastore,
		commands.WithListStoresQueryLogger(s.logger),
		commands.WithListStoresQueryEncoder(s.encoder),
	)
	return q.Execute(ctx, req, storeIDs)
}
