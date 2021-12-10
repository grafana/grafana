package restjson

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"testing"
)

func TestGetErrorInfo(t *testing.T) {
	cases := map[string]struct {
		errorResponse                []byte
		expectedErrorType            string
		expectedErrorMsg             string
		expectedDeserializationError string
	}{
		"error with code": {
			errorResponse:     []byte(`{"code": "errorCode", "message": "message for errorCode"}`),
			expectedErrorType: "errorCode",
			expectedErrorMsg:  "message for errorCode",
		},
		"error with type": {
			errorResponse:     []byte(`{"__type": "errorCode", "message": "message for errorCode"}`),
			expectedErrorType: "errorCode",
			expectedErrorMsg:  "message for errorCode",
		},

		"error with only message": {
			errorResponse:    []byte(`{"message": "message for errorCode"}`),
			expectedErrorMsg: "message for errorCode",
		},

		"error with only code": {
			errorResponse:     []byte(`{"code": "errorCode"}`),
			expectedErrorType: "errorCode",
		},

		"empty": {
			errorResponse: []byte(``),
		},

		"unknownField": {
			errorResponse:     []byte(`{"xyz":"abc", "code": "errorCode"}`),
			expectedErrorType: "errorCode",
		},

		"unexpectedEOF": {
			errorResponse:                []byte(`{"xyz":"abc"`),
			expectedDeserializationError: io.ErrUnexpectedEOF.Error(),
		},

		"caseless compare": {
			errorResponse:     []byte(`{"Code": "errorCode", "Message": "errorMessage", "xyz": "abc"}`),
			expectedErrorType: "errorCode",
			expectedErrorMsg:  "errorMessage",
		},
	}

	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			decoder := json.NewDecoder(bytes.NewReader(c.errorResponse))
			actualType, actualMsg, err := GetErrorInfo(decoder)
			if err != nil {
				if len(c.expectedDeserializationError) == 0 {
					t.Fatalf("expected no error, got %v", err.Error())
				}

				if e, a := c.expectedDeserializationError, err.Error(); !strings.Contains(a, e) {
					t.Fatalf("expected error to be %v, got %v", e, a)
				}
			}

			if e, a := c.expectedErrorType, actualType; !strings.EqualFold(e, a) {
				t.Fatalf("expected error type to be %v, got %v", e, a)
			}

			if e, a := c.expectedErrorMsg, actualMsg; !strings.EqualFold(e, a) {
				t.Fatalf("expected error message to be %v, got %v", e, a)
			}
		})
	}
}
