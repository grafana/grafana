package services

import (
	"context"
	"fmt"
	"time"
)

// NewIdleService initializes basic service as an "idle" service -- it doesn't do anything in its Running state,
// but still supports all state transitions.
func NewIdleService(up StartingFn, down StoppingFn) *BasicService {
	run := func(ctx context.Context) error {
		<-ctx.Done()
		return nil
	}

	return NewBasicService(up, run, down)
}

// OneIteration is one iteration of the timer service. Called repeatedly until service is stopped, or this function returns error
// in which case, service will fail.
type OneIteration func(ctx context.Context) error

// NewTimerService runs iteration function on every interval tick. When iteration returns error, service fails.
func NewTimerService(interval time.Duration, start StartingFn, iter OneIteration, stop StoppingFn) *BasicService {
	run := func(ctx context.Context) error {
		t := time.NewTicker(interval)
		defer t.Stop()

		for {
			select {
			case <-t.C:
				err := iter(ctx)
				if err != nil {
					return err
				}

			case <-ctx.Done():
				return nil
			}
		}
	}

	return NewBasicService(start, run, stop)
}

// NewListener provides a simple way to build service listener from supplied functions.
// Functions are only called when not nil.
func NewListener(starting, running func(), stopping, terminated func(from State), failed func(from State, failure error)) Listener {
	return &funcBasedListener{
		startingFn:   starting,
		runningFn:    running,
		stoppingFn:   stopping,
		terminatedFn: terminated,
		failedFn:     failed,
	}
}

type funcBasedListener struct {
	startingFn   func()
	runningFn    func()
	stoppingFn   func(from State)
	terminatedFn func(from State)
	failedFn     func(from State, failure error)
}

func (f funcBasedListener) Starting() {
	if f.startingFn != nil {
		f.startingFn()
	}
}

func (f funcBasedListener) Running() {
	if f.runningFn != nil {
		f.runningFn()
	}
}

func (f funcBasedListener) Stopping(from State) {
	if f.stoppingFn != nil {
		f.stoppingFn(from)
	}
}

func (f funcBasedListener) Terminated(from State) {
	if f.terminatedFn != nil {
		f.terminatedFn(from)
	}
}

func (f funcBasedListener) Failed(from State, failure error) {
	if f.failedFn != nil {
		f.failedFn(from, failure)
	}
}

// StartAndAwaitRunning starts the service, and then waits until it reaches Running state.
// If service fails to start, its failure case is returned.
// Service must be in New state when this function is called.
//
// Notice that context passed to the service for starting is the same as context used for waiting!
// If you need these contexts to be different, please use StartAsync and AwaitRunning directly.
func StartAndAwaitRunning(ctx context.Context, service Service) error {
	err := service.StartAsync(ctx)
	if err != nil {
		return err
	}

	err = service.AwaitRunning(ctx)
	if e := service.FailureCase(); e != nil {
		return e
	}

	return err
}

// StopAndAwaitTerminated asks service to stop, and then waits until service reaches Terminated
// or Failed state. If service ends in Terminated state, this function returns error. On Failed state,
// it returns the failure case. Other errors are possible too (eg. if context stops before service does).
func StopAndAwaitTerminated(ctx context.Context, service Service) error {
	service.StopAsync()
	err := service.AwaitTerminated(ctx)
	if err == nil {
		return nil
	}

	if e := service.FailureCase(); e != nil {
		return e
	}

	// can happen e.g. if context was canceled
	return err
}

// DescribeService returns name of the service, if it has one, or returns string representation of the service.
func DescribeService(service Service) string {
	name := ""
	if named, ok := service.(NamedService); ok {
		name = named.ServiceName()
	}
	if name == "" {
		name = fmt.Sprintf("%v", service)
	}
	return name
}
