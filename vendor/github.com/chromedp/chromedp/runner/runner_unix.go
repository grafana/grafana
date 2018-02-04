// +build linux darwin freebsd netbsd openbsd

package runner

import (
	"os/exec"
	"syscall"
)

const (
	// DefaultUserDataTmpDir is the default directory path for created user
	// data directories.
	DefaultUserDataTmpDir = "/tmp"
)

// KillProcessGroup is a Chrome command line option that will instruct the
// invoked child Chrome process to terminate when the parent process (ie, the
// Go application) dies.
//
// Note: sets exec.Cmd.SysProcAttr.Setpgid = true and does nothing on Windows.
func KillProcessGroup(m map[string]interface{}) error {
	return CmdOpt(func(c *exec.Cmd) error {
		if c.SysProcAttr == nil {
			c.SysProcAttr = new(syscall.SysProcAttr)
		}

		c.SysProcAttr.Setpgid = true

		return nil
	})(m)
}
