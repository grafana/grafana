package commands

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/encoder"
	"github.com/openfga/openfga/pkg/logger"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/storage"
)

type ReadAuthorizationModelsQuery struct {
	backend storage.AuthorizationModelReadBackend
	logger  logger.Logger
	encoder encoder.Encoder
}

type ReadAuthModelsQueryOption func(*ReadAuthorizationModelsQuery)

func WithReadAuthModelsQueryLogger(l logger.Logger) ReadAuthModelsQueryOption {
	return func(rm *ReadAuthorizationModelsQuery) {
		rm.logger = l
	}
}

func WithReadAuthModelsQueryEncoder(e encoder.Encoder) ReadAuthModelsQueryOption {
	return func(rm *ReadAuthorizationModelsQuery) {
		rm.encoder = e
	}
}

func NewReadAuthorizationModelsQuery(backend storage.AuthorizationModelReadBackend, opts ...ReadAuthModelsQueryOption) *ReadAuthorizationModelsQuery {
	rm := &ReadAuthorizationModelsQuery{
		backend: backend,
		logger:  logger.NewNoopLogger(),
		encoder: encoder.NewBase64Encoder(),
	}

	for _, opt := range opts {
		opt(rm)
	}
	return rm
}

func (q *ReadAuthorizationModelsQuery) Execute(ctx context.Context, req *openfgav1.ReadAuthorizationModelsRequest) (*openfgav1.ReadAuthorizationModelsResponse, error) {
	decodedContToken, err := q.encoder.Decode(req.GetContinuationToken())
	if err != nil {
		return nil, serverErrors.ErrInvalidContinuationToken
	}

	opts := storage.ReadAuthorizationModelsOptions{
		Pagination: storage.NewPaginationOptions(req.GetPageSize().GetValue(), string(decodedContToken)),
	}
	models, contToken, err := q.backend.ReadAuthorizationModels(ctx, req.GetStoreId(), opts)
	if err != nil {
		return nil, serverErrors.HandleError("", err)
	}

	encodedContToken, err := q.encoder.Encode([]byte(contToken))
	if err != nil {
		return nil, serverErrors.HandleError("", err)
	}

	resp := &openfgav1.ReadAuthorizationModelsResponse{
		AuthorizationModels: models,
		ContinuationToken:   encodedContToken,
	}
	return resp, nil
}
