package graphql

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

// Errors are intentionally serialized first based on the advice in
// https://github.com/facebook/graphql/commit/7b40390d48680b15cb93e02d46ac5eb249689876#diff-757cea6edf0288677a9eea4cfc801d87R107
// and https://github.com/facebook/graphql/pull/384
type Response struct {
	Errors     gqlerror.List   `json:"errors,omitempty"`
	Data       json.RawMessage `json:"data"`
	Label      string          `json:"label,omitempty"`
	Path       ast.Path        `json:"path,omitempty"`
	HasNext    *bool           `json:"hasNext,omitempty"`
	Extensions map[string]any  `json:"extensions,omitempty"`
}

func ErrorResponse(ctx context.Context, messagef string, args ...any) *Response {
	return &Response{
		Errors: gqlerror.List{{Message: fmt.Sprintf(messagef, args...)}},
	}
}
