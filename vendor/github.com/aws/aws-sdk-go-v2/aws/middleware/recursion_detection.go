package middleware

import (
	"context"
	"fmt"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"os"
)

const envAwsLambdaFunctionName = "AWS_LAMBDA_FUNCTION_NAME"
const envAmznTraceID = "_X_AMZN_TRACE_ID"
const amznTraceIDHeader = "X-Amzn-Trace-Id"

// AddRecursionDetection adds recursionDetection to the middleware stack
func AddRecursionDetection(stack *middleware.Stack) error {
	return stack.Build.Add(&RecursionDetection{}, middleware.After)
}

// RecursionDetection detects Lambda environment and sets its X-Ray trace ID to request header if absent
// to avoid recursion invocation in Lambda
type RecursionDetection struct{}

// ID returns the middleware identifier
func (m *RecursionDetection) ID() string {
	return "RecursionDetection"
}

// HandleBuild detects Lambda environment and adds its trace ID to request header if absent
func (m *RecursionDetection) HandleBuild(
	ctx context.Context, in middleware.BuildInput, next middleware.BuildHandler,
) (
	out middleware.BuildOutput, metadata middleware.Metadata, err error,
) {
	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown request type %T", req)
	}

	_, hasLambdaEnv := os.LookupEnv(envAwsLambdaFunctionName)
	xAmznTraceID, hasTraceID := os.LookupEnv(envAmznTraceID)
	value := req.Header.Get(amznTraceIDHeader)
	// only set the X-Amzn-Trace-Id header when it is not set initially, the
	// current environment is Lambda and the _X_AMZN_TRACE_ID env variable exists
	if value != "" || !hasLambdaEnv || !hasTraceID {
		return next.HandleBuild(ctx, in)
	}

	req.Header.Set(amznTraceIDHeader, percentEncode(xAmznTraceID))
	return next.HandleBuild(ctx, in)
}

func percentEncode(s string) string {
	upperhex := "0123456789ABCDEF"
	hexCount := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		if shouldEncode(c) {
			hexCount++
		}
	}

	if hexCount == 0 {
		return s
	}

	required := len(s) + 2*hexCount
	t := make([]byte, required)
	j := 0
	for i := 0; i < len(s); i++ {
		if c := s[i]; shouldEncode(c) {
			t[j] = '%'
			t[j+1] = upperhex[c>>4]
			t[j+2] = upperhex[c&15]
			j += 3
		} else {
			t[j] = c
			j++
		}
	}
	return string(t)
}

func shouldEncode(c byte) bool {
	if 'a' <= c && c <= 'z' || 'A' <= c && c <= 'Z' || '0' <= c && c <= '9' {
		return false
	}
	switch c {
	case '-', '=', ';', ':', '+', '&', '[', ']', '{', '}', '"', '\'', ',':
		return false
	default:
		return true
	}
}
