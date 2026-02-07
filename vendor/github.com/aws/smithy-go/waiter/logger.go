package waiter

import (
	"context"
	"fmt"

	"github.com/aws/smithy-go/logging"
	"github.com/aws/smithy-go/middleware"
)

// Logger is the Logger middleware used by the waiter to log an attempt
type Logger struct {
	// Attempt is the current attempt to be logged
	Attempt int64
}

// ID representing the Logger middleware
func (*Logger) ID() string {
	return "WaiterLogger"
}

// HandleInitialize performs handling of request in initialize stack step
func (m *Logger) HandleInitialize(ctx context.Context, in middleware.InitializeInput, next middleware.InitializeHandler) (
	out middleware.InitializeOutput, metadata middleware.Metadata, err error,
) {
	logger := middleware.GetLogger(ctx)

	logger.Logf(logging.Debug, fmt.Sprintf("attempting waiter request, attempt count: %d", m.Attempt))

	return next.HandleInitialize(ctx, in)
}

// AddLogger is a helper util to add waiter logger after `SetLogger` middleware in
func (m Logger) AddLogger(stack *middleware.Stack) error {
	return stack.Initialize.Insert(&m, "SetLogger", middleware.After)
}
