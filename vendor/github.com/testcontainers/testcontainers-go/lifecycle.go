package testcontainers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strings"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"

	"github.com/testcontainers/testcontainers-go/log"
)

// ContainerRequestHook is a hook that will be called before a container is created.
// It can be used to modify container configuration before it is created,
// using the different lifecycle hooks that are available:
// - Creating
// For that, it will receive a ContainerRequest, modify it and return an error if needed.
type ContainerRequestHook func(ctx context.Context, req ContainerRequest) error

// ContainerHook is a hook that will be called after a container is created
// It can be used to modify the state of the container after it is created,
// using the different lifecycle hooks that are available:
// - Created
// - Starting
// - Started
// - Readied
// - Stopping
// - Stopped
// - Terminating
// - Terminated
// For that, it will receive a Container, modify it and return an error if needed.
type ContainerHook func(ctx context.Context, ctr Container) error

// ContainerLifecycleHooks is a struct that contains all the hooks that can be used
// to modify the container lifecycle. All the container lifecycle hooks except the PreCreates hooks
// will be passed to the container once it's created
type ContainerLifecycleHooks struct {
	PreBuilds      []ContainerRequestHook
	PostBuilds     []ContainerRequestHook
	PreCreates     []ContainerRequestHook
	PostCreates    []ContainerHook
	PreStarts      []ContainerHook
	PostStarts     []ContainerHook
	PostReadies    []ContainerHook
	PreStops       []ContainerHook
	PostStops      []ContainerHook
	PreTerminates  []ContainerHook
	PostTerminates []ContainerHook
}

// DefaultLoggingHook is a hook that will log the container lifecycle events
var DefaultLoggingHook = func(logger log.Logger) ContainerLifecycleHooks {
	shortContainerID := func(c Container) string {
		return c.GetContainerID()[:12]
	}

	return ContainerLifecycleHooks{
		PreBuilds: []ContainerRequestHook{
			func(_ context.Context, req ContainerRequest) error {
				logger.Printf("🐳 Building image %s:%s", req.GetRepo(), req.GetTag())
				return nil
			},
		},
		PostBuilds: []ContainerRequestHook{
			func(_ context.Context, req ContainerRequest) error {
				logger.Printf("✅ Built image %s", req.Image)
				return nil
			},
		},
		PreCreates: []ContainerRequestHook{
			func(_ context.Context, req ContainerRequest) error {
				logger.Printf("🐳 Creating container for image %s", req.Image)
				return nil
			},
		},
		PostCreates: []ContainerHook{
			func(_ context.Context, c Container) error {
				logger.Printf("✅ Container created: %s", shortContainerID(c))
				return nil
			},
		},
		PreStarts: []ContainerHook{
			func(_ context.Context, c Container) error {
				logger.Printf("🐳 Starting container: %s", shortContainerID(c))
				return nil
			},
		},
		PostStarts: []ContainerHook{
			func(_ context.Context, c Container) error {
				logger.Printf("✅ Container started: %s", shortContainerID(c))
				return nil
			},
		},
		PostReadies: []ContainerHook{
			func(_ context.Context, c Container) error {
				logger.Printf("🔔 Container is ready: %s", shortContainerID(c))
				return nil
			},
		},
		PreStops: []ContainerHook{
			func(_ context.Context, c Container) error {
				logger.Printf("🐳 Stopping container: %s", shortContainerID(c))
				return nil
			},
		},
		PostStops: []ContainerHook{
			func(_ context.Context, c Container) error {
				logger.Printf("✅ Container stopped: %s", shortContainerID(c))
				return nil
			},
		},
		PreTerminates: []ContainerHook{
			func(_ context.Context, c Container) error {
				logger.Printf("🐳 Terminating container: %s", shortContainerID(c))
				return nil
			},
		},
		PostTerminates: []ContainerHook{
			func(_ context.Context, c Container) error {
				logger.Printf("🚫 Container terminated: %s", shortContainerID(c))
				return nil
			},
		},
	}
}

// defaultPreCreateHook is a hook that will apply the default configuration to the container
var defaultPreCreateHook = func(p *DockerProvider, dockerInput *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig) ContainerLifecycleHooks {
	return ContainerLifecycleHooks{
		PreCreates: []ContainerRequestHook{
			func(ctx context.Context, req ContainerRequest) error {
				return p.preCreateContainerHook(ctx, req, dockerInput, hostConfig, networkingConfig)
			},
		},
	}
}

// defaultCopyFileToContainerHook is a hook that will copy files to the container after it's created
// but before it's started
var defaultCopyFileToContainerHook = func(files []ContainerFile) ContainerLifecycleHooks {
	return ContainerLifecycleHooks{
		PostCreates: []ContainerHook{
			// copy files to container after it's created
			func(ctx context.Context, c Container) error {
				for _, f := range files {
					if err := f.validate(); err != nil {
						return fmt.Errorf("invalid file: %w", err)
					}

					var err error
					// Bytes takes precedence over HostFilePath
					if f.Reader != nil {
						bs, ioerr := io.ReadAll(f.Reader)
						if ioerr != nil {
							return fmt.Errorf("can't read from reader: %w", ioerr)
						}

						err = c.CopyToContainer(ctx, bs, f.ContainerFilePath, f.FileMode)
					} else {
						err = c.CopyFileToContainer(ctx, f.HostFilePath, f.ContainerFilePath, f.FileMode)
					}

					if err != nil {
						return fmt.Errorf("can't copy %s to container: %w", f.HostFilePath, err)
					}
				}

				return nil
			},
		},
	}
}

// defaultLogConsumersHook is a hook that will start log consumers after the container is started
var defaultLogConsumersHook = func(cfg *LogConsumerConfig) ContainerLifecycleHooks {
	return ContainerLifecycleHooks{
		PostStarts: []ContainerHook{
			// Produce logs sending details to the log consumers.
			// See combineContainerHooks for the order of execution.
			func(ctx context.Context, c Container) error {
				if cfg == nil || len(cfg.Consumers) == 0 {
					return nil
				}

				dockerContainer := c.(*DockerContainer)
				dockerContainer.consumers = dockerContainer.consumers[:0]
				for _, consumer := range cfg.Consumers {
					dockerContainer.followOutput(consumer)
				}

				return dockerContainer.startLogProduction(ctx, cfg.Opts...)
			},
		},
		PostStops: []ContainerHook{
			// Stop the log production.
			// See combineContainerHooks for the order of execution.
			func(_ context.Context, c Container) error {
				if cfg == nil || len(cfg.Consumers) == 0 {
					return nil
				}

				dockerContainer := c.(*DockerContainer)
				return dockerContainer.stopLogProduction()
			},
		},
	}
}

func checkPortsMapped(exposedAndMappedPorts nat.PortMap, exposedPorts []string) error {
	portMap, _, err := nat.ParsePortSpecs(exposedPorts)
	if err != nil {
		return fmt.Errorf("parse exposed ports: %w", err)
	}

	for exposedPort := range portMap {
		// having entries in exposedAndMappedPorts, where the key is the exposed port,
		// and the value is the mapped port, means that the port has been already mapped.
		if _, ok := exposedAndMappedPorts[exposedPort]; ok {
			continue
		}

		// check if the port is mapped with the protocol (default is TCP)
		if strings.Contains(string(exposedPort), "/") {
			return fmt.Errorf("port %s is not mapped yet", exposedPort)
		}

		// Port didn't have a type, default to tcp and retry.
		exposedPort += "/tcp"
		if _, ok := exposedAndMappedPorts[exposedPort]; !ok {
			return fmt.Errorf("port %s is not mapped yet", exposedPort)
		}
	}

	return nil
}

// defaultReadinessHook is a hook that will wait for the container to be ready
var defaultReadinessHook = func() ContainerLifecycleHooks {
	return ContainerLifecycleHooks{
		PostStarts: []ContainerHook{
			func(ctx context.Context, c Container) error {
				// wait until all the exposed ports are mapped:
				// it will be ready when all the exposed ports are mapped,
				// checking every 50ms, up to 1s, and failing if all the
				// exposed ports are not mapped in 5s.
				dockerContainer := c.(*DockerContainer)

				b := backoff.NewExponentialBackOff()

				b.InitialInterval = 50 * time.Millisecond
				b.MaxElapsedTime = 5 * time.Second
				b.MaxInterval = time.Duration(float64(time.Second) * backoff.DefaultRandomizationFactor)

				err := backoff.RetryNotify(
					func() error {
						jsonRaw, err := dockerContainer.inspectRawContainer(ctx)
						if err != nil {
							return err
						}

						return checkPortsMapped(jsonRaw.NetworkSettings.Ports, dockerContainer.exposedPorts)
					},
					b,
					func(err error, _ time.Duration) {
						dockerContainer.logger.Printf("All requested ports were not exposed: %v", err)
					},
				)
				if err != nil {
					return fmt.Errorf("all exposed ports, %s, were not mapped in 5s: %w", dockerContainer.exposedPorts, err)
				}

				return nil
			},
			// wait for the container to be ready
			func(ctx context.Context, c Container) error {
				dockerContainer := c.(*DockerContainer)

				// if a Wait Strategy has been specified, wait before returning
				if dockerContainer.WaitingFor != nil {
					dockerContainer.logger.Printf(
						"⏳ Waiting for container id %s image: %s. Waiting for: %+v",
						dockerContainer.ID[:12], dockerContainer.Image, dockerContainer.WaitingFor,
					)
					if err := dockerContainer.WaitingFor.WaitUntilReady(ctx, c); err != nil {
						return fmt.Errorf("wait until ready: %w", err)
					}
				}

				dockerContainer.isRunning = true

				return nil
			},
		},
	}
}

// buildingHook is a hook that will be called before a container image is built.
func (req ContainerRequest) buildingHook(ctx context.Context) error {
	return req.applyLifecycleHooks(func(lifecycleHooks ContainerLifecycleHooks) error {
		return lifecycleHooks.Building(ctx)(req)
	})
}

// builtHook is a hook that will be called after a container image is built.
func (req ContainerRequest) builtHook(ctx context.Context) error {
	return req.applyLifecycleHooks(func(lifecycleHooks ContainerLifecycleHooks) error {
		return lifecycleHooks.Built(ctx)(req)
	})
}

// creatingHook is a hook that will be called before a container is created.
func (req ContainerRequest) creatingHook(ctx context.Context) error {
	return req.applyLifecycleHooks(func(lifecycleHooks ContainerLifecycleHooks) error {
		return lifecycleHooks.Creating(ctx)(req)
	})
}

// applyLifecycleHooks calls hook on all LifecycleHooks.
func (req ContainerRequest) applyLifecycleHooks(hook func(lifecycleHooks ContainerLifecycleHooks) error) error {
	var errs []error
	for _, lifecycleHooks := range req.LifecycleHooks {
		if err := hook(lifecycleHooks); err != nil {
			errs = append(errs, err)
		}
	}

	return errors.Join(errs...)
}

// createdHook is a hook that will be called after a container is created.
func (c *DockerContainer) createdHook(ctx context.Context) error {
	return c.applyLifecycleHooks(ctx, false, func(lifecycleHooks ContainerLifecycleHooks) []ContainerHook {
		return lifecycleHooks.PostCreates
	})
}

// startingHook is a hook that will be called before a container is started.
func (c *DockerContainer) startingHook(ctx context.Context) error {
	return c.applyLifecycleHooks(ctx, true, func(lifecycleHooks ContainerLifecycleHooks) []ContainerHook {
		return lifecycleHooks.PreStarts
	})
}

// startedHook is a hook that will be called after a container is started.
func (c *DockerContainer) startedHook(ctx context.Context) error {
	return c.applyLifecycleHooks(ctx, true, func(lifecycleHooks ContainerLifecycleHooks) []ContainerHook {
		return lifecycleHooks.PostStarts
	})
}

// readiedHook is a hook that will be called after a container is ready.
func (c *DockerContainer) readiedHook(ctx context.Context) error {
	return c.applyLifecycleHooks(ctx, true, func(lifecycleHooks ContainerLifecycleHooks) []ContainerHook {
		return lifecycleHooks.PostReadies
	})
}

// printLogs is a helper function that will print the logs of a Docker container
// We are going to use this helper function to inform the user of the logs when an error occurs
func (c *DockerContainer) printLogs(ctx context.Context, cause error) {
	reader, err := c.Logs(ctx)
	if err != nil {
		c.logger.Printf("failed accessing container logs: %v\n", err)
		return
	}

	b, err := io.ReadAll(reader)
	if err != nil {
		c.logger.Printf("failed reading container logs: %v\n", err)
		return
	}

	c.logger.Printf("container logs (%s):\n%s", cause, b)
}

// stoppingHook is a hook that will be called before a container is stopped.
func (c *DockerContainer) stoppingHook(ctx context.Context) error {
	return c.applyLifecycleHooks(ctx, false, func(lifecycleHooks ContainerLifecycleHooks) []ContainerHook {
		return lifecycleHooks.PreStops
	})
}

// stoppedHook is a hook that will be called after a container is stopped.
func (c *DockerContainer) stoppedHook(ctx context.Context) error {
	return c.applyLifecycleHooks(ctx, false, func(lifecycleHooks ContainerLifecycleHooks) []ContainerHook {
		return lifecycleHooks.PostStops
	})
}

// terminatingHook is a hook that will be called before a container is terminated.
func (c *DockerContainer) terminatingHook(ctx context.Context) error {
	return c.applyLifecycleHooks(ctx, false, func(lifecycleHooks ContainerLifecycleHooks) []ContainerHook {
		return lifecycleHooks.PreTerminates
	})
}

// terminatedHook is a hook that will be called after a container is terminated.
func (c *DockerContainer) terminatedHook(ctx context.Context) error {
	return c.applyLifecycleHooks(ctx, false, func(lifecycleHooks ContainerLifecycleHooks) []ContainerHook {
		return lifecycleHooks.PostTerminates
	})
}

// applyLifecycleHooks applies all lifecycle hooks reporting the container logs on error if logError is true.
func (c *DockerContainer) applyLifecycleHooks(ctx context.Context, logError bool, hooks func(lifecycleHooks ContainerLifecycleHooks) []ContainerHook) error {
	var errs []error
	for _, lifecycleHooks := range c.lifecycleHooks {
		if err := containerHookFn(ctx, hooks(lifecycleHooks))(c); err != nil {
			errs = append(errs, err)
		}
	}

	if err := errors.Join(errs...); err != nil {
		if logError {
			select {
			case <-ctx.Done():
				// Context has timed out so need a new context to get logs.
				ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
				defer cancel()
				c.printLogs(ctx, err)
			default:
				c.printLogs(ctx, err)
			}
		}

		return err
	}

	return nil
}

// Building is a hook that will be called before a container image is built.
func (c ContainerLifecycleHooks) Building(ctx context.Context) func(req ContainerRequest) error {
	return containerRequestHook(ctx, c.PreBuilds)
}

// Building is a hook that will be called before a container image is built.
func (c ContainerLifecycleHooks) Built(ctx context.Context) func(req ContainerRequest) error {
	return containerRequestHook(ctx, c.PostBuilds)
}

// Creating is a hook that will be called before a container is created.
func (c ContainerLifecycleHooks) Creating(ctx context.Context) func(req ContainerRequest) error {
	return containerRequestHook(ctx, c.PreCreates)
}

// containerRequestHook returns a function that will iterate over all
// the hooks and call them one by one until there is an error.
func containerRequestHook(ctx context.Context, hooks []ContainerRequestHook) func(req ContainerRequest) error {
	return func(req ContainerRequest) error {
		for _, hook := range hooks {
			if err := hook(ctx, req); err != nil {
				return err
			}
		}

		return nil
	}
}

// containerHookFn is a helper function that will create a function to be returned by all the different
// container lifecycle hooks. The created function will iterate over all the hooks and call them one by one.
func containerHookFn(ctx context.Context, containerHook []ContainerHook) func(container Container) error {
	return func(ctr Container) error {
		var errs []error
		for _, hook := range containerHook {
			if err := hook(ctx, ctr); err != nil {
				errs = append(errs, err)
			}
		}

		return errors.Join(errs...)
	}
}

// Created is a hook that will be called after a container is created
func (c ContainerLifecycleHooks) Created(ctx context.Context) func(container Container) error {
	return containerHookFn(ctx, c.PostCreates)
}

// Starting is a hook that will be called before a container is started
func (c ContainerLifecycleHooks) Starting(ctx context.Context) func(container Container) error {
	return containerHookFn(ctx, c.PreStarts)
}

// Started is a hook that will be called after a container is started
func (c ContainerLifecycleHooks) Started(ctx context.Context) func(container Container) error {
	return containerHookFn(ctx, c.PostStarts)
}

// Readied is a hook that will be called after a container is ready
func (c ContainerLifecycleHooks) Readied(ctx context.Context) func(container Container) error {
	return containerHookFn(ctx, c.PostReadies)
}

// Stopping is a hook that will be called before a container is stopped
func (c ContainerLifecycleHooks) Stopping(ctx context.Context) func(container Container) error {
	return containerHookFn(ctx, c.PreStops)
}

// Stopped is a hook that will be called after a container is stopped
func (c ContainerLifecycleHooks) Stopped(ctx context.Context) func(container Container) error {
	return containerHookFn(ctx, c.PostStops)
}

// Terminating is a hook that will be called before a container is terminated
func (c ContainerLifecycleHooks) Terminating(ctx context.Context) func(container Container) error {
	return containerHookFn(ctx, c.PreTerminates)
}

// Terminated is a hook that will be called after a container is terminated
func (c ContainerLifecycleHooks) Terminated(ctx context.Context) func(container Container) error {
	return containerHookFn(ctx, c.PostTerminates)
}

func (p *DockerProvider) preCreateContainerHook(ctx context.Context, req ContainerRequest, dockerInput *container.Config, hostConfig *container.HostConfig, networkingConfig *network.NetworkingConfig) error {
	// prepare mounts
	hostConfig.Mounts = mapToDockerMounts(req.Mounts)

	endpointSettings := map[string]*network.EndpointSettings{}

	// #248: Docker allows only one network to be specified during container creation
	// If there is more than one network specified in the request container should be attached to them
	// once it is created. We will take a first network if any specified in the request and use it to create container
	if len(req.Networks) > 0 {
		attachContainerTo := req.Networks[0]

		nw, err := p.GetNetwork(ctx, NetworkRequest{
			Name: attachContainerTo,
		})
		if err == nil {
			aliases := []string{}
			if _, ok := req.NetworkAliases[attachContainerTo]; ok {
				aliases = req.NetworkAliases[attachContainerTo]
			}
			endpointSetting := network.EndpointSettings{
				Aliases:   aliases,
				NetworkID: nw.ID,
			}
			endpointSettings[attachContainerTo] = &endpointSetting
		}
	}

	if req.ConfigModifier != nil {
		req.ConfigModifier(dockerInput)
	}

	if req.HostConfigModifier == nil {
		req.HostConfigModifier = defaultHostConfigModifier(req)
	}
	req.HostConfigModifier(hostConfig)

	if req.EndpointSettingsModifier != nil {
		req.EndpointSettingsModifier(endpointSettings)
	}

	networkingConfig.EndpointsConfig = endpointSettings

	exposedPorts := req.ExposedPorts
	// this check must be done after the pre-creation Modifiers are called, so the network mode is already set
	if len(exposedPorts) == 0 && !hostConfig.NetworkMode.IsContainer() {
		image, err := p.client.ImageInspect(ctx, dockerInput.Image)
		if err != nil {
			return err
		}
		for p := range image.Config.ExposedPorts {
			exposedPorts = append(exposedPorts, string(p))
		}
	}

	exposedPortSet, exposedPortMap, err := nat.ParsePortSpecs(exposedPorts)
	if err != nil {
		return err
	}

	dockerInput.ExposedPorts = exposedPortSet

	// only exposing those ports automatically if the container request exposes zero ports and the container does not run in a container network
	if len(exposedPorts) == 0 && !hostConfig.NetworkMode.IsContainer() {
		hostConfig.PortBindings = exposedPortMap
	} else {
		hostConfig.PortBindings = mergePortBindings(hostConfig.PortBindings, exposedPortMap, req.ExposedPorts)
	}

	return nil
}

// combineContainerHooks returns a ContainerLifecycle hook as the result
// of combining the default hooks with the user-defined hooks.
//
// The order of hooks is the following:
// - Pre-hooks run the default hooks first then the user-defined hooks
// - Post-hooks run the user-defined hooks first then the default hooks
func combineContainerHooks(defaultHooks, userDefinedHooks []ContainerLifecycleHooks) ContainerLifecycleHooks {
	// We use reflection here to ensure that any new hooks are handled.
	var hooks ContainerLifecycleHooks
	hooksVal := reflect.ValueOf(&hooks).Elem()
	hooksType := reflect.TypeOf(hooks)
	for _, defaultHook := range defaultHooks {
		defaultVal := reflect.ValueOf(defaultHook)
		for i := 0; i < hooksType.NumField(); i++ {
			if strings.HasPrefix(hooksType.Field(i).Name, "Pre") {
				field := hooksVal.Field(i)
				field.Set(reflect.AppendSlice(field, defaultVal.Field(i)))
			}
		}
	}

	// Append the user-defined hooks after the default pre-hooks
	// and because the post hooks are still empty, the user-defined
	// post-hooks will be the first ones to be executed.
	for _, userDefinedHook := range userDefinedHooks {
		userVal := reflect.ValueOf(userDefinedHook)
		for i := 0; i < hooksType.NumField(); i++ {
			field := hooksVal.Field(i)
			field.Set(reflect.AppendSlice(field, userVal.Field(i)))
		}
	}

	// Finally, append the default post-hooks.
	for _, defaultHook := range defaultHooks {
		defaultVal := reflect.ValueOf(defaultHook)
		for i := 0; i < hooksType.NumField(); i++ {
			if strings.HasPrefix(hooksType.Field(i).Name, "Post") {
				field := hooksVal.Field(i)
				field.Set(reflect.AppendSlice(field, defaultVal.Field(i)))
			}
		}
	}

	return hooks
}

func mergePortBindings(configPortMap, exposedPortMap nat.PortMap, exposedPorts []string) nat.PortMap {
	if exposedPortMap == nil {
		exposedPortMap = make(map[nat.Port][]nat.PortBinding)
	}

	mappedPorts := make(map[string]struct{}, len(exposedPorts))
	for _, p := range exposedPorts {
		p = strings.Split(p, "/")[0]
		mappedPorts[p] = struct{}{}
	}

	for k, v := range configPortMap {
		if _, ok := mappedPorts[k.Port()]; ok {
			exposedPortMap[k] = v
		}
	}
	return exposedPortMap
}

// defaultHostConfigModifier provides a default modifier including the deprecated fields
func defaultHostConfigModifier(req ContainerRequest) func(hostConfig *container.HostConfig) {
	return func(hostConfig *container.HostConfig) {
		hostConfig.AutoRemove = req.AutoRemove
		hostConfig.CapAdd = req.CapAdd
		hostConfig.CapDrop = req.CapDrop
		hostConfig.Binds = req.Binds
		hostConfig.ExtraHosts = req.ExtraHosts
		hostConfig.NetworkMode = req.NetworkMode
		hostConfig.Resources = req.Resources
	}
}
