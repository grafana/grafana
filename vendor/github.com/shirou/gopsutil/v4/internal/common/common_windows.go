// SPDX-License-Identifier: BSD-3-Clause
//go:build windows

package common

import (
	"context"
	"fmt"
	"path/filepath"
	"reflect"
	"strings"
	"syscall"
	"unsafe"

	"github.com/yusufpapurcu/wmi"
	"golang.org/x/sys/windows"
)

// for double values
type PDH_FMT_COUNTERVALUE_DOUBLE struct { //nolint:revive //FIXME
	CStatus     uint32
	DoubleValue float64
}

// for 64 bit integer values
type PDH_FMT_COUNTERVALUE_LARGE struct { //nolint:revive //FIXME
	CStatus    uint32
	LargeValue int64
}

// for long values
type PDH_FMT_COUNTERVALUE_LONG struct { //nolint:revive //FIXME
	CStatus   uint32
	LongValue int32
	padding   [4]byte
}

// windows system const
const (
	ERROR_SUCCESS        = 0
	ERROR_FILE_NOT_FOUND = 2
	DRIVE_REMOVABLE      = 2
	DRIVE_FIXED          = 3
	HKEY_LOCAL_MACHINE   = 0x80000002
	RRF_RT_REG_SZ        = 0x00000002
	RRF_RT_REG_DWORD     = 0x00000010
	PDH_FMT_LONG         = 0x00000100
	PDH_FMT_DOUBLE       = 0x00000200
	PDH_FMT_LARGE        = 0x00000400
	PDH_INVALID_DATA     = 0xc0000bc6
	PDH_INVALID_HANDLE   = 0xC0000bbc
	PDH_NO_DATA          = 0x800007d5

	STATUS_BUFFER_OVERFLOW      = 0x80000005
	STATUS_BUFFER_TOO_SMALL     = 0xC0000023
	STATUS_INFO_LENGTH_MISMATCH = 0xC0000004
)

const (
	ProcessBasicInformation = 0
	ProcessWow64Information = 26
	ProcessQueryInformation = windows.PROCESS_DUP_HANDLE | windows.PROCESS_QUERY_INFORMATION

	SystemExtendedHandleInformationClass = 64
)

var (
	Modkernel32 = windows.NewLazySystemDLL("kernel32.dll")
	ModNt       = windows.NewLazySystemDLL("ntdll.dll")
	ModPdh      = windows.NewLazySystemDLL("pdh.dll")
	ModPsapi    = windows.NewLazySystemDLL("psapi.dll")

	ProcGetSystemTimes                   = Modkernel32.NewProc("GetSystemTimes")
	ProcNtQuerySystemInformation         = ModNt.NewProc("NtQuerySystemInformation")
	ProcRtlGetNativeSystemInformation    = ModNt.NewProc("RtlGetNativeSystemInformation")
	ProcRtlNtStatusToDosError            = ModNt.NewProc("RtlNtStatusToDosError")
	ProcNtQueryInformationProcess        = ModNt.NewProc("NtQueryInformationProcess")
	ProcNtReadVirtualMemory              = ModNt.NewProc("NtReadVirtualMemory")
	ProcNtWow64QueryInformationProcess64 = ModNt.NewProc("NtWow64QueryInformationProcess64")
	ProcNtWow64ReadVirtualMemory64       = ModNt.NewProc("NtWow64ReadVirtualMemory64")

	PdhOpenQuery                = ModPdh.NewProc("PdhOpenQuery")
	PdhAddEnglishCounterW       = ModPdh.NewProc("PdhAddEnglishCounterW")
	PdhCollectQueryData         = ModPdh.NewProc("PdhCollectQueryData")
	PdhGetFormattedCounterValue = ModPdh.NewProc("PdhGetFormattedCounterValue")
	PdhCloseQuery               = ModPdh.NewProc("PdhCloseQuery")

	procQueryDosDeviceW = Modkernel32.NewProc("QueryDosDeviceW")
)

type FILETIME struct {
	DwLowDateTime  uint32
	DwHighDateTime uint32
}

// borrowed from net/interface_windows.go
func BytePtrToString(p *uint8) string {
	a := (*[10000]uint8)(unsafe.Pointer(p))
	i := 0
	for a[i] != 0 {
		i++
	}
	return string(a[:i])
}

// CounterInfo struct is used to track a windows performance counter
// copied from https://github.com/mackerelio/mackerel-agent/
type CounterInfo struct {
	PostName    string
	CounterName string
	Counter     windows.Handle
}

// CreateQuery with a PdhOpenQuery call
// copied from https://github.com/mackerelio/mackerel-agent/
func CreateQuery() (windows.Handle, error) {
	var query windows.Handle
	r, _, err := PdhOpenQuery.Call(0, 0, uintptr(unsafe.Pointer(&query)))
	if r != 0 {
		return 0, err
	}
	return query, nil
}

// CreateCounter with a PdhAddEnglishCounterW call
func CreateCounter(query windows.Handle, pname, cname string) (*CounterInfo, error) {
	var counter windows.Handle
	r, _, err := PdhAddEnglishCounterW.Call(
		uintptr(query),
		uintptr(unsafe.Pointer(windows.StringToUTF16Ptr(cname))),
		0,
		uintptr(unsafe.Pointer(&counter)))
	if r != 0 {
		return nil, err
	}
	return &CounterInfo{
		PostName:    pname,
		CounterName: cname,
		Counter:     counter,
	}, nil
}

// GetCounterValue get counter value from handle
// adapted from https://github.com/mackerelio/mackerel-agent/
func GetCounterValue(counter windows.Handle) (float64, error) {
	var value PDH_FMT_COUNTERVALUE_DOUBLE
	r, _, err := PdhGetFormattedCounterValue.Call(uintptr(counter), PDH_FMT_DOUBLE, uintptr(0), uintptr(unsafe.Pointer(&value)))
	if r != 0 && r != PDH_INVALID_DATA {
		return 0.0, err
	}
	return value.DoubleValue, nil
}

type Win32PerformanceCounter struct {
	PostName    string
	CounterName string
	Query       windows.Handle
	Counter     windows.Handle
}

func NewWin32PerformanceCounter(postName, counterName string) (*Win32PerformanceCounter, error) {
	query, err := CreateQuery()
	if err != nil {
		return nil, err
	}
	counter := Win32PerformanceCounter{
		Query:       query,
		PostName:    postName,
		CounterName: counterName,
	}
	r, _, err := PdhAddEnglishCounterW.Call(
		uintptr(counter.Query),
		uintptr(unsafe.Pointer(windows.StringToUTF16Ptr(counter.CounterName))),
		0,
		uintptr(unsafe.Pointer(&counter.Counter)),
	)
	if r != 0 {
		return nil, err
	}
	return &counter, nil
}

func (w *Win32PerformanceCounter) GetValue() (float64, error) {
	r, _, err := PdhCollectQueryData.Call(uintptr(w.Query))
	if r != 0 && err != nil {
		if r == PDH_NO_DATA {
			return 0.0, fmt.Errorf("%w: this counter has not data", err)
		}
		return 0.0, err
	}

	return GetCounterValue(w.Counter)
}

func ProcessorQueueLengthCounter() (*Win32PerformanceCounter, error) {
	return NewWin32PerformanceCounter("processor_queue_length", `\System\Processor Queue Length`)
}

// WMIQueryWithContext - wraps wmi.Query with a timed-out context to avoid hanging
func WMIQueryWithContext(ctx context.Context, query string, dst any, connectServerArgs ...any) error {
	if _, ok := ctx.Deadline(); !ok {
		ctxTimeout, cancel := context.WithTimeout(ctx, Timeout)
		defer cancel()
		ctx = ctxTimeout
	}

	errChan := make(chan error, 1)
	go func() {
		errChan <- wmi.Query(query, dst, connectServerArgs...)
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errChan:
		return err
	}
}

// Convert paths using native DOS format like:
//
//	"\Device\HarddiskVolume1\Windows\systemew\file.txt"
//
// into:
//
//	"C:\Windows\systemew\file.txt"
func ConvertDOSPath(p string) string {
	rawDrive := strings.Join(strings.Split(p, `\`)[:3], `\`)

	for d := 'A'; d <= 'Z'; d++ {
		szDeviceName := string(d) + ":"
		szTarget := make([]uint16, 512)
		ret, _, _ := procQueryDosDeviceW.Call(uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(szDeviceName))),
			uintptr(unsafe.Pointer(&szTarget[0])),
			uintptr(len(szTarget)))
		if ret != 0 && windows.UTF16ToString(szTarget) == rawDrive {
			return filepath.Join(szDeviceName, p[len(rawDrive):])
		}
	}
	return p
}

type NtStatus uint32

func (s NtStatus) Error() error {
	if s == 0 {
		return nil
	}
	return fmt.Errorf("NtStatus 0x%08x", uint32(s))
}

func (s NtStatus) IsError() bool {
	return s>>30 == 3
}

type SystemExtendedHandleTableEntryInformation struct {
	Object                uintptr
	UniqueProcessId       uintptr
	HandleValue           uintptr
	GrantedAccess         uint32
	CreatorBackTraceIndex uint16
	ObjectTypeIndex       uint16
	HandleAttributes      uint32
	Reserved              uint32
}

type SystemExtendedHandleInformation struct {
	NumberOfHandles uintptr
	Reserved        uintptr
	Handles         [1]SystemExtendedHandleTableEntryInformation
}

// CallWithExpandingBuffer https://github.com/hillu/go-ntdll
func CallWithExpandingBuffer(fn func() NtStatus, buf *[]byte, resultLength *uint32) NtStatus {
	for {
		st := fn()
		if st == STATUS_BUFFER_OVERFLOW || st == STATUS_BUFFER_TOO_SMALL || st == STATUS_INFO_LENGTH_MISMATCH {
			if int(*resultLength) <= cap(*buf) {
				(*reflect.SliceHeader)(unsafe.Pointer(buf)).Len = int(*resultLength)
			} else {
				*buf = make([]byte, int(*resultLength))
			}
			continue
		}
		if !st.IsError() {
			*buf = (*buf)[:int(*resultLength)]
		}
		return st
	}
}

func NtQuerySystemInformation(
	SystemInformationClass uint32,
	SystemInformation *byte,
	SystemInformationLength uint32,
	ReturnLength *uint32,
) NtStatus {
	r0, _, _ := ProcNtQuerySystemInformation.Call(
		uintptr(SystemInformationClass),
		uintptr(unsafe.Pointer(SystemInformation)),
		uintptr(SystemInformationLength),
		uintptr(unsafe.Pointer(ReturnLength)))
	return NtStatus(r0)
}
