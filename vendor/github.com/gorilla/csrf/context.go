// +build go1.7

package csrf

import (
	"context"
	"net/http"

	"github.com/pkg/errors"
)

func contextGet(r *http.Request, key string) (interface{}, error) {
	val := r.Context().Value(key)
	if val == nil {
		return nil, errors.Errorf("no value exists in the context for key %q", key)
	}

	return val, nil
}

func contextSave(r *http.Request, key string, val interface{}) *http.Request {
	ctx := r.Context()
	ctx = context.WithValue(ctx, key, val)
	return r.WithContext(ctx)
}

func contextClear(r *http.Request) {
	// no-op for go1.7+
}
