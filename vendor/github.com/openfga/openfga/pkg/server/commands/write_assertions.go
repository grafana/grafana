package commands

import (
	"context"
	"errors"

	"google.golang.org/protobuf/proto"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/logger"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/storage"
	tupleUtils "github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

// DefaultMaxAssertionSizeInBytes is 64KB because MySQL supports up to 64 KB in one BLOB.
// In the future we may want to make it a LONGBLOB (4 GB) and/or make this value configurable
// based on the datastore.
var DefaultMaxAssertionSizeInBytes = 64000 // 64KB

type WriteAssertionsCommand struct {
	datastore               storage.OpenFGADatastore
	logger                  logger.Logger
	maxAssertionSizeInBytes int
}

type WriteAssertionsCmdOption func(*WriteAssertionsCommand)

func WithWriteAssertCmdLogger(l logger.Logger) WriteAssertionsCmdOption {
	return func(c *WriteAssertionsCommand) {
		c.logger = l
	}
}

func NewWriteAssertionsCommand(
	datastore storage.OpenFGADatastore, opts ...WriteAssertionsCmdOption) *WriteAssertionsCommand {
	cmd := &WriteAssertionsCommand{
		datastore:               datastore,
		logger:                  logger.NewNoopLogger(),
		maxAssertionSizeInBytes: DefaultMaxAssertionSizeInBytes,
	}

	for _, opt := range opts {
		opt(cmd)
	}
	return cmd
}

func (w *WriteAssertionsCommand) Execute(ctx context.Context, req *openfgav1.WriteAssertionsRequest) (*openfgav1.WriteAssertionsResponse, error) {
	store := req.GetStoreId()
	modelID := req.GetAuthorizationModelId()
	assertions := req.GetAssertions()

	model, err := w.datastore.ReadAuthorizationModel(ctx, store, modelID)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			return nil, serverErrors.AuthorizationModelNotFound(req.GetAuthorizationModelId())
		}

		return nil, serverErrors.HandleError("", err)
	}

	if !typesystem.IsSchemaVersionSupported(model.GetSchemaVersion()) {
		return nil, serverErrors.ValidationError(typesystem.ErrInvalidSchemaVersion)
	}

	typesys, err := typesystem.New(model)
	if err != nil {
		return nil, serverErrors.HandleError("", err)
	}

	assertionSizeInBytes := 0
	for _, assertion := range assertions {
		assertionSizeInBytes += proto.Size(assertion)
	}

	if assertionSizeInBytes > w.maxAssertionSizeInBytes {
		return nil, serverErrors.ExceededEntityLimit("bytes", w.maxAssertionSizeInBytes)
	}

	for _, assertion := range assertions {
		// an assertion should be validated the same as the input tuple key to a Check request
		if err := validation.ValidateUserObjectRelation(typesys, tupleUtils.ConvertAssertionTupleKeyToTupleKey(assertion.GetTupleKey())); err != nil {
			return nil, serverErrors.ValidationError(err)
		}

		for _, ct := range assertion.GetContextualTuples() {
			// but contextual tuples need to be validated the same as an input to a Write Tuple request
			if err = validation.ValidateTupleForWrite(typesys, ct); err != nil {
				return nil, serverErrors.ValidationError(err)
			}
		}
	}

	err = w.datastore.WriteAssertions(ctx, store, modelID, assertions)
	if err != nil {
		return nil, serverErrors.HandleError("", err)
	}

	return &openfgav1.WriteAssertionsResponse{}, nil
}
