package engineconn

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"dagger.io/dagger/telemetry"
)

type cliSessionConn struct {
	*http.Client
	childCancel context.CancelCauseFunc
	childProc   *exec.Cmd
	stderrBuf   *safeBuffer
	ioWait      *sync.WaitGroup
}

func (c *cliSessionConn) Host() string {
	return "dagger"
}

func (c *cliSessionConn) Close() error {
	if c.childCancel != nil && c.childProc != nil {
		c.childCancel(errors.New("client closed"))
		err := c.childProc.Wait()
		if err != nil {
			// only context canceled is expected
			if !errors.Is(err, context.Canceled) {
				return fmt.Errorf("close: %w\nstderr:\n%s", err, c.stderrBuf.String())
			}
		}
		c.ioWait.Wait()
	}
	return nil
}

func getSDKVersion() string {
	version := "n/a"
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return version
	}

	for _, dep := range info.Deps {
		if dep.Path == "dagger.io/dagger" {
			version = dep.Version
			if version[0] == 'v' {
				version = version[1:]
			}
			break
		}
	}
	return version
}

type flagValue struct {
	flag  string
	value string
}

func startCLISession(ctx context.Context, binPath string, cfg *Config) (_ EngineConn, rerr error) {
	args := []string{"session"}

	version := getSDKVersion()

	flagsAndValues := []flagValue{
		{"--workdir", cfg.Workdir},
		{"--label", "dagger.io/sdk.name:go"},
		{"--label", fmt.Sprintf("dagger.io/sdk.version:%s", version)},
	}
	if cfg.VersionOverride != "" {
		flagsAndValues = append(flagsAndValues, flagValue{"--version", cfg.VersionOverride})
	}

	for _, pair := range flagsAndValues {
		if pair.value != "" {
			args = append(args, pair.flag, pair.value)
		}
	}

	if cfg.Verbosity > 0 {
		args = append(args, "-"+strings.Repeat("v", cfg.Verbosity))
	}

	env := os.Environ()

	if cfg.RunnerHost != "" {
		env = append(env, "_EXPERIMENTAL_DAGGER_RUNNER_HOST="+cfg.RunnerHost)
	}

	if len(cfg.ExtraEnv) > 0 {
		env = append(env, cfg.ExtraEnv...)
	}

	// detect $TRACEPARENT set by 'dagger run'
	ctx = fallbackSpanContext(ctx)

	// propagate trace context to the child process (i.e. for Dagger-in-Dagger)
	env = append(env, telemetry.PropagationEnv(ctx)...)

	cmdCtx, cmdCancel := context.WithCancelCause(ctx)

	// Workaround https://github.com/golang/go/issues/22315
	// Basically, if any other code in this process does fork/exec, it may
	// temporarily have the tmpbin fd that we closed earlier open still, and it
	// will be open for writing. Even though we rename the file, the
	// underlying inode is the same and thus we can get a "text file busy"
	// error when trying to exec it below.
	//
	// We workaround this the same way suggested in the issue, by sleeping
	// and retrying the exec a few times. This is such an obscure case that
	// this retry approach should be fine. It can only happen when a new
	// dagger binary needs to be created and even then only if many
	// threads within this process are trying to provision it at the same time.
	var proc *exec.Cmd
	var stdout io.ReadCloser
	var stderrBuf *safeBuffer
	var childStdin io.WriteCloser
	var ioWait *sync.WaitGroup

	if cfg.LogOutput != nil {
		fmt.Fprintf(cfg.LogOutput, "Creating new Engine session... ")
	}

	for range 10 {
		proc = exec.CommandContext(cmdCtx, binPath, args...)
		proc.Env = env

		var err error
		stdout, err = proc.StdoutPipe()
		if err != nil {
			cmdCancel(fmt.Errorf("failed to create stdout pipe: %w", err))
			return nil, err
		}

		stderrPipe, err := proc.StderrPipe()
		if err != nil {
			cmdCancel(fmt.Errorf("failed to create stderr pipe: %w", err))
			return nil, err
		}
		if cfg.LogOutput == nil {
			cfg.LogOutput = io.Discard
		}

		// Write stderr to logWriter but also buffer it for the duration
		// of this function so we can return it in the error if something
		// goes wrong here. Otherwise the only error ends up being EOF and
		// the user has to enable log output to see anything.
		stderrBuf = &safeBuffer{}
		discardableBuf := &discardableWriter{w: stderrBuf}
		ioWait = new(sync.WaitGroup)
		ioWait.Add(1)
		go func() {
			defer ioWait.Done()
			io.Copy(io.MultiWriter(cfg.LogOutput, discardableBuf), stderrPipe)
		}()
		defer discardableBuf.Discard()

		// Open a stdin pipe with the child process. The engine-session shutsdown
		// when it is closed. This is a platform-agnostic way of ensuring
		// we don't leak child processes even if this process is SIGKILL'd.
		childStdin, err = proc.StdinPipe()
		if err != nil {
			cmdCancel(fmt.Errorf("failed to create stdin pipe: %w", err))
			return nil, err
		}

		// Kill the child process by closing stdin, not via SIGKILL, so it has a
		// chance to drain logs.
		proc.Cancel = childStdin.Close

		// Set a long timeout to give time for any cache exports to pack layers up
		// which currently has to happen synchronously with the session.
		proc.WaitDelay = 300 * time.Second // 5 mins

		if err := proc.Start(); err != nil {
			if strings.Contains(err.Error(), "text file busy") {
				time.Sleep(100 * time.Millisecond)
				proc = nil
				stdout.Close()
				stdout = nil
				stderrPipe.Close()
				stderrBuf = nil
				childStdin.Close()
				childStdin = nil
				continue
			}
			cmdCancel(fmt.Errorf("failed to start dagger session process: %w", err))
			return nil, err
		}
		break
	}
	if proc == nil {
		err := fmt.Errorf("failed to start dagger session")
		cmdCancel(err)
		return nil, err
	}

	defer func() {
		if rerr != nil {
			stderrContents := stderrBuf.String()
			if stderrContents != "" {
				rerr = fmt.Errorf("%w: %s", rerr, stderrContents)
			}
		}
	}()

	if cfg.LogOutput != nil {
		fmt.Fprintf(cfg.LogOutput, "OK!\nEstablishing connection to Engine... ")
	}

	// Read the connect params from stdout.
	paramCh := make(chan error, 1)
	var params ConnectParams
	go func() {
		stdout := bufio.NewReader(stdout)
		paramBytes, err := stdout.ReadBytes('\n')
		if err != nil {
			paramCh <- err
			return
		}
		if err := json.Unmarshal(paramBytes, &params); err != nil {
			paramCh <- err
			return
		}
		close(paramCh)

		io.Copy(io.Discard, stdout)
	}()

	select {
	case err := <-paramCh:
		if err != nil {
			err = fmt.Errorf("failed to read session params: %w", err)
			cmdCancel(err)
			return nil, err
		}

	case <-time.After(300 * time.Second):
		// really long time to account for extensions that need to build, though
		// that path should be optimized in future
		err := fmt.Errorf("timed out waiting for session params")
		cmdCancel(err)
		return nil, err
	}

	if cfg.LogOutput != nil {
		fmt.Fprintln(cfg.LogOutput, "OK!")
	}

	return &cliSessionConn{
		Client:      defaultHTTPClient(&params),
		childCancel: cmdCancel,
		childProc:   proc,
		stderrBuf:   stderrBuf,
		ioWait:      ioWait,
	}, nil
}

// a writer that can later be turned into io.Discard
type discardableWriter struct {
	mu sync.RWMutex
	w  io.Writer
}

func (w *discardableWriter) Write(p []byte) (int, error) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.w.Write(p)
}

func (w *discardableWriter) Discard() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.w = io.Discard
}

type safeBuffer struct {
	bu bytes.Buffer
	mu sync.Mutex
}

func (s *safeBuffer) Write(p []byte) (n int, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.bu.Write(p)
}

func (s *safeBuffer) String() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.bu.String()
}
