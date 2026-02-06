// SPDX-License-Identifier: BSD-3-Clause
package process

import (
	"context"
	"encoding/json"
	"errors"
	"runtime"
	"sort"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/internal/common"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
)

var (
	invoke                 common.Invoker = common.Invoke{}
	ErrorNoChildren                       = errors.New("process does not have children") // Deprecated: ErrorNoChildren is never returned by process.Children(), check its returned []*Process slice length instead
	ErrorProcessNotRunning                = errors.New("process does not exist")
	ErrorNotPermitted                     = errors.New("operation not permitted")
)

type Process struct {
	Pid            int32 `json:"pid"`
	name           string
	status         string
	parent         int32
	parentMutex    sync.RWMutex // for windows ppid cache
	numCtxSwitches *NumCtxSwitchesStat
	uids           []uint32
	gids           []uint32
	groups         []uint32
	numThreads     int32
	memInfo        *MemoryInfoStat
	sigInfo        *SignalInfoStat
	createTime     int64

	lastCPUTimes *cpu.TimesStat
	lastCPUTime  time.Time

	tgid int32
}

// Process status
const (
	// Running marks a task a running or runnable (on the run queue)
	Running = "running"
	// Blocked marks a task waiting on a short, uninterruptible operation (usually I/O)
	Blocked = "blocked"
	// Idle marks a task sleeping for more than about 20 seconds
	Idle = "idle"
	// Lock marks a task waiting to acquire a lock
	Lock = "lock"
	// Sleep marks task waiting for short, interruptible operation
	Sleep = "sleep"
	// Stop marks a stopped process
	Stop = "stop"
	// Wait marks an idle interrupt thread (or paging in pre 2.6.xx Linux)
	Wait = "wait"
	// Zombie marks a defunct process, terminated but not reaped by its parent
	Zombie = "zombie"

	// Solaris states. See https://github.com/collectd/collectd/blob/1da3305c10c8ff9a63081284cf3d4bb0f6daffd8/src/processes.c#L2115
	Daemon   = "daemon"
	Detached = "detached"
	System   = "system"
	Orphan   = "orphan"

	UnknownState = ""
)

type OpenFilesStat struct {
	Path string `json:"path"`
	Fd   uint64 `json:"fd"`
}

type MemoryInfoStat struct {
	RSS    uint64 `json:"rss"`    // bytes
	VMS    uint64 `json:"vms"`    // bytes
	HWM    uint64 `json:"hwm"`    // bytes
	Data   uint64 `json:"data"`   // bytes
	Stack  uint64 `json:"stack"`  // bytes
	Locked uint64 `json:"locked"` // bytes
	Swap   uint64 `json:"swap"`   // bytes
}

type SignalInfoStat struct {
	PendingProcess uint64 `json:"pending_process"`
	PendingThread  uint64 `json:"pending_thread"`
	Blocked        uint64 `json:"blocked"`
	Ignored        uint64 `json:"ignored"`
	Caught         uint64 `json:"caught"`
}

type RlimitStat struct {
	Resource int32  `json:"resource"`
	Soft     uint64 `json:"soft"`
	Hard     uint64 `json:"hard"`
	Used     uint64 `json:"used"`
}

type IOCountersStat struct {
	// ReadCount is a number of read I/O operations such as syscalls.
	ReadCount uint64 `json:"readCount"`
	// WriteCount is a number of read I/O operations such as syscalls.
	WriteCount uint64 `json:"writeCount"`
	// ReadBytes is a number of all I/O read in bytes. This includes disk I/O on Linux and Windows.
	ReadBytes uint64 `json:"readBytes"`
	// WriteBytes is a number of all I/O write in bytes. This includes disk I/O on Linux and Windows.
	WriteBytes uint64 `json:"writeBytes"`
	// DiskReadBytes is a number of disk I/O write in bytes. Currently only Linux has this value.
	DiskReadBytes uint64 `json:"diskReadBytes"`
	// DiskWriteBytes is a number of disk I/O read in bytes.  Currently only Linux has this value.
	DiskWriteBytes uint64 `json:"diskWriteBytes"`
}

type NumCtxSwitchesStat struct {
	Voluntary   int64 `json:"voluntary"`
	Involuntary int64 `json:"involuntary"`
}

type PageFaultsStat struct {
	MinorFaults      uint64 `json:"minorFaults"`
	MajorFaults      uint64 `json:"majorFaults"`
	ChildMinorFaults uint64 `json:"childMinorFaults"`
	ChildMajorFaults uint64 `json:"childMajorFaults"`
}

// Resource limit constants are from /usr/include/x86_64-linux-gnu/bits/resource.h
// from libc6-dev package in Ubuntu 16.10
const (
	RLIMIT_CPU        int32 = 0
	RLIMIT_FSIZE      int32 = 1
	RLIMIT_DATA       int32 = 2
	RLIMIT_STACK      int32 = 3
	RLIMIT_CORE       int32 = 4
	RLIMIT_RSS        int32 = 5
	RLIMIT_NPROC      int32 = 6
	RLIMIT_NOFILE     int32 = 7
	RLIMIT_MEMLOCK    int32 = 8
	RLIMIT_AS         int32 = 9
	RLIMIT_LOCKS      int32 = 10
	RLIMIT_SIGPENDING int32 = 11
	RLIMIT_MSGQUEUE   int32 = 12
	RLIMIT_NICE       int32 = 13
	RLIMIT_RTPRIO     int32 = 14
	RLIMIT_RTTIME     int32 = 15
)

func (p Process) String() string {
	s, _ := json.Marshal(p)
	return string(s)
}

func (o OpenFilesStat) String() string {
	s, _ := json.Marshal(o)
	return string(s)
}

func (m MemoryInfoStat) String() string {
	s, _ := json.Marshal(m)
	return string(s)
}

func (r RlimitStat) String() string {
	s, _ := json.Marshal(r)
	return string(s)
}

func (i IOCountersStat) String() string {
	s, _ := json.Marshal(i)
	return string(s)
}

func (p NumCtxSwitchesStat) String() string {
	s, _ := json.Marshal(p)
	return string(s)
}

var enableBootTimeCache bool

// EnableBootTimeCache change cache behavior of BootTime. If true, cache BootTime value. Default is false.
func EnableBootTimeCache(enable bool) {
	enableBootTimeCache = enable
}

// Pids returns a slice of process ID list which are running now.
func Pids() ([]int32, error) {
	return PidsWithContext(context.Background())
}

func PidsWithContext(ctx context.Context) ([]int32, error) {
	pids, err := pidsWithContext(ctx)
	sort.Slice(pids, func(i, j int) bool { return pids[i] < pids[j] })
	return pids, err
}

// Processes returns a slice of pointers to Process structs for all
// currently running processes.
func Processes() ([]*Process, error) {
	return ProcessesWithContext(context.Background())
}

// NewProcess creates a new Process instance, it only stores the pid and
// checks that the process exists. Other method on Process can be used
// to get more information about the process. An error will be returned
// if the process does not exist.
func NewProcess(pid int32) (*Process, error) {
	return NewProcessWithContext(context.Background(), pid)
}

func NewProcessWithContext(ctx context.Context, pid int32) (*Process, error) {
	p := &Process{
		Pid: pid,
	}

	exists, err := PidExistsWithContext(ctx, pid)
	if err != nil {
		return p, err
	}
	if !exists {
		return p, ErrorProcessNotRunning
	}
	p.CreateTimeWithContext(ctx)
	return p, nil
}

func PidExists(pid int32) (bool, error) {
	return PidExistsWithContext(context.Background(), pid)
}

// Background returns true if the process is in background, false otherwise.
func (p *Process) Background() (bool, error) {
	return p.BackgroundWithContext(context.Background())
}

func (p *Process) BackgroundWithContext(ctx context.Context) (bool, error) {
	fg, err := p.ForegroundWithContext(ctx)
	if err != nil {
		return false, err
	}
	return !fg, err
}

// If interval is 0, return difference from last call(non-blocking).
// If interval > 0, wait interval sec and return difference between start and end.
func (p *Process) Percent(interval time.Duration) (float64, error) {
	return p.PercentWithContext(context.Background(), interval)
}

func (p *Process) PercentWithContext(ctx context.Context, interval time.Duration) (float64, error) {
	cpuTimes, err := p.TimesWithContext(ctx)
	if err != nil {
		return 0, err
	}
	now := time.Now()

	if interval > 0 {
		p.lastCPUTimes = cpuTimes
		p.lastCPUTime = now
		if err := common.Sleep(ctx, interval); err != nil {
			return 0, err
		}
		cpuTimes, err = p.TimesWithContext(ctx)
		now = time.Now()
		if err != nil {
			return 0, err
		}
	} else if p.lastCPUTimes == nil {
		// invoked first time
		p.lastCPUTimes = cpuTimes
		p.lastCPUTime = now
		return 0, nil
	}

	numcpu := runtime.NumCPU()
	delta := (now.Sub(p.lastCPUTime).Seconds()) * float64(numcpu)
	ret := calculatePercent(p.lastCPUTimes, cpuTimes, delta, numcpu)
	p.lastCPUTimes = cpuTimes
	p.lastCPUTime = now
	return ret, nil
}

// IsRunning returns whether the process is still running or not.
func (p *Process) IsRunning() (bool, error) {
	return p.IsRunningWithContext(context.Background())
}

func (p *Process) IsRunningWithContext(ctx context.Context) (bool, error) {
	createTime, err := p.CreateTimeWithContext(ctx)
	if err != nil {
		return false, err
	}
	p2, err := NewProcessWithContext(ctx, p.Pid)
	if errors.Is(err, ErrorProcessNotRunning) {
		return false, nil
	}
	createTime2, err := p2.CreateTimeWithContext(ctx)
	if err != nil {
		return false, err
	}
	return createTime == createTime2, nil
}

// CreateTime returns created time of the process in milliseconds since the epoch, in UTC.
func (p *Process) CreateTime() (int64, error) {
	return p.CreateTimeWithContext(context.Background())
}

func (p *Process) CreateTimeWithContext(ctx context.Context) (int64, error) {
	if p.createTime != 0 {
		return p.createTime, nil
	}
	createTime, err := p.createTimeWithContext(ctx)
	p.createTime = createTime
	return p.createTime, err
}

func calculatePercent(t1, t2 *cpu.TimesStat, delta float64, numcpu int) float64 {
	if delta == 0 {
		return 0
	}
	// https://github.com/giampaolo/psutil/blob/c034e6692cf736b5e87d14418a8153bb03f6cf42/psutil/__init__.py#L1064
	deltaProc := (t2.User - t1.User) + (t2.System - t1.System)
	if deltaProc <= 0 {
		return 0
	}
	overallPercent := ((deltaProc / delta) * 100) * float64(numcpu)
	return overallPercent
}

// MemoryPercent returns how many percent of the total RAM this process uses
func (p *Process) MemoryPercent() (float32, error) {
	return p.MemoryPercentWithContext(context.Background())
}

func (p *Process) MemoryPercentWithContext(ctx context.Context) (float32, error) {
	machineMemory, err := mem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return 0, err
	}
	total := machineMemory.Total

	processMemory, err := p.MemoryInfoWithContext(ctx)
	if err != nil {
		return 0, err
	}
	used := processMemory.RSS

	return (100 * float32(used) / float32(total)), nil
}

// CPUPercent returns how many percent of the CPU time this process uses
func (p *Process) CPUPercent() (float64, error) {
	return p.CPUPercentWithContext(context.Background())
}

func (p *Process) CPUPercentWithContext(ctx context.Context) (float64, error) {
	createTime, err := p.createTimeWithContext(ctx)
	if err != nil {
		return 0, err
	}

	cput, err := p.TimesWithContext(ctx)
	if err != nil {
		return 0, err
	}

	created := time.Unix(0, createTime*int64(time.Millisecond))
	totalTime := time.Since(created).Seconds()
	if totalTime <= 0 {
		return 0, nil
	}

	return 100 * cput.Total() / totalTime, nil
}

// Groups returns all group IDs(include supplementary groups) of the process as a slice of the int
func (p *Process) Groups() ([]uint32, error) {
	return p.GroupsWithContext(context.Background())
}

// Ppid returns Parent Process ID of the process.
func (p *Process) Ppid() (int32, error) {
	return p.PpidWithContext(context.Background())
}

// Name returns name of the process.
func (p *Process) Name() (string, error) {
	return p.NameWithContext(context.Background())
}

// Exe returns executable path of the process.
func (p *Process) Exe() (string, error) {
	return p.ExeWithContext(context.Background())
}

// Cmdline returns the command line arguments of the process as a string with
// each argument separated by 0x20 ascii character.
func (p *Process) Cmdline() (string, error) {
	return p.CmdlineWithContext(context.Background())
}

// CmdlineSlice returns the command line arguments of the process as a slice with each
// element being an argument.
//
// On Windows, this assumes the command line is encoded according to the convention accepted by
// [golang.org/x/sys/windows.CmdlineToArgv] (the most common convention). If this is not suitable,
// you should instead use [Process.Cmdline] and parse the command line according to your specific
// requirements.
func (p *Process) CmdlineSlice() ([]string, error) {
	return p.CmdlineSliceWithContext(context.Background())
}

// Cwd returns current working directory of the process.
func (p *Process) Cwd() (string, error) {
	return p.CwdWithContext(context.Background())
}

// Parent returns parent Process of the process.
func (p *Process) Parent() (*Process, error) {
	return p.ParentWithContext(context.Background())
}

// ParentWithContext returns parent Process of the process.
func (p *Process) ParentWithContext(ctx context.Context) (*Process, error) {
	ppid, err := p.PpidWithContext(ctx)
	if err != nil {
		return nil, err
	}
	return NewProcessWithContext(ctx, ppid)
}

// Status returns the process status.
// Return value could be one of these.
// R: Running S: Sleep T: Stop I: Idle
// Z: Zombie W: Wait L: Lock
// The character is same within all supported platforms.
func (p *Process) Status() ([]string, error) {
	return p.StatusWithContext(context.Background())
}

// Foreground returns true if the process is in foreground, false otherwise.
func (p *Process) Foreground() (bool, error) {
	return p.ForegroundWithContext(context.Background())
}

// Uids returns user ids of the process as a slice of the int
func (p *Process) Uids() ([]uint32, error) {
	return p.UidsWithContext(context.Background())
}

// Gids returns group ids of the process as a slice of the int
func (p *Process) Gids() ([]uint32, error) {
	return p.GidsWithContext(context.Background())
}

// Terminal returns a terminal which is associated with the process.
func (p *Process) Terminal() (string, error) {
	return p.TerminalWithContext(context.Background())
}

// Nice returns a nice value (priority).
func (p *Process) Nice() (int32, error) {
	return p.NiceWithContext(context.Background())
}

// IOnice returns process I/O nice value (priority).
func (p *Process) IOnice() (int32, error) {
	return p.IOniceWithContext(context.Background())
}

// Rlimit returns Resource Limits.
func (p *Process) Rlimit() ([]RlimitStat, error) {
	return p.RlimitWithContext(context.Background())
}

// RlimitUsage returns Resource Limits.
// If gatherUsed is true, the currently used value will be gathered and added
// to the resulting RlimitStat.
func (p *Process) RlimitUsage(gatherUsed bool) ([]RlimitStat, error) {
	return p.RlimitUsageWithContext(context.Background(), gatherUsed)
}

// IOCounters returns IO Counters.
func (p *Process) IOCounters() (*IOCountersStat, error) {
	return p.IOCountersWithContext(context.Background())
}

// NumCtxSwitches returns the number of the context switches of the process.
func (p *Process) NumCtxSwitches() (*NumCtxSwitchesStat, error) {
	return p.NumCtxSwitchesWithContext(context.Background())
}

// NumFDs returns the number of File Descriptors used by the process.
func (p *Process) NumFDs() (int32, error) {
	return p.NumFDsWithContext(context.Background())
}

// NumThreads returns the number of threads used by the process.
func (p *Process) NumThreads() (int32, error) {
	return p.NumThreadsWithContext(context.Background())
}

func (p *Process) Threads() (map[int32]*cpu.TimesStat, error) {
	return p.ThreadsWithContext(context.Background())
}

// Times returns CPU times of the process.
func (p *Process) Times() (*cpu.TimesStat, error) {
	return p.TimesWithContext(context.Background())
}

// CPUAffinity returns CPU affinity of the process.
func (p *Process) CPUAffinity() ([]int32, error) {
	return p.CPUAffinityWithContext(context.Background())
}

// MemoryInfo returns generic process memory information,
// such as RSS and VMS.
func (p *Process) MemoryInfo() (*MemoryInfoStat, error) {
	return p.MemoryInfoWithContext(context.Background())
}

// MemoryInfoEx returns platform-specific process memory information.
func (p *Process) MemoryInfoEx() (*MemoryInfoExStat, error) {
	return p.MemoryInfoExWithContext(context.Background())
}

// PageFaults returns the process's page fault counters.
func (p *Process) PageFaults() (*PageFaultsStat, error) {
	return p.PageFaultsWithContext(context.Background())
}

// Children returns the children of the process represented as a slice
// of pointers to Process type.
func (p *Process) Children() ([]*Process, error) {
	return p.ChildrenWithContext(context.Background())
}

// OpenFiles returns a slice of OpenFilesStat opend by the process.
// OpenFilesStat includes a file path and file descriptor.
func (p *Process) OpenFiles() ([]OpenFilesStat, error) {
	return p.OpenFilesWithContext(context.Background())
}

// Connections returns a slice of net.ConnectionStat used by the process.
// This returns all kind of the connection. This means TCP, UDP or UNIX.
func (p *Process) Connections() ([]net.ConnectionStat, error) {
	return p.ConnectionsWithContext(context.Background())
}

// ConnectionsMax returns a slice of net.ConnectionStat used by the process at most `max`.
func (p *Process) ConnectionsMax(maxConn int) ([]net.ConnectionStat, error) {
	return p.ConnectionsMaxWithContext(context.Background(), maxConn)
}

// MemoryMaps get memory maps from /proc/(pid)/smaps
func (p *Process) MemoryMaps(grouped bool) (*[]MemoryMapsStat, error) {
	return p.MemoryMapsWithContext(context.Background(), grouped)
}

// Tgid returns thread group id of the process.
func (p *Process) Tgid() (int32, error) {
	return p.TgidWithContext(context.Background())
}

// SendSignal sends a unix.Signal to the process.
func (p *Process) SendSignal(sig Signal) error {
	return p.SendSignalWithContext(context.Background(), sig)
}

// Suspend sends SIGSTOP to the process.
func (p *Process) Suspend() error {
	return p.SuspendWithContext(context.Background())
}

// Resume sends SIGCONT to the process.
func (p *Process) Resume() error {
	return p.ResumeWithContext(context.Background())
}

// Terminate sends SIGTERM to the process.
func (p *Process) Terminate() error {
	return p.TerminateWithContext(context.Background())
}

// Kill sends SIGKILL to the process.
func (p *Process) Kill() error {
	return p.KillWithContext(context.Background())
}

// Username returns a username of the process.
func (p *Process) Username() (string, error) {
	return p.UsernameWithContext(context.Background())
}

// Environ returns the environment variables of the process.
func (p *Process) Environ() ([]string, error) {
	return p.EnvironWithContext(context.Background())
}

// convertStatusChar as reported by the ps command across different platforms.
func convertStatusChar(letter string) string {
	// Sources
	// Darwin: http://www.mywebuniversity.com/Man_Pages/Darwin/man_ps.html
	// FreeBSD: https://www.freebsd.org/cgi/man.cgi?ps
	// Linux https://man7.org/linux/man-pages/man1/ps.1.html
	// OpenBSD: https://man.openbsd.org/ps.1#state
	// Solaris: https://github.com/collectd/collectd/blob/1da3305c10c8ff9a63081284cf3d4bb0f6daffd8/src/processes.c#L2115
	switch letter {
	case "A":
		return Daemon
	case "D", "U":
		return Blocked
	case "E":
		return Detached
	case "I":
		return Idle
	case "L":
		return Lock
	case "O":
		return Orphan
	case "R":
		return Running
	case "S":
		return Sleep
	case "T", "t":
		// "t" is used by Linux to signal stopped by the debugger during tracing
		return Stop
	case "W":
		return Wait
	case "Y":
		return System
	case "Z":
		return Zombie
	default:
		return UnknownState
	}
}
