// Package errors contains custom error codes that are sent to clients.
package errors

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/tuple"
)

const InternalServerErrorMsg = "Internal Server Error"

var (
	// ErrAuthorizationModelResolutionTooComplex is used to avoid stack overflows.
	ErrAuthorizationModelResolutionTooComplex = status.Error(codes.Code(openfgav1.ErrorCode_authorization_model_resolution_too_complex), "Authorization Model resolution required too many rewrite rules to be resolved. Check your authorization model for infinite recursion or too much nesting")
	ErrInvalidWriteInput                      = status.Error(codes.Code(openfgav1.ErrorCode_invalid_write_input), "Invalid input. Make sure you provide at least one write, or at least one delete")
	ErrInvalidContinuationToken               = status.Error(codes.Code(openfgav1.ErrorCode_invalid_continuation_token), "Invalid continuation token")
	ErrInvalidStartTime                       = status.Error(codes.Code(openfgav1.ErrorCode_invalid_start_time), "Invalid start time")
	ErrInvalidExpandInput                     = status.Error(codes.Code(openfgav1.ErrorCode_invalid_expand_input), "Invalid input. Make sure you provide an object and a relation")
	ErrUnsupportedUserSet                     = status.Error(codes.Code(openfgav1.ErrorCode_unsupported_user_set), "Userset is not supported (right now)")
	ErrStoreIDNotFound                        = status.Error(codes.Code(openfgav1.NotFoundErrorCode_store_id_not_found), "Store ID not found")
	ErrMismatchObjectType                     = status.Error(codes.Code(openfgav1.ErrorCode_query_string_type_continuation_token_mismatch), "The type in the querystring and the continuation token don't match")
	ErrRequestCancelled                       = status.Error(codes.Code(openfgav1.ErrorCode_cancelled), "Request Cancelled")
	ErrRequestDeadlineExceeded                = status.Error(codes.Code(openfgav1.InternalErrorCode_deadline_exceeded), "Request Deadline Exceeded")
	ErrThrottledTimeout                       = status.Error(codes.Code(openfgav1.UnprocessableContentErrorCode_throttled_timeout_error), "timeout due to throttling on complex request")

	// ErrTransactionThrottled can apply when a limit is hit at the database level.
	ErrTransactionThrottled = status.Error(codes.ResourceExhausted, "transaction was throttled by the datastore")
)

type InternalError struct {
	public   error
	internal error
}

func (e InternalError) Error() string {
	// hide the internal error in the message
	return e.public.Error()
}

// Unwrap is called by errors.Is. It returns the underlying issue.
func (e InternalError) Unwrap() error {
	return e.internal
}

func (e InternalError) GRPCStatus() *status.Status {
	st, ok := status.FromError(e.public)
	if ok {
		return st
	}
	return status.New(codes.Unknown, e.public.Error())
}

// NewInternalError returns an error that is decorated with a public-facing error message.
// It is only meant to be called by HandleError.
func NewInternalError(public string, internal error) InternalError {
	if public == "" {
		public = InternalServerErrorMsg
	}

	return InternalError{
		public:   status.Error(codes.Code(openfgav1.InternalErrorCode_internal_error), public),
		internal: internal,
	}
}

func ValidationError(cause error) error {
	return status.Error(codes.Code(openfgav1.ErrorCode_validation_error), cause.Error())
}

func AssertionsNotForAuthorizationModelFound(modelID string) error {
	return status.Error(codes.Code(openfgav1.ErrorCode_authorization_model_assertions_not_found), fmt.Sprintf("No assertions found for authorization model '%s'", modelID))
}

func AuthorizationModelNotFound(modelID string) error {
	return status.Error(codes.Code(openfgav1.ErrorCode_authorization_model_not_found), fmt.Sprintf("Authorization Model '%s' not found", modelID))
}

func LatestAuthorizationModelNotFound(store string) error {
	return status.Error(codes.Code(openfgav1.ErrorCode_latest_authorization_model_not_found), fmt.Sprintf("No authorization models found for store '%s'", store))
}

func TypeNotFound(objectType string) error {
	return status.Error(codes.Code(openfgav1.ErrorCode_type_not_found), fmt.Sprintf("type '%s' not found", objectType))
}

func RelationNotFound(relation string, objectType string, tk *openfgav1.TupleKey) error {
	msg := fmt.Sprintf("relation '%s#%s' not found", objectType, relation)
	if tk != nil {
		msg += fmt.Sprintf(" for tuple '%s'", tuple.TupleKeyToString(tk))
	}

	return status.Error(codes.Code(openfgav1.ErrorCode_relation_not_found), msg)
}

func ExceededEntityLimit(entity string, limit int) error {
	return status.Error(codes.Code(openfgav1.ErrorCode_exceeded_entity_limit),
		fmt.Sprintf("The number of %s exceeds the allowed limit of %d", entity, limit))
}

func DuplicateTupleInWrite(tk tuple.TupleWithoutCondition) error {
	return status.Error(codes.Code(openfgav1.ErrorCode_cannot_allow_duplicate_tuples_in_one_request), fmt.Sprintf("duplicate tuple in write: user: '%s', relation: '%s', object: '%s'", tk.GetUser(), tk.GetRelation(), tk.GetObject()))
}

func WriteFailedDueToInvalidInput(err error) error {
	return status.Error(codes.Code(openfgav1.ErrorCode_write_failed_due_to_invalid_input), err.Error())
}

func InvalidAuthorizationModelInput(err error) error {
	return status.Error(codes.Code(openfgav1.ErrorCode_invalid_authorization_model), err.Error())
}

// HandleError is used to surface some errors, and hide others.
// Use `public` if you want to return a useful error message to the user.
func HandleError(public string, err error) error {
	switch {
	case errors.Is(err, storage.ErrTransactionThrottled):
		return ErrTransactionThrottled
	case errors.Is(err, context.Canceled):
		// cancel by a client is not an "internal server error"
		return ErrRequestCancelled
	case errors.Is(err, context.DeadlineExceeded):
		return ErrRequestDeadlineExceeded
	case errors.Is(err, storage.ErrInvalidStartTime):
		return ErrInvalidStartTime
	case errors.Is(err, storage.ErrInvalidContinuationToken):
		return ErrInvalidContinuationToken
	default:
		return NewInternalError(public, err)
	}
}

// HandleTupleValidateError provide common routines for handling tuples validation error.
func HandleTupleValidateError(err error) error {
	switch t := err.(type) { //nolint:errorlint
	case *tuple.InvalidTupleError:
		return status.Error(
			codes.Code(openfgav1.ErrorCode_invalid_tuple),
			fmt.Sprintf("Invalid tuple '%s'. Reason: %s", t.TupleKey, t.Cause.Error()),
		)
	case *tuple.TypeNotFoundError:
		return TypeNotFound(t.TypeName)
	case *tuple.RelationNotFoundError:
		return RelationNotFound(t.Relation, t.TypeName, t.TupleKey)
	case *tuple.InvalidConditionalTupleError:
		return status.Error(
			codes.Code(openfgav1.ErrorCode_validation_error),
			err.Error(),
		)
	}

	return HandleError("", err)
}
