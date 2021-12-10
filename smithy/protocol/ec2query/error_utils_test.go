package ec2query

import (
	"bytes"
	"io"
	"strings"
	"testing"
)

func TestGetResponseErrorCode(t *testing.T) {
	cases := map[string]struct {
		errorResponse          io.Reader
		expectedErrorCode      string
		expectedErrorMessage   string
		expectedErrorRequestID string
	}{
		"Invalid Greeting": {
			errorResponse: bytes.NewReader([]byte(`<Response>
			    <Errors>
			        <Error>
			            <Code>InvalidGreeting</Code>
			            <Message>Hi</Message>
			        </Error>
			    </Errors>
			    <RequestID>foo-id</RequestID>
			</Response>`)),
			expectedErrorCode:      "InvalidGreeting",
			expectedErrorMessage:   "Hi",
			expectedErrorRequestID: "foo-id",
		},
		"InvalidGreetingWithNoMessage": {
			errorResponse: bytes.NewReader([]byte(`<Response>
			    <Errors>
			        <Error>
			            <Code>InvalidGreeting</Code>
			        </Error>
			    </Errors>
			    <RequestID>foo-id</RequestID>
			</Response>`)),
			expectedErrorCode:      "InvalidGreeting",
			expectedErrorRequestID: "foo-id",
		},
		"Error with no code": {
			errorResponse: bytes.NewReader([]byte(`<Response>
			    <Errors>
			        <Error>
			            <Message>Hi</Message>
			        </Error>
			    </Errors>
			    <RequestID>foo-id</RequestID>
			</Response>`)),
			expectedErrorMessage:   "Hi",
			expectedErrorRequestID: "foo-id",
		},
		"no response body": {
			errorResponse: bytes.NewReader([]byte(``)),
		},
	}

	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			ec, err := GetErrorResponseComponents(c.errorResponse)
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
