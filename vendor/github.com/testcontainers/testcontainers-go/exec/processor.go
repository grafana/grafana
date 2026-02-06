package exec

import (
	"bytes"
	"fmt"
	"io"
	"sync"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/pkg/stdcopy"
)

// ProcessOptions defines options applicable to the reader processor
type ProcessOptions struct {
	ExecConfig container.ExecOptions
	Reader     io.Reader
}

// NewProcessOptions returns a new ProcessOptions instance
// with the given command and default options:
// - detach: false
// - attach stdout: true
// - attach stderr: true
func NewProcessOptions(cmd []string) *ProcessOptions {
	return &ProcessOptions{
		ExecConfig: container.ExecOptions{
			Cmd:          cmd,
			Detach:       false,
			AttachStdout: true,
			AttachStderr: true,
		},
	}
}

// ProcessOption defines a common interface to modify the reader processor
// These options can be passed to the Exec function in a variadic way to customize the returned Reader instance
type ProcessOption interface {
	Apply(opts *ProcessOptions)
}

type ProcessOptionFunc func(opts *ProcessOptions)

func (fn ProcessOptionFunc) Apply(opts *ProcessOptions) {
	fn(opts)
}

func WithUser(user string) ProcessOption {
	return ProcessOptionFunc(func(opts *ProcessOptions) {
		opts.ExecConfig.User = user
	})
}

func WithWorkingDir(workingDir string) ProcessOption {
	return ProcessOptionFunc(func(opts *ProcessOptions) {
		opts.ExecConfig.WorkingDir = workingDir
	})
}

func WithEnv(env []string) ProcessOption {
	return ProcessOptionFunc(func(opts *ProcessOptions) {
		opts.ExecConfig.Env = env
	})
}

// safeBuffer is a goroutine safe buffer.
type safeBuffer struct {
	mtx sync.Mutex
	buf bytes.Buffer
	err error
}

// Error sets an error for the next read.
func (sb *safeBuffer) Error(err error) {
	sb.mtx.Lock()
	defer sb.mtx.Unlock()

	sb.err = err
}

// Write writes p to the buffer.
// It is safe for concurrent use by multiple goroutines.
func (sb *safeBuffer) Write(p []byte) (n int, err error) {
	sb.mtx.Lock()
	defer sb.mtx.Unlock()

	return sb.buf.Write(p)
}

// Read reads up to len(p) bytes into p from the buffer.
// It is safe for concurrent use by multiple goroutines.
func (sb *safeBuffer) Read(p []byte) (n int, err error) {
	sb.mtx.Lock()
	defer sb.mtx.Unlock()

	if sb.err != nil {
		return 0, sb.err
	}

	return sb.buf.Read(p)
}

// Multiplexed returns a [ProcessOption] that configures the command execution
// to combine stdout and stderr into a single stream without Docker's multiplexing headers.
func Multiplexed() ProcessOption {
	return ProcessOptionFunc(func(opts *ProcessOptions) {
		// returning fast to bypass those options with a nil reader,
		// which could be the case when other options are used
		// to configure the exec creation.
		if opts.Reader == nil {
			return
		}

		done := make(chan struct{})

		var outBuff safeBuffer
		var errBuff safeBuffer
		go func() {
			defer close(done)
			if _, err := stdcopy.StdCopy(&outBuff, &errBuff, opts.Reader); err != nil {
				outBuff.Error(fmt.Errorf("copying output: %w", err))
				return
			}
		}()

		<-done

		opts.Reader = io.MultiReader(&outBuff, &errBuff)
	})
}
