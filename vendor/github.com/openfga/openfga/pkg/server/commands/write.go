package commands

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/validation"
	"github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/server/config"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/storage"
	tupleUtils "github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

// WriteCommand is used to Write and Delete tuples. Instances may be safely shared by multiple goroutines.
type WriteCommand struct {
	logger                    logger.Logger
	datastore                 storage.OpenFGADatastore
	conditionContextByteLimit int
}

type WriteCommandOption func(*WriteCommand)

func WithWriteCmdLogger(l logger.Logger) WriteCommandOption {
	return func(wc *WriteCommand) {
		wc.logger = l
	}
}

func WithConditionContextByteLimit(limit int) WriteCommandOption {
	return func(wc *WriteCommand) {
		wc.conditionContextByteLimit = limit
	}
}

// NewWriteCommand creates a WriteCommand with specified storage.OpenFGADatastore to use for storage.
func NewWriteCommand(datastore storage.OpenFGADatastore, opts ...WriteCommandOption) *WriteCommand {
	cmd := &WriteCommand{
		datastore:                 datastore,
		logger:                    logger.NewNoopLogger(),
		conditionContextByteLimit: config.DefaultWriteContextByteLimit,
	}

	for _, opt := range opts {
		opt(cmd)
	}
	return cmd
}

func parseOptionOnDuplicate(wr *openfgav1.WriteRequestWrites) (storage.OnDuplicateInsert, error) {
	switch wr.GetOnDuplicate() {
	case "", "error":
		return storage.OnDuplicateInsertError, nil
	case "ignore":
		return storage.OnDuplicateInsertIgnore, nil
	default:
		return storage.OnDuplicateInsertError, serverErrors.ValidationError(fmt.Errorf("invalid on_duplicate option: %s", wr.GetOnDuplicate()))
	}
}

func parseOptionOnMissing(wr *openfgav1.WriteRequestDeletes) (storage.OnMissingDelete, error) {
	switch wr.GetOnMissing() {
	case "", "error":
		return storage.OnMissingDeleteError, nil
	case "ignore":
		return storage.OnMissingDeleteIgnore, nil
	default:
		return storage.OnMissingDeleteError, serverErrors.ValidationError(fmt.Errorf("invalid on_missing option: %s", wr.GetOnMissing()))
	}
}

// Execute deletes and writes the specified tuples. Deletes are applied first, then writes.
func (c *WriteCommand) Execute(ctx context.Context, req *openfgav1.WriteRequest) (*openfgav1.WriteResponse, error) {
	if err := c.validateWriteRequest(ctx, req); err != nil {
		return nil, err
	}

	onDuplicateInsert, err := parseOptionOnDuplicate(req.GetWrites())
	if err != nil {
		return nil, err
	}

	onEmptyDelete, err := parseOptionOnMissing(req.GetDeletes())
	if err != nil {
		return nil, err
	}

	err = c.datastore.Write(
		ctx,
		req.GetStoreId(),
		req.GetDeletes().GetTupleKeys(),
		req.GetWrites().GetTupleKeys(),
		storage.WithOnMissingDelete(onEmptyDelete),
		storage.WithOnDuplicateInsert(onDuplicateInsert),
	)
	if err != nil {
		if errors.Is(err, storage.ErrTransactionalWriteFailed) {
			return nil, status.Error(codes.Aborted, err.Error())
		}
		if errors.Is(err, storage.ErrInvalidWriteInput) {
			return nil, serverErrors.WriteFailedDueToInvalidInput(err)
		}
		return nil, serverErrors.HandleError("", err)
	}

	return &openfgav1.WriteResponse{}, nil
}

func (c *WriteCommand) validateWriteRequest(ctx context.Context, req *openfgav1.WriteRequest) error {
	ctx, span := tracer.Start(ctx, "validateWriteRequest")
	defer span.End()

	store := req.GetStoreId()
	modelID := req.GetAuthorizationModelId()
	deletes := req.GetDeletes().GetTupleKeys()
	writes := req.GetWrites().GetTupleKeys()

	if len(deletes) == 0 && len(writes) == 0 {
		return serverErrors.ErrInvalidWriteInput
	}

	if len(writes) > 0 {
		authModel, err := c.datastore.ReadAuthorizationModel(ctx, store, modelID)
		if err != nil {
			if errors.Is(err, storage.ErrNotFound) {
				return serverErrors.AuthorizationModelNotFound(modelID)
			}
			return serverErrors.HandleError("", err)
		}

		if !typesystem.IsSchemaVersionSupported(authModel.GetSchemaVersion()) {
			return serverErrors.ValidationError(typesystem.ErrInvalidSchemaVersion)
		}

		typesys, err := typesystem.New(authModel)
		if err != nil {
			return err
		}

		for _, tk := range writes {
			err := validation.ValidateTupleForWrite(typesys, tk)
			if err != nil {
				return serverErrors.ValidationError(err)
			}

			err = c.validateNotImplicit(tk)
			if err != nil {
				return err
			}

			contextSize := proto.Size(tk.GetCondition().GetContext())
			if contextSize > c.conditionContextByteLimit {
				return serverErrors.ValidationError(&tupleUtils.InvalidTupleError{
					Cause:    fmt.Errorf("condition context size limit exceeded: %d bytes exceeds %d bytes", contextSize, c.conditionContextByteLimit),
					TupleKey: tk,
				})
			}
		}
	}

	for _, tk := range deletes {
		// TODO validate relation format and object format
		if ok := tupleUtils.IsValidUser(tk.GetUser()); !ok {
			return serverErrors.ValidationError(
				&tupleUtils.InvalidTupleError{
					Cause:    fmt.Errorf("the 'user' field is malformed"),
					TupleKey: tk,
				},
			)
		}
	}

	if err := c.validateNoDuplicatesAndCorrectSize(deletes, writes); err != nil {
		return err
	}

	return nil
}

// validateNoDuplicatesAndCorrectSize ensures the deletes and writes contain no duplicates and length fits.
func (c *WriteCommand) validateNoDuplicatesAndCorrectSize(
	deletes []*openfgav1.TupleKeyWithoutCondition,
	writes []*openfgav1.TupleKey,
) error {
	tuples := map[string]struct{}{}

	for _, tk := range deletes {
		key := tupleUtils.TupleKeyToString(tk)
		if _, ok := tuples[key]; ok {
			return serverErrors.DuplicateTupleInWrite(tk)
		}
		tuples[key] = struct{}{}
	}

	for _, tk := range writes {
		key := tupleUtils.TupleKeyToString(tk)
		if _, ok := tuples[key]; ok {
			return serverErrors.DuplicateTupleInWrite(tk)
		}
		tuples[key] = struct{}{}
	}

	if len(tuples) > c.datastore.MaxTuplesPerWrite() {
		return serverErrors.ExceededEntityLimit("write operations", c.datastore.MaxTuplesPerWrite())
	}
	return nil
}

// validateNotImplicit ensures the tuple to be written (not deleted) is not of the form `object:id # relation @ object:id#relation`.
func (c *WriteCommand) validateNotImplicit(
	tk *openfgav1.TupleKey,
) error {
	userObject, userRelation := tupleUtils.SplitObjectRelation(tk.GetUser())
	if tk.GetRelation() == userRelation && tk.GetObject() == userObject {
		return serverErrors.ValidationError(&tupleUtils.InvalidTupleError{
			Cause:    fmt.Errorf("cannot write a tuple that is implicit"),
			TupleKey: tk,
		})
	}
	return nil
}
