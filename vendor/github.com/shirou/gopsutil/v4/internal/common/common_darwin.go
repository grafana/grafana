// SPDX-License-Identifier: BSD-3-Clause
//go:build darwin

package common

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"unsafe"

	"github.com/ebitengine/purego"
	"golang.org/x/sys/unix"
)

func DoSysctrlWithContext(ctx context.Context, mib string) ([]string, error) {
	cmd := exec.CommandContext(ctx, "sysctl", "-n", mib)
	cmd.Env = getSysctrlEnv(os.Environ())
	out, err := cmd.Output()
	if err != nil {
		return []string{}, err
	}
	v := strings.Replace(string(out), "{ ", "", 1)
	v = strings.Replace(string(v), " }", "", 1)
	values := strings.Fields(string(v))

	return values, nil
}

func CallSyscall(mib []int32) ([]byte, uint64, error) {
	miblen := uint64(len(mib))

	// get required buffer size
	length := uint64(0)
	_, _, err := unix.Syscall6(
		202, // unix.SYS___SYSCTL https://github.com/golang/sys/blob/76b94024e4b621e672466e8db3d7f084e7ddcad2/unix/zsysnum_darwin_amd64.go#L146
		uintptr(unsafe.Pointer(&mib[0])),
		uintptr(miblen),
		0,
		uintptr(unsafe.Pointer(&length)),
		0,
		0)
	if err != 0 {
		var b []byte
		return b, length, err
	}
	if length == 0 {
		var b []byte
		return b, length, err
	}
	// get proc info itself
	buf := make([]byte, length)
	_, _, err = unix.Syscall6(
		202, // unix.SYS___SYSCTL https://github.com/golang/sys/blob/76b94024e4b621e672466e8db3d7f084e7ddcad2/unix/zsysnum_darwin_amd64.go#L146
		uintptr(unsafe.Pointer(&mib[0])),
		uintptr(miblen),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&length)),
		0,
		0)
	if err != 0 {
		return buf, length, err
	}

	return buf, length, nil
}

// Library represents a dynamic library loaded by purego.
type Library struct {
	addr  uintptr
	path  string
	close func()
}

// library paths
const (
	IOKit          = "/System/Library/Frameworks/IOKit.framework/IOKit"
	CoreFoundation = "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation"
	System         = "/usr/lib/libSystem.B.dylib"
)

func NewLibrary(path string) (*Library, error) {
	lib, err := purego.Dlopen(path, purego.RTLD_LAZY|purego.RTLD_GLOBAL)
	if err != nil {
		return nil, err
	}

	closeFunc := func() {
		purego.Dlclose(lib)
	}

	return &Library{
		addr:  lib,
		path:  path,
		close: closeFunc,
	}, nil
}

func (lib *Library) Dlsym(symbol string) (uintptr, error) {
	return purego.Dlsym(lib.addr, symbol)
}

func GetFunc[T any](lib *Library, symbol string) T {
	var fptr T
	purego.RegisterLibFunc(&fptr, lib.addr, symbol)
	return fptr
}

func (lib *Library) Close() {
	lib.close()
}

// status codes
const (
	KERN_SUCCESS = 0
)

// IOKit functions and symbols.
type (
	IOServiceGetMatchingServiceFunc       func(mainPort uint32, matching uintptr) uint32
	IOServiceGetMatchingServicesFunc      func(mainPort uint32, matching uintptr, existing *uint32) int
	IOServiceMatchingFunc                 func(name string) unsafe.Pointer
	IOServiceOpenFunc                     func(service, owningTask, connType uint32, connect *uint32) int
	IOServiceCloseFunc                    func(connect uint32) int
	IOIteratorNextFunc                    func(iterator uint32) uint32
	IORegistryEntryGetNameFunc            func(entry uint32, name CStr) int
	IORegistryEntryGetParentEntryFunc     func(entry uint32, plane string, parent *uint32) int
	IORegistryEntryCreateCFPropertyFunc   func(entry uint32, key, allocator uintptr, options uint32) unsafe.Pointer
	IORegistryEntryCreateCFPropertiesFunc func(entry uint32, properties unsafe.Pointer, allocator uintptr, options uint32) int
	IOObjectConformsToFunc                func(object uint32, className string) bool
	IOObjectReleaseFunc                   func(object uint32) int
	IOConnectCallStructMethodFunc         func(connection, selector uint32, inputStruct, inputStructCnt, outputStruct uintptr, outputStructCnt *uintptr) int

	IOHIDEventSystemClientCreateFunc      func(allocator uintptr) unsafe.Pointer
	IOHIDEventSystemClientSetMatchingFunc func(client, match uintptr) int
	IOHIDServiceClientCopyEventFunc       func(service uintptr, eventType int64,
		options int32, timeout int64) unsafe.Pointer
	IOHIDServiceClientCopyPropertyFunc     func(service, property uintptr) unsafe.Pointer
	IOHIDEventGetFloatValueFunc            func(event uintptr, field int32) float64
	IOHIDEventSystemClientCopyServicesFunc func(client uintptr) unsafe.Pointer
)

const (
	IOServiceGetMatchingServiceSym       = "IOServiceGetMatchingService"
	IOServiceGetMatchingServicesSym      = "IOServiceGetMatchingServices"
	IOServiceMatchingSym                 = "IOServiceMatching"
	IOServiceOpenSym                     = "IOServiceOpen"
	IOServiceCloseSym                    = "IOServiceClose"
	IOIteratorNextSym                    = "IOIteratorNext"
	IORegistryEntryGetNameSym            = "IORegistryEntryGetName"
	IORegistryEntryGetParentEntrySym     = "IORegistryEntryGetParentEntry"
	IORegistryEntryCreateCFPropertySym   = "IORegistryEntryCreateCFProperty"
	IORegistryEntryCreateCFPropertiesSym = "IORegistryEntryCreateCFProperties"
	IOObjectConformsToSym                = "IOObjectConformsTo"
	IOObjectReleaseSym                   = "IOObjectRelease"
	IOConnectCallStructMethodSym         = "IOConnectCallStructMethod"

	IOHIDEventSystemClientCreateSym       = "IOHIDEventSystemClientCreate"
	IOHIDEventSystemClientSetMatchingSym  = "IOHIDEventSystemClientSetMatching"
	IOHIDServiceClientCopyEventSym        = "IOHIDServiceClientCopyEvent"
	IOHIDServiceClientCopyPropertySym     = "IOHIDServiceClientCopyProperty"
	IOHIDEventGetFloatValueSym            = "IOHIDEventGetFloatValue"
	IOHIDEventSystemClientCopyServicesSym = "IOHIDEventSystemClientCopyServices"
)

const (
	KIOMainPortDefault = 0

	KIOHIDEventTypeTemperature = 15

	KNilOptions = 0
)

const (
	KIOMediaWholeKey = "Media"
	KIOServicePlane  = "IOService"
)

// CoreFoundation functions and symbols.
type (
	CFGetTypeIDFunc        func(cf uintptr) int32
	CFNumberCreateFunc     func(allocator uintptr, theType int32, valuePtr uintptr) unsafe.Pointer
	CFNumberGetValueFunc   func(num uintptr, theType int32, valuePtr uintptr) bool
	CFDictionaryCreateFunc func(allocator uintptr, keys, values *unsafe.Pointer, numValues int32,
		keyCallBacks, valueCallBacks uintptr) unsafe.Pointer
	CFDictionaryAddValueFunc      func(theDict, key, value uintptr)
	CFDictionaryGetValueFunc      func(theDict, key uintptr) unsafe.Pointer
	CFArrayGetCountFunc           func(theArray uintptr) int32
	CFArrayGetValueAtIndexFunc    func(theArray uintptr, index int32) unsafe.Pointer
	CFStringCreateMutableFunc     func(alloc uintptr, maxLength int32) unsafe.Pointer
	CFStringGetLengthFunc         func(theString uintptr) int32
	CFStringGetCStringFunc        func(theString uintptr, buffer CStr, bufferSize int32, encoding uint32)
	CFStringCreateWithCStringFunc func(alloc uintptr, cStr string, encoding uint32) unsafe.Pointer
	CFDataGetLengthFunc           func(theData uintptr) int32
	CFDataGetBytePtrFunc          func(theData uintptr) unsafe.Pointer
	CFReleaseFunc                 func(cf uintptr)
)

const (
	CFGetTypeIDSym               = "CFGetTypeID"
	CFNumberCreateSym            = "CFNumberCreate"
	CFNumberGetValueSym          = "CFNumberGetValue"
	CFDictionaryCreateSym        = "CFDictionaryCreate"
	CFDictionaryAddValueSym      = "CFDictionaryAddValue"
	CFDictionaryGetValueSym      = "CFDictionaryGetValue"
	CFArrayGetCountSym           = "CFArrayGetCount"
	CFArrayGetValueAtIndexSym    = "CFArrayGetValueAtIndex"
	CFStringCreateMutableSym     = "CFStringCreateMutable"
	CFStringGetLengthSym         = "CFStringGetLength"
	CFStringGetCStringSym        = "CFStringGetCString"
	CFStringCreateWithCStringSym = "CFStringCreateWithCString"
	CFDataGetLengthSym           = "CFDataGetLength"
	CFDataGetBytePtrSym          = "CFDataGetBytePtr"
	CFReleaseSym                 = "CFRelease"
)

const (
	KCFStringEncodingUTF8 = 0x08000100
	KCFNumberSInt64Type   = 4
	KCFNumberIntType      = 9
	KCFAllocatorDefault   = 0
)

// Kernel functions and symbols.
type MachTimeBaseInfo struct {
	Numer uint32
	Denom uint32
}

type (
	HostProcessorInfoFunc func(host uint32, flavor int32, outProcessorCount *uint32, outProcessorInfo uintptr,
		outProcessorInfoCnt *uint32) int
	HostStatisticsFunc   func(host uint32, flavor int32, hostInfoOut uintptr, hostInfoOutCnt *uint32) int
	MachHostSelfFunc     func() uint32
	MachTaskSelfFunc     func() uint32
	MachTimeBaseInfoFunc func(info uintptr) int
	VMDeallocateFunc     func(targetTask uint32, vmAddress, vmSize uintptr) int
)

const (
	HostProcessorInfoSym = "host_processor_info"
	HostStatisticsSym    = "host_statistics"
	MachHostSelfSym      = "mach_host_self"
	MachTaskSelfSym      = "mach_task_self"
	MachTimeBaseInfoSym  = "mach_timebase_info"
	VMDeallocateSym      = "vm_deallocate"
)

const (
	CTL_KERN       = 1
	KERN_ARGMAX    = 8
	KERN_PROCARGS2 = 49

	HOST_VM_INFO       = 2
	HOST_CPU_LOAD_INFO = 3

	HOST_VM_INFO_COUNT = 0xf
)

// System functions and symbols.
type (
	ProcPidPathFunc func(pid int32, buffer uintptr, bufferSize uint32) int32
	ProcPidInfoFunc func(pid, flavor int32, arg uint64, buffer uintptr, bufferSize int32) int32
)

const (
	SysctlSym      = "sysctl"
	ProcPidPathSym = "proc_pidpath"
	ProcPidInfoSym = "proc_pidinfo"
)

const (
	MAXPATHLEN               = 1024
	PROC_PIDPATHINFO_MAXSIZE = 4 * MAXPATHLEN
	PROC_PIDTASKINFO         = 4
	PROC_PIDVNODEPATHINFO    = 9
)

// SMC represents a SMC instance.
type SMC struct {
	lib        *Library
	conn       uint32
	callStruct IOConnectCallStructMethodFunc
}

const ioServiceSMC = "AppleSMC"

const (
	KSMCUserClientOpen  = 0
	KSMCUserClientClose = 1
	KSMCHandleYPCEvent  = 2
	KSMCReadKey         = 5
	KSMCWriteKey        = 6
	KSMCGetKeyCount     = 7
	KSMCGetKeyFromIndex = 8
	KSMCGetKeyInfo      = 9
)

const (
	KSMCSuccess     = 0
	KSMCError       = 1
	KSMCKeyNotFound = 132
)

func NewSMC(ioKit *Library) (*SMC, error) {
	if ioKit.path != IOKit {
		return nil, errors.New("library is not IOKit")
	}

	ioServiceGetMatchingService := GetFunc[IOServiceGetMatchingServiceFunc](ioKit, IOServiceGetMatchingServiceSym)
	ioServiceMatching := GetFunc[IOServiceMatchingFunc](ioKit, IOServiceMatchingSym)
	ioServiceOpen := GetFunc[IOServiceOpenFunc](ioKit, IOServiceOpenSym)
	ioObjectRelease := GetFunc[IOObjectReleaseFunc](ioKit, IOObjectReleaseSym)
	machTaskSelf := GetFunc[MachTaskSelfFunc](ioKit, MachTaskSelfSym)

	ioConnectCallStructMethod := GetFunc[IOConnectCallStructMethodFunc](ioKit, IOConnectCallStructMethodSym)

	service := ioServiceGetMatchingService(0, uintptr(ioServiceMatching(ioServiceSMC)))
	if service == 0 {
		return nil, fmt.Errorf("ERROR: %s NOT FOUND", ioServiceSMC)
	}

	var conn uint32
	if result := ioServiceOpen(service, machTaskSelf(), 0, &conn); result != 0 {
		return nil, errors.New("ERROR: IOServiceOpen failed")
	}

	ioObjectRelease(service)
	return &SMC{
		lib:        ioKit,
		conn:       conn,
		callStruct: ioConnectCallStructMethod,
	}, nil
}

func (s *SMC) CallStruct(selector uint32, inputStruct, inputStructCnt, outputStruct uintptr, outputStructCnt *uintptr) int {
	return s.callStruct(s.conn, selector, inputStruct, inputStructCnt, outputStruct, outputStructCnt)
}

func (s *SMC) Close() error {
	ioServiceClose := GetFunc[IOServiceCloseFunc](s.lib, IOServiceCloseSym)

	if result := ioServiceClose(s.conn); result != 0 {
		return errors.New("ERROR: IOServiceClose failed")
	}
	return nil
}

type CStr []byte

func NewCStr(length int32) CStr {
	return make(CStr, length)
}

func (s CStr) Length() int32 {
	// Include null terminator to make CFStringGetCString properly functions
	return int32(len(s)) + 1
}

func (s CStr) Ptr() *byte {
	if len(s) < 1 {
		return nil
	}

	return &s[0]
}

func (s CStr) Addr() uintptr {
	return uintptr(unsafe.Pointer(s.Ptr()))
}

func (s CStr) GoString() string {
	if s == nil {
		return ""
	}

	var length int
	for _, char := range s {
		if char == '\x00' {
			break
		}
		length++
	}
	return string(s[:length])
}

// https://github.com/ebitengine/purego/blob/main/internal/strings/strings.go#L26
func GoString(cStr *byte) string {
	if cStr == nil {
		return ""
	}
	var length int
	for {
		if *(*byte)(unsafe.Add(unsafe.Pointer(cStr), uintptr(length))) == '\x00' {
			break
		}
		length++
	}
	return string(unsafe.Slice(cStr, length))
}
