package commands

import (
	"context"
	"errors"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/logger"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/storage"
)

// ReadAuthorizationModelQuery retrieves a single type definition from a storage backend.
type ReadAuthorizationModelQuery struct {
	backend storage.AuthorizationModelReadBackend
	logger  logger.Logger
}

type ReadAuthModelQueryOption func(*ReadAuthorizationModelQuery)

func WithReadAuthModelQueryLogger(l logger.Logger) ReadAuthModelQueryOption {
	return func(m *ReadAuthorizationModelQuery) {
		m.logger = l
	}
}

func NewReadAuthorizationModelQuery(backend storage.AuthorizationModelReadBackend, opts ...ReadAuthModelQueryOption) *ReadAuthorizationModelQuery {
	m := &ReadAuthorizationModelQuery{
		backend: backend,
		logger:  logger.NewNoopLogger(),
	}

	for _, opt := range opts {
		opt(m)
	}
	return m
}

func (q *ReadAuthorizationModelQuery) Execute(ctx context.Context, req *openfgav1.ReadAuthorizationModelRequest) (*openfgav1.ReadAuthorizationModelResponse, error) {
	modelID := req.GetId()
	azm, err := q.backend.ReadAuthorizationModel(ctx, req.GetStoreId(), modelID)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			return nil, serverErrors.AuthorizationModelNotFound(modelID)
		}
		return nil, serverErrors.HandleError("", err)
	}
	return &openfgav1.ReadAuthorizationModelResponse{
		AuthorizationModel: azm,
	}, nil
}
