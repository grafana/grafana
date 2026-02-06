package services

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"

	"go.uber.org/atomic"
)

type managerState int

const (
	unknown managerState = iota // initial state
	healthy                     // all services running
	stopped                     // all services stopped (failed or terminated)
)

// ManagerListener listens for events from Manager.
type ManagerListener interface {
	// Healthy is called when Manager reaches Healthy state (all services Running)
	Healthy()

	// Stopped is called when Manager reaches Stopped state (all services are either Terminated or Failed)
	Stopped()

	// Failure is called when service fails.
	Failure(service Service)
}

// Manager is initialized with a collection of services. They all must be in New state.
// Manager can start them, and observe their state as a group.
// Once all services are running, Manager is said to be Healthy. It is possible for manager to never reach the Healthy state, if some services fail to start.
// When all services are stopped (Terminated or Failed), manager is Stopped.
//
// Note: Manager's state is defined by state of services. Services can be started outside of Manager and if all become Running, Manager will be Healthy as well.
//
// Note: Creating a manager immediately installs listeners to all services (to compute manager's state), which may start goroutines.
// To avoid leaking goroutines, make sure to eventually stop all services or the manager (which stops services), even if manager wasn't explicitly started.
type Manager struct {
	services []Service

	healthyCh chan struct{} // closed when healthy state is reached, or if it cannot be reached anymore (whatever happens first)
	stoppedCh chan struct{} // closed when stopped state is reached.

	mu            sync.Mutex
	state         managerState
	byState       map[State][]Service // Services sorted by state
	healthyClosed bool                // was healthyCh closed already?
	listeners     []chan func(listener ManagerListener)
}

// NewManager creates new service manager. It needs at least one service, and all services must be in New state.
func NewManager(services ...Service) (*Manager, error) {
	if len(services) == 0 {
		return nil, errors.New("no services")
	}

	m := &Manager{
		services:  services,
		byState:   map[State][]Service{},
		healthyCh: make(chan struct{}),
		stoppedCh: make(chan struct{}),
	}

	for _, s := range services {
		st := s.State()
		if st != New {
			return nil, fmt.Errorf("unexpected service state: %v", st)
		}

		m.byState[st] = append(m.byState[st], s)
	}

	for _, s := range services {
		s.AddListener(newManagerServiceListener(m, s))
	}
	return m, nil
}

// StartAsync initiates service startup on all the services being managed.
// It is only valid to call this method if all of the services are New.
func (m *Manager) StartAsync(ctx context.Context) error {
	for _, s := range m.services {
		err := s.StartAsync(ctx)
		if err != nil {
			return err
		}
	}
	return nil
}

// StopAsync initiates service shutdown if necessary on all the services being managed.
func (m *Manager) StopAsync() {
	if m == nil {
		return
	}

	for _, s := range m.services {
		s.StopAsync()
	}
}

// IsHealthy returns true if all services are currently in the Running state.
func (m *Manager) IsHealthy() bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.state == healthy
}

// AwaitHealthy waits for the ServiceManager to become healthy. Returns nil, if manager is healthy, error otherwise (eg. manager
// is in a state in which it cannot get healthy anymore).
func (m *Manager) AwaitHealthy(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-m.healthyCh:
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.state != healthy {
		terminated := len(m.byState[Terminated])

		var failedReasons []string
		for _, s := range m.byState[Failed] {
			err := s.FailureCase()
			if err != nil {
				// err is never nil for a failed service.
				failedReasons = append(failedReasons, err.Error())
			}
		}

		return fmt.Errorf("not healthy, %d terminated, %d failed: %v", terminated, len(failedReasons), failedReasons)
	}
	return nil
}

// IsStopped returns true if all services are in terminal state (Terminated or Failed)
func (m *Manager) IsStopped() bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.state == stopped
}

// AwaitStopped waits for the ServiceManager to become stopped. Returns nil, if manager is stopped, error when context finishes earlier.
func (m *Manager) AwaitStopped(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-m.stoppedCh:
		return nil
	}
}

// ServicesByState provides a snapshot of the current state of all the services under management.
func (m *Manager) ServicesByState() map[State][]Service {
	m.mu.Lock()
	defer m.mu.Unlock()

	result := map[State][]Service{}
	for st, ss := range m.byState {
		result[st] = append([]Service(nil), ss...) // make a copy
	}
	return result
}

func (m *Manager) serviceStateChanged(s Service, from State, to State) {
	m.mu.Lock()
	defer m.mu.Unlock()

	fs := m.byState[from]
	for ix, ss := range fs {
		if s == ss {
			fs = append(fs[:ix], fs[ix+1:]...)
			break
		}
	}
	if len(fs) == 0 {
		delete(m.byState, from)
	} else {
		m.byState[from] = fs
	}

	m.byState[to] = append(m.byState[to], s)

	if to == Failed {
		m.notifyListeners(func(l ManagerListener) { l.Failure(s) }, false)
	}

	running := len(m.byState[Running])
	stopping := len(m.byState[Stopping])
	done := len(m.byState[Terminated]) + len(m.byState[Failed])

	all := len(m.services)

	switch {
	case running == all:
		close(m.healthyCh)
		m.state = healthy
		m.healthyClosed = true
		m.notifyListeners(func(l ManagerListener) { l.Healthy() }, false)

	case done == all:
		if !m.healthyClosed {
			// healthy cannot be reached anymore
			close(m.healthyCh)
			m.healthyClosed = true
		}
		close(m.stoppedCh) // happens at most once
		m.state = stopped
		m.notifyListeners(func(l ManagerListener) { l.Stopped() }, true)

	default:
		if !m.healthyClosed && (done > 0 || stopping > 0) {
			// healthy cannot be reached anymore
			close(m.healthyCh)
			m.healthyClosed = true
		}

		m.state = unknown
	}
}

// AddListener registers a ManagerListener to be run when this Manager changes state.
// The listener will not have previous state changes replayed, so it is suggested that listeners are added before any of the managed services are started.
//
// AddListener guarantees execution ordering across calls to a given listener but not across calls to multiple listeners.
// Specifically, a given listener will have its callbacks invoked in the same order as the underlying service enters those states.
// Additionally, at most one of the listener's callbacks will execute at once.
// However, multiple listeners' callbacks may execute concurrently, and listeners may execute in an order different from the one in which they were registered.
//
// Returned function can be used to stop the listener and free resources used by it (e.g. goroutine).
func (m *Manager) AddListener(listener ManagerListener) func() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.state == stopped {
		// no need to register listener, as no more events will be sent
		return func() {}
	}

	// max number of events is: failed notification for each service + healthy + stopped.
	// we use buffer to avoid blocking the sender, which holds the manager's lock.
	listenerCh := make(chan func(l ManagerListener), len(m.services)+2)
	m.listeners = append(m.listeners, listenerCh)

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
			case fn, ok := <-listenerCh:
				if !ok {
					return
				}
				fn(listener)

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

		// Remove channel for notifications from manager's list of listeners.
		m.mu.Lock()
		m.listeners = slices.DeleteFunc(m.listeners, func(c chan func(listener ManagerListener)) bool {
			return listenerCh == c
		})
		m.mu.Unlock()

		wg.Wait()
	}
}

// called with lock
func (m *Manager) notifyListeners(fn func(l ManagerListener), closeChan bool) {
	for _, ch := range m.listeners {
		ch <- fn

		if closeChan {
			close(ch)
		}
	}
}

func newManagerServiceListener(m *Manager, s Service) *managerServiceListener {
	return &managerServiceListener{m: m, s: s}
}

// managerServiceListener is a service listener, that updates Service state in the Manager
type managerServiceListener struct {
	m *Manager
	s Service
}

func (l managerServiceListener) Starting() {
	l.m.serviceStateChanged(l.s, New, Starting)
}

func (l managerServiceListener) Running() {
	l.m.serviceStateChanged(l.s, Starting, Running)
}

func (l managerServiceListener) Stopping(from State) {
	l.m.serviceStateChanged(l.s, from, Stopping)
}

func (l managerServiceListener) Terminated(from State) {
	l.m.serviceStateChanged(l.s, from, Terminated)
}

func (l managerServiceListener) Failed(from State, _ error) {
	l.m.serviceStateChanged(l.s, from, Failed)
}

// NewManagerListener provides a simple way to build manager listener from supplied functions.
// Functions will only be called when not nil.
func NewManagerListener(healthy, stopped func(), failure func(service Service)) ManagerListener {
	return &funcBasedManagerListener{
		healthy: healthy,
		stopped: stopped,
		failure: failure,
	}
}

type funcBasedManagerListener struct {
	healthy func()
	stopped func()
	failure func(service Service)
}

func (f funcBasedManagerListener) Healthy() {
	if f.healthy != nil {
		f.healthy()
	}
}

func (f funcBasedManagerListener) Stopped() {
	if f.stopped != nil {
		f.stopped()
	}
}

func (f funcBasedManagerListener) Failure(service Service) {
	if f.failure != nil {
		f.failure(service)
	}
}

// StartManagerAndAwaitHealthy starts the manager (which in turns starts all services managed by it), and then waits
// until it reaches Running state. All services that this manager manages must be in New state, otherwise starting
// will fail.
//
// Notice that context passed to the manager for starting its services is the same as context used for waiting!
func StartManagerAndAwaitHealthy(ctx context.Context, manager *Manager) error {
	err := manager.StartAsync(ctx)
	if err != nil {
		return err
	}

	return manager.AwaitHealthy(ctx)
}

// StopManagerAndAwaitStopped asks manager to stop its services, and then waits
// until manager reaches the stopped state or context is stopped.
func StopManagerAndAwaitStopped(ctx context.Context, manager *Manager) error {
	manager.StopAsync()
	return manager.AwaitStopped(ctx)
}
