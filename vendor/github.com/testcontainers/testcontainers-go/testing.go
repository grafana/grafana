package testcontainers

import (
	"context"
	"fmt"
	"io"
	"regexp"
	"testing"

	"github.com/docker/docker/errdefs"
	"github.com/stretchr/testify/require"
)

// errAlreadyInProgress is a regular expression that matches the error for a container
// removal that is already in progress.
var errAlreadyInProgress = regexp.MustCompile(`removal of container .* is already in progress`)

// SkipIfProviderIsNotHealthy is a utility function capable of skipping tests
// if the provider is not healthy, or running at all.
// This is a function designed to be used in your test, when Docker is not mandatory for CI/CD.
// In this way tests that depend on Testcontainers won't run if the provider is provisioned correctly.
func SkipIfProviderIsNotHealthy(t *testing.T) {
	t.Helper()
	defer func() {
		if r := recover(); r != nil {
			t.Skipf("Recovered from panic: %v. Docker is not running. Testcontainers can't perform is work without it", r)
		}
	}()

	ctx := context.Background()
	provider, err := ProviderDocker.GetProvider()
	if err != nil {
		t.Skipf("Docker is not running. Testcontainers can't perform is work without it: %s", err)
	}
	err = provider.Health(ctx)
	if err != nil {
		t.Skipf("Docker is not running. Testcontainers can't perform is work without it: %s", err)
	}
}

// SkipIfDockerDesktop is a utility function capable of skipping tests
// if tests are run using Docker Desktop.
func SkipIfDockerDesktop(t *testing.T, ctx context.Context) {
	t.Helper()
	cli, err := NewDockerClientWithOpts(ctx)
	require.NoErrorf(t, err, "failed to create docker client: %s", err)

	info, err := cli.Info(ctx)
	require.NoErrorf(t, err, "failed to get docker info: %s", err)

	if info.OperatingSystem == "Docker Desktop" {
		t.Skip("Skipping test that requires host network access when running in Docker Desktop")
	}
}

// exampleLogConsumer {

// StdoutLogConsumer is a LogConsumer that prints the log to stdout
type StdoutLogConsumer struct{}

// Accept prints the log to stdout
func (lc *StdoutLogConsumer) Accept(l Log) {
	fmt.Print(string(l.Content))
}

// }

// CleanupContainer is a helper function that schedules the container
// to be stopped / terminated when the test ends.
//
// This should be called as a defer directly after (before any error check)
// of [GenericContainer](...) or a modules Run(...) in a test to ensure the
// container is stopped when the function ends.
//
// before any error check. If container is nil, it's a no-op.
func CleanupContainer(tb testing.TB, ctr Container, options ...TerminateOption) {
	tb.Helper()

	tb.Cleanup(func() {
		noErrorOrIgnored(tb, TerminateContainer(ctr, options...))
	})
}

// CleanupNetwork is a helper function that schedules the network to be
// removed when the test ends.
// This should be the first call after NewNetwork(...) in a test before
// any error check. If network is nil, it's a no-op.
func CleanupNetwork(tb testing.TB, network Network) {
	tb.Helper()

	tb.Cleanup(func() {
		if !isNil(network) {
			noErrorOrIgnored(tb, network.Remove(context.Background()))
		}
	})
}

// noErrorOrIgnored is a helper function that checks if the error is nil or an error
// we can ignore.
func noErrorOrIgnored(tb testing.TB, err error) {
	tb.Helper()

	if isCleanupSafe(err) {
		return
	}

	require.NoError(tb, err)
}

// causer is an interface that allows to get the cause of an error.
type causer interface {
	Cause() error
}

// wrapErr is an interface that allows to unwrap an error.
type wrapErr interface {
	Unwrap() error
}

// unwrapErrs is an interface that allows to unwrap multiple errors.
type unwrapErrs interface {
	Unwrap() []error
}

// isCleanupSafe reports whether all errors in err's tree are one of the
// following, so can safely be ignored:
//   - nil
//   - not found
//   - already in progress
func isCleanupSafe(err error) bool {
	if err == nil {
		return true
	}

	switch x := err.(type) { //nolint:errorlint // We need to check for interfaces.
	case errdefs.ErrNotFound:
		return true
	case errdefs.ErrConflict:
		// Terminating a container that is already terminating.
		if errAlreadyInProgress.MatchString(err.Error()) {
			return true
		}
		return false
	case causer:
		return isCleanupSafe(x.Cause())
	case wrapErr:
		return isCleanupSafe(x.Unwrap())
	case unwrapErrs:
		for _, e := range x.Unwrap() {
			if !isCleanupSafe(e) {
				return false
			}
		}
		return true
	default:
		return false
	}
}

// RequireContainerExec is a helper function that executes a command in a container
// It insures that there is no error during the execution
// Finally returns the output of its execution
func RequireContainerExec(ctx context.Context, t *testing.T, container Container, cmd []string) string {
	t.Helper()

	code, out, err := container.Exec(ctx, cmd)
	require.NoError(t, err)
	require.Zero(t, code)

	checkBytes, err := io.ReadAll(out)
	require.NoError(t, err)
	return string(checkBytes)
}
