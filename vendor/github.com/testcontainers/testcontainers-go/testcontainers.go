package testcontainers

import (
	"context"

	"github.com/testcontainers/testcontainers-go/internal/core"
)

// Deprecated: use MustExtractDockerHost instead.
func ExtractDockerSocket() string {
	return MustExtractDockerSocket(context.Background())
}

// MustExtractDockerSocket Extracts the docker socket from the different alternatives, removing the socket schema.
// Use this function to get the docker socket path, not the host (e.g. mounting the socket in a container).
// This function does not consider Windows containers at the moment.
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
	return core.MustExtractDockerSocket(ctx)
}

// SessionID returns a unique session ID for the current test session. Because each Go package
// will be run in a separate process, we need a way to identify the current test session.
// By test session, we mean:
//   - a single "go test" invocation (including flags)
//   - a single "go test ./..." invocation (including flags)
//   - the execution of a single test or a set of tests using the IDE
//
// As a consequence, with the sole goal of aggregating test execution across multiple
// packages, this variable will contain the value of the parent process ID (pid) of the current process
// and its creation date, to use it to generate a unique session ID. We are using the parent pid because
// the current process will be a child process of:
//   - the process that is running the tests, e.g.: "go test";
//   - the process that is running the application in development mode, e.g. "go run main.go -tags dev";
//   - the process that is running the tests in the IDE, e.g.: "go test ./...".
//
// Finally, we will hash the combination of the "testcontainers-go:" string with the parent pid
// and the creation date of that parent process to generate a unique session ID.
//
// This sessionID will be used to:
//   - identify the test session, aggregating the test execution of multiple packages in the same test session.
//   - tag the containers created by testcontainers-go, adding a label to the container with the session ID.
func SessionID() string {
	return core.SessionID()
}
