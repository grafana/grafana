package services

import (
	"context"
	"fmt"
	"slices"
	"sync"

	"go.uber.org/atomic"
)

// StartingFn is called when service enters Starting state. If StartingFn returns
// error, service goes into Failed state. If StartingFn returns without error, service transitions into
// Running state (unless context has been canceled).
//
// serviceContext is a context that is finished at latest when service enters Stopping state, but can also be finished
// earlier when StopAsync is called on the service. This context is derived from context passed to StartAsync method.
type StartingFn func(serviceContext context.Context) error

// RunningFn function is called when service enters Running state. When it returns, service will move to Stopping state.
// If RunningFn or StoppingFn return error, Service will end in Failed state, otherwise if both functions return without
// error, service will end in Terminated state.
type RunningFn func(serviceContext context.Context) error

// StoppingFn function is called when service enters Stopping state. When it returns, service moves to Terminated or Failed state,
// depending on whether there was any error returned from previous RunningFn (if it was called) and this StoppingFn function. If both return error,
// RunningFn's error will be saved as failure case for Failed state.
// Parameter is error from Running function, or nil if there was no error.
type StoppingFn func(failureCase error) error

// BasicService implements contract of Service interface, using three supplied functions: StartingFn, RunningFn and StoppingFn.
// When service is started, these three functions are called as service transitions to Starting, Running and Stopping state.
//
// Since they are called sequentially, they don't need to synchronize access on the state.
// (In other words: StartingFn happens-before RunningFn, RunningFn happens-before StoppingFn).
//
// All three functions are called at most once. If they are nil, they are not called and service transitions to the next state.
//
// Context passed to StartingFn and RunningFn function is canceled when StopAsync() is called, or service enters Stopping state.
// This context can be used to start additional tasks from inside StartingFn or RunningFn.
// Same context is available via ServiceContext() method (not part of Service interface).
//
// Possible orders of how functions are called:
//
// * 1. StartingFn -- if StartingFn returns error, no other functions are called.
//
// * 1. StartingFn, 2. StoppingFn -- StartingFn doesn't return error, but StopAsync is called while running
// StartingFn, or context is canceled from outside while StartingFn still runs.
//
// * 1. StartingFn, 2. RunningFn, 3. StoppingFn -- this is most common, when StartingFn doesn't return error,
// service is not stopped and context isn't stopped externally while running StartingFn.
type BasicService struct {
	// functions only run, if they are not nil. If functions are nil, service will effectively do nothing
	// in given state, and go to the next one without any error.
	startFn    StartingFn
	runningFn  RunningFn
	stoppingFn StoppingFn

	// everything below is protected by this mutex
	stateMu     sync.RWMutex
	state       State
	failureCase error
	listeners   []chan func(l Listener)
	serviceName string

	// closed when state reaches Running, Terminated or Failed state
	runningWaitersCh chan struct{}
	// closed when state reaches Terminated or Failed state
	terminatedWaitersCh chan struct{}

	serviceContext context.Context
	serviceCancel  context.CancelFunc
}

func invalidServiceStateError(state, expected State) error {
	return fmt.Errorf("invalid service state: %v, expected: %v", state, expected)
}

func invalidServiceStateWithFailureError(state, expected State, failure error) error {
	return fmt.Errorf("invalid service state: %v, expected: %v, failure: %w", state, expected, failure)
}

// NewBasicService returns service built from three functions (using BasicService).
func NewBasicService(start StartingFn, run RunningFn, stop StoppingFn) *BasicService {
	return &BasicService{
		startFn:             start,
		runningFn:           run,
		stoppingFn:          stop,
		state:               New,
		runningWaitersCh:    make(chan struct{}),
		terminatedWaitersCh: make(chan struct{}),
	}
}

// WithName sets service name, if service is still in New state, and returns service to allow
// usage like NewBasicService(...).WithName("service name").
func (b *BasicService) WithName(name string) *BasicService {
	// Hold lock to make sure state doesn't change while setting service name.
	b.stateMu.Lock()
	defer b.stateMu.Unlock()

	if b.state != New {
		return b
	}

	b.serviceName = name
	return b
}

func (b *BasicService) ServiceName() string {
	b.stateMu.RLock()
	defer b.stateMu.RUnlock()

	return b.serviceName
}

// StartAsync is part of Service interface.
func (b *BasicService) StartAsync(parentContext context.Context) error {
	switched, oldState := b.switchState(New, Starting, func() {
		b.serviceContext, b.serviceCancel = context.WithCancel(parentContext)
		b.notifyListeners(func(l Listener) { l.Starting() }, false)
		go b.main()
	})

	if !switched {
		return invalidServiceStateError(oldState, New)
	}
	return nil
}

// Returns true, if state switch succeeds, false if it fails. Returned state is the state before switch.
// if state switching succeeds, stateFn runs with lock held.
func (b *BasicService) switchState(from, to State, stateFn func()) (bool, State) {
	b.stateMu.Lock()
	defer b.stateMu.Unlock()

	if b.state != from {
		return false, b.state
	}
	b.state = to
	if stateFn != nil {
		stateFn()
	}
	return true, from
}

func (b *BasicService) mustSwitchState(from, to State, stateFn func()) {
	if ok, _ := b.switchState(from, to, stateFn); !ok {
		panic("switchState failed")
	}
}

// This is the "main" method, that does most of the work of service.
// Service is in Starting state when this method runs.
// Entire lifecycle of the service happens here.
func (b *BasicService) main() {
	var err error

	if b.startFn != nil {
		err = b.startFn(b.serviceContext)
	}

	if err != nil {
		b.mustSwitchState(Starting, Failed, func() {
			b.failureCase = err
			b.serviceCancel() // cancel the context, just in case if anything started in StartingFn is using it
			// we will not reach Running or Terminated, notify waiters
			close(b.runningWaitersCh)
			close(b.terminatedWaitersCh)
			b.notifyListeners(func(l Listener) { l.Failed(Starting, err) }, true)
		})
		return
	}

	stoppingFrom := Starting

	// Starting has succeeded. We should switch to Running now, but let's not do that
	// if our context has been canceled in the meantime.
	if err = b.serviceContext.Err(); err != nil {
		err = nil // don't report this as a failure, it is a normal "stop" signal.
		goto stop
	}

	// We have reached Running state
	b.mustSwitchState(Starting, Running, func() {
		// unblock waiters waiting for Running state
		close(b.runningWaitersCh)
		b.notifyListeners(func(l Listener) { l.Running() }, false)
	})

	stoppingFrom = Running
	if b.runningFn != nil {
		err = b.runningFn(b.serviceContext)
	}

stop:
	failure := err
	b.mustSwitchState(stoppingFrom, Stopping, func() {
		if stoppingFrom == Starting {
			// we will not reach Running state
			close(b.runningWaitersCh)
		}
		b.notifyListeners(func(l Listener) { l.Stopping(stoppingFrom) }, false)
	})

	// Make sure we cancel the context before running stoppingFn
	b.serviceCancel()

	if b.stoppingFn != nil {
		err = b.stoppingFn(failure)
		if failure == nil {
			failure = err
		}
	}

	if failure != nil {
		b.mustSwitchState(Stopping, Failed, func() {
			b.failureCase = failure
			close(b.terminatedWaitersCh)
			b.notifyListeners(func(l Listener) { l.Failed(Stopping, failure) }, true)
		})
	} else {
		b.mustSwitchState(Stopping, Terminated, func() {
			close(b.terminatedWaitersCh)
			b.notifyListeners(func(l Listener) { l.Terminated(Stopping) }, true)
		})
	}
}

// StopAsync is part of Service interface.
func (b *BasicService) StopAsync() {
	if s := b.State(); s == Stopping || s == Terminated || s == Failed {
		// no need to do anything
		return
	}

	terminated, _ := b.switchState(New, Terminated, func() {
		// Service wasn't started yet, and it won't be now.
		// Notify waiters and listeners.
		close(b.runningWaitersCh)
		close(b.terminatedWaitersCh)
		b.notifyListeners(func(l Listener) { l.Terminated(New) }, true)
	})

	if !terminated {
		// Service is Starting or Running. Just cancel the context (it must exist,
		// as it is created when switching from New to Starting state)
		b.serviceCancel()
	}
}

// ServiceContext returns context that this service uses internally for controlling its lifecycle. It is the same context that
// is passed to Starting and Running functions, and is based on context passed to the service via StartAsync.
//
// Before service enters Starting state, there is no context. This context is stopped when service enters Stopping state.
//
// This can be useful in code, that embeds BasicService and wants to provide additional methods to its clients.
//
// Example:
//
//	func (s *exampleService) Send(msg string) bool {
//		ctx := s.ServiceContext()
//		if ctx == nil {
//			// Service is not yet started
//			return false
//		}
//		select {
//		case s.ch <- msg:
//			return true
//		case <-ctx.Done():
//			// Service is not running anymore.
//			return false
//		}
//	}
//
// This is not part of Service interface, and clients of the Service should not use it.
func (b *BasicService) ServiceContext() context.Context {
	s := b.State()
	if s == New {
		return nil
	}
	// no need for locking, as we have checked the state.
	return b.serviceContext
}

// AwaitRunning is part of Service interface.
func (b *BasicService) AwaitRunning(ctx context.Context) error {
	return b.awaitState(ctx, Running, b.runningWaitersCh)
}

// AwaitTerminated is part of Service interface.
func (b *BasicService) AwaitTerminated(ctx context.Context) error {
	return b.awaitState(ctx, Terminated, b.terminatedWaitersCh)
}

func (b *BasicService) awaitState(ctx context.Context, expectedState State, ch chan struct{}) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-ch:
		s := b.State()
		if s == expectedState {
			return nil
		}

		// if service has failed, include failure case in the returned error.
		if failure := b.FailureCase(); failure != nil {
			return invalidServiceStateWithFailureError(s, expectedState, failure)
		}

		return invalidServiceStateError(s, expectedState)
	}
}

// FailureCase is part of Service interface.
func (b *BasicService) FailureCase() error {
	b.stateMu.RLock()
	defer b.stateMu.RUnlock()

	return b.failureCase
}

// State is part of Service interface.
func (b *BasicService) State() State {
	b.stateMu.RLock()
	defer b.stateMu.RUnlock()
	return b.state
}

// AddListener is part of Service interface.
func (b *BasicService) AddListener(listener Listener) func() {
	b.stateMu.Lock()
	defer b.stateMu.Unlock()

	if b.state == Terminated || b.state == Failed {
		// no more state transitions will be done, and channel wouldn't get closed
		return func() {}
	}

	// There are max 4 state transitions. We use buffer to avoid blocking the sender,
	// which holds service lock.
	listenerCh := make(chan func(l Listener), 4)
	b.listeners = append(b.listeners, listenerCh)

	stop := make(chan struct{})
	stopClosed := atomic.NewBool(false)

	wg := sync.WaitGroup{}
	wg.Add(1)

	// each listener has its own goroutine, processing events.
	go func() {
		defer wg.Done()
		for {
			select {
			// Process events from service.
			case lfn, ok := <-listenerCh:
				if !ok {
					return
				}
				lfn(listener)

			case <-stop:
				return
			}
		}
	}()

	return func() {
		if stopClosed.CompareAndSwap(false, true) {
			// Tell listener goroutine to stop.
			close(stop)
		}

		// Remove channel for notifications from service's list of listeners.
		b.stateMu.Lock()
		b.listeners = slices.DeleteFunc(b.listeners, func(c chan func(l Listener)) bool {
			return listenerCh == c
		})
		b.stateMu.Unlock()

		wg.Wait()
	}
}

// lock must be held here. Read lock would be good enough, but since
// this is called from state transitions, full lock is used.
func (b *BasicService) notifyListeners(lfn func(l Listener), closeChan bool) {
	for _, ch := range b.listeners {
		ch <- lfn
		if closeChan {
			close(ch)
		}
	}
}
