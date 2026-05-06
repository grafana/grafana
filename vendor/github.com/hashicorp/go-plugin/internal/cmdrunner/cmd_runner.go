// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package cmdrunner

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin/runner"
)

var (
	_ runner.Runner = (*CmdRunner)(nil)

	// ErrProcessNotFound is returned when a client is instantiated to
	// reattach to an existing process and it isn't found.
	ErrProcessNotFound = errors.New("Reattachment process not found")
)

const unrecognizedRemotePluginMessage = `This usually means
  the plugin was not compiled for this architecture,
  the plugin is missing dynamic-link libraries necessary to run,
  the plugin is not executable by this process due to file permissions, or
  the plugin failed to negotiate the initial go-plugin protocol handshake
%s`

// CmdRunner implements the runner.Runner interface. It mostly just passes through
// to exec.Cmd methods.
type CmdRunner struct {
	logger hclog.Logger
	cmd    *exec.Cmd

	stdout io.ReadCloser
	stderr io.ReadCloser

	// Cmd info is persisted early, since the process information will be removed
	// after Kill is called.
	path string
	pid  int

	addrTranslator
}

// NewCmdRunner returns an implementation of runner.Runner for running a plugin
// as a subprocess. It must be passed a cmd that hasn't yet been started.
func NewCmdRunner(logger hclog.Logger, cmd *exec.Cmd) (*CmdRunner, error) {
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}

	return &CmdRunner{
		logger: logger,
		cmd:    cmd,
		stdout: stdout,
		stderr: stderr,
		path:   cmd.Path,
	}, nil
}

func (c *CmdRunner) Start(_ context.Context) error {
	c.logger.Debug("starting plugin", "path", c.cmd.Path, "args", c.cmd.Args)
	err := c.cmd.Start()
	if err != nil {
		return err
	}

	c.pid = c.cmd.Process.Pid
	c.logger.Debug("plugin started", "path", c.path, "pid", c.pid)
	return nil
}

func (c *CmdRunner) Wait(_ context.Context) error {
	return c.cmd.Wait()
}

func (c *CmdRunner) Kill(_ context.Context) error {
	if c.cmd.Process != nil {
		err := c.cmd.Process.Kill()
		// Swallow ErrProcessDone, we support calling Kill multiple times.
		if !errors.Is(err, os.ErrProcessDone) {
			return err
		}
		return nil
	}

	return nil
}

func (c *CmdRunner) Stdout() io.ReadCloser {
	return c.stdout
}

func (c *CmdRunner) Stderr() io.ReadCloser {
	return c.stderr
}

func (c *CmdRunner) Name() string {
	return c.path
}

func (c *CmdRunner) ID() string {
	return fmt.Sprintf("%d", c.pid)
}

// peTypes is a list of Portable Executable (PE) machine types from https://learn.microsoft.com/en-us/windows/win32/debug/pe-format
// mapped to GOARCH types. It is not comprehensive, and only includes machine types that Go supports.
var peTypes = map[uint16]string{
	0x14c:  "386",
	0x1c0:  "arm",
	0x6264: "loong64",
	0x8664: "amd64",
	0xaa64: "arm64",
}

func (c *CmdRunner) Diagnose(_ context.Context) string {
	return fmt.Sprintf(unrecognizedRemotePluginMessage, additionalNotesAboutCommand(c.cmd.Path))
}
