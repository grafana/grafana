package xml

import (
	"bytes"
	"io"
	"strings"
	"testing"
)

func TestGetResponseErrorCode(t *testing.T) {
	cases := map[string]struct {
		errorResponse          io.Reader
		noErrorWrappingEnabled bool
		expectedErrorCode      string
		expectedErrorMessage   string
		expectedErrorRequestID string
	}{
		"no error wrapping enabled": {
			errorResponse: bytes.NewReader([]byte(`<ErrorResponse>
    <Error>
        <Type>Sender</Type>
        <Code>InvalidGreeting</Code>
        <Message>Hi</Message>
        <AnotherSetting>setting</AnotherSetting>
    </Error>
    <RequestId>foo-id</RequestId>
</ErrorResponse>`)),
			expectedErrorCode:      "InvalidGreeting",
			expectedErrorMessage:   "Hi",
			expectedErrorRequestID: "foo-id",
		},
		"no error wrapping disabled": {
			errorResponse: bytes.NewReader([]byte(`<ErrorResponse>
    <Type>Sender</Type>
    <Code>InvalidGreeting</Code>
    <Message>Hi</Message>
    <AnotherSetting>setting</AnotherSetting>
    <RequestId>foo-id</RequestId>
</ErrorResponse>`)),
			noErrorWrappingEnabled: true,
			expectedErrorCode:      "InvalidGreeting",
			expectedErrorMessage:   "Hi",
			expectedErrorRequestID: "foo-id",
		},
		"no response body": {
			errorResponse: bytes.NewReader([]byte(``)),
		},
	}

	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			ec, err := GetErrorResponseComponents(c.errorResponse, c.noErrorWrappingEnabled)
			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}

			if e, a := c.expectedErrorCode, ec.Code; !strings.EqualFold(e, a) {
				t.Fatalf("expected %v, got %v", e, a)
			}
			if e, a := c.expectedErrorMessage, ec.Message; !strings.EqualFold(e, a) {
				t.Fatalf("expected %v, got %v", e, a)
			}
			if e, a := c.expectedErrorRequestID, ec.RequestID; !strings.EqualFold(e, a) {
				t.Fatalf("expected %v, got %v", e, a)
			}
		})
	}
}
