// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package cmdrunner

import (
	"context"
	"fmt"
	"net"
	"os"

	"github.com/hashicorp/go-plugin/runner"
)

// ReattachFunc returns a function that allows reattaching to a plugin running
// as a plain process. The process may or may not be a child process.
func ReattachFunc(pid int, addr net.Addr) runner.ReattachFunc {
	return func() (runner.AttachedRunner, error) {
		p, err := os.FindProcess(pid)
		if err != nil {
			// On Unix systems, FindProcess never returns an error.
			// On Windows, for non-existent pids it returns:
			// os.SyscallError - 'OpenProcess: the paremter is incorrect'
			return nil, ErrProcessNotFound
		}

		// Attempt to connect to the addr since on Unix systems FindProcess
		// doesn't actually return an error if it can't find the process.
		conn, err := net.Dial(addr.Network(), addr.String())
		if err != nil {
			return nil, ErrProcessNotFound
		}
		conn.Close()

		return &CmdAttachedRunner{
			pid:     pid,
			process: p,
		}, nil
	}
}

// CmdAttachedRunner is mostly a subset of CmdRunner, except the Wait function
// does not assume the process is a child of the host process, and so uses a
// different implementation to wait on the process.
type CmdAttachedRunner struct {
	pid     int
	process *os.Process

	addrTranslator
}

func (c *CmdAttachedRunner) Wait(_ context.Context) error {
	return pidWait(c.pid)
}

func (c *CmdAttachedRunner) Kill(_ context.Context) error {
	return c.process.Kill()
}

func (c *CmdAttachedRunner) ID() string {
	return fmt.Sprintf("%d", c.pid)
}
