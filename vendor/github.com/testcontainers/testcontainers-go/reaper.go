package testcontainers

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/errdefs"
	"github.com/docker/go-connections/nat"

	"github.com/testcontainers/testcontainers-go/internal/config"
	"github.com/testcontainers/testcontainers-go/internal/core"
	"github.com/testcontainers/testcontainers-go/log"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	// Deprecated: it has been replaced by the internal core.LabelLang
	TestcontainerLabel = "org.testcontainers.golang"
	// Deprecated: it has been replaced by the internal core.LabelSessionID
	TestcontainerLabelSessionID = TestcontainerLabel + ".sessionId"
	// Deprecated: it has been replaced by the internal core.LabelReaper
	TestcontainerLabelIsReaper = TestcontainerLabel + ".reaper"
)

var (
	// Deprecated: it has been replaced by an internal value
	ReaperDefaultImage = config.ReaperDefaultImage

	// defaultReaperPort is the default port that the reaper listens on if not
	// overridden by the RYUK_PORT environment variable.
	defaultReaperPort = nat.Port("8080/tcp")

	// errReaperNotFound is returned when no reaper container is found.
	errReaperNotFound = errors.New("reaper not found")

	// errReaperDisabled is returned if a reaper is requested but the
	// config has it disabled.
	errReaperDisabled = errors.New("reaper disabled")

	// spawner is the singleton instance of reaperSpawner.
	spawner = &reaperSpawner{}

	// reaperAck is the expected response from the reaper container.
	reaperAck = []byte("ACK\n")
)

// ReaperProvider represents a provider for the reaper to run itself with
// The ContainerProvider interface should usually satisfy this as well, so it is pluggable
type ReaperProvider interface {
	RunContainer(ctx context.Context, req ContainerRequest) (Container, error)
	Config() TestcontainersConfig
}

// NewReaper creates a Reaper with a sessionID to identify containers and a provider to use
// Deprecated: it's not possible to create a reaper any more. Compose module uses this method
// to create a reaper for the compose stack.
//
// The caller must call Connect at least once on the returned Reaper and use the returned
// result otherwise the reaper will be kept open until the process exits.
func NewReaper(ctx context.Context, sessionID string, provider ReaperProvider, _ string) (*Reaper, error) {
	reaper, err := spawner.reaper(ctx, sessionID, provider)
	if err != nil {
		return nil, fmt.Errorf("reaper: %w", err)
	}

	return reaper, nil
}

// reaperContainerNameFromSessionID returns the container name that uniquely
// identifies the container based on the session id.
func reaperContainerNameFromSessionID(sessionID string) string {
	// The session id is 64 characters, so we will not hit the limit of 128
	// characters for container names.
	return "reaper_" + sessionID
}

// reaperSpawner is a singleton that manages the reaper container.
type reaperSpawner struct {
	instance *Reaper
	mtx      sync.Mutex
}

// port returns the port that a new reaper should listen on.
func (r *reaperSpawner) port() nat.Port {
	if port := os.Getenv("RYUK_PORT"); port != "" {
		natPort, err := nat.NewPort("tcp", port)
		if err != nil {
			panic(fmt.Sprintf("invalid RYUK_PORT value %q: %s", port, err))
		}
		return natPort
	}

	return defaultReaperPort
}

// backoff returns a backoff policy for the reaper spawner.
// It will take at most 20 seconds, doing each attempt every 100ms - 250ms.
func (r *reaperSpawner) backoff() *backoff.ExponentialBackOff {
	// We want random intervals between 100ms and 250ms for concurrent executions
	// to not be synchronized: it could be the case that multiple executions of this
	// function happen at the same time (specifically when called from a different test
	// process execution), and we want to avoid that they all try to find the reaper
	// container at the same time.
	b := &backoff.ExponentialBackOff{
		InitialInterval:     time.Millisecond * 100,
		RandomizationFactor: backoff.DefaultRandomizationFactor,
		Multiplier:          backoff.DefaultMultiplier,
		// Adjust MaxInterval to compensate for randomization factor which can be added to
		// returned interval so we have a maximum of 250ms.
		MaxInterval:    time.Duration(float64(time.Millisecond*250) * backoff.DefaultRandomizationFactor),
		MaxElapsedTime: time.Second * 20,
		Stop:           backoff.Stop,
		Clock:          backoff.SystemClock,
	}
	b.Reset()

	return b
}

// cleanup terminates the reaper container if set.
func (r *reaperSpawner) cleanup() error {
	r.mtx.Lock()
	defer r.mtx.Unlock()

	return r.cleanupLocked()
}

// cleanupLocked terminates the reaper container if set.
// It must be called with the lock held.
func (r *reaperSpawner) cleanupLocked() error {
	if r.instance == nil {
		return nil
	}

	err := TerminateContainer(r.instance.container)
	r.instance = nil

	return err
}

// lookupContainer returns a DockerContainer type with the reaper container in the case
// it's found in the running state, and including the labels for sessionID, reaper, and ryuk.
// It will perform a retry with exponential backoff to allow for the container to be started and
// avoid potential false negatives.
func (r *reaperSpawner) lookupContainer(ctx context.Context, sessionID string) (*DockerContainer, error) {
	dockerClient, err := NewDockerClientWithOpts(ctx)
	if err != nil {
		return nil, fmt.Errorf("new client: %w", err)
	}
	defer dockerClient.Close()

	provider, err := NewDockerProvider()
	if err != nil {
		return nil, fmt.Errorf("new provider: %w", err)
	}

	provider.SetClient(dockerClient)

	opts := container.ListOptions{
		All: true,
		Filters: filters.NewArgs(
			filters.Arg("label", fmt.Sprintf("%s=%s", core.LabelSessionID, sessionID)),
			filters.Arg("label", fmt.Sprintf("%s=%t", core.LabelReaper, true)),
			filters.Arg("label", fmt.Sprintf("%s=%t", core.LabelRyuk, true)),
			filters.Arg("name", reaperContainerNameFromSessionID(sessionID)),
		),
	}

	return backoff.RetryWithData(
		func() (*DockerContainer, error) {
			resp, err := dockerClient.ContainerList(ctx, opts)
			if err != nil {
				return nil, fmt.Errorf("container list: %w", err)
			}

			if len(resp) == 0 {
				// No reaper container not found.
				return nil, backoff.Permanent(errReaperNotFound)
			}

			if len(resp) > 1 {
				return nil, fmt.Errorf("found %d reaper containers for session ID %q", len(resp), sessionID)
			}

			r, err := provider.ContainerFromType(ctx, resp[0])
			if err != nil {
				return nil, fmt.Errorf("from docker: %w", err)
			}

			switch {
			case r.healthStatus == types.Healthy,
				r.healthStatus == types.NoHealthcheck:
				return r, nil
			case r.healthStatus != "":
				return nil, fmt.Errorf("container not healthy: %s", r.healthStatus)
			}

			return r, nil
		},
		backoff.WithContext(r.backoff(), ctx),
	)
}

// isRunning returns an error if the container is not running.
func (r *reaperSpawner) isRunning(ctx context.Context, ctr Container) error {
	state, err := ctr.State(ctx)
	if err != nil {
		return fmt.Errorf("container state: %w", err)
	}

	if !state.Running {
		// Use NotFound error to indicate the container is not running
		// and should be recreated.
		return errdefs.NotFound(fmt.Errorf("container state: %s", state.Status))
	}

	return nil
}

// retryError returns a permanent error if the error is not considered retryable.
func (r *reaperSpawner) retryError(err error) error {
	var timeout interface {
		Timeout() bool
	}
	switch {
	case isCleanupSafe(err),
		createContainerFailDueToNameConflictRegex.MatchString(err.Error()),
		errors.Is(err, syscall.ECONNREFUSED),
		errors.Is(err, syscall.ECONNRESET),
		errors.Is(err, syscall.ECONNABORTED),
		errors.Is(err, syscall.ETIMEDOUT),
		errors.Is(err, os.ErrDeadlineExceeded),
		errors.As(err, &timeout) && timeout.Timeout(),
		errors.Is(err, context.DeadlineExceeded),
		errors.Is(err, context.Canceled):
		// Retryable error.
		return err
	default:
		return backoff.Permanent(err)
	}
}

// reaper returns an existing Reaper instance if it exists and is running, otherwise
// a new Reaper instance will be created with a sessionID to identify containers in
// the same test session/program. If connect is true, the reaper will be connected
// to the reaper container.
// Returns an error if config.RyukDisabled is true.
//
// Safe for concurrent calls.
func (r *reaperSpawner) reaper(ctx context.Context, sessionID string, provider ReaperProvider) (*Reaper, error) {
	if config.Read().RyukDisabled {
		return nil, errReaperDisabled
	}

	r.mtx.Lock()
	defer r.mtx.Unlock()

	return backoff.RetryWithData(
		r.retryLocked(ctx, sessionID, provider),
		backoff.WithContext(r.backoff(), ctx),
	)
}

// retryLocked returns a function that can be used to create or reuse a reaper container.
// If connect is true, the reaper will be connected to the reaper container.
// It must be called with the lock held.
func (r *reaperSpawner) retryLocked(ctx context.Context, sessionID string, provider ReaperProvider) func() (*Reaper, error) {
	return func() (reaper *Reaper, err error) {
		reaper, err = r.reuseOrCreate(ctx, sessionID, provider)
		// Ensure that the reaper is terminated if an error occurred.
		defer func() {
			if err != nil {
				if reaper != nil {
					err = errors.Join(err, TerminateContainer(reaper.container))
				}
				err = r.retryError(errors.Join(err, r.cleanupLocked()))
			}
		}()
		if err != nil {
			return nil, err
		}

		if err = r.isRunning(ctx, reaper.container); err != nil {
			return nil, err
		}

		// Check we can still connect.
		termSignal, err := reaper.connect(ctx)
		if err != nil {
			return nil, fmt.Errorf("connect: %w", err)
		}

		reaper.setOrSignal(termSignal)

		r.instance = reaper

		return reaper, nil
	}
}

// reuseOrCreate returns an existing Reaper instance if it exists, otherwise a new Reaper instance.
func (r *reaperSpawner) reuseOrCreate(ctx context.Context, sessionID string, provider ReaperProvider) (*Reaper, error) {
	if r.instance != nil {
		// We already have an associated reaper.
		return r.instance, nil
	}

	// Look for an existing reaper created in the same test session but in a
	// different test process execution e.g. when running tests in parallel.
	container, err := r.lookupContainer(context.Background(), sessionID)
	if err != nil {
		if !errors.Is(err, errReaperNotFound) {
			return nil, fmt.Errorf("look up container: %w", err)
		}

		// The reaper container was not found, continue to create a new one.
		reaper, err := r.newReaper(ctx, sessionID, provider)
		if err != nil {
			return nil, fmt.Errorf("new reaper: %w", err)
		}

		return reaper, nil
	}

	// A reaper container exists re-use it.
	reaper, err := r.fromContainer(ctx, sessionID, provider, container)
	if err != nil {
		return nil, fmt.Errorf("from container %q: %w", container.ID[:8], err)
	}

	return reaper, nil
}

// fromContainer constructs a Reaper from an already running reaper DockerContainer.
func (r *reaperSpawner) fromContainer(ctx context.Context, sessionID string, provider ReaperProvider, dockerContainer *DockerContainer) (*Reaper, error) {
	log.Printf("⏳ Waiting for Reaper %q to be ready", dockerContainer.ID[:8])

	// Reusing an existing container so we determine the port from the container's exposed ports.
	if err := wait.ForExposedPort().
		WithPollInterval(100*time.Millisecond).
		SkipInternalCheck().
		WaitUntilReady(ctx, dockerContainer); err != nil {
		return nil, fmt.Errorf("wait for reaper %s: %w", dockerContainer.ID[:8], err)
	}

	endpoint, err := dockerContainer.Endpoint(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("port endpoint: %w", err)
	}

	log.Printf("🔥 Reaper obtained from Docker for this test session %s", dockerContainer.ID[:8])

	return &Reaper{
		Provider:  provider,
		SessionID: sessionID,
		Endpoint:  endpoint,
		container: dockerContainer,
	}, nil
}

// newReaper creates a connected Reaper with a sessionID to identify containers
// and a provider to use.
func (r *reaperSpawner) newReaper(ctx context.Context, sessionID string, provider ReaperProvider) (reaper *Reaper, err error) {
	dockerHostMount := core.MustExtractDockerSocket(ctx)

	port := r.port()
	tcConfig := provider.Config().Config
	req := ContainerRequest{
		Image:        config.ReaperDefaultImage,
		ExposedPorts: []string{string(port)},
		Labels:       core.DefaultLabels(sessionID),
		Privileged:   tcConfig.RyukPrivileged,
		WaitingFor:   wait.ForListeningPort(port),
		Name:         reaperContainerNameFromSessionID(sessionID),
		HostConfigModifier: func(hc *container.HostConfig) {
			hc.AutoRemove = true
			hc.Binds = []string{dockerHostMount + ":/var/run/docker.sock"}
			hc.NetworkMode = Bridge
		},
		Env: map[string]string{},
	}
	if to := tcConfig.RyukConnectionTimeout; to > time.Duration(0) {
		req.Env["RYUK_CONNECTION_TIMEOUT"] = to.String()
	}
	if to := tcConfig.RyukReconnectionTimeout; to > time.Duration(0) {
		req.Env["RYUK_RECONNECTION_TIMEOUT"] = to.String()
	}
	if tcConfig.RyukVerbose {
		req.Env["RYUK_VERBOSE"] = "true"
	}

	// Setup reaper-specific labels for the reaper container.
	req.Labels[core.LabelReaper] = "true"
	req.Labels[core.LabelRyuk] = "true"
	delete(req.Labels, core.LabelReap)

	// Attach reaper container to a requested network if it is specified
	if p, ok := provider.(*DockerProvider); ok {
		defaultNetwork, err := p.ensureDefaultNetwork(ctx)
		if err != nil {
			return nil, fmt.Errorf("ensure default network: %w", err)
		}

		req.Networks = append(req.Networks, defaultNetwork)
	}

	c, err := provider.RunContainer(ctx, req)
	defer func() {
		if err != nil {
			err = errors.Join(err, TerminateContainer(c))
		}
	}()
	if err != nil {
		return nil, fmt.Errorf("run container: %w", err)
	}

	endpoint, err := c.PortEndpoint(ctx, port, "")
	if err != nil {
		return nil, fmt.Errorf("port endpoint: %w", err)
	}

	return &Reaper{
		Provider:  provider,
		SessionID: sessionID,
		Endpoint:  endpoint,
		container: c,
	}, nil
}

// Reaper is used to start a sidecar container that cleans up resources
type Reaper struct {
	Provider   ReaperProvider
	SessionID  string
	Endpoint   string
	container  Container
	mtx        sync.Mutex // Protects termSignal.
	termSignal chan bool
}

// Connect connects to the reaper container and sends the labels to it
// so that it can clean up the containers with the same labels.
//
// It returns a channel that can be closed to terminate the connection.
// Returns an error if config.RyukDisabled is true.
func (r *Reaper) Connect() (chan bool, error) {
	if config.Read().RyukDisabled {
		return nil, errReaperDisabled
	}

	if termSignal := r.useTermSignal(); termSignal != nil {
		return termSignal, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()

	return r.connect(ctx)
}

// close signals the connection to close if needed.
// Safe for concurrent calls.
func (r *Reaper) close() {
	r.mtx.Lock()
	defer r.mtx.Unlock()

	if r.termSignal != nil {
		r.termSignal <- true
		r.termSignal = nil
	}
}

// setOrSignal sets the reapers termSignal field if nil
// otherwise consumes by sending true to it.
// Safe for concurrent calls.
func (r *Reaper) setOrSignal(termSignal chan bool) {
	r.mtx.Lock()
	defer r.mtx.Unlock()

	if r.termSignal != nil {
		// Already have an existing connection, close the new one.
		termSignal <- true
		return
	}

	// First or new unused termSignal, assign for caller to reuse.
	r.termSignal = termSignal
}

// useTermSignal if termSignal is not nil returns it
// and sets it to nil, otherwise returns nil.
//
// Safe for concurrent calls.
func (r *Reaper) useTermSignal() chan bool {
	r.mtx.Lock()
	defer r.mtx.Unlock()

	if r.termSignal == nil {
		return nil
	}

	// Use existing connection.
	term := r.termSignal
	r.termSignal = nil

	return term
}

// connect connects to the reaper container and sends the labels to it
// so that it can clean up the containers with the same labels.
//
// It returns a channel that can be sent true to terminate the connection.
// Returns an error if config.RyukDisabled is true.
func (r *Reaper) connect(ctx context.Context) (chan bool, error) {
	var d net.Dialer
	conn, err := d.DialContext(ctx, "tcp", r.Endpoint)
	if err != nil {
		return nil, fmt.Errorf("dial reaper %s: %w", r.Endpoint, err)
	}

	terminationSignal := make(chan bool)
	go func() {
		defer conn.Close()
		if err := r.handshake(conn); err != nil {
			log.Printf("Reaper handshake failed: %s", err)
		}
		<-terminationSignal
	}()
	return terminationSignal, nil
}

// handshake sends the labels to the reaper container and reads the ACK.
func (r *Reaper) handshake(conn net.Conn) error {
	labels := core.DefaultLabels(r.SessionID)
	labelFilters := make([]string, 0, len(labels))
	for l, v := range labels {
		labelFilters = append(labelFilters, fmt.Sprintf("label=%s=%s", l, v))
	}

	filters := []byte(strings.Join(labelFilters, "&") + "\n")
	buf := make([]byte, 4)
	if _, err := conn.Write(filters); err != nil {
		return fmt.Errorf("writing filters: %w", err)
	}

	n, err := io.ReadFull(conn, buf)
	if err != nil {
		return fmt.Errorf("read ack: %w", err)
	}

	if !bytes.Equal(reaperAck, buf[:n]) {
		// We have received the ACK so all done.
		return fmt.Errorf("unexpected reaper response: %s", buf[:n])
	}

	return nil
}

// Labels returns the container labels to use so that this Reaper cleans them up
// Deprecated: internally replaced by core.DefaultLabels(sessionID)
func (r *Reaper) Labels() map[string]string {
	return GenericLabels()
}

// isReaperImage returns true if the image name is the reaper image.
func isReaperImage(name string) bool {
	return strings.HasSuffix(name, config.ReaperDefaultImage)
}
