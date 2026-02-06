package graphql

import (
	"context"
	"errors"

	"github.com/vektah/gqlparser/v2/gqlerror"
)

type ErrorPresenterFunc func(ctx context.Context, err error) *gqlerror.Error

func DefaultErrorPresenter(ctx context.Context, err error) *gqlerror.Error {
	if err == nil {
		return nil
	}
	var gqlErr *gqlerror.Error
	if errors.As(err, &gqlErr) {
		return gqlErr
	}
	return gqlerror.WrapPath(GetPath(ctx), err)
}

func ErrorOnPath(ctx context.Context, err error) error {
	if err == nil {
		return nil
	}
	var gqlErr *gqlerror.Error
	if errors.As(err, &gqlErr) {
		if gqlErr.Path == nil {
			gqlErr.Path = GetPath(ctx)
		}
		// Return the original error to avoid losing any attached annotation
		return err
	}
	return gqlerror.WrapPath(GetPath(ctx), err)
}
