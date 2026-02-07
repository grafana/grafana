package testcontainers

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/testcontainers/testcontainers-go/internal/config"
	"github.com/testcontainers/testcontainers-go/internal/core"
	"github.com/testcontainers/testcontainers-go/log"
)

// possible provider types
const (
	ProviderDefault ProviderType = iota // default will auto-detect provider from DOCKER_HOST environment variable
	ProviderDocker
	ProviderPodman
)

type (
	// ProviderType is an enum for the possible providers
	ProviderType int

	// GenericProviderOptions defines options applicable to all providers
	GenericProviderOptions struct {
		Logger         log.Logger
		defaultNetwork string
	}

	// GenericProviderOption defines a common interface to modify GenericProviderOptions
	// These options can be passed to GetProvider in a variadic way to customize the returned GenericProvider instance
	GenericProviderOption interface {
		ApplyGenericTo(opts *GenericProviderOptions)
	}

	// GenericProviderOptionFunc is a shorthand to implement the GenericProviderOption interface
	GenericProviderOptionFunc func(opts *GenericProviderOptions)

	// DockerProviderOptions defines options applicable to DockerProvider
	DockerProviderOptions struct {
		defaultBridgeNetworkName string
		*GenericProviderOptions
	}

	// DockerProviderOption defines a common interface to modify DockerProviderOptions
	// These can be passed to NewDockerProvider in a variadic way to customize the returned DockerProvider instance
	DockerProviderOption interface {
		ApplyDockerTo(opts *DockerProviderOptions)
	}

	// DockerProviderOptionFunc is a shorthand to implement the DockerProviderOption interface
	DockerProviderOptionFunc func(opts *DockerProviderOptions)
)

func (f DockerProviderOptionFunc) ApplyDockerTo(opts *DockerProviderOptions) {
	f(opts)
}

func Generic2DockerOptions(opts ...GenericProviderOption) []DockerProviderOption {
	converted := make([]DockerProviderOption, 0, len(opts))
	for _, o := range opts {
		switch c := o.(type) {
		case DockerProviderOption:
			converted = append(converted, c)
		default:
			converted = append(converted, DockerProviderOptionFunc(func(opts *DockerProviderOptions) {
				o.ApplyGenericTo(opts.GenericProviderOptions)
			}))
		}
	}

	return converted
}

func WithDefaultBridgeNetwork(bridgeNetworkName string) DockerProviderOption {
	return DockerProviderOptionFunc(func(opts *DockerProviderOptions) {
		opts.defaultBridgeNetworkName = bridgeNetworkName
	})
}

func (f GenericProviderOptionFunc) ApplyGenericTo(opts *GenericProviderOptions) {
	f(opts)
}

// ContainerProvider allows the creation of containers on an arbitrary system
type ContainerProvider interface {
	Close() error                                                                // close the provider
	CreateContainer(context.Context, ContainerRequest) (Container, error)        // create a container without starting it
	ReuseOrCreateContainer(context.Context, ContainerRequest) (Container, error) // reuses a container if it exists or creates a container without starting
	RunContainer(context.Context, ContainerRequest) (Container, error)           // create a container and start it
	Health(context.Context) error
	Config() TestcontainersConfig
}

// GetProvider provides the provider implementation for a certain type
func (t ProviderType) GetProvider(opts ...GenericProviderOption) (GenericProvider, error) {
	opt := &GenericProviderOptions{
		Logger: log.Default(),
	}

	for _, o := range opts {
		o.ApplyGenericTo(opt)
	}

	pt := t
	if pt == ProviderDefault && strings.Contains(os.Getenv("DOCKER_HOST"), "podman.sock") {
		pt = ProviderPodman
	}

	switch pt {
	case ProviderDefault, ProviderDocker:
		providerOptions := append(Generic2DockerOptions(opts...), WithDefaultBridgeNetwork(Bridge))
		provider, err := NewDockerProvider(providerOptions...)
		if err != nil {
			return nil, fmt.Errorf("%w, failed to create Docker provider", err)
		}
		return provider, nil
	case ProviderPodman:
		providerOptions := append(Generic2DockerOptions(opts...), WithDefaultBridgeNetwork(Podman))
		provider, err := NewDockerProvider(providerOptions...)
		if err != nil {
			return nil, fmt.Errorf("%w, failed to create Docker provider", err)
		}
		return provider, nil
	}
	return nil, errors.New("unknown provider")
}

// NewDockerProvider creates a Docker provider with the EnvClient
func NewDockerProvider(provOpts ...DockerProviderOption) (*DockerProvider, error) {
	o := &DockerProviderOptions{
		GenericProviderOptions: &GenericProviderOptions{
			Logger: log.Default(),
		},
	}

	for idx := range provOpts {
		provOpts[idx].ApplyDockerTo(o)
	}

	ctx := context.Background()
	c, err := NewDockerClientWithOpts(ctx)
	if err != nil {
		return nil, err
	}

	return &DockerProvider{
		DockerProviderOptions: o,
		host:                  core.MustExtractDockerHost(ctx),
		client:                c,
		config:                config.Read(),
	}, nil
}
