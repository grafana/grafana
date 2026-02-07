package services

import (
	"context"
	"fmt"
)

// State of the service. See Service interface for full state diagram.
type State int

// Possible states to represent the service State.
const (
	New        State = iota // New: Service is new, not running yet. Initial State.
	Starting                // Starting: Service is starting. If starting succeeds, service enters Running state.
	Running                 // Running: Service is fully running now. When service stops running, it enters Stopping state.
	Stopping                // Stopping: Service is shutting down
	Terminated              // Terminated: Service has stopped successfully. Terminal state.
	Failed                  // Failed: Service has failed in Starting, Running or Stopping state. Terminal state.
)

func (s State) String() string {
	switch s {
	case New:
		return "New"
	case Starting:
		return "Starting"
	case Running:
		return "Running"
	case Stopping:
		return "Stopping"
	case Terminated:
		return "Terminated"
	case Failed:
		return "Failed"
	default:
		return fmt.Sprintf("Unknown state: %d", s)
	}
}

// Service defines interface for controlling a service.
//
// State diagram for the service:
//
//	   ┌────────────────────────────────────────────────────────────────────┐
//	   │                                                                    │
//	   │                                                                    ▼
//	┌─────┐      ┌──────────┐      ┌─────────┐     ┌──────────┐      ┌────────────┐
//	│ New │─────▶│ Starting │─────▶│ Running │────▶│ Stopping │───┬─▶│ Terminated │
//	└─────┘      └──────────┘      └─────────┘     └──────────┘   │  └────────────┘
//	                   │                                          │
//	                   │                                          │
//	                   │                                          │   ┌────────┐
//	                   └──────────────────────────────────────────┴──▶│ Failed │
//	                                                                  └────────┘
type Service interface {
	// StartAsync starts Service asynchronously. Service must be in New State, otherwise error is returned.
	// Context is used as a parent context for service own context.
	StartAsync(ctx context.Context) error

	// AwaitRunning waits until service gets into Running state.
	// If service is in New or Starting state, this method is blocking.
	// If service is already in Running state, returns immediately with no error.
	// If service is in a state, from which it cannot get into Running state, error is returned immediately.
	AwaitRunning(ctx context.Context) error

	// StopAsync tell the service to stop. This method doesn't block and can be called multiple times.
	// If Service is New, it is Terminated without having been started nor stopped.
	// If Service is in Starting or Running state, this initiates shutdown and returns immediately.
	// If Service has already been stopped, this method returns immediately, without taking action.
	StopAsync()

	// AwaitTerminated waits for the service to reach Terminated or Failed state. If service is already in one of these states,
	// when method is called, method returns immediately.
	// If service enters Terminated state, this method returns nil.
	// If service enters Failed state, or context is finished before reaching Terminated or Failed, error is returned.
	AwaitTerminated(ctx context.Context) error

	// FailureCase returns error if Service is in Failed state.
	// If Service is not in Failed state, this method returns nil.
	FailureCase() error

	// State returns current state of the service.
	State() State

	// AddListener adds listener to this service. Listener will be notified on subsequent state transitions
	// of the service. Previous state transitions are not replayed, so it is suggested to add listeners before
	// service is started.
	//
	// AddListener guarantees execution ordering across calls to a given listener but not across calls to
	// multiple listeners. Specifically, a given listener will have its callbacks invoked in the same order
	// as the service enters those states. Additionally, at most one of the listener's callbacks will execute
	// at once. However, multiple listeners' callbacks may execute concurrently, and listeners may execute
	// in an order different from the one in which they were registered.
	//
	// Returned function can be used to stop the listener from receiving additional events from the service,
	// and release resources used by the listener (e.g. goroutine, if it was started by adding listener).
	AddListener(listener Listener) func()
}

// NamedService extends Service with a name.
type NamedService interface {
	Service

	// ServiceName returns name of the service, if it has one.
	// Subsequent calls to ServiceName can return different values,
	// for example service may update its name based on its state.
	ServiceName() string
}

// Listener receives notifications about Service state changes.
type Listener interface {
	// Starting is called when the service transitions from NEW to STARTING.
	Starting()

	// Running is called when the service transitions from STARTING to RUNNING.
	Running()

	// Stopping is called when the service transitions to the STOPPING state.
	Stopping(from State)

	// Terminated is called when the service transitions to the TERMINATED state.
	Terminated(from State)

	// Failed is called when the service transitions to the FAILED state.
	Failed(from State, failure error)
}
