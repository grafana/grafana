package commands

import (
	"context"

	"github.com/oklog/ulid/v2"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/logger"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/storage"
)

type CreateStoreCommand struct {
	storesBackend storage.StoresBackend
	logger        logger.Logger
}

type CreateStoreCmdOption func(*CreateStoreCommand)

func WithCreateStoreCmdLogger(l logger.Logger) CreateStoreCmdOption {
	return func(c *CreateStoreCommand) {
		c.logger = l
	}
}

func NewCreateStoreCommand(
	storesBackend storage.StoresBackend,
	opts ...CreateStoreCmdOption,
) *CreateStoreCommand {
	cmd := &CreateStoreCommand{
		storesBackend: storesBackend,
		logger:        logger.NewNoopLogger(),
	}

	for _, opt := range opts {
		opt(cmd)
	}
	return cmd
}

func (s *CreateStoreCommand) Execute(ctx context.Context, req *openfgav1.CreateStoreRequest) (*openfgav1.CreateStoreResponse, error) {
	store, err := s.storesBackend.CreateStore(ctx, &openfgav1.Store{
		Id:   ulid.Make().String(),
		Name: req.GetName(),
		// TODO why not pass CreatedAt and UpdatedAt as derived from the ulid?
	})
	if err != nil {
		return nil, serverErrors.HandleError("", err)
	}

	return &openfgav1.CreateStoreResponse{
		Id:        store.GetId(),
		Name:      store.GetName(),
		CreatedAt: store.GetCreatedAt(),
		UpdatedAt: store.GetUpdatedAt(),
	}, nil
}
