package restjson

import (
	"encoding/json"
	"io"
	"strings"

	"github.com/aws/smithy-go"
)

// GetErrorInfo util looks for code, __type, and message members in the
// json body. These members are optionally available, and the function
// returns the value of member if it is available. This function is useful to
// identify the error code, msg in a REST JSON error response.
func GetErrorInfo(decoder *json.Decoder) (errorType string, message string, err error) {
	var errInfo struct {
		Code    string
		Type    string `json:"__type"`
		Message string
	}

	err = decoder.Decode(&errInfo)
	if err != nil {
		if err == io.EOF {
			return errorType, message, nil
		}
		return errorType, message, err
	}

	// assign error type
	if len(errInfo.Code) != 0 {
		errorType = errInfo.Code
	} else if len(errInfo.Type) != 0 {
		errorType = errInfo.Type
	}

	// assign error message
	if len(errInfo.Message) != 0 {
		message = errInfo.Message
	}

	// sanitize error
	if len(errorType) != 0 {
		errorType = SanitizeErrorCode(errorType)
	}

	return errorType, message, nil
}

// SanitizeErrorCode sanitizes the errorCode string .
// The rule for sanitizing is if a `:` character is present, then take only the
// contents before the first : character in the value.
// If a # character is present, then take only the contents after the
// first # character in the value.
func SanitizeErrorCode(errorCode string) string {
	if strings.ContainsAny(errorCode, ":") {
		errorCode = strings.SplitN(errorCode, ":", 2)[0]
	}

	if strings.ContainsAny(errorCode, "#") {
		errorCode = strings.SplitN(errorCode, "#", 2)[1]
	}

	return errorCode
}

// GetSmithyGenericAPIError returns smithy generic api error and an error interface.
// Takes in json decoder, and error Code string as args. The function retrieves error message
// and error code from the decoder body. If errorCode of length greater than 0 is passed in as
// an argument, it is used instead.
func GetSmithyGenericAPIError(decoder *json.Decoder, errorCode string) (*smithy.GenericAPIError, error) {
	errorType, message, err := GetErrorInfo(decoder)
	if err != nil {
		return nil, err
	}

	if len(errorCode) == 0 {
		errorCode = errorType
	}

	return &smithy.GenericAPIError{
		Code:    errorCode,
		Message: message,
	}, nil
}
