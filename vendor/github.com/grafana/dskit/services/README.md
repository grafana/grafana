# Services

This is a Go implementation of [services model](https://github.com/google/guava/wiki/ServiceExplained) from [Google Guava](https://github.com/google/guava) library.

It provides `Service` interface (with implementation in `BasicService` type) and `Manager` for managing group of services at once.

Main benefits of this model are:

- Services have well-defined explicit states. Services are not supposed to start any work until they are started, and they are supposed to enter Running state only if they have successfully done all initialization in Starting state.
- States are observable by clients. Client can not only see the state, but also wait for Running or Terminated state.
- If more observability is needed, clients can register state listeners.
- Service startup and shutdown is done asynchronously. This allows for nice parallelization of startup or shutdown of multiple services.
- Services that depend on each other can simply wait for other service to be in correct state before using it.

## Service interface

As the user of the service, here is what you need to know:
Each service starts in New state.
In this state, service is not yet doing anything. It is only instantiated, and ready to be started.

Service is started by calling its `StartAsync` method. This will make service transition to `Starting` state, and eventually to `Running` state, if starting is successful.
Starting is done asynchronously, so that client can do other work while service is starting, for example start more services.

Service spends most of its time in `Running` state, in which it provides it services to the clients. What exactly it does depends on service itself. Typical examples include responding to HTTP requests, running periodic background tasks, etc.

Clients can stop the service by calling `StopAsync`, which tells service to stop. `Service` will transition to `Stopping` state (in which it does the necessary cleanup) and eventually `Terminated` state.
If service fails in its `Starting`, `Running` or `Stopping` state, it will end up in `Failed` state instead of Terminated.

Once service is in `Terminated` or `Failed` state, it cannot be restarted, these states are terminal.

Full state diagram:

```text
   ┌────────────────────────────────────────────────────────────────────┐
   │                                                                    │
   │                                                                    ▼
┌─────┐      ┌──────────┐      ┌─────────┐     ┌──────────┐      ┌────────────┐
│ New │─────▶│ Starting │─────▶│ Running │────▶│ Stopping │───┬─▶│ Terminated │
└─────┘      └──────────┘      └─────────┘     └──────────┘   │  └────────────┘
                   │                                          │
                   │                                          │
                   │                                          │   ┌────────┐
                   └──────────────────────────────────────────┴──▶│ Failed │
                                                                  └────────┘
```

API and states and semantics are implemented to correspond to [Service class](https://guava.dev/releases/snapshot/api/docs/com/google/common/util/concurrent/Service.html) in Guava library.

## Manager

Multiple services can be managed via `Manager` (corresponds to [ServiceManager](https://guava.dev/releases/snapshot/api/docs/com/google/common/util/concurrent/ServiceManager.html) in Guava library).
Manager is initialized with list of New services.
It can start the services, and wait until all services are running (= "Healthy" state).
Manager can also be stopped – which triggers stopping of all its services.
When all services are in their terminal states (Terminated or Final), manager is said to be Stopped.

## Implementing custom Service

As a developer who wants to implement your own service, there are several possibilities.

### Using `NewService`

The easiest possible way to create a service is using `NewService` function with three functions called `StartingFn`, `RunningFn` and `StoppingFn`.
Returned service will be in `New` state.
When it transitions to `Starting` state (by calling `StartAsync`), `StartingFn` is called.
When `StartingFn` finishes with no error, service transitions to `Running` state and `RunningFn` is called.
When `RunningFn` finishes, services transitions to `Stopping` state, and `StoppingFn` is called.
After `StoppingFn` is done, service ends in `Terminated` state (if none of the functions returned error), or `Failed` state, if there were errors.

Any of the functions can be `nil`, in which case service simply moves to the next state.

### Using `NewIdleService`

"Idle" service is a service which needs to run custom code during `Starting` or `Stopping` state, but not in `Running` state.
Service will remain in `Running` state until explicitly stopped via `StopAsync`.

Example usage is a service that registers some HTTP or gRPC handlers.

### Using `NewTimerService`

Timer service runs supplied function on every tick. If this function returns error, service will fail.
Otherwise service will continue calling supplied function until stopped via `StopAsync`.

### Using `BasicService` struct

All previous options use `BasicService` type internally, and it is `BasicService` which implements semantics of `Service` interface.
This struct can also be embedded into custom struct, and then initialized with starting/running/stopping functions via `InitBasicService`:

```go
type exampleService struct {
	*BasicService

	log []string
	ch  chan string
}

func newExampleServ() *exampleService {
	s := &exampleService{
		ch: make(chan string),
	}
    s.BasicService = NewBasicService(nil, s.collect, nil) // StartingFn, RunningFn, StoppingFn
	return s
}

// used as Running function. When service is stopped, context is canceled, so we react on it.
func (s *exampleService) collect(ctx context.Context) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		case msg := <-s.ch:
			s.log = append(s.log, msg)
		}
	}
}

// External method called by clients of the Service.
func (s *exampleService) Send(msg string) bool {
	ctx := s.ServiceContext() // provided by BasicService. Not part of Service interface.
	if ctx == nil {
		// Service is not yet started
		return false
	}
	select {
	case s.ch <- msg:
		return true
	case <-ctx.Done():
		// Service is not running anymore.
		return false
	}
}
```

Now `exampleService` is a service that can be started, observed for state changes, or stopped. As long as service is in Running state, clients can call its `Send` method:

```go
s := newExampleServ()
s.StartAsync(context.Background())
s.AwaitRunning(context.Background())
// now collect() is running
s.Send("A")
s.Send("B")
s.Send("C")
s.StopAsync()
s.AwaitTerminated(context.Background())
// now service is finished, and we can access s.log
```

After service is stopped (in Terminated or Failed state, although here the "running" function doesn't return error, so only Terminated state is possible), all collected messages can be read from `log` field.
Notice that no further synchronization is necessary in this case... when service is stopped and client has observed that via `AwaitTerminated`, any access to `log` is safe.

(This example is adapted from unit tests in basic_service_test.go)

This may seem like a lot of extra code, and for such a simple usage it probably is.
Real benefit comes when one starts combining multiple services into a manager, observe them as a group, or let services depend on each other via Await methods.
