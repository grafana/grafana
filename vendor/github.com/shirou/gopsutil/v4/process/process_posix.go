// SPDX-License-Identifier: BSD-3-Clause
//go:build linux || freebsd || openbsd || darwin || solaris

package process

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"golang.org/x/sys/unix"

	"github.com/shirou/gopsutil/v4/internal/common"
)

type Signal = syscall.Signal

// POSIX
func getTerminalMap() (map[uint64]string, error) {
	ret := make(map[uint64]string)
	var termfiles []string

	d, err := os.Open("/dev")
	if err != nil {
		return nil, err
	}
	defer d.Close()

	devnames, err := d.Readdirnames(-1)
	if err != nil {
		return nil, err
	}
	for _, devname := range devnames {
		if strings.HasPrefix(devname, "/dev/tty") {
			termfiles = append(termfiles, "/dev/tty/"+devname)
		}
	}

	var ptsnames []string
	ptsd, err := os.Open("/dev/pts")
	if err != nil {
		ptsnames, _ = filepath.Glob("/dev/ttyp*")
		if ptsnames == nil {
			return nil, err
		}
	}
	defer ptsd.Close()

	if ptsnames == nil {
		defer ptsd.Close()
		ptsnames, err = ptsd.Readdirnames(-1)
		if err != nil {
			return nil, err
		}
		for _, ptsname := range ptsnames {
			termfiles = append(termfiles, "/dev/pts/"+ptsname)
		}
	} else {
		termfiles = ptsnames
	}

	for _, name := range termfiles {
		stat := unix.Stat_t{}
		if err = unix.Stat(name, &stat); err != nil {
			return nil, err
		}
		rdev := uint64(stat.Rdev)
		ret[rdev] = strings.ReplaceAll(name, "/dev", "")
	}
	return ret, nil
}

// isMount is a port of python's os.path.ismount()
// https://github.com/python/cpython/blob/08ff4369afca84587b1c82034af4e9f64caddbf2/Lib/posixpath.py#L186-L216
// https://docs.python.org/3/library/os.path.html#os.path.ismount
func isMount(path string) bool {
	// Check symlinkness with os.Lstat; unix.DT_LNK is not portable
	fileInfo, err := os.Lstat(path)
	if err != nil {
		return false
	}
	if fileInfo.Mode()&os.ModeSymlink != 0 {
		return false
	}
	var stat1 unix.Stat_t
	if err := unix.Lstat(path, &stat1); err != nil {
		return false
	}
	parent := filepath.Join(path, "..")
	var stat2 unix.Stat_t
	if err := unix.Lstat(parent, &stat2); err != nil {
		return false
	}
	return stat1.Dev != stat2.Dev || stat1.Ino == stat2.Ino
}

func PidExistsWithContext(ctx context.Context, pid int32) (bool, error) {
	if pid <= 0 {
		return false, fmt.Errorf("invalid pid %v", pid)
	}
	proc, err := os.FindProcess(int(pid))
	if err != nil {
		return false, err
	}
	defer proc.Release()

	if isMount(common.HostProcWithContext(ctx)) { // if /<HOST_PROC>/proc exists and is mounted, check if /<HOST_PROC>/proc/<PID> folder exists
		_, err := os.Stat(common.HostProcWithContext(ctx, strconv.Itoa(int(pid))))
		if os.IsNotExist(err) {
			return false, nil
		}
		return err == nil, err
	}

	// procfs does not exist or is not mounted, check PID existence by signalling the pid
	err = proc.Signal(syscall.Signal(0))
	if err == nil {
		return true, nil
	}
	if errors.Is(err, os.ErrProcessDone) {
		return false, nil
	}
	var errno syscall.Errno
	if !errors.As(err, &errno) {
		return false, err
	}
	switch errno {
	case syscall.ESRCH:
		return false, nil
	case syscall.EPERM:
		return true, nil
	}

	return false, err
}

func (p *Process) SendSignalWithContext(_ context.Context, sig syscall.Signal) error {
	process, err := os.FindProcess(int(p.Pid))
	if err != nil {
		return err
	}
	defer process.Release()

	err = process.Signal(sig)
	if err != nil {
		return err
	}

	return nil
}

func (p *Process) SuspendWithContext(ctx context.Context) error {
	return p.SendSignalWithContext(ctx, unix.SIGSTOP)
}

func (p *Process) ResumeWithContext(ctx context.Context) error {
	return p.SendSignalWithContext(ctx, unix.SIGCONT)
}

func (p *Process) TerminateWithContext(ctx context.Context) error {
	return p.SendSignalWithContext(ctx, unix.SIGTERM)
}

func (p *Process) KillWithContext(ctx context.Context) error {
	return p.SendSignalWithContext(ctx, unix.SIGKILL)
}

func (p *Process) UsernameWithContext(ctx context.Context) (string, error) {
	uids, err := p.UidsWithContext(ctx)
	if err != nil {
		return "", err
	}
	if len(uids) > 0 {
		u, err := user.LookupId(strconv.Itoa(int(uids[0])))
		if err != nil {
			return "", err
		}
		return u.Username, nil
	}
	return "", nil
}
