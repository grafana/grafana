package modules

import (
	"context"
	"fmt"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"

	"github.com/grafana/dskit/services"
)

// ErrStopProcess is the error returned by a service as a hint to stop the server entirely.
var ErrStopProcess = errors.New("stop process")

// moduleService is a Service implementation that adds waiting for dependencies to start before starting,
// and dependant modules to stop before stopping this module service.
type moduleService struct {
	services.Service

	service services.Service
	name    string
	logger  log.Logger

	// startDeps, stopDeps return map of service names to services
	startDeps, stopDeps func(string) map[string]services.Service
}

type delegatedNamedService struct {
	services.Service

	delegate services.NamedService
}

func (n delegatedNamedService) ServiceName() string {
	return n.delegate.ServiceName()
}

// NewModuleService wraps a module service, and makes sure that dependencies are started/stopped before module service starts or stops.
// If any dependency fails to start, this service fails as well.
// On stop, errors from failed dependencies are ignored.
func NewModuleService(name string, logger log.Logger, service services.Service, startDeps, stopDeps func(string) map[string]services.Service) services.Service {
	w := &moduleService{
		name:      name,
		logger:    logger,
		service:   service,
		startDeps: startDeps,
		stopDeps:  stopDeps,
	}

	w.Service = services.NewBasicService(w.start, w.run, w.stop)

	if namedService, isNamed := service.(services.NamedService); isNamed {
		// return a value that implements services.NamedService only if the wrapped service implements services.NamedService
		return delegatedNamedService{
			Service:  w,
			delegate: namedService,
		}
	}
	return w
}

func (w *moduleService) start(serviceContext context.Context) error {
	// wait until all startDeps are running
	startDeps := w.startDeps(w.name)
	for m, s := range startDeps {
		if s == nil {
			continue
		}

		level.Debug(w.logger).Log("msg", "module waiting for initialization", "module", w.name, "waiting_for", m)

		err := s.AwaitRunning(serviceContext)
		if err != nil {
			return fmt.Errorf("failed to start %v, because it depends on module %v, which has failed: %w", w.name, m, err)
		}
	}

	// we don't want to let this service to stop until all dependant services are stopped,
	// so we use independent context here
	level.Info(w.logger).Log("msg", "starting", "module", w.name)
	err := w.service.StartAsync(context.Background())
	if err != nil {
		return errors.Wrapf(err, "error starting module: %s", w.name)
	}

	err = w.service.AwaitRunning(serviceContext)
	if err != nil {
		// Make sure that underlying service is stopped before returning
		// (e.g. in case of context cancellation, AwaitRunning returns early, but service may still be starting).
		_ = services.StopAndAwaitTerminated(context.Background(), w.service)
	}
	return errors.Wrapf(err, "starting module %s", w.name)
}

func (w *moduleService) run(serviceContext context.Context) error {
	// wait until service stops, or context is canceled, whatever happens first.
	// We don't care about exact error here
	_ = w.service.AwaitTerminated(serviceContext)
	return w.service.FailureCase()
}

func (w *moduleService) stop(_ error) error {
	var err error
	if w.service.State() == services.Running {
		// Only wait for other modules, if underlying service is still running.
		w.waitForModulesToStop()

		level.Debug(w.logger).Log("msg", "stopping", "module", w.name)

		err = services.StopAndAwaitTerminated(context.Background(), w.service)
	} else {
		err = w.service.FailureCase()
	}

	if err != nil && err != ErrStopProcess {
		level.Warn(w.logger).Log("msg", "module failed with error", "module", w.name, "err", err)
	} else {
		level.Info(w.logger).Log("msg", "module stopped", "module", w.name)
	}
	return err
}

func (w *moduleService) waitForModulesToStop() {
	// wait until all stopDeps have stopped
	stopDeps := w.stopDeps(w.name)
	for n, s := range stopDeps {
		if s == nil {
			continue
		}

		level.Debug(w.logger).Log("msg", "module waiting for", "module", w.name, "waiting_for", n)
		// Passed context isn't canceled, so we can only get error here, if service
		// fails. But we don't care *how* service stops, as long as it is done.
		_ = s.AwaitTerminated(context.Background())
	}
}
