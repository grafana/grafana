// SPDX-License-Identifier: BSD-3-Clause
//go:build windows

package process

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"syscall"
	"time"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/internal/common"
	"github.com/shirou/gopsutil/v4/net"
)

type Signal = syscall.Signal

var (
	modntdll             = windows.NewLazySystemDLL("ntdll.dll")
	procNtResumeProcess  = modntdll.NewProc("NtResumeProcess")
	procNtSuspendProcess = modntdll.NewProc("NtSuspendProcess")

	modpsapi                     = windows.NewLazySystemDLL("psapi.dll")
	procGetProcessMemoryInfo     = modpsapi.NewProc("GetProcessMemoryInfo")
	procGetProcessImageFileNameW = modpsapi.NewProc("GetProcessImageFileNameW")

	advapi32                  = windows.NewLazySystemDLL("advapi32.dll")
	procLookupPrivilegeValue  = advapi32.NewProc("LookupPrivilegeValueW")
	procAdjustTokenPrivileges = advapi32.NewProc("AdjustTokenPrivileges")

	procQueryFullProcessImageNameW = common.Modkernel32.NewProc("QueryFullProcessImageNameW")
	procGetPriorityClass           = common.Modkernel32.NewProc("GetPriorityClass")
	procGetProcessIoCounters       = common.Modkernel32.NewProc("GetProcessIoCounters")
	procGetNativeSystemInfo        = common.Modkernel32.NewProc("GetNativeSystemInfo")
	procGetProcessHandleCount      = common.Modkernel32.NewProc("GetProcessHandleCount")

	processorArchitecture uint
)

const processQueryInformation = windows.PROCESS_QUERY_LIMITED_INFORMATION

type systemProcessorInformation struct {
	ProcessorArchitecture uint16
	ProcessorLevel        uint16
	ProcessorRevision     uint16
	Reserved              uint16
	ProcessorFeatureBits  uint16
}

type systemInfo struct {
	wProcessorArchitecture      uint16
	wReserved                   uint16
	dwpageSize                  uint32
	lpMinimumApplicationAddress uintptr
	lpMaximumApplicationAddress uintptr
	dwActiveProcessorMask       uintptr
	dwNumberOfProcessors        uint32
	dwProcessorType             uint32
	dwAllocationGranularity     uint32
	wProcessorLevel             uint16
	wProcessorRevision          uint16
}

// Memory_info_ex is different between OSes
type MemoryInfoExStat struct{}

type MemoryMapsStat struct{}

// ioCounters is an equivalent representation of IO_COUNTERS in the Windows API.
// https://docs.microsoft.com/windows/win32/api/winnt/ns-winnt-io_counters
type ioCounters struct {
	ReadOperationCount  uint64
	WriteOperationCount uint64
	OtherOperationCount uint64
	ReadTransferCount   uint64
	WriteTransferCount  uint64
	OtherTransferCount  uint64
}

type processBasicInformation32 struct {
	Reserved1       uint32
	PebBaseAddress  uint32
	Reserved2       uint32
	Reserved3       uint32
	UniqueProcessId uint32
	Reserved4       uint32
}

type processBasicInformation64 struct {
	Reserved1       uint64
	PebBaseAddress  uint64
	Reserved2       uint64
	Reserved3       uint64
	UniqueProcessId uint64
	Reserved4       uint64
}

type processEnvironmentBlock32 struct {
	Reserved1         [2]uint8
	BeingDebugged     uint8
	Reserved2         uint8
	Reserved3         [2]uint32
	Ldr               uint32
	ProcessParameters uint32
	// More fields which we don't use so far
}

type processEnvironmentBlock64 struct {
	Reserved1         [2]uint8
	BeingDebugged     uint8
	Reserved2         uint8
	_                 [4]uint8 // padding, since we are 64 bit, the next pointer is 64 bit aligned (when compiling for 32 bit, this is not the case without manual padding)
	Reserved3         [2]uint64
	Ldr               uint64
	ProcessParameters uint64
	// More fields which we don't use so far
}

type rtlUserProcessParameters32 struct {
	Reserved1                      [16]uint8
	ConsoleHandle                  uint32
	ConsoleFlags                   uint32
	StdInputHandle                 uint32
	StdOutputHandle                uint32
	StdErrorHandle                 uint32
	CurrentDirectoryPathNameLength uint16
	_                              uint16 // Max Length
	CurrentDirectoryPathAddress    uint32
	CurrentDirectoryHandle         uint32
	DllPathNameLength              uint16
	_                              uint16 // Max Length
	DllPathAddress                 uint32
	ImagePathNameLength            uint16
	_                              uint16 // Max Length
	ImagePathAddress               uint32
	CommandLineLength              uint16
	_                              uint16 // Max Length
	CommandLineAddress             uint32
	EnvironmentAddress             uint32
	// More fields which we don't use so far
}

type rtlUserProcessParameters64 struct {
	Reserved1                      [16]uint8
	ConsoleHandle                  uint64
	ConsoleFlags                   uint64
	StdInputHandle                 uint64
	StdOutputHandle                uint64
	StdErrorHandle                 uint64
	CurrentDirectoryPathNameLength uint16
	_                              uint16 // Max Length
	_                              uint32 // Padding
	CurrentDirectoryPathAddress    uint64
	CurrentDirectoryHandle         uint64
	DllPathNameLength              uint16
	_                              uint16 // Max Length
	_                              uint32 // Padding
	DllPathAddress                 uint64
	ImagePathNameLength            uint16
	_                              uint16 // Max Length
	_                              uint32 // Padding
	ImagePathAddress               uint64
	CommandLineLength              uint16
	_                              uint16 // Max Length
	_                              uint32 // Padding
	CommandLineAddress             uint64
	EnvironmentAddress             uint64
	// More fields which we don't use so far
}

type winLUID struct {
	LowPart  winDWord
	HighPart winLong
}

// LUID_AND_ATTRIBUTES
type winLUIDAndAttributes struct {
	Luid       winLUID
	Attributes winDWord
}

// TOKEN_PRIVILEGES
type winTokenPrivileges struct {
	PrivilegeCount winDWord
	Privileges     [1]winLUIDAndAttributes
}

type (
	winLong  int32
	winDWord uint32
)

func init() {
	var systemInfo systemInfo

	procGetNativeSystemInfo.Call(uintptr(unsafe.Pointer(&systemInfo)))
	processorArchitecture = uint(systemInfo.wProcessorArchitecture)

	// enable SeDebugPrivilege https://github.com/midstar/proci/blob/6ec79f57b90ba3d9efa2a7b16ef9c9369d4be875/proci_windows.go#L80-L119
	handle, err := syscall.GetCurrentProcess()
	if err != nil {
		return
	}

	var token syscall.Token
	err = syscall.OpenProcessToken(handle, 0x0028, &token)
	if err != nil {
		return
	}
	defer token.Close()

	tokenPrivileges := winTokenPrivileges{PrivilegeCount: 1}
	lpName := syscall.StringToUTF16("SeDebugPrivilege")
	ret, _, _ := procLookupPrivilegeValue.Call(
		0,
		uintptr(unsafe.Pointer(&lpName[0])),
		uintptr(unsafe.Pointer(&tokenPrivileges.Privileges[0].Luid)))
	if ret == 0 {
		return
	}

	tokenPrivileges.Privileges[0].Attributes = 0x00000002 // SE_PRIVILEGE_ENABLED

	procAdjustTokenPrivileges.Call(
		uintptr(token),
		0,
		uintptr(unsafe.Pointer(&tokenPrivileges)),
		uintptr(unsafe.Sizeof(tokenPrivileges)),
		0,
		0)
}

func pidsWithContext(_ context.Context) ([]int32, error) {
	// inspired by https://gist.github.com/henkman/3083408
	// and https://github.com/giampaolo/psutil/blob/1c3a15f637521ba5c0031283da39c733fda53e4c/psutil/arch/windows/process_info.c#L315-L329
	var ret []int32
	var read uint32
	var psSize uint32 = 1024
	const dwordSize uint32 = 4

	for {
		ps := make([]uint32, psSize)
		if err := windows.EnumProcesses(ps, &read); err != nil {
			return nil, err
		}
		if uint32(len(ps)) == read/dwordSize { // ps buffer was too small to host every results, retry with a bigger one
			psSize += 1024
			continue
		}
		for _, pid := range ps[:read/dwordSize] {
			ret = append(ret, int32(pid))
		}
		return ret, nil

	}
}

func PidExistsWithContext(ctx context.Context, pid int32) (bool, error) {
	if pid == 0 { // special case for pid 0 System Idle Process
		return true, nil
	}
	if pid < 0 {
		return false, fmt.Errorf("invalid pid %v", pid)
	}
	if pid%4 != 0 {
		// OpenProcess will succeed even on non-existing pid here https://devblogs.microsoft.com/oldnewthing/20080606-00/?p=22043
		// so we list every pid just to be sure and be future-proof
		pids, err := PidsWithContext(ctx)
		if err != nil {
			return false, err
		}
		for _, i := range pids {
			if i == pid {
				return true, err
			}
		}
		return false, err
	}
	h, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if errors.Is(err, windows.ERROR_ACCESS_DENIED) {
		return true, nil
	}
	if errors.Is(err, windows.ERROR_INVALID_PARAMETER) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	defer windows.CloseHandle(h)
	event, err := windows.WaitForSingleObject(h, 0)
	return event == uint32(windows.WAIT_TIMEOUT), err
}

func (p *Process) PpidWithContext(_ context.Context) (int32, error) {
	// if cached already, return from cache
	cachedPpid := p.getPpid()
	if cachedPpid != 0 {
		return cachedPpid, nil
	}

	ppid, _, _, err := getFromSnapProcess(p.Pid)
	if err != nil {
		return 0, err
	}

	// no errors and not cached already, so cache it
	p.setPpid(ppid)

	return ppid, nil
}

func (p *Process) NameWithContext(ctx context.Context) (string, error) {
	if p.Pid == 0 {
		return "System Idle Process", nil
	}
	if p.Pid == 4 {
		return "System", nil
	}

	exe, err := p.ExeWithContext(ctx)
	if err != nil {
		return "", fmt.Errorf("could not get Name: %w", err)
	}

	return filepath.Base(exe), nil
}

func (p *Process) TgidWithContext(_ context.Context) (int32, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) ExeWithContext(_ context.Context) (string, error) {
	c, err := windows.OpenProcess(processQueryInformation, false, uint32(p.Pid))
	if err != nil {
		return "", err
	}
	defer windows.CloseHandle(c)
	buf := make([]uint16, syscall.MAX_LONG_PATH)
	size := uint32(syscall.MAX_LONG_PATH)
	if err := procQueryFullProcessImageNameW.Find(); err == nil { // Vista+
		ret, _, err := procQueryFullProcessImageNameW.Call(
			uintptr(c),
			uintptr(0),
			uintptr(unsafe.Pointer(&buf[0])),
			uintptr(unsafe.Pointer(&size)))
		if ret == 0 {
			return "", err
		}
		return windows.UTF16ToString(buf), nil
	}
	// XP fallback
	ret, _, err := procGetProcessImageFileNameW.Call(uintptr(c), uintptr(unsafe.Pointer(&buf[0])), uintptr(size))
	if ret == 0 {
		return "", err
	}
	return common.ConvertDOSPath(windows.UTF16ToString(buf)), nil
}

func (p *Process) CmdlineWithContext(_ context.Context) (string, error) {
	cmdline, err := getProcessCommandLine(p.Pid)
	if err != nil {
		return "", fmt.Errorf("could not get CommandLine: %w", err)
	}
	return cmdline, nil
}

func (p *Process) CmdlineSliceWithContext(ctx context.Context) ([]string, error) {
	cmdline, err := p.CmdlineWithContext(ctx)
	if err != nil {
		return nil, err
	}
	return parseCmdline(cmdline)
}

func parseCmdline(cmdline string) ([]string, error) {
	cmdlineptr, err := windows.UTF16PtrFromString(cmdline)
	if err != nil {
		return nil, err
	}

	var argc int32
	argvptr, err := windows.CommandLineToArgv(cmdlineptr, &argc)
	if err != nil {
		return nil, err
	}
	defer windows.LocalFree(windows.Handle(uintptr(unsafe.Pointer(argvptr))))

	argv := make([]string, argc)
	for i, v := range (*argvptr)[:argc] {
		argv[i] = windows.UTF16ToString((*v)[:])
	}
	return argv, nil
}

func (p *Process) createTimeWithContext(_ context.Context) (int64, error) {
	ru, err := getRusage(p.Pid)
	if err != nil {
		return 0, fmt.Errorf("could not get CreationDate: %w", err)
	}

	return ru.CreationTime.Nanoseconds() / 1000000, nil
}

func (p *Process) CwdWithContext(_ context.Context) (string, error) {
	h, err := windows.OpenProcess(processQueryInformation|windows.PROCESS_VM_READ, false, uint32(p.Pid))
	if errors.Is(err, windows.ERROR_ACCESS_DENIED) || errors.Is(err, windows.ERROR_INVALID_PARAMETER) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	defer syscall.CloseHandle(syscall.Handle(h))

	procIs32Bits := is32BitProcess(h)

	if procIs32Bits {
		userProcParams, err := getUserProcessParams32(h)
		if err != nil {
			return "", err
		}
		if userProcParams.CurrentDirectoryPathNameLength > 0 {
			cwd := readProcessMemory(syscall.Handle(h), procIs32Bits, uint64(userProcParams.CurrentDirectoryPathAddress), uint(userProcParams.CurrentDirectoryPathNameLength))
			if len(cwd) != int(userProcParams.CurrentDirectoryPathNameLength) {
				return "", errors.New("cannot read current working directory")
			}

			return convertUTF16ToString(cwd), nil
		}
	} else {
		userProcParams, err := getUserProcessParams64(h)
		if err != nil {
			return "", err
		}
		if userProcParams.CurrentDirectoryPathNameLength > 0 {
			cwd := readProcessMemory(syscall.Handle(h), procIs32Bits, userProcParams.CurrentDirectoryPathAddress, uint(userProcParams.CurrentDirectoryPathNameLength))
			if len(cwd) != int(userProcParams.CurrentDirectoryPathNameLength) {
				return "", errors.New("cannot read current working directory")
			}

			return convertUTF16ToString(cwd), nil
		}
	}

	// if we reach here, we have no cwd
	return "", nil
}

func (p *Process) StatusWithContext(_ context.Context) ([]string, error) {
	return []string{""}, common.ErrNotImplementedError
}

func (p *Process) ForegroundWithContext(_ context.Context) (bool, error) {
	return false, common.ErrNotImplementedError
}

func (p *Process) UsernameWithContext(_ context.Context) (string, error) {
	pid := p.Pid
	c, err := windows.OpenProcess(processQueryInformation, false, uint32(pid))
	if err != nil {
		return "", err
	}
	defer windows.CloseHandle(c)

	var token syscall.Token
	err = syscall.OpenProcessToken(syscall.Handle(c), syscall.TOKEN_QUERY, &token)
	if err != nil {
		return "", err
	}
	defer token.Close()
	tokenUser, err := token.GetTokenUser()
	if err != nil {
		return "", err
	}

	user, domain, _, err := tokenUser.User.Sid.LookupAccount("")
	return domain + "\\" + user, err
}

func (p *Process) UidsWithContext(_ context.Context) ([]uint32, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) GidsWithContext(_ context.Context) ([]uint32, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) GroupsWithContext(_ context.Context) ([]uint32, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) TerminalWithContext(_ context.Context) (string, error) {
	return "", common.ErrNotImplementedError
}

// priorityClasses maps a win32 priority class to its WMI equivalent Win32_Process.Priority
// https://docs.microsoft.com/en-us/windows/desktop/api/processthreadsapi/nf-processthreadsapi-getpriorityclass
// https://docs.microsoft.com/en-us/windows/desktop/cimwin32prov/win32-process
var priorityClasses = map[int]int32{
	0x00008000: 10, // ABOVE_NORMAL_PRIORITY_CLASS
	0x00004000: 6,  // BELOW_NORMAL_PRIORITY_CLASS
	0x00000080: 13, // HIGH_PRIORITY_CLASS
	0x00000040: 4,  // IDLE_PRIORITY_CLASS
	0x00000020: 8,  // NORMAL_PRIORITY_CLASS
	0x00000100: 24, // REALTIME_PRIORITY_CLASS
}

func (p *Process) NiceWithContext(_ context.Context) (int32, error) {
	c, err := windows.OpenProcess(processQueryInformation, false, uint32(p.Pid))
	if err != nil {
		return 0, err
	}
	defer windows.CloseHandle(c)
	ret, _, err := procGetPriorityClass.Call(uintptr(c))
	if ret == 0 {
		return 0, err
	}
	priority, ok := priorityClasses[int(ret)]
	if !ok {
		return 0, fmt.Errorf("unknown priority class %v", ret)
	}
	return priority, nil
}

func (p *Process) IOniceWithContext(_ context.Context) (int32, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) RlimitWithContext(_ context.Context) ([]RlimitStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) RlimitUsageWithContext(_ context.Context, _ bool) ([]RlimitStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) IOCountersWithContext(_ context.Context) (*IOCountersStat, error) {
	c, err := windows.OpenProcess(processQueryInformation, false, uint32(p.Pid))
	if err != nil {
		return nil, err
	}
	defer windows.CloseHandle(c)
	var ioCounters ioCounters
	ret, _, err := procGetProcessIoCounters.Call(uintptr(c), uintptr(unsafe.Pointer(&ioCounters)))
	if ret == 0 {
		return nil, err
	}
	stats := &IOCountersStat{
		ReadCount:  ioCounters.ReadOperationCount,
		ReadBytes:  ioCounters.ReadTransferCount,
		WriteCount: ioCounters.WriteOperationCount,
		WriteBytes: ioCounters.WriteTransferCount,
	}

	return stats, nil
}

func (p *Process) NumCtxSwitchesWithContext(_ context.Context) (*NumCtxSwitchesStat, error) {
	return nil, common.ErrNotImplementedError
}

// NumFDsWithContext returns the number of handles for a process on Windows,
// not the number of file descriptors (FDs).
func (p *Process) NumFDsWithContext(_ context.Context) (int32, error) {
	handle, err := windows.OpenProcess(processQueryInformation, false, uint32(p.Pid))
	if err != nil {
		return 0, err
	}
	defer windows.CloseHandle(handle)

	var handleCount uint32
	ret, _, err := procGetProcessHandleCount.Call(uintptr(handle), uintptr(unsafe.Pointer(&handleCount)))
	if ret == 0 {
		return 0, err
	}
	return int32(handleCount), nil
}

func (p *Process) NumThreadsWithContext(_ context.Context) (int32, error) {
	ppid, ret, _, err := getFromSnapProcess(p.Pid)
	if err != nil {
		return 0, err
	}

	// if no errors and not cached already, cache ppid
	p.parent = ppid
	if 0 == p.getPpid() {
		p.setPpid(ppid)
	}

	return ret, nil
}

func (p *Process) ThreadsWithContext(_ context.Context) (map[int32]*cpu.TimesStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) TimesWithContext(_ context.Context) (*cpu.TimesStat, error) {
	sysTimes, err := getProcessCPUTimes(p.Pid)
	if err != nil {
		return nil, err
	}

	// User and kernel times are represented as a FILETIME structure
	// which contains a 64-bit value representing the number of
	// 100-nanosecond intervals since January 1, 1601 (UTC):
	// http://msdn.microsoft.com/en-us/library/ms724284(VS.85).aspx
	// To convert it into a float representing the seconds that the
	// process has executed in user/kernel mode I borrowed the code
	// below from psutil's _psutil_windows.c, and in turn from Python's
	// Modules/posixmodule.c

	user := float64(sysTimes.UserTime.HighDateTime)*429.4967296 + float64(sysTimes.UserTime.LowDateTime)*1e-7
	kernel := float64(sysTimes.KernelTime.HighDateTime)*429.4967296 + float64(sysTimes.KernelTime.LowDateTime)*1e-7

	return &cpu.TimesStat{
		User:   user,
		System: kernel,
	}, nil
}

func (p *Process) CPUAffinityWithContext(_ context.Context) ([]int32, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) MemoryInfoWithContext(_ context.Context) (*MemoryInfoStat, error) {
	mem, err := getMemoryInfo(p.Pid)
	if err != nil {
		return nil, err
	}

	ret := &MemoryInfoStat{
		RSS: uint64(mem.WorkingSetSize),
		VMS: uint64(mem.PagefileUsage),
	}

	return ret, nil
}

func (p *Process) MemoryInfoExWithContext(_ context.Context) (*MemoryInfoExStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) PageFaultsWithContext(_ context.Context) (*PageFaultsStat, error) {
	mem, err := getMemoryInfo(p.Pid)
	if err != nil {
		return nil, err
	}

	ret := &PageFaultsStat{
		// Since Windows does not distinguish between Major and Minor faults, all faults are treated as Major
		MajorFaults: uint64(mem.PageFaultCount),
	}

	return ret, nil
}

func (p *Process) ChildrenWithContext(ctx context.Context) ([]*Process, error) {
	out := []*Process{}
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, uint32(0))
	if err != nil {
		return out, err
	}
	defer windows.CloseHandle(snap)
	var pe32 windows.ProcessEntry32
	pe32.Size = uint32(unsafe.Sizeof(pe32))
	if err := windows.Process32First(snap, &pe32); err != nil {
		return out, err
	}
	for {
		if pe32.ParentProcessID == uint32(p.Pid) {
			p, err := NewProcessWithContext(ctx, int32(pe32.ProcessID))
			if err == nil {
				out = append(out, p)
			}
		}
		if err = windows.Process32Next(snap, &pe32); err != nil {
			break
		}
	}
	return out, nil
}

func (p *Process) OpenFilesWithContext(ctx context.Context) ([]OpenFilesStat, error) {
	files := make([]OpenFilesStat, 0)
	fileExists := make(map[string]bool)

	process, err := windows.OpenProcess(common.ProcessQueryInformation, false, uint32(p.Pid))
	if err != nil {
		return nil, err
	}

	buffer := make([]byte, 1024)
	var size uint32

	st := common.CallWithExpandingBuffer(
		func() common.NtStatus {
			return common.NtQuerySystemInformation(
				common.SystemExtendedHandleInformationClass,
				&buffer[0],
				uint32(len(buffer)),
				&size,
			)
		},
		&buffer,
		&size,
	)
	if st.IsError() {
		return nil, st.Error()
	}

	handlesList := (*common.SystemExtendedHandleInformation)(unsafe.Pointer(&buffer[0]))
	handles := make([]common.SystemExtendedHandleTableEntryInformation, int(handlesList.NumberOfHandles))
	hdr := (*reflect.SliceHeader)(unsafe.Pointer(&handles))
	hdr.Data = uintptr(unsafe.Pointer(&handlesList.Handles[0]))

	currentProcess, err := windows.GetCurrentProcess()
	if err != nil {
		return nil, err
	}

	for _, handle := range handles {
		var file uintptr
		if int32(handle.UniqueProcessId) != p.Pid {
			continue
		}
		if windows.DuplicateHandle(process, windows.Handle(handle.HandleValue), currentProcess, (*windows.Handle)(&file),
			0, true, windows.DUPLICATE_SAME_ACCESS) != nil {
			continue
		}
		// release the new handle
		defer windows.CloseHandle(windows.Handle(file))

		fileType, err := windows.GetFileType(windows.Handle(file))
		if err != nil || fileType != windows.FILE_TYPE_DISK {
			continue
		}

		var fileName string
		ch := make(chan struct{})

		go func() {
			var buf [syscall.MAX_LONG_PATH]uint16
			n, err := windows.GetFinalPathNameByHandle(windows.Handle(file), &buf[0], syscall.MAX_LONG_PATH, 0)
			if err != nil {
				return
			}

			fileName = string(utf16.Decode(buf[:n]))
			ch <- struct{}{}
		}()

		select {
		case <-time.NewTimer(100 * time.Millisecond).C:
			continue
		case <-ch:
			fileInfo, err := os.Stat(fileName)
			if err != nil || fileInfo.IsDir() {
				continue
			}

			if _, exists := fileExists[fileName]; !exists {
				files = append(files, OpenFilesStat{
					Path: fileName,
					Fd:   uint64(file),
				})
				fileExists[fileName] = true
			}
		case <-ctx.Done():
			return files, ctx.Err()
		}
	}

	return files, nil
}

func (p *Process) ConnectionsWithContext(ctx context.Context) ([]net.ConnectionStat, error) {
	return net.ConnectionsPidWithContext(ctx, "all", p.Pid)
}

func (p *Process) ConnectionsMaxWithContext(_ context.Context, _ int) ([]net.ConnectionStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) MemoryMapsWithContext(_ context.Context, _ bool) (*[]MemoryMapsStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) SendSignalWithContext(_ context.Context, _ syscall.Signal) error {
	return common.ErrNotImplementedError
}

func (p *Process) SuspendWithContext(_ context.Context) error {
	c, err := windows.OpenProcess(windows.PROCESS_SUSPEND_RESUME, false, uint32(p.Pid))
	if err != nil {
		return err
	}
	defer windows.CloseHandle(c)

	r1, _, _ := procNtSuspendProcess.Call(uintptr(c))
	if r1 != 0 {
		// See https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-erref/596a1078-e883-4972-9bbc-49e60bebca55
		return fmt.Errorf("NtStatus='0x%.8X'", r1)
	}

	return nil
}

func (p *Process) ResumeWithContext(_ context.Context) error {
	c, err := windows.OpenProcess(windows.PROCESS_SUSPEND_RESUME, false, uint32(p.Pid))
	if err != nil {
		return err
	}
	defer windows.CloseHandle(c)

	r1, _, _ := procNtResumeProcess.Call(uintptr(c))
	if r1 != 0 {
		// See https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-erref/596a1078-e883-4972-9bbc-49e60bebca55
		return fmt.Errorf("NtStatus='0x%.8X'", r1)
	}

	return nil
}

func (p *Process) TerminateWithContext(_ context.Context) error {
	proc, err := windows.OpenProcess(windows.PROCESS_TERMINATE, false, uint32(p.Pid))
	if err != nil {
		return err
	}
	err = windows.TerminateProcess(proc, 0)
	windows.CloseHandle(proc)
	return err
}

func (p *Process) KillWithContext(_ context.Context) error {
	process, err := os.FindProcess(int(p.Pid))
	if err != nil {
		return err
	}
	defer process.Release()
	return process.Kill()
}

func (p *Process) EnvironWithContext(ctx context.Context) ([]string, error) {
	envVars, err := getProcessEnvironmentVariables(ctx, p.Pid)
	if err != nil {
		return nil, fmt.Errorf("could not get environment variables: %w", err)
	}
	return envVars, nil
}

// retrieve Ppid in a thread-safe manner
func (p *Process) getPpid() int32 {
	p.parentMutex.RLock()
	defer p.parentMutex.RUnlock()
	return p.parent
}

// cache Ppid in a thread-safe manner (WINDOWS ONLY)
// see https://psutil.readthedocs.io/en/latest/#psutil.Process.ppid
func (p *Process) setPpid(ppid int32) {
	p.parentMutex.Lock()
	defer p.parentMutex.Unlock()
	p.parent = ppid
}

func getFromSnapProcess(pid int32) (int32, int32, string, error) { //nolint:unparam //FIXME
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, uint32(pid))
	if err != nil {
		return 0, 0, "", err
	}
	defer windows.CloseHandle(snap)
	var pe32 windows.ProcessEntry32
	pe32.Size = uint32(unsafe.Sizeof(pe32))
	if err = windows.Process32First(snap, &pe32); err != nil {
		return 0, 0, "", err
	}
	for {
		if pe32.ProcessID == uint32(pid) {
			szexe := windows.UTF16ToString(pe32.ExeFile[:])
			return int32(pe32.ParentProcessID), int32(pe32.Threads), szexe, nil
		}
		if err = windows.Process32Next(snap, &pe32); err != nil {
			break
		}
	}
	return 0, 0, "", fmt.Errorf("couldn't find pid: %d", pid)
}

func ProcessesWithContext(ctx context.Context) ([]*Process, error) {
	out := []*Process{}

	pids, err := PidsWithContext(ctx)
	if err != nil {
		return out, fmt.Errorf("could not get Processes %w", err)
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

func getRusage(pid int32) (*windows.Rusage, error) {
	var CPU windows.Rusage

	c, err := windows.OpenProcess(processQueryInformation, false, uint32(pid))
	if err != nil {
		return nil, err
	}
	defer windows.CloseHandle(c)

	if err := windows.GetProcessTimes(c, &CPU.CreationTime, &CPU.ExitTime, &CPU.KernelTime, &CPU.UserTime); err != nil {
		return nil, err
	}

	return &CPU, nil
}

func getMemoryInfo(pid int32) (PROCESS_MEMORY_COUNTERS, error) {
	var mem PROCESS_MEMORY_COUNTERS
	c, err := windows.OpenProcess(processQueryInformation, false, uint32(pid))
	if err != nil {
		return mem, err
	}
	defer windows.CloseHandle(c)
	if err := getProcessMemoryInfo(c, &mem); err != nil {
		return mem, err
	}

	return mem, err
}

func getProcessMemoryInfo(h windows.Handle, mem *PROCESS_MEMORY_COUNTERS) (err error) {
	r1, _, e1 := syscall.Syscall(procGetProcessMemoryInfo.Addr(), 3, uintptr(h), uintptr(unsafe.Pointer(mem)), uintptr(unsafe.Sizeof(*mem)))
	if r1 == 0 {
		if e1 != 0 {
			err = error(e1)
		} else {
			err = syscall.EINVAL
		}
	}
	return
}

type SYSTEM_TIMES struct { //nolint:revive //FIXME
	CreateTime syscall.Filetime
	ExitTime   syscall.Filetime
	KernelTime syscall.Filetime
	UserTime   syscall.Filetime
}

func getProcessCPUTimes(pid int32) (SYSTEM_TIMES, error) {
	var times SYSTEM_TIMES

	h, err := windows.OpenProcess(processQueryInformation, false, uint32(pid))
	if err != nil {
		return times, err
	}
	defer windows.CloseHandle(h)

	err = syscall.GetProcessTimes(
		syscall.Handle(h),
		&times.CreateTime,
		&times.ExitTime,
		&times.KernelTime,
		&times.UserTime,
	)

	return times, err
}

func getUserProcessParams32(handle windows.Handle) (rtlUserProcessParameters32, error) {
	pebAddress, err := queryPebAddress(syscall.Handle(handle), true)
	if err != nil {
		return rtlUserProcessParameters32{}, fmt.Errorf("cannot locate process PEB: %w", err)
	}

	buf := readProcessMemory(syscall.Handle(handle), true, pebAddress, uint(unsafe.Sizeof(processEnvironmentBlock32{})))
	if len(buf) != int(unsafe.Sizeof(processEnvironmentBlock32{})) {
		return rtlUserProcessParameters32{}, errors.New("cannot read process PEB")
	}
	peb := (*processEnvironmentBlock32)(unsafe.Pointer(&buf[0]))
	userProcessAddress := uint64(peb.ProcessParameters)
	buf = readProcessMemory(syscall.Handle(handle), true, userProcessAddress, uint(unsafe.Sizeof(rtlUserProcessParameters32{})))
	if len(buf) != int(unsafe.Sizeof(rtlUserProcessParameters32{})) {
		return rtlUserProcessParameters32{}, errors.New("cannot read user process parameters")
	}
	return *(*rtlUserProcessParameters32)(unsafe.Pointer(&buf[0])), nil
}

func getUserProcessParams64(handle windows.Handle) (rtlUserProcessParameters64, error) {
	pebAddress, err := queryPebAddress(syscall.Handle(handle), false)
	if err != nil {
		return rtlUserProcessParameters64{}, fmt.Errorf("cannot locate process PEB: %w", err)
	}

	buf := readProcessMemory(syscall.Handle(handle), false, pebAddress, uint(unsafe.Sizeof(processEnvironmentBlock64{})))
	if len(buf) != int(unsafe.Sizeof(processEnvironmentBlock64{})) {
		return rtlUserProcessParameters64{}, errors.New("cannot read process PEB")
	}
	peb := (*processEnvironmentBlock64)(unsafe.Pointer(&buf[0]))
	userProcessAddress := peb.ProcessParameters
	buf = readProcessMemory(syscall.Handle(handle), false, userProcessAddress, uint(unsafe.Sizeof(rtlUserProcessParameters64{})))
	if len(buf) != int(unsafe.Sizeof(rtlUserProcessParameters64{})) {
		return rtlUserProcessParameters64{}, errors.New("cannot read user process parameters")
	}
	return *(*rtlUserProcessParameters64)(unsafe.Pointer(&buf[0])), nil
}

func is32BitProcess(h windows.Handle) bool {
	const (
		PROCESSOR_ARCHITECTURE_INTEL = 0
		PROCESSOR_ARCHITECTURE_ARM   = 5
		PROCESSOR_ARCHITECTURE_ARM64 = 12
		PROCESSOR_ARCHITECTURE_IA64  = 6
		PROCESSOR_ARCHITECTURE_AMD64 = 9
	)

	var procIs32Bits bool
	switch processorArchitecture {
	case PROCESSOR_ARCHITECTURE_INTEL, PROCESSOR_ARCHITECTURE_ARM:
		procIs32Bits = true
	case PROCESSOR_ARCHITECTURE_ARM64, PROCESSOR_ARCHITECTURE_IA64, PROCESSOR_ARCHITECTURE_AMD64:
		var wow64 uint

		ret, _, _ := common.ProcNtQueryInformationProcess.Call(
			uintptr(h),
			uintptr(common.ProcessWow64Information),
			uintptr(unsafe.Pointer(&wow64)),
			uintptr(unsafe.Sizeof(wow64)),
			uintptr(0),
		)
		if int(ret) >= 0 {
			if wow64 != 0 {
				procIs32Bits = true
			}
		} else {
			// if the OS does not support the call, we fallback into the bitness of the app
			if unsafe.Sizeof(wow64) == 4 {
				procIs32Bits = true
			}
		}

	default:
		// for other unknown platforms, we rely on process platform
		if unsafe.Sizeof(processorArchitecture) == 8 {
			procIs32Bits = false
		} else {
			procIs32Bits = true
		}
	}
	return procIs32Bits
}

func getProcessEnvironmentVariables(ctx context.Context, pid int32) ([]string, error) {
	h, err := windows.OpenProcess(processQueryInformation|windows.PROCESS_VM_READ, false, uint32(pid))
	if errors.Is(err, windows.ERROR_ACCESS_DENIED) || errors.Is(err, windows.ERROR_INVALID_PARAMETER) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer syscall.CloseHandle(syscall.Handle(h))

	procIs32Bits := is32BitProcess(h)

	var processParameterBlockAddress uint64

	if procIs32Bits {
		peb, err := getUserProcessParams32(h)
		if err != nil {
			return nil, err
		}
		processParameterBlockAddress = uint64(peb.EnvironmentAddress)
	} else {
		peb, err := getUserProcessParams64(h)
		if err != nil {
			return nil, err
		}
		processParameterBlockAddress = peb.EnvironmentAddress
	}
	envvarScanner := bufio.NewScanner(&processReader{
		processHandle:  h,
		is32BitProcess: procIs32Bits,
		offset:         processParameterBlockAddress,
	})
	envvarScanner.Split(func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		if atEOF && len(data) == 0 {
			return 0, nil, nil
		}
		// Check for UTF-16 zero character
		for i := 0; i < len(data)-1; i += 2 {
			if data[i] == 0 && data[i+1] == 0 {
				return i + 2, data[0:i], nil
			}
		}
		if atEOF {
			return len(data), data, nil
		}
		// Request more data
		return 0, nil, nil
	})
	var envVars []string
	for envvarScanner.Scan() {
		entry := envvarScanner.Bytes()
		if len(entry) == 0 {
			break // Block is finished
		}
		envVars = append(envVars, convertUTF16ToString(entry))
		select {
		case <-ctx.Done():
			break
		default:
			continue
		}
	}
	if err := envvarScanner.Err(); err != nil {
		return nil, err
	}
	return envVars, nil
}

type processReader struct {
	processHandle  windows.Handle
	is32BitProcess bool
	offset         uint64
}

func (p *processReader) Read(buf []byte) (int, error) {
	processMemory := readProcessMemory(syscall.Handle(p.processHandle), p.is32BitProcess, p.offset, uint(len(buf)))
	if len(processMemory) == 0 {
		return 0, io.EOF
	}
	copy(buf, processMemory)
	p.offset += uint64(len(processMemory))
	return len(processMemory), nil
}

func getProcessCommandLine(pid int32) (string, error) {
	h, err := windows.OpenProcess(processQueryInformation|windows.PROCESS_VM_READ, false, uint32(pid))
	if errors.Is(err, windows.ERROR_ACCESS_DENIED) || errors.Is(err, windows.ERROR_INVALID_PARAMETER) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	defer syscall.CloseHandle(syscall.Handle(h))

	procIs32Bits := is32BitProcess(h)

	if procIs32Bits {
		userProcParams, err := getUserProcessParams32(h)
		if err != nil {
			return "", err
		}
		if userProcParams.CommandLineLength > 0 {
			cmdLine := readProcessMemory(syscall.Handle(h), procIs32Bits, uint64(userProcParams.CommandLineAddress), uint(userProcParams.CommandLineLength))
			if len(cmdLine) != int(userProcParams.CommandLineLength) {
				return "", errors.New("cannot read cmdline")
			}

			return convertUTF16ToString(cmdLine), nil
		}
	} else {
		userProcParams, err := getUserProcessParams64(h)
		if err != nil {
			return "", err
		}
		if userProcParams.CommandLineLength > 0 {
			cmdLine := readProcessMemory(syscall.Handle(h), procIs32Bits, userProcParams.CommandLineAddress, uint(userProcParams.CommandLineLength))
			if len(cmdLine) != int(userProcParams.CommandLineLength) {
				return "", errors.New("cannot read cmdline")
			}

			return convertUTF16ToString(cmdLine), nil
		}
	}

	// if we reach here, we have no command line
	return "", nil
}

func convertUTF16ToString(src []byte) string {
	srcLen := len(src) / 2

	codePoints := make([]uint16, srcLen)

	srcIdx := 0
	for i := 0; i < srcLen; i++ {
		codePoints[i] = uint16(src[srcIdx]) | uint16(src[srcIdx+1])<<8
		srcIdx += 2
	}
	return syscall.UTF16ToString(codePoints)
}
