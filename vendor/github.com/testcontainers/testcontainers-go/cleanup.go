package testcontainers

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"time"
)

// TerminateOptions is a type that holds the options for terminating a container.
type TerminateOptions struct {
	ctx         context.Context
	stopTimeout *time.Duration
	volumes     []string
}

// TerminateOption is a type that represents an option for terminating a container.
type TerminateOption func(*TerminateOptions)

// NewTerminateOptions returns a fully initialised TerminateOptions.
// Defaults: StopTimeout: 10 seconds.
func NewTerminateOptions(ctx context.Context, opts ...TerminateOption) *TerminateOptions {
	timeout := time.Second * 10
	options := &TerminateOptions{
		stopTimeout: &timeout,
		ctx:         ctx,
	}
	for _, opt := range opts {
		opt(options)
	}
	return options
}

// Context returns the context to use during a Terminate.
func (o *TerminateOptions) Context() context.Context {
	return o.ctx
}

// StopTimeout returns the stop timeout to use during a Terminate.
func (o *TerminateOptions) StopTimeout() *time.Duration {
	return o.stopTimeout
}

// Cleanup performs any clean up needed
func (o *TerminateOptions) Cleanup() error {
	// TODO: simplify this when when perform the client refactor.
	if len(o.volumes) == 0 {
		return nil
	}
	client, err := NewDockerClientWithOpts(o.ctx)
	if err != nil {
		return fmt.Errorf("docker client: %w", err)
	}
	defer client.Close()
	// Best effort to remove all volumes.
	var errs []error
	for _, volume := range o.volumes {
		if errRemove := client.VolumeRemove(o.ctx, volume, true); errRemove != nil {
			errs = append(errs, fmt.Errorf("volume remove %q: %w", volume, errRemove))
		}
	}
	return errors.Join(errs...)
}

// StopContext returns a TerminateOption that sets the context.
// Default: context.Background().
func StopContext(ctx context.Context) TerminateOption {
	return func(c *TerminateOptions) {
		c.ctx = ctx
	}
}

// StopTimeout returns a TerminateOption that sets the timeout.
// Default: See [Container.Stop].
func StopTimeout(timeout time.Duration) TerminateOption {
	return func(c *TerminateOptions) {
		c.stopTimeout = &timeout
	}
}

// RemoveVolumes returns a TerminateOption that sets additional volumes to remove.
// This is useful when the container creates named volumes that should be removed
// which are not removed by default.
// Default: nil.
func RemoveVolumes(volumes ...string) TerminateOption {
	return func(c *TerminateOptions) {
		c.volumes = volumes
	}
}

// TerminateContainer calls [Container.Terminate] on the container if it is not nil.
//
// This should be called as a defer directly after [GenericContainer](...)
// or a modules Run(...) to ensure the container is terminated when the
// function ends.
func TerminateContainer(container Container, options ...TerminateOption) error {
	if isNil(container) {
		return nil
	}

	err := container.Terminate(context.Background(), options...)
	if !isCleanupSafe(err) {
		return fmt.Errorf("terminate: %w", err)
	}

	return nil
}

// isNil returns true if val is nil or a nil instance false otherwise.
func isNil(val any) bool {
	if val == nil {
		return true
	}

	valueOf := reflect.ValueOf(val)
	switch valueOf.Kind() {
	case reflect.Chan, reflect.Func, reflect.Map, reflect.Ptr, reflect.UnsafePointer, reflect.Interface, reflect.Slice:
		return valueOf.IsNil()
	default:
		return false
	}
}
