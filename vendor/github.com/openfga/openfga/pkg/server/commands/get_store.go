package commands

import (
	"context"
	"errors"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/logger"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/storage"
)

type GetStoreQuery struct {
	logger        logger.Logger
	storesBackend storage.StoresBackend
}

type GetStoreQueryOption func(*GetStoreQuery)

func WithGetStoreQueryLogger(l logger.Logger) GetStoreQueryOption {
	return func(q *GetStoreQuery) {
		q.logger = l
	}
}

func NewGetStoreQuery(storesBackend storage.StoresBackend, opts ...GetStoreQueryOption) *GetStoreQuery {
	q := &GetStoreQuery{
		storesBackend: storesBackend,
		logger:        logger.NewNoopLogger(),
	}

	for _, opt := range opts {
		opt(q)
	}
	return q
}

func (q *GetStoreQuery) Execute(ctx context.Context, req *openfgav1.GetStoreRequest) (*openfgav1.GetStoreResponse, error) {
	storeID := req.GetStoreId()
	store, err := q.storesBackend.GetStore(ctx, storeID)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			return nil, serverErrors.ErrStoreIDNotFound
		}
		return nil, serverErrors.HandleError("", err)
	}
	return &openfgav1.GetStoreResponse{
		Id:        store.GetId(),
		Name:      store.GetName(),
		CreatedAt: store.GetCreatedAt(),
		UpdatedAt: store.GetUpdatedAt(),
	}, nil
}
