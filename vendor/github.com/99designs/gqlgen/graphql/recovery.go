package graphql

import (
	"context"
	"fmt"
	"os"
	"runtime/debug"

	"github.com/vektah/gqlparser/v2/gqlerror"
)

type RecoverFunc func(ctx context.Context, err any) (userMessage error)

func DefaultRecover(ctx context.Context, err any) error {
	fmt.Fprintln(os.Stderr, err)
	fmt.Fprintln(os.Stderr)
	debug.PrintStack()

	return gqlerror.Errorf("internal system error")
}
