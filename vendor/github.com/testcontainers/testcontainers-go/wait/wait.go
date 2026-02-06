package wait

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/go-connections/nat"

	"github.com/testcontainers/testcontainers-go/exec"
)

// Strategy defines the basic interface for a Wait Strategy
type Strategy interface {
	WaitUntilReady(context.Context, StrategyTarget) error
}

// StrategyTimeout allows MultiStrategy to configure a Strategy's Timeout
type StrategyTimeout interface {
	Timeout() *time.Duration
}

type StrategyTarget interface {
	Host(context.Context) (string, error)
	Inspect(context.Context) (*container.InspectResponse, error)
	Ports(ctx context.Context) (nat.PortMap, error) // Deprecated: use Inspect instead
	MappedPort(context.Context, nat.Port) (nat.Port, error)
	Logs(context.Context) (io.ReadCloser, error)
	Exec(context.Context, []string, ...exec.ProcessOption) (int, io.Reader, error)
	State(context.Context) (*container.State, error)
	CopyFileFromContainer(ctx context.Context, filePath string) (io.ReadCloser, error)
}

func checkTarget(ctx context.Context, target StrategyTarget) error {
	state, err := target.State(ctx)
	if err != nil {
		return fmt.Errorf("get state: %w", err)
	}

	return checkState(state)
}

func checkState(state *container.State) error {
	switch {
	case state.Running:
		return nil
	case state.OOMKilled:
		return errors.New("container crashed with out-of-memory (OOMKilled)")
	case state.Status == "exited":
		return fmt.Errorf("container exited with code %d", state.ExitCode)
	default:
		return fmt.Errorf("unexpected container status %q", state.Status)
	}
}

func defaultStartupTimeout() time.Duration {
	return 60 * time.Second
}

func defaultPollInterval() time.Duration {
	return 100 * time.Millisecond
}
