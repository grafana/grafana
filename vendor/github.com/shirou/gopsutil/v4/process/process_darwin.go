// SPDX-License-Identifier: BSD-3-Clause
//go:build darwin

package process

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"unsafe"

	"golang.org/x/sys/unix"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/internal/common"
	"github.com/shirou/gopsutil/v4/net"
)

// copied from sys/sysctl.h
const (
	CTLKern          = 1  // "high kernel": proc, limits
	KernProc         = 14 // struct: process entries
	KernProcPID      = 1  // by process id
	KernProcProc     = 8  // only return procs
	KernProcAll      = 0  // everything
	KernProcPathname = 12 // path to executable
)

type _Ctype_struct___0 struct { //nolint:revive //FIXME
	Pad uint64
}

func pidsWithContext(_ context.Context) ([]int32, error) {
	var ret []int32

	kprocs, err := unix.SysctlKinfoProcSlice("kern.proc.all")
	if err != nil {
		return ret, err
	}

	for _, proc := range kprocs {
		ret = append(ret, int32(proc.Proc.P_pid))
	}

	return ret, nil
}

func (p *Process) PpidWithContext(_ context.Context) (int32, error) {
	k, err := p.getKProc()
	if err != nil {
		return 0, err
	}

	return k.Eproc.Ppid, nil
}

func (p *Process) NameWithContext(ctx context.Context) (string, error) {
	k, err := p.getKProc()
	if err != nil {
		return "", err
	}

	name := common.ByteToString(k.Proc.P_comm[:])

	if len(name) >= 15 {
		cmdName, err := p.cmdNameWithContext(ctx)
		if err != nil {
			return "", err
		}
		if len(cmdName) > 0 {
			extendedName := filepath.Base(cmdName)
			if strings.HasPrefix(extendedName, p.name) {
				name = extendedName
			}
		}
	}

	return name, nil
}

func (p *Process) createTimeWithContext(_ context.Context) (int64, error) {
	k, err := p.getKProc()
	if err != nil {
		return 0, err
	}

	return k.Proc.P_starttime.Sec*1000 + int64(k.Proc.P_starttime.Usec)/1000, nil
}

func (p *Process) StatusWithContext(ctx context.Context) ([]string, error) {
	r, err := callPsWithContext(ctx, "state", p.Pid, false, false)
	if err != nil {
		return []string{""}, err
	}
	status := convertStatusChar(r[0][0][0:1])
	return []string{status}, err
}

func (p *Process) ForegroundWithContext(ctx context.Context) (bool, error) {
	// see https://github.com/shirou/gopsutil/issues/596#issuecomment-432707831 for implementation details
	pid := p.Pid
	out, err := invoke.CommandWithContext(ctx, "ps", "-o", "stat=", "-p", strconv.Itoa(int(pid)))
	if err != nil {
		return false, err
	}
	return strings.IndexByte(string(out), '+') != -1, nil
}

func (p *Process) UidsWithContext(_ context.Context) ([]uint32, error) {
	k, err := p.getKProc()
	if err != nil {
		return nil, err
	}

	// See: http://unix.superglobalmegacorp.com/Net2/newsrc/sys/ucred.h.html
	userEffectiveUID := uint32(k.Eproc.Ucred.Uid)

	return []uint32{userEffectiveUID}, nil
}

func (p *Process) GidsWithContext(_ context.Context) ([]uint32, error) {
	k, err := p.getKProc()
	if err != nil {
		return nil, err
	}

	gids := make([]uint32, 0, 3)
	gids = append(gids, uint32(k.Eproc.Pcred.P_rgid), uint32(k.Eproc.Pcred.P_rgid), uint32(k.Eproc.Pcred.P_svgid))

	return gids, nil
}

func (p *Process) GroupsWithContext(_ context.Context) ([]uint32, error) {
	return nil, common.ErrNotImplementedError
	// k, err := p.getKProc()
	// if err != nil {
	// 	return nil, err
	// }

	// groups := make([]int32, k.Eproc.Ucred.Ngroups)
	// for i := int16(0); i < k.Eproc.Ucred.Ngroups; i++ {
	// 	groups[i] = int32(k.Eproc.Ucred.Groups[i])
	// }

	// return groups, nil
}

func (p *Process) TerminalWithContext(_ context.Context) (string, error) {
	return "", common.ErrNotImplementedError
	/*
		k, err := p.getKProc()
		if err != nil {
			return "", err
		}

		ttyNr := uint64(k.Eproc.Tdev)
		termmap, err := getTerminalMap()
		if err != nil {
			return "", err
		}

		return termmap[ttyNr], nil
	*/
}

func (p *Process) NiceWithContext(_ context.Context) (int32, error) {
	k, err := p.getKProc()
	if err != nil {
		return 0, err
	}
	return int32(k.Proc.P_nice), nil
}

func (p *Process) IOCountersWithContext(_ context.Context) (*IOCountersStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) ChildrenWithContext(ctx context.Context) ([]*Process, error) {
	procs, err := ProcessesWithContext(ctx)
	if err != nil {
		return nil, nil
	}
	ret := make([]*Process, 0, len(procs))
	for _, proc := range procs {
		ppid, err := proc.PpidWithContext(ctx)
		if err != nil {
			continue
		}
		if ppid == p.Pid {
			ret = append(ret, proc)
		}
	}
	sort.Slice(ret, func(i, j int) bool { return ret[i].Pid < ret[j].Pid })
	return ret, nil
}

func (p *Process) ConnectionsWithContext(ctx context.Context) ([]net.ConnectionStat, error) {
	return net.ConnectionsPidWithContext(ctx, "all", p.Pid)
}

func (p *Process) ConnectionsMaxWithContext(ctx context.Context, maxConn int) ([]net.ConnectionStat, error) {
	return net.ConnectionsPidMaxWithContext(ctx, "all", p.Pid, maxConn)
}

func ProcessesWithContext(ctx context.Context) ([]*Process, error) {
	out := []*Process{}

	pids, err := PidsWithContext(ctx)
	if err != nil {
		return out, err
	}

	for _, pid := range pids {
		p, err := NewProcessWithContext(ctx, pid)
		if err != nil {
			continue
		}
		out = append(out, p)
	}

	return out, nil
}

// Returns a proc as defined here:
// http://unix.superglobalmegacorp.com/Net2/newsrc/sys/kinfo_proc.h.html
func (p *Process) getKProc() (*unix.KinfoProc, error) {
	return unix.SysctlKinfoProc("kern.proc.pid", int(p.Pid))
}

// call ps command.
// Return value deletes Header line(you must not input wrong arg).
// And splited by Space. Caller have responsibility to manage.
// If passed arg pid is 0, get information from all process.
func callPsWithContext(ctx context.Context, arg string, pid int32, threadOption bool, nameOption bool) ([][]string, error) {
	var cmd []string
	switch {
	case pid == 0: // will get from all processes.
		cmd = []string{"-ax", "-o", arg}
	case threadOption:
		cmd = []string{"-x", "-o", arg, "-M", "-p", strconv.Itoa(int(pid))}
	default:
		cmd = []string{"-x", "-o", arg, "-p", strconv.Itoa(int(pid))}
	}
	if nameOption {
		cmd = append(cmd, "-c")
	}
	out, err := invoke.CommandWithContext(ctx, "ps", cmd...)
	if err != nil {
		return [][]string{}, err
	}
	lines := strings.Split(string(out), "\n")

	var ret [][]string
	for _, l := range lines[1:] {
		var lr []string
		if nameOption {
			lr = append(lr, l)
		} else {
			for _, r := range strings.Split(l, " ") {
				if r == "" {
					continue
				}
				lr = append(lr, strings.TrimSpace(r))
			}
		}
		if len(lr) != 0 {
			ret = append(ret, lr)
		}
	}

	return ret, nil
}

var (
	procPidPath      common.ProcPidPathFunc
	procPidInfo      common.ProcPidInfoFunc
	machTimeBaseInfo common.MachTimeBaseInfoFunc
)

func registerFuncs() (*common.Library, error) {
	lib, err := common.NewLibrary(common.System)
	if err != nil {
		return nil, err
	}

	procPidPath = common.GetFunc[common.ProcPidPathFunc](lib, common.ProcPidPathSym)
	procPidInfo = common.GetFunc[common.ProcPidInfoFunc](lib, common.ProcPidInfoSym)
	machTimeBaseInfo = common.GetFunc[common.MachTimeBaseInfoFunc](lib, common.MachTimeBaseInfoSym)

	return lib, nil
}

func getTimeScaleToNanoSeconds() float64 {
	var timeBaseInfo common.MachTimeBaseInfo

	machTimeBaseInfo(uintptr(unsafe.Pointer(&timeBaseInfo)))

	return float64(timeBaseInfo.Numer) / float64(timeBaseInfo.Denom)
}

func (p *Process) ExeWithContext(_ context.Context) (string, error) {
	lib, err := registerFuncs()
	if err != nil {
		return "", err
	}
	defer lib.Close()

	buf := common.NewCStr(common.PROC_PIDPATHINFO_MAXSIZE)
	ret := procPidPath(p.Pid, buf.Addr(), common.PROC_PIDPATHINFO_MAXSIZE)

	if ret <= 0 {
		return "", fmt.Errorf("unknown error: proc_pidpath returned %d", ret)
	}

	return buf.GoString(), nil
}

// sys/proc_info.h
type vnodePathInfo struct {
	_       [152]byte
	vipPath [common.MAXPATHLEN]byte
	_       [1176]byte
}

// CwdWithContext retrieves the Current Working Directory for the given process.
// It uses the proc_pidinfo from libproc and will only work for processes the
// EUID can access.  Otherwise "operation not permitted" will be returned as the
// error.
// Note: This might also work for other *BSD OSs.
func (p *Process) CwdWithContext(_ context.Context) (string, error) {
	lib, err := registerFuncs()
	if err != nil {
		return "", err
	}
	defer lib.Close()

	// Lock OS thread to ensure the errno does not change
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	var vpi vnodePathInfo
	const vpiSize = int32(unsafe.Sizeof(vpi))
	ret := procPidInfo(p.Pid, common.PROC_PIDVNODEPATHINFO, 0, uintptr(unsafe.Pointer(&vpi)), vpiSize)
	errno, _ := lib.Dlsym("errno")
	err = *(**unix.Errno)(unsafe.Pointer(&errno))
	if errors.Is(err, unix.EPERM) {
		return "", ErrorNotPermitted
	}

	if ret <= 0 {
		return "", fmt.Errorf("unknown error: proc_pidinfo returned %d", ret)
	}

	if ret != vpiSize {
		return "", fmt.Errorf("too few bytes; expected %d, got %d", vpiSize, ret)
	}
	return common.GoString(&vpi.vipPath[0]), nil
}

func procArgs(pid int32) ([]byte, int, error) {
	procargs, _, err := common.CallSyscall([]int32{common.CTL_KERN, common.KERN_PROCARGS2, pid})
	if err != nil {
		return nil, 0, err
	}

	// The first 4 bytes indicate the number of arguments.
	nargs := procargs[:4]
	return procargs, int(binary.LittleEndian.Uint32(nargs)), nil
}

func (p *Process) CmdlineSliceWithContext(_ context.Context) ([]string, error) {
	return p.cmdlineSlice()
}

func (p *Process) cmdlineSlice() ([]string, error) {
	pargs, nargs, err := procArgs(p.Pid)
	if err != nil {
		return nil, err
	}
	// The first bytes hold the nargs int, skip it.
	args := bytes.Split((pargs)[unsafe.Sizeof(int(0)):], []byte{0})
	var argStr string
	// The first element is the actual binary/command path.
	// command := args[0]
	var argSlice []string
	// var envSlice []string
	// All other, non-zero elements are arguments. The first "nargs" elements
	// are the arguments. Everything else in the slice is then the environment
	// of the process.
	for _, arg := range args[1:] {
		argStr = string(arg)
		if len(argStr) > 0 {
			if nargs > 0 {
				argSlice = append(argSlice, argStr)
				nargs--
				continue
			}
			break
			// envSlice = append(envSlice, argStr)
		}
	}
	return argSlice, err
}

// cmdNameWithContext returns the command name (including spaces) without any arguments
func (p *Process) cmdNameWithContext(_ context.Context) (string, error) {
	r, err := p.cmdlineSlice()
	if err != nil {
		return "", err
	}

	if len(r) == 0 {
		return "", nil
	}

	return r[0], err
}

func (p *Process) CmdlineWithContext(ctx context.Context) (string, error) {
	r, err := p.CmdlineSliceWithContext(ctx)
	if err != nil {
		return "", err
	}
	return strings.Join(r, " "), err
}

func (p *Process) NumThreadsWithContext(_ context.Context) (int32, error) {
	lib, err := registerFuncs()
	if err != nil {
		return 0, err
	}
	defer lib.Close()

	var ti ProcTaskInfo
	procPidInfo(p.Pid, common.PROC_PIDTASKINFO, 0, uintptr(unsafe.Pointer(&ti)), int32(unsafe.Sizeof(ti)))

	return int32(ti.Threadnum), nil
}

func (p *Process) TimesWithContext(_ context.Context) (*cpu.TimesStat, error) {
	lib, err := registerFuncs()
	if err != nil {
		return nil, err
	}
	defer lib.Close()

	var ti ProcTaskInfo
	procPidInfo(p.Pid, common.PROC_PIDTASKINFO, 0, uintptr(unsafe.Pointer(&ti)), int32(unsafe.Sizeof(ti)))

	timescaleToNanoSeconds := getTimeScaleToNanoSeconds()
	ret := &cpu.TimesStat{
		CPU:    "cpu",
		User:   float64(ti.Total_user) * timescaleToNanoSeconds / 1e9,
		System: float64(ti.Total_system) * timescaleToNanoSeconds / 1e9,
	}
	return ret, nil
}

func (p *Process) MemoryInfoWithContext(_ context.Context) (*MemoryInfoStat, error) {
	lib, err := registerFuncs()
	if err != nil {
		return nil, err
	}
	defer lib.Close()

	var ti ProcTaskInfo
	procPidInfo(p.Pid, common.PROC_PIDTASKINFO, 0, uintptr(unsafe.Pointer(&ti)), int32(unsafe.Sizeof(ti)))

	ret := &MemoryInfoStat{
		RSS:  uint64(ti.Resident_size),
		VMS:  uint64(ti.Virtual_size),
		Swap: uint64(ti.Pageins),
	}
	return ret, nil
}
