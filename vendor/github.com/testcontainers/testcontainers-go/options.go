package testcontainers

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"dario.cat/mergo"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"

	tcexec "github.com/testcontainers/testcontainers-go/exec"
	"github.com/testcontainers/testcontainers-go/internal/core"
	"github.com/testcontainers/testcontainers-go/wait"
)

// ContainerCustomizer is an interface that can be used to configure the Testcontainers container
// request. The passed request will be merged with the default one.
type ContainerCustomizer interface {
	Customize(req *GenericContainerRequest) error
}

// CustomizeRequestOption is a type that can be used to configure the Testcontainers container request.
// The passed request will be merged with the default one.
type CustomizeRequestOption func(req *GenericContainerRequest) error

func (opt CustomizeRequestOption) Customize(req *GenericContainerRequest) error {
	return opt(req)
}

// CustomizeRequest returns a function that can be used to merge the passed container request with the one that is used by the container.
// Slices and Maps will be appended.
func CustomizeRequest(src GenericContainerRequest) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		if err := mergo.Merge(req, &src, mergo.WithOverride, mergo.WithAppendSlice); err != nil {
			return fmt.Errorf("error merging container request, keeping the original one: %w", err)
		}

		return nil
	}
}

// WithConfigModifier allows to override the default container config
func WithConfigModifier(modifier func(config *container.Config)) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		req.ConfigModifier = modifier

		return nil
	}
}

// WithEndpointSettingsModifier allows to override the default endpoint settings
func WithEndpointSettingsModifier(modifier func(settings map[string]*network.EndpointSettings)) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		req.EndpointSettingsModifier = modifier

		return nil
	}
}

// WithEnv sets the environment variables for a container.
// If the environment variable already exists, it will be overridden.
func WithEnv(envs map[string]string) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		if req.Env == nil {
			req.Env = map[string]string{}
		}

		for key, val := range envs {
			req.Env[key] = val
		}

		return nil
	}
}

// WithHostConfigModifier allows to override the default host config
func WithHostConfigModifier(modifier func(hostConfig *container.HostConfig)) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		req.HostConfigModifier = modifier

		return nil
	}
}

// WithHostPortAccess allows to expose the host ports to the container
func WithHostPortAccess(ports ...int) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		if req.HostAccessPorts == nil {
			req.HostAccessPorts = []int{}
		}

		req.HostAccessPorts = append(req.HostAccessPorts, ports...)
		return nil
	}
}

// Deprecated: the modules API forces passing the image as part of the signature of the Run function.
// WithImage sets the image for a container
func WithImage(image string) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		req.Image = image

		return nil
	}
}

// imageSubstitutor {

// ImageSubstitutor represents a way to substitute container image names
type ImageSubstitutor interface {
	// Description returns the name of the type and a short description of how it modifies the image.
	// Useful to be printed in logs
	Description() string
	Substitute(image string) (string, error)
}

// }

// CustomHubSubstitutor represents a way to substitute the hub of an image with a custom one,
// using provided value with respect to the HubImageNamePrefix configuration value.
type CustomHubSubstitutor struct {
	hub string
}

// NewCustomHubSubstitutor creates a new CustomHubSubstitutor
func NewCustomHubSubstitutor(hub string) CustomHubSubstitutor {
	return CustomHubSubstitutor{
		hub: hub,
	}
}

// Description returns the name of the type and a short description of how it modifies the image.
func (c CustomHubSubstitutor) Description() string {
	return fmt.Sprintf("CustomHubSubstitutor (replaces hub with %s)", c.hub)
}

// Substitute replaces the hub of the image with the provided one, with certain conditions:
//   - if the hub is empty, the image is returned as is.
//   - if the image already contains a registry, the image is returned as is.
//   - if the HubImageNamePrefix configuration value is set, the image is returned as is.
func (c CustomHubSubstitutor) Substitute(image string) (string, error) {
	registry := core.ExtractRegistry(image, "")
	cfg := ReadConfig()

	exclusions := []func() bool{
		func() bool { return c.hub == "" },
		func() bool { return registry != "" },
		func() bool { return cfg.Config.HubImageNamePrefix != "" },
	}

	for _, exclusion := range exclusions {
		if exclusion() {
			return image, nil
		}
	}

	result, err := url.JoinPath(c.hub, image)
	if err != nil {
		return "", err
	}

	return result, nil
}

// prependHubRegistry represents a way to prepend a custom Hub registry to the image name,
// using the HubImageNamePrefix configuration value
type prependHubRegistry struct {
	prefix string
}

// newPrependHubRegistry creates a new prependHubRegistry
func newPrependHubRegistry(hubPrefix string) prependHubRegistry {
	return prependHubRegistry{
		prefix: hubPrefix,
	}
}

// Description returns the name of the type and a short description of how it modifies the image.
func (p prependHubRegistry) Description() string {
	return fmt.Sprintf("HubImageSubstitutor (prepends %s)", p.prefix)
}

// Substitute prepends the Hub prefix to the image name, with certain conditions:
//   - if the prefix is empty, the image is returned as is.
//   - if the image is a non-hub image (e.g. where another registry is set), the image is returned as is.
//   - if the image is a Docker Hub image where the hub registry is explicitly part of the name
//     (i.e. anything with a registry.hub.docker.com host part), the image is returned as is.
func (p prependHubRegistry) Substitute(image string) (string, error) {
	registry := core.ExtractRegistry(image, "")

	// add the exclusions in the right order
	exclusions := []func() bool{
		func() bool { return p.prefix == "" },                        // no prefix set at the configuration level
		func() bool { return registry != "" },                        // non-hub image
		func() bool { return registry == "docker.io" },               // explicitly including docker.io
		func() bool { return registry == "registry.hub.docker.com" }, // explicitly including registry.hub.docker.com
	}

	for _, exclusion := range exclusions {
		if exclusion() {
			return image, nil
		}
	}

	result, err := url.JoinPath(p.prefix, image)
	if err != nil {
		return "", err
	}

	return result, nil
}

// WithImageSubstitutors sets the image substitutors for a container
func WithImageSubstitutors(fn ...ImageSubstitutor) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		req.ImageSubstitutors = fn

		return nil
	}
}

// WithLogConsumers sets the log consumers for a container
func WithLogConsumers(consumer ...LogConsumer) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		if req.LogConsumerCfg == nil {
			req.LogConsumerCfg = &LogConsumerConfig{}
		}

		req.LogConsumerCfg.Consumers = consumer
		return nil
	}
}

// Executable represents an executable command to be sent to a container, including options,
// as part of the different lifecycle hooks.
type Executable interface {
	AsCommand() []string
	// Options can container two different types of options:
	// - Docker's ExecConfigs (WithUser, WithWorkingDir, WithEnv, etc.)
	// - testcontainers' ProcessOptions (i.e. Multiplexed response)
	Options() []tcexec.ProcessOption
}

// ExecOptions is a struct that provides a default implementation for the Options method
// of the Executable interface.
type ExecOptions struct {
	opts []tcexec.ProcessOption
}

func (ce ExecOptions) Options() []tcexec.ProcessOption {
	return ce.opts
}

// RawCommand is a type that implements Executable and represents a command to be sent to a container
type RawCommand struct {
	ExecOptions
	cmds []string
}

func NewRawCommand(cmds []string) RawCommand {
	return RawCommand{
		cmds: cmds,
		ExecOptions: ExecOptions{
			opts: []tcexec.ProcessOption{},
		},
	}
}

// AsCommand returns the command as a slice of strings
func (r RawCommand) AsCommand() []string {
	return r.cmds
}

// WithStartupCommand will execute the command representation of each Executable into the container.
// It will leverage the container lifecycle hooks to call the command right after the container
// is started.
func WithStartupCommand(execs ...Executable) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		startupCommandsHook := ContainerLifecycleHooks{
			PostStarts: []ContainerHook{},
		}

		for _, exec := range execs {
			execFn := func(ctx context.Context, c Container) error {
				_, _, err := c.Exec(ctx, exec.AsCommand(), exec.Options()...)
				return err
			}

			startupCommandsHook.PostStarts = append(startupCommandsHook.PostStarts, execFn)
		}

		req.LifecycleHooks = append(req.LifecycleHooks, startupCommandsHook)

		return nil
	}
}

// WithAfterReadyCommand will execute the command representation of each Executable into the container.
// It will leverage the container lifecycle hooks to call the command right after the container
// is ready.
func WithAfterReadyCommand(execs ...Executable) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		postReadiesHook := []ContainerHook{}

		for _, exec := range execs {
			execFn := func(ctx context.Context, c Container) error {
				_, _, err := c.Exec(ctx, exec.AsCommand(), exec.Options()...)
				return err
			}

			postReadiesHook = append(postReadiesHook, execFn)
		}

		req.LifecycleHooks = append(req.LifecycleHooks, ContainerLifecycleHooks{
			PostReadies: postReadiesHook,
		})

		return nil
	}
}

// WithWaitStrategy sets the wait strategy for a container, using 60 seconds as deadline
func WithWaitStrategy(strategies ...wait.Strategy) CustomizeRequestOption {
	return WithWaitStrategyAndDeadline(60*time.Second, strategies...)
}

// WithWaitStrategyAndDeadline sets the wait strategy for a container, including deadline
func WithWaitStrategyAndDeadline(deadline time.Duration, strategies ...wait.Strategy) CustomizeRequestOption {
	return func(req *GenericContainerRequest) error {
		req.WaitingFor = wait.ForAll(strategies...).WithDeadline(deadline)

		return nil
	}
}
