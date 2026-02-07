package core

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"

	"github.com/docker/docker/client"

	"github.com/testcontainers/testcontainers-go/internal/config"
)

type dockerHostContext string

var DockerHostContextKey = dockerHostContext("docker_host")

var (
	ErrDockerHostNotSet               = errors.New("DOCKER_HOST is not set")
	ErrDockerSocketOverrideNotSet     = errors.New("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE is not set")
	ErrDockerSocketNotSetInContext    = errors.New("socket not set in context")
	ErrDockerSocketNotSetInProperties = errors.New("socket not set in ~/.testcontainers.properties")
	ErrNoUnixSchema                   = errors.New("URL schema is not unix")
	ErrSocketNotFound                 = errors.New("socket not found")
	ErrSocketNotFoundInPath           = errors.New("docker socket not found in " + DockerSocketPath)
	// ErrTestcontainersHostNotSetInProperties this error is specific to Testcontainers
	ErrTestcontainersHostNotSetInProperties = errors.New("tc.host not set in ~/.testcontainers.properties")
)

var (
	dockerHostCache string
	dockerHostOnce  sync.Once
)

var (
	dockerSocketPathCache string
	dockerSocketPathOnce  sync.Once
)

// deprecated
// see https://github.com/testcontainers/testcontainers-java/blob/main/core/src/main/java/org/testcontainers/dockerclient/DockerClientConfigUtils.java#L46
func DefaultGatewayIP() (string, error) {
	// see https://github.com/testcontainers/testcontainers-java/blob/3ad8d80e2484864e554744a4800a81f6b7982168/core/src/main/java/org/testcontainers/dockerclient/DockerClientConfigUtils.java#L27
	cmd := exec.Command("sh", "-c", "ip route|awk '/default/ { print $3 }'")
	stdout, err := cmd.Output()
	if err != nil {
		return "", errors.New("failed to detect docker host")
	}
	ip := strings.TrimSpace(string(stdout))
	if len(ip) == 0 {
		return "", errors.New("failed to parse default gateway IP")
	}
	return ip, nil
}

// dockerHostCheck Use a vanilla Docker client to check if the Docker host is reachable.
// It will avoid recursive calls to this function.
var dockerHostCheck = func(ctx context.Context, host string) error {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithHost(host), client.WithAPIVersionNegotiation())
	if err != nil {
		return fmt.Errorf("new client: %w", err)
	}
	defer cli.Close()

	_, err = cli.Info(ctx)
	if err != nil {
		return fmt.Errorf("docker info: %w", err)
	}

	return nil
}

// MustExtractDockerHost Extracts the docker host from the different alternatives, caching the result to avoid unnecessary
// calculations. Use this function to get the actual Docker host. This function does not consider Windows containers at the moment.
// The possible alternatives are:
//
//  1. Docker host from the "tc.host" property in the ~/.testcontainers.properties file.
//  2. DOCKER_HOST environment variable.
//  3. Docker host from context.
//  4. Docker host from the default docker socket path, without the unix schema.
//  5. Docker host from the "docker.host" property in the ~/.testcontainers.properties file.
//  6. Rootless docker socket path.
//  7. Else, because the Docker host is not set, it panics.
func MustExtractDockerHost(ctx context.Context) string {
	dockerHostOnce.Do(func() {
		cache, err := extractDockerHost(ctx)
		if err != nil {
			panic(err)
		}

		dockerHostCache = cache
	})

	return dockerHostCache
}

// MustExtractDockerSocket Extracts the docker socket from the different alternatives, removing the socket schema and
// caching the result to avoid unnecessary calculations. Use this function to get the docker socket path,
// not the host (e.g. mounting the socket in a container). This function does not consider Windows containers at the moment.
// The possible alternatives are:
//
//  1. Docker host from the "tc.host" property in the ~/.testcontainers.properties file.
//  2. The TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE environment variable.
//  3. Using a Docker client, check if the Info().OperatingSystem is "Docker Desktop" and return the default docker socket path for rootless docker.
//  4. Else, Get the current Docker Host from the existing strategies: see MustExtractDockerHost.
//  5. If the socket contains the unix schema, the schema is removed (e.g. unix:///var/run/docker.sock -> /var/run/docker.sock)
//  6. Else, the default location of the docker socket is used (/var/run/docker.sock)
//
// It panics if a Docker client cannot be created, or the Docker host cannot be discovered.
func MustExtractDockerSocket(ctx context.Context) string {
	dockerSocketPathOnce.Do(func() {
		dockerSocketPathCache = extractDockerSocket(ctx)
	})

	return dockerSocketPathCache
}

// extractDockerHost Extracts the docker host from the different alternatives, without caching the result.
// This internal method is handy for testing purposes.
func extractDockerHost(ctx context.Context) (string, error) {
	dockerHostFns := []func(context.Context) (string, error){
		testcontainersHostFromProperties,
		dockerHostFromEnv,
		dockerHostFromContext,
		dockerSocketPath,
		dockerHostFromProperties,
		rootlessDockerSocketPath,
	}

	var errs []error
	for _, dockerHostFn := range dockerHostFns {
		dockerHost, err := dockerHostFn(ctx)
		if err != nil {
			if !isHostNotSet(err) {
				errs = append(errs, err)
			}
			continue
		}

		if err = dockerHostCheck(ctx, dockerHost); err != nil {
			errs = append(errs, fmt.Errorf("check host %q: %w", dockerHost, err))
			continue
		}

		return dockerHost, nil
	}

	if len(errs) > 0 {
		return "", errors.Join(errs...)
	}

	return "", ErrSocketNotFound
}

// extractDockerSocket Extracts the docker socket from the different alternatives, without caching the result.
// It will internally use the default Docker client, calling the internal method extractDockerSocketFromClient with it.
// This internal method is handy for testing purposes.
// It panics if a Docker client cannot be created, or the Docker host is not discovered.
func extractDockerSocket(ctx context.Context) string {
	cli, err := NewClient(ctx)
	if err != nil {
		panic(err) // a Docker client is required to get the Docker info
	}
	defer cli.Close()

	return extractDockerSocketFromClient(ctx, cli)
}

// extractDockerSocketFromClient Extracts the docker socket from the different alternatives, without caching the result,
// and receiving an instance of the Docker API client interface.
// This internal method is handy for testing purposes, passing a mock type simulating the desired behaviour.
// It panics if the Docker Info call errors, or the Docker host is not discovered.
func extractDockerSocketFromClient(ctx context.Context, cli client.APIClient) string {
	// check that the socket is not a tcp or unix socket
	checkDockerSocketFn := func(socket string) string {
		// this use case will cover the case when the docker host is a tcp socket
		if strings.HasPrefix(socket, TCPSchema) {
			return DockerSocketPath
		}

		if strings.HasPrefix(socket, DockerSocketSchema) {
			return strings.Replace(socket, DockerSocketSchema, "", 1)
		}

		return socket
	}

	tcHost, err := testcontainersHostFromProperties(ctx)
	if err == nil {
		return checkDockerSocketFn(tcHost)
	}

	testcontainersDockerSocket, err := dockerSocketOverridePath()
	if err == nil {
		return checkDockerSocketFn(testcontainersDockerSocket)
	}

	info, err := cli.Info(ctx)
	if err != nil {
		panic(err) // Docker Info is required to get the Operating System
	}

	// Because Docker Desktop runs in a VM, we need to use the default docker path for rootless docker
	if info.OperatingSystem == "Docker Desktop" {
		if IsWindows() {
			return WindowsDockerSocketPath
		}

		return DockerSocketPath
	}

	dockerHost, err := extractDockerHost(ctx)
	if err != nil {
		panic(err) // Docker host is required to get the Docker socket
	}

	return checkDockerSocketFn(dockerHost)
}

// isHostNotSet returns true if the error is related to the Docker host
// not being set, false otherwise.
func isHostNotSet(err error) bool {
	switch {
	case errors.Is(err, ErrTestcontainersHostNotSetInProperties),
		errors.Is(err, ErrDockerHostNotSet),
		errors.Is(err, ErrDockerSocketNotSetInContext),
		errors.Is(err, ErrDockerSocketNotSetInProperties),
		errors.Is(err, ErrSocketNotFoundInPath),
		errors.Is(err, ErrXDGRuntimeDirNotSet),
		errors.Is(err, ErrRootlessDockerNotFoundHomeRunDir),
		errors.Is(err, ErrRootlessDockerNotFoundHomeDesktopDir),
		errors.Is(err, ErrRootlessDockerNotFoundRunDir):
		return true
	default:
		return false
	}
}

// dockerHostFromEnv returns the docker host from the DOCKER_HOST environment variable, if it's not empty
func dockerHostFromEnv(_ context.Context) (string, error) {
	if dockerHostPath := os.Getenv("DOCKER_HOST"); dockerHostPath != "" {
		return dockerHostPath, nil
	}

	return "", ErrDockerHostNotSet
}

// dockerHostFromContext returns the docker host from the Go context, if it's not empty
func dockerHostFromContext(ctx context.Context) (string, error) {
	if socketPath, ok := ctx.Value(DockerHostContextKey).(string); ok && socketPath != "" {
		parsed, err := parseURL(socketPath)
		if err != nil {
			return "", err
		}

		return parsed, nil
	}

	return "", ErrDockerSocketNotSetInContext
}

// dockerHostFromProperties returns the docker host from the ~/.testcontainers.properties file, if it's not empty
func dockerHostFromProperties(_ context.Context) (string, error) {
	cfg := config.Read()
	socketPath := cfg.Host
	if socketPath != "" {
		return socketPath, nil
	}

	return "", ErrDockerSocketNotSetInProperties
}

// dockerSocketOverridePath returns the docker socket from the TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE environment variable,
// if it's not empty
func dockerSocketOverridePath() (string, error) {
	if dockerHostPath, exists := os.LookupEnv("TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE"); exists {
		return dockerHostPath, nil
	}

	return "", ErrDockerSocketOverrideNotSet
}

// dockerSocketPath returns the docker socket from the default docker socket path, if it's not empty
// and the socket exists
func dockerSocketPath(_ context.Context) (string, error) {
	if fileExists(DockerSocketPath) {
		return DockerSocketPathWithSchema, nil
	}

	return "", ErrSocketNotFoundInPath
}

// testcontainersHostFromProperties returns the testcontainers host from the ~/.testcontainers.properties file, if it's not empty
func testcontainersHostFromProperties(_ context.Context) (string, error) {
	cfg := config.Read()
	testcontainersHost := cfg.TestcontainersHost
	if testcontainersHost != "" {
		parsed, err := parseURL(testcontainersHost)
		if err != nil {
			return "", err
		}

		return parsed, nil
	}

	return "", ErrTestcontainersHostNotSetInProperties
}

// DockerEnvFile is the file that is created when running inside a container.
// It's a variable to allow testing.
// TODO: Remove this once context rework is done, which eliminates need for the default network creation.
var DockerEnvFile = "/.dockerenv"

// InAContainer returns true if the code is running inside a container
// See https://github.com/docker/docker/blob/a9fa38b1edf30b23cae3eade0be48b3d4b1de14b/daemon/initlayer/setup_unix.go#L25
func InAContainer() bool {
	return inAContainer(DockerEnvFile)
}

func inAContainer(path string) bool {
	// see https://github.com/testcontainers/testcontainers-java/blob/3ad8d80e2484864e554744a4800a81f6b7982168/core/src/main/java/org/testcontainers/dockerclient/DockerClientConfigUtils.java#L15
	if _, err := os.Stat(path); err == nil {
		return true
	}
	return false
}
