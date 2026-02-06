package app

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana-app-sdk/health"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/metrics"
)

var ErrRunnerExitTimeout = errors.New("exit wait time exceeded waiting for Runners to complete")

var RunnableCollectorDefaultErrorHandler = func(ctx context.Context, err error) bool {
	logging.FromContext(ctx).Error("runner exited with error", "error", err)
	return true
}

// NewMultiRunner creates a new MultiRunner with Runners as an empty slice and ErrorHandler set to RunnableCollectorDefaultErrorHandler
func NewMultiRunner() *MultiRunner {
	return &MultiRunner{
		Runners:      make([]Runnable, 0),
		ErrorHandler: RunnableCollectorDefaultErrorHandler,
	}
}

// MultiRunner implements Runnable for running multiple Runnable instances.
type MultiRunner struct {
	Runners []Runnable
	// ErrorHandler is called if one of the Runners returns an error. If the function call returns true,
	// the context will be canceled and all other Runners will also be prompted to exit.
	// If ErrorHandler is nil, RunnableCollectorDefaultErrorHandler is used.
	ErrorHandler func(context.Context, error) bool
	// ExitWait is how long to wait for Runners to exit after ErrorHandler returns true or the context is canceled
	// before stopping execution and returning a timeout error instead of exiting gracefully.
	// If ExitWait is nil, Run execution will always block until all Runners have exited.
	ExitWait *time.Duration
}

// Run runs all Runners in separate goroutines, and calls ErrorHandler if any of them exits early with an error.
// If ErrorHandler returns true (or if there is no ErrorHandler), the other Runners are canceled and the error is returned.
func (m *MultiRunner) Run(ctx context.Context) error {
	propagatedContext, cancel := context.WithCancel(ctx)
	defer cancel()
	errs := make(chan error, len(m.Runners))
	errsClosed := false
	errsClosedMux := sync.Mutex{}
	defer func() {
		errsClosedMux.Lock()
		defer errsClosedMux.Unlock()
		errsClosed = true
		close(errs)
	}()
	wg := &sync.WaitGroup{}
	timedOut := false
	for _, runner := range m.Runners {
		wg.Add(1)
		go func(r Runnable) {
			err := r.Run(propagatedContext)
			wg.Done()
			if err != nil && !timedOut {
				errsClosedMux.Lock()
				defer errsClosedMux.Unlock()
				if errsClosed {
					logging.DefaultLogger.Warn("MultiRunner runner error encountered, but MultiRunner already completed", "error", err)
					return
				}
				errs <- err
			}
		}(runner)
	}
	for {
		select {
		case err := <-errs:
			handler := m.ErrorHandler
			if handler == nil {
				handler = RunnableCollectorDefaultErrorHandler
			}
			if handler(propagatedContext, err) {
				cancel()
				if m.ExitWait != nil {
					if waitOrTimeout(wg, *m.ExitWait) {
						timedOut = true
						return errors.Join(ErrRunnerExitTimeout, err)
					}
				} else {
					wg.Wait() // Wait for all the runners to stop
				}
				return err
			}
		case <-ctx.Done():
			cancel()
			if m.ExitWait != nil {
				if waitOrTimeout(wg, *m.ExitWait) {
					timedOut = true
					return ErrRunnerExitTimeout
				}
			} else {
				wg.Wait() // Wait for all the runners to stop
			}
			return nil
		}
	}
}

// PrometheusCollectors implements metrics.Provider by returning prometheus collectors for all Runners that also
// implement metrics.Provider.
func (m *MultiRunner) PrometheusCollectors() []prometheus.Collector {
	collectors := make([]prometheus.Collector, 0)
	for _, runner := range m.Runners {
		if cast, ok := runner.(metrics.Provider); ok {
			collectors = append(collectors, cast.PrometheusCollectors()...)
		}
	}
	return collectors
}

// HealthChecks implements health.Checker
func (m *MultiRunner) HealthChecks() []health.Check {
	checks := make([]health.Check, 0)

	for _, runner := range m.Runners {
		if cast, ok := runner.(health.Checker); ok {
			checks = append(checks, cast.HealthChecks()...)
		}

		if cast, ok := runner.(health.Check); ok {
			checks = append(checks, cast)
		}
	}

	return checks
}

// AddRunnable adds the provided Runnable to the Runners slice. If the slice is nil, it will create it.
func (m *MultiRunner) AddRunnable(runnable Runnable) {
	if m.Runners == nil {
		m.Runners = make([]Runnable, 0)
	}
	m.Runners = append(m.Runners, runnable)
}

func waitOrTimeout(wg *sync.WaitGroup, timeout time.Duration) bool {
	ch := make(chan struct{})
	go func() {
		defer close(ch)
		wg.Wait()
	}()
	select {
	case <-ch:
		return false
	case <-time.After(timeout):
		return true
	}
}

var (
	ErrOtherRunStopped = errors.New("run stopped by another run call")
)

func NewSingletonRunner(runnable Runnable, stopOnAny bool) *SingletonRunner {
	return &SingletonRunner{
		Wrapped:   runnable,
		StopOnAny: stopOnAny,
	}
}

// SingletonRunner runs a single Runnable but allows for multiple distinct calls to Run() which cn have independent lifecycles
type SingletonRunner struct {
	Wrapped Runnable
	// StopOnAny tells the SingletonRunner to stop all Run() calls if any one of them is stopped
	StopOnAny bool

	mux     sync.Mutex
	running bool
	wg      sync.WaitGroup
	cancel  context.CancelCauseFunc
	ctx     context.Context
}

// Run runs until the provided context.Context is closed, the underlying Runnable completes, or
// another call to Run is stopped and StopOnAny is set to true (in which case ErrOtherRunStopped is returned)
func (s *SingletonRunner) Run(ctx context.Context) error {
	s.wg.Add(1)
	defer s.wg.Done()
	go func(c context.Context) {
		<-c.Done()
		if s.StopOnAny && s.cancel != nil {
			s.cancel(ErrOtherRunStopped)
		}
	}(ctx)

	func() {
		s.mux.Lock()
		defer s.mux.Unlock()
		if !s.running {
			s.running = true
			// Stop cancel propagation and set up our own cancel function
			derived := context.WithoutCancel(ctx)
			s.ctx, s.cancel = context.WithCancelCause(derived)
			go func() {
				s.wg.Wait()
				s.mux.Lock()
				s.running = false
				s.mux.Unlock()
			}()

			go func() {
				err := s.Wrapped.Run(s.ctx)
				s.cancel(err)
			}()
		}
	}()

	select {
	case <-s.ctx.Done():
		return context.Cause(s.ctx)
	case <-ctx.Done():
	}
	return nil
}

// PrometheusCollectors implements metrics.Provider by returning prometheus collectors for the wrapped Runnable if it implements metrics.Provider.
func (s *SingletonRunner) PrometheusCollectors() []prometheus.Collector {
	if cast, ok := s.Wrapped.(metrics.Provider); ok {
		return cast.PrometheusCollectors()
	}
	return nil
}

// HealthChecks
func (s *SingletonRunner) HealthChecks() []health.Check {
	checks := make([]health.Check, 0)
	if cast, ok := s.Wrapped.(health.Check); ok {
		checks = append(checks, cast)
	}

	if cast, ok := s.Wrapped.(health.Checker); ok {
		checks = append(checks, cast.HealthChecks()...)
	}
	return checks
}

type dynamicMultiRunnerTuple struct {
	runner       Runnable
	cancelFunc   context.CancelFunc
	mainTimedOut bool
}

// DynamicMultiRunner is a MultiRunner that allows for adding and removing Runnable instances after Run is called.
// Only one concurrent Run call is allowed at a time.
type DynamicMultiRunner struct {
	// ErrorHandler is called if one of the Runners returns an error. If the function call returns true,
	// the context will be canceled and all other Runners will also be prompted to exit.
	// If ErrorHandler is nil, RunnableCollectorDefaultErrorHandler is used.
	ErrorHandler func(context.Context, error) bool
	// ExitWait is how long to wait for Runners to exit after ErrorHandler returns true or the context is canceled
	// before stopping execution and returning a timeout error instead of exiting gracefully.
	// If ExitWait is nil, Run execution will always block until all Runners have exited.
	ExitWait *time.Duration
	runners  []*dynamicMultiRunnerTuple
	running  bool
	runMux   sync.Mutex
	runCtx   context.Context
	errs     chan error
	wg       *sync.WaitGroup
}

// NewDynamicMultiRunner creates a new properly-initialized DynamicMultiRunner.
func NewDynamicMultiRunner() *DynamicMultiRunner {
	return &DynamicMultiRunner{
		ErrorHandler: RunnableCollectorDefaultErrorHandler,
		runners:      make([]*dynamicMultiRunnerTuple, 0),
	}
}

// Run runs all the current runners, and will dynamically run any runners added with AddRunnable.
func (d *DynamicMultiRunner) Run(ctx context.Context) error {
	d.runMux.Lock()
	if d.running {
		d.runMux.Unlock()
		return errors.New("already running")
	}
	d.running = true
	d.errs = make(chan error)
	defer close(d.errs)
	d.wg = &sync.WaitGroup{}
	var cancel context.CancelFunc
	d.runCtx, cancel = context.WithCancel(ctx)
	for idx := range d.runners {
		d.runners[idx].mainTimedOut = false // Reset this in case we're in a new Run() after a timeout on the previous
		d.runTuple(d.runners[idx])
	}
	d.runMux.Unlock()
	for {
		select {
		case err := <-d.errs:
			handler := d.ErrorHandler
			if handler == nil {
				handler = RunnableCollectorDefaultErrorHandler
			}
			if handler(d.runCtx, err) {
				cancel()
				if d.ExitWait != nil {
					if waitOrTimeout(d.wg, *d.ExitWait) {
						d.setTimedOut(true)
						return errors.Join(ErrRunnerExitTimeout, err)
					}
				} else {
					d.wg.Wait() // Wait for all the runners to stop
				}
				return err
			}
		case <-ctx.Done():
			cancel()
			if d.ExitWait != nil {
				if waitOrTimeout(d.wg, *d.ExitWait) {
					d.setTimedOut(true)
					return ErrRunnerExitTimeout
				}
			} else {
				d.wg.Wait() // Wait for all the runners to stop
			}
			return nil
		}
	}
}

func (d *DynamicMultiRunner) setTimedOut(val bool) {
	d.runMux.Lock()
	defer d.runMux.Unlock()
	for idx := range d.runners {
		d.runners[idx].mainTimedOut = val
	}
}

// AddRunnable adds the provided Runnable to the list of runners which gets run by Run.
// If the DynamicMultiRunner is already running, the Runnable will be started immediately.
func (d *DynamicMultiRunner) AddRunnable(runnable Runnable) {
	d.runMux.Lock()
	defer d.runMux.Unlock()
	tpl := &dynamicMultiRunnerTuple{
		runner: runnable,
	}
	if d.running {
		d.runTuple(tpl)
	}
	d.runners = append(d.runners, tpl)
}

// RemoveRunnable removes the provided Runnable from the list of runners, provided that it exists in the current list.
// If the DynamicMultiRunner is already running, the context provided to the Runnable's Run method will be canceled.
func (d *DynamicMultiRunner) RemoveRunnable(runnable Runnable) {
	d.runMux.Lock()
	defer d.runMux.Unlock()
	for i, tpl := range d.runners {
		if tpl.runner == runnable {
			if d.running && tpl.cancelFunc != nil {
				tpl.cancelFunc()
			}
			if len(d.runners) > i+1 {
				d.runners = append(d.runners[:i], d.runners[i+1:]...)
			} else {
				d.runners = d.runners[:i]
			}
		}
	}
}

// PrometheusCollectors implements metrics.Provider by returning prometheus collectors for all Runners that also
// implement metrics.Provider.
func (d *DynamicMultiRunner) PrometheusCollectors() []prometheus.Collector {
	collectors := make([]prometheus.Collector, 0)
	for _, runner := range d.runners {
		if cast, ok := runner.runner.(metrics.Provider); ok {
			collectors = append(collectors, cast.PrometheusCollectors()...)
		}
	}
	return collectors
}

// HealthChecks implements health.Checker
func (d *DynamicMultiRunner) HealthChecks() []health.Check {
	checks := make([]health.Check, 0)

	for _, tpl := range d.runners {
		if cast, ok := tpl.runner.(health.Checker); ok {
			checks = append(checks, cast.HealthChecks()...)
		}

		if cast, ok := tpl.runner.(health.Check); ok {
			checks = append(checks, cast)
		}
	}

	return checks
}
func (d *DynamicMultiRunner) runTuple(tpl *dynamicMultiRunnerTuple) {
	d.wg.Add(1)
	ctx, cancel := context.WithCancel(d.runCtx)
	tpl.cancelFunc = cancel
	go func() {
		err := tpl.runner.Run(ctx)
		d.wg.Done()
		if err != nil && !tpl.mainTimedOut { // Only send the error if main isn't timed out (otherwise the channel is closed)
			d.errs <- err
		}
	}()
}
