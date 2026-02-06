package wait

import (
	"context"
	"time"

	"github.com/docker/docker/api/types"
)

// Implement interface
var (
	_ Strategy        = (*HealthStrategy)(nil)
	_ StrategyTimeout = (*HealthStrategy)(nil)
)

// HealthStrategy will wait until the container becomes healthy
type HealthStrategy struct {
	// all Strategies should have a startupTimeout to avoid waiting infinitely
	timeout *time.Duration

	// additional properties
	PollInterval time.Duration
}

// NewHealthStrategy constructs with polling interval of 100 milliseconds and startup timeout of 60 seconds by default
func NewHealthStrategy() *HealthStrategy {
	return &HealthStrategy{
		PollInterval: defaultPollInterval(),
	}
}

// fluent builders for each property
// since go has neither covariance nor generics, the return type must be the type of the concrete implementation
// this is true for all properties, even the "shared" ones like startupTimeout

// WithStartupTimeout can be used to change the default startup timeout
func (ws *HealthStrategy) WithStartupTimeout(startupTimeout time.Duration) *HealthStrategy {
	ws.timeout = &startupTimeout
	return ws
}

// WithPollInterval can be used to override the default polling interval of 100 milliseconds
func (ws *HealthStrategy) WithPollInterval(pollInterval time.Duration) *HealthStrategy {
	ws.PollInterval = pollInterval
	return ws
}

// ForHealthCheck is the default construction for the fluid interface.
//
// For Example:
//
//	wait.
//		ForHealthCheck().
//		WithPollInterval(1 * time.Second)
func ForHealthCheck() *HealthStrategy {
	return NewHealthStrategy()
}

func (ws *HealthStrategy) Timeout() *time.Duration {
	return ws.timeout
}

// WaitUntilReady implements Strategy.WaitUntilReady
func (ws *HealthStrategy) WaitUntilReady(ctx context.Context, target StrategyTarget) error {
	timeout := defaultStartupTimeout()
	if ws.timeout != nil {
		timeout = *ws.timeout
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			state, err := target.State(ctx)
			if err != nil {
				return err
			}
			if err := checkState(state); err != nil {
				return err
			}
			if state.Health == nil || state.Health.Status != types.Healthy {
				time.Sleep(ws.PollInterval)
				continue
			}
			return nil
		}
	}
}
