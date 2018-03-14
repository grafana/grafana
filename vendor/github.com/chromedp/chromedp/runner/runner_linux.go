// +build linux

package runner

import (
	"os"
	"os/exec"
	"syscall"
	"unsafe"
)

// ByteCount is a type byte count const.
type ByteCount uint64

// ByteCount values.
const (
	Byte     ByteCount = 1
	Kilobyte ByteCount = 1024 * Byte
	Megabyte ByteCount = 1024 * Kilobyte
	Gigabyte ByteCount = 1024 * Megabyte
)

// prlimit invokes the system's prlimit call. Copied from Go source tree.
//
// Note: this needs either the CAP_SYS_RESOURCE capability, or the invoking
// process needs to have the same functional user and group as the pid being
// modified.
//
// see: man 2 prlimit
func prlimit(pid int, res int, newv, old *syscall.Rlimit) error {
	_, _, err := syscall.RawSyscall6(syscall.SYS_PRLIMIT64, uintptr(pid), uintptr(res), uintptr(unsafe.Pointer(newv)), uintptr(unsafe.Pointer(old)), 0, 0)
	if err != 0 {
		return err
	}

	return nil
}

// Rlimit is a Chrome command line option to set the soft rlimit value for res
// on a running Chrome process.
//
// Note: uses Linux prlimit system call, and is invoked after the child process
// has been started.
//
// see: man 2 prlimit
func Rlimit(res int, cur, max uint64) CommandLineOption {
	return ProcessOpt(func(p *os.Process) error {
		return prlimit(p.Pid, syscall.RLIMIT_AS, &syscall.Rlimit{
			Cur: cur,
			Max: max,
		}, nil)
	})
}

// LimitMemory is a Chrome command line option to set the soft memory limit for
// a running Chrome process.
//
// Note: uses Linux prlimit system call, and is invoked after the child
// process has been started.
func LimitMemory(mem ByteCount) CommandLineOption {
	return Rlimit(syscall.RLIMIT_AS, uint64(mem), uint64(mem))
}

// LimitCoreDump is a Chrome command line option to set the soft core dump
// limit for a running Chrome process.
//
// Note: uses Linux prlimit system call, and is invoked after the child
// process has been started.
func LimitCoreDump(sz ByteCount) CommandLineOption {
	return Rlimit(syscall.RLIMIT_CORE, uint64(sz), uint64(sz))
}

// ForceKill is a Chrome command line option that forces Chrome to be killed
// when the parent is killed.
//
// Note: sets exec.Cmd.SysProcAttr.Setpgid = true (only for Linux)
func ForceKill(m map[string]interface{}) error {
	return CmdOpt(func(c *exec.Cmd) error {
		if c.SysProcAttr == nil {
			c.SysProcAttr = new(syscall.SysProcAttr)
		}

		c.SysProcAttr.Pdeathsig = syscall.SIGKILL

		return nil
	})(m)
}
