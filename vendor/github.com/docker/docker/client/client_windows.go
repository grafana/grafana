package client // import "github.com/docker/docker/client"

// DefaultDockerHost defines OS-specific default host if the DOCKER_HOST
// (EnvOverrideHost) environment variable is unset or empty.
const DefaultDockerHost = "npipe:////./pipe/docker_engine"
