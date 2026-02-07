package testcontainers

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/testcontainers/testcontainers-go/internal/core"
	"github.com/testcontainers/testcontainers-go/log"
)

var (
	reuseContainerMx  sync.Mutex
	ErrReuseEmptyName = errors.New("with reuse option a container name mustn't be empty")
)

// GenericContainerRequest represents parameters to a generic container
type GenericContainerRequest struct {
	ContainerRequest              // embedded request for provider
	Started          bool         // whether to auto-start the container
	ProviderType     ProviderType // which provider to use, Docker if empty
	Logger           log.Logger   // provide a container specific Logging - use default global logger if empty
	Reuse            bool         // reuse an existing container if it exists or create a new one. a container name mustn't be empty
}

// Deprecated: will be removed in the future.
// GenericNetworkRequest represents parameters to a generic network
type GenericNetworkRequest struct {
	NetworkRequest              // embedded request for provider
	ProviderType   ProviderType // which provider to use, Docker if empty
}

// Deprecated: use network.New instead
// GenericNetwork creates a generic network with parameters
func GenericNetwork(ctx context.Context, req GenericNetworkRequest) (Network, error) {
	provider, err := req.ProviderType.GetProvider()
	if err != nil {
		return nil, err
	}
	network, err := provider.CreateNetwork(ctx, req.NetworkRequest)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to create network", err)
	}

	return network, nil
}

// GenericContainer creates a generic container with parameters
func GenericContainer(ctx context.Context, req GenericContainerRequest) (Container, error) {
	if req.Reuse && req.Name == "" {
		return nil, ErrReuseEmptyName
	}

	logger := req.Logger
	if logger == nil {
		// Ensure there is always a non-nil logger by default
		logger = log.Default()
	}
	provider, err := req.ProviderType.GetProvider(WithLogger(logger))
	if err != nil {
		return nil, fmt.Errorf("get provider: %w", err)
	}
	defer provider.Close()

	var c Container
	if req.Reuse {
		// we must protect the reusability of the container in the case it's invoked
		// in a parallel execution, via ParallelContainers or t.Parallel()
		reuseContainerMx.Lock()
		defer reuseContainerMx.Unlock()

		c, err = provider.ReuseOrCreateContainer(ctx, req.ContainerRequest)
	} else {
		c, err = provider.CreateContainer(ctx, req.ContainerRequest)
	}
	if err != nil {
		// At this point `c` might not be nil. Give the caller an opportunity to call Destroy on the container.
		// TODO: Remove this debugging.
		if strings.Contains(err.Error(), "toomanyrequests") {
			// Debugging information for rate limiting.
			cfg, err := getDockerConfig()
			if err == nil {
				fmt.Printf("XXX: too many requests: %+v", cfg)
			}
		}
		return c, fmt.Errorf("create container: %w", err)
	}

	if req.Started && !c.IsRunning() {
		if err := c.Start(ctx); err != nil {
			return c, fmt.Errorf("start container: %w", err)
		}
	}
	return c, nil
}

// GenericProvider represents an abstraction for container and network providers
type GenericProvider interface {
	ContainerProvider
	NetworkProvider
	ImageProvider
}

// GenericLabels returns a map of labels that can be used to identify resources
// created by this library. This includes the standard LabelSessionID if the
// reaper is enabled, otherwise this is excluded to prevent resources being
// incorrectly reaped.
func GenericLabels() map[string]string {
	return core.DefaultLabels(core.SessionID())
}

// AddGenericLabels adds the generic labels to target.
func AddGenericLabels(target map[string]string) {
	for k, v := range GenericLabels() {
		target[k] = v
	}
}
