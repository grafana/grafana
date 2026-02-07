package wait

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/docker/docker/errdefs"
)

var (
	_ Strategy        = (*FileStrategy)(nil)
	_ StrategyTimeout = (*FileStrategy)(nil)
)

// FileStrategy waits for a file to exist in the container.
type FileStrategy struct {
	timeout      *time.Duration
	file         string
	pollInterval time.Duration
	matcher      func(io.Reader) error
}

// NewFileStrategy constructs an FileStrategy strategy.
func NewFileStrategy(file string) *FileStrategy {
	return &FileStrategy{
		file:         file,
		pollInterval: defaultPollInterval(),
	}
}

// WithStartupTimeout can be used to change the default startup timeout
func (ws *FileStrategy) WithStartupTimeout(startupTimeout time.Duration) *FileStrategy {
	ws.timeout = &startupTimeout
	return ws
}

// WithPollInterval can be used to override the default polling interval of 100 milliseconds
func (ws *FileStrategy) WithPollInterval(pollInterval time.Duration) *FileStrategy {
	ws.pollInterval = pollInterval
	return ws
}

// WithMatcher can be used to consume the file content.
// The matcher can return an errdefs.ErrNotFound to indicate that the file is not ready.
// Any other error will be considered a failure.
// Default: nil, will only wait for the file to exist.
func (ws *FileStrategy) WithMatcher(matcher func(io.Reader) error) *FileStrategy {
	ws.matcher = matcher
	return ws
}

// ForFile is a convenience method to assign FileStrategy
func ForFile(file string) *FileStrategy {
	return NewFileStrategy(file)
}

// Timeout returns the timeout for the strategy
func (ws *FileStrategy) Timeout() *time.Duration {
	return ws.timeout
}

// WaitUntilReady waits until the file exists in the container and copies it to the target.
func (ws *FileStrategy) WaitUntilReady(ctx context.Context, target StrategyTarget) error {
	timeout := defaultStartupTimeout()
	if ws.timeout != nil {
		timeout = *ws.timeout
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	timer := time.NewTicker(ws.pollInterval)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timer.C:
			if err := ws.matchFile(ctx, target); err != nil {
				if errdefs.IsNotFound(err) {
					// Not found, continue polling.
					continue
				}

				return fmt.Errorf("copy from container: %w", err)
			}
			return nil
		}
	}
}

// matchFile tries to copy the file from the container and match it.
func (ws *FileStrategy) matchFile(ctx context.Context, target StrategyTarget) error {
	rc, err := target.CopyFileFromContainer(ctx, ws.file)
	if err != nil {
		return fmt.Errorf("copy from container: %w", err)
	}
	defer rc.Close()

	if ws.matcher == nil {
		// No matcher, just check if the file exists.
		return nil
	}

	if err = ws.matcher(rc); err != nil {
		return fmt.Errorf("matcher: %w", err)
	}

	return nil
}
