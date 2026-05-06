package errors

import (
	"net/http"
	"regexp"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

const (
	cFirstAuthenticationErrorCode  int32 = 1000
	cFirstValidationErrorCode      int32 = 2000
	cFirstThrottlingErrorCode      int32 = 3500
	cFirstInternalErrorCode        int32 = 4000
	cFirstUnknownEndpointErrorCode int32 = 5000
)

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	codeInt int32
}

// EncodedError allows customized error with code in string and specified http status field.
type EncodedError struct {
	HTTPStatusCode int
	GRPCStatusCode codes.Code
	ActualError    ErrorResponse
}

// Error returns the encoded message.
func (e *EncodedError) Error() string {
	return e.ActualError.Message
}

// CodeValue returns the encoded code in integer.
func (e *EncodedError) CodeValue() int32 {
	return e.ActualError.codeInt
}

// HTTPStatus returns the HTTP Status code.
func (e *EncodedError) HTTPStatus() int {
	return e.HTTPStatusCode
}

func (e *EncodedError) GRPCStatus() *status.Status {
	return status.New(e.GRPCStatusCode, e.Error())
}

// Code returns the encoded code in string.
func (e *EncodedError) Code() string {
	return e.ActualError.Code
}

func sanitizedMessage(message string) string {
	parsedMessages := strings.Split(message, "| caused by:")
	lastMessage := parsedMessages[len(parsedMessages)-1]
	lastMessage = strings.TrimSpace(lastMessage)

	sanitizedErrorMessage := regexp.MustCompile(`unexpected EOF`).ReplaceAllString(lastMessage, "malformed JSON")

	sanitizedErrorMessage = regexp.MustCompile(`rpc error: code = [a-zA-Z0-9\(\)]* desc = `).ReplaceAllString(sanitizedErrorMessage, "")
	return strings.TrimSpace(strings.TrimPrefix(sanitizedErrorMessage, "proto:"))
}

// NewEncodedError returns the encoded error with the correct http status code etc.
func NewEncodedError(errorCode int32, message string) *EncodedError {
	if !IsValidEncodedError(errorCode) {
		if errorCode == int32(codes.Aborted) {
			return &EncodedError{
				HTTPStatusCode: http.StatusConflict,
				GRPCStatusCode: codes.Aborted,
				ActualError: ErrorResponse{
					Code:    codes.Aborted.String(),
					Message: sanitizedMessage(message),
					codeInt: errorCode,
				},
			}
		}
		return &EncodedError{
			HTTPStatusCode: http.StatusInternalServerError,
			GRPCStatusCode: codes.Internal,
			ActualError: ErrorResponse{
				Code:    openfgav1.InternalErrorCode(errorCode).String(),
				Message: sanitizedMessage(message),
				codeInt: errorCode,
			},
		}
	}

	var httpStatusCode int
	var grpcStatusCode codes.Code
	var code string

	switch {
	case errorCode >= cFirstAuthenticationErrorCode && errorCode < cFirstValidationErrorCode:
		httpStatusCode = http.StatusUnauthorized
		code = openfgav1.AuthErrorCode(errorCode).String()
		grpcStatusCode = codes.Unauthenticated
	case errorCode >= cFirstValidationErrorCode && errorCode < cFirstThrottlingErrorCode:
		httpStatusCode = http.StatusBadRequest
		code = openfgav1.ErrorCode(errorCode).String()
		grpcStatusCode = codes.InvalidArgument
	case errorCode >= cFirstThrottlingErrorCode && errorCode < cFirstInternalErrorCode:
		httpStatusCode = http.StatusUnprocessableEntity
		code = openfgav1.UnprocessableContentErrorCode(errorCode).String()
		grpcStatusCode = codes.ResourceExhausted
	case errorCode >= cFirstInternalErrorCode && errorCode < cFirstUnknownEndpointErrorCode:
		httpStatusCode = http.StatusInternalServerError
		code = openfgav1.InternalErrorCode(errorCode).String()
		grpcStatusCode = codes.Internal
	default:
		httpStatusCode = http.StatusNotFound
		code = openfgav1.NotFoundErrorCode(errorCode).String()
		grpcStatusCode = codes.NotFound
	}

	return &EncodedError{
		HTTPStatusCode: httpStatusCode,
		GRPCStatusCode: grpcStatusCode,
		ActualError: ErrorResponse{
			Code:    code,
			Message: sanitizedMessage(message),
			codeInt: errorCode,
		},
	}
}

// IsValidEncodedError returns whether the error code is a valid encoded error.
func IsValidEncodedError(errorCode int32) bool {
	return errorCode >= cFirstAuthenticationErrorCode
}

func getCustomizedErrorCode(field string, reason string) int32 {
	switch field {
	case "Assertions":
		if strings.HasPrefix(reason, "value must contain no more than") {
			return int32(openfgav1.ErrorCode_assertions_too_many_items)
		}
	case "AuthorizationModelId":
		if strings.HasPrefix(reason, "value length must be at most") {
			return int32(openfgav1.ErrorCode_authorization_model_id_too_long)
		}
	case "Base":
		if strings.HasPrefix(reason, "value is required") {
			return int32(openfgav1.ErrorCode_difference_base_missing_value)
		}
	case "Id":
		if strings.HasPrefix(reason, "value length must be at most") {
			return int32(openfgav1.ErrorCode_id_too_long)
		}
	case "Object":
		if strings.HasPrefix(reason, "value length must be at most") {
			return int32(openfgav1.ErrorCode_object_too_long)
		}
	case "PageSize":
		if strings.HasPrefix(reason, "value must be inside range") {
			return int32(openfgav1.ErrorCode_page_size_invalid)
		}
	case "Params":
		if strings.HasPrefix(reason, "value is required") {
			return int32(openfgav1.ErrorCode_param_missing_value)
		}
	case "Relation":
		if strings.HasPrefix(reason, "value length must be at most") {
			return int32(openfgav1.ErrorCode_relation_too_long)
		}
	case "Relations":
		if strings.HasPrefix(reason, "value must contain at least") {
			return int32(openfgav1.ErrorCode_relations_too_few_items)
		}
	case "Subtract":
		if strings.HasPrefix(reason, "value is required") {
			return int32(openfgav1.ErrorCode_subtract_base_missing_value)
		}
	case "StoreId":
		if strings.HasPrefix(reason, "value length must be") {
			return int32(openfgav1.ErrorCode_store_id_invalid_length)
		}
	case "TupleKey":
		if strings.HasPrefix(reason, "value is required") {
			return int32(openfgav1.ErrorCode_tuple_key_value_not_specified)
		}
	case "TupleKeys":
		if strings.HasPrefix(reason, "value must contain between") {
			return int32(openfgav1.ErrorCode_tuple_keys_too_many_or_too_few_items)
		}
	case "Type":
		if strings.HasPrefix(reason, "value length must be at") {
			return int32(openfgav1.ErrorCode_type_invalid_length)
		}
		if strings.HasPrefix(reason, "value does not match regex pattern") {
			return int32(openfgav1.ErrorCode_type_invalid_pattern)
		}
	case "TypeDefinitions":
		if strings.HasPrefix(reason, "value must contain at least") {
			return int32(openfgav1.ErrorCode_type_definitions_too_few_items)
		}
	}
	// We will need to check for regex pattern
	if strings.HasPrefix(field, "Relations[") {
		if strings.HasPrefix(reason, "value length must be at most") {
			return int32(openfgav1.ErrorCode_relations_too_long)
		}
		if strings.HasPrefix(reason, "value does not match regex pattern") {
			return int32(openfgav1.ErrorCode_relations_invalid_pattern)
		}
	}

	// When we get to here, this is not a type or message that we know well.
	// We needs to return the generic error type
	return int32(openfgav1.ErrorCode_validation_error)
}

func ConvertToEncodedErrorCode(statusError *status.Status) int32 {
	code := int32(statusError.Code())
	if code >= cFirstAuthenticationErrorCode {
		return code
	}

	switch statusError.Code() {
	case codes.OK:
		return int32(codes.OK)
	case codes.Unauthenticated:
		return int32(openfgav1.AuthErrorCode_unauthenticated)
	case codes.Canceled:
		return int32(openfgav1.ErrorCode_cancelled)
	case codes.Unknown:
		// we will return InternalError as our implementation of
		// InternalError does not have a status code - which will result
		// in unknown error
		return int32(openfgav1.InternalErrorCode_internal_error)
	case codes.DeadlineExceeded:
		return int32(openfgav1.InternalErrorCode_deadline_exceeded)
	case codes.NotFound:
		return int32(openfgav1.NotFoundErrorCode_undefined_endpoint)
	case codes.AlreadyExists:
		return int32(openfgav1.InternalErrorCode_already_exists)
	case codes.ResourceExhausted:
		return int32(openfgav1.InternalErrorCode_resource_exhausted)
	case codes.FailedPrecondition:
		return int32(openfgav1.InternalErrorCode_failed_precondition)
	case codes.Aborted:
		return int32(codes.Aborted)
	case codes.OutOfRange:
		return int32(openfgav1.InternalErrorCode_out_of_range)
	case codes.Unimplemented:
		return int32(openfgav1.NotFoundErrorCode_unimplemented)
	case codes.Internal:
		return int32(openfgav1.InternalErrorCode_internal_error)
	case codes.Unavailable:
		return int32(openfgav1.InternalErrorCode_unavailable)
	case codes.DataLoss:
		return int32(openfgav1.InternalErrorCode_data_loss)
	case codes.InvalidArgument:
		break
	default:
		// Unknown code - internal error
		return int32(openfgav1.InternalErrorCode_internal_error)
	}
	// When we get to here, the cause is InvalidArgument (likely flagged by the framework's validator).
	// We will try to find out the actual cause if possible. Otherwise, the default response will
	// be openfgav1.ErrorCode_validation_error

	lastMessage := sanitizedMessage(statusError.Message())
	lastMessageSplitted := strings.SplitN(lastMessage, ": ", 2)
	if len(lastMessageSplitted) < 2 {
		// I don't know how to process this message.
		// The safest thing is to return the generic validation error
		return int32(openfgav1.ErrorCode_validation_error)
	}
	errorObjectSplitted := strings.Split(lastMessageSplitted[0], ".")
	if len(errorObjectSplitted) != 2 {
		// I don't know is the type.
		// Return generic error type
		return int32(openfgav1.ErrorCode_validation_error)
	}
	return getCustomizedErrorCode(errorObjectSplitted[1], lastMessageSplitted[1])
}
