// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package libc // import "modernc.org/libc"

import (
	"errors"
	"fmt"
	"golang.org/x/sys/windows"
	"math"
	mbits "math/bits"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"runtime/debug"
	"strings"
	"sync"
	"sync/atomic"
	gotime "time"
	"unicode"
	"unicode/utf16"
	"unsafe"

	"github.com/ncruces/go-strftime"
	"modernc.org/libc/errno"
	"modernc.org/libc/fcntl"
	"modernc.org/libc/limits"
	"modernc.org/libc/stdio"
	"modernc.org/libc/sys/stat"
	"modernc.org/libc/sys/types"
	"modernc.org/libc/time"
	"modernc.org/libc/unistd"
)

// Keep these outside of the var block otherwise go generate will miss them.
var X__imp__environ = EnvironP()
var X__imp__wenviron = uintptr(unsafe.Pointer(&wenviron))
var X_imp___environ = EnvironP()
var X_imp___wenviron = uintptr(unsafe.Pointer(&wenviron))
var X_iob [stdio.X_IOB_ENTRIES]stdio.FILE
var Xin6addr_any [16]byte
var Xtimezone long // extern long timezone;

type Tsize_t = types.Size_t

var (
	iobMap     = map[uintptr]int32{} // &_iob[fd] -> fd
	wenvValid  bool
	wenviron   uintptr // &winEnviron[0]
	winEnviron = []uintptr{0}
)

func init() {
	for i := range X_iob {
		iobMap[uintptr(unsafe.Pointer(&X_iob[i]))] = int32(i)
	}
}

func X__p__wenviron(t *TLS) uintptr {
	if !wenvValid {
		bootWinEnviron(t)
	}
	return uintptr(unsafe.Pointer(&wenviron))
}

func winGetObject(stream uintptr) interface{} {
	if fd, ok := iobMap[stream]; ok {
		f, _ := fdToFile(fd)
		return f
	}

	return getObject(stream)
}

type (
	syscallErrno = windows.Errno
	long         = int32
	ulong        = uint32
)

var (
	modkernel32 = windows.NewLazySystemDLL("kernel32.dll")
	//--
	procAreFileApisANSI            = modkernel32.NewProc("AreFileApisANSI")
	procCopyFileW                  = modkernel32.NewProc("CopyFileW")
	procCreateEventA               = modkernel32.NewProc("CreateEventA")
	procCreateEventW               = modkernel32.NewProc("CreateEventW")
	procCreateFileA                = modkernel32.NewProc("CreateFileA")
	procCreateFileMappingW         = modkernel32.NewProc("CreateFileMappingW")
	procCreateFileW                = modkernel32.NewProc("CreateFileW")
	procCreateHardLinkW            = modkernel32.NewProc("CreateHardLinkW")
	procCreatePipe                 = modkernel32.NewProc("CreatePipe")
	procCreateProcessA             = modkernel32.NewProc("CreateProcessA")
	procCreateProcessW             = modkernel32.NewProc("CreateProcessW")
	procCreateThread               = modkernel32.NewProc("CreateThread")
	procDeleteCriticalSection      = modkernel32.NewProc("DeleteCriticalSection")
	procDeviceIoControl            = modkernel32.NewProc("DeviceIoControl")
	procDuplicateHandle            = modkernel32.NewProc("DuplicateHandle")
	procEnterCriticalSection       = modkernel32.NewProc("EnterCriticalSection")
	procFindClose                  = modkernel32.NewProc("FindClose")
	procFindFirstFileExW           = modkernel32.NewProc("FindFirstFileExW")
	procFindFirstFileW             = modkernel32.NewProc("FindFirstFileW")
	procFindNextFileW              = modkernel32.NewProc("FindNextFileW")
	procFormatMessageW             = modkernel32.NewProc("FormatMessageW")
	procGetACP                     = modkernel32.NewProc("GetACP")
	procGetCommState               = modkernel32.NewProc("GetCommState")
	procGetComputerNameExW         = modkernel32.NewProc("GetComputerNameExW")
	procGetConsoleCP               = modkernel32.NewProc("GetConsoleCP")
	procGetConsoleScreenBufferInfo = modkernel32.NewProc("GetConsoleScreenBufferInfo")
	procGetCurrentProcess          = modkernel32.NewProc("GetCurrentProcess")
	procGetCurrentProcessId        = modkernel32.NewProc("GetCurrentProcessId")
	procGetCurrentThread           = modkernel32.NewProc("GetCurrentThread")
	procGetCurrentThreadId         = modkernel32.NewProc("GetCurrentThreadId")
	procGetEnvironmentVariableA    = modkernel32.NewProc("GetEnvironmentVariableA")
	procGetEnvironmentVariableW    = modkernel32.NewProc("GetEnvironmentVariableW")
	procGetExitCodeProcess         = modkernel32.NewProc("GetExitCodeProcess")
	procGetExitCodeThread          = modkernel32.NewProc("GetExitCodeThread")
	procGetFileAttributesA         = modkernel32.NewProc("GetFileAttributesA")
	procGetFileAttributesExA       = modkernel32.NewProc("GetFileAttributesExA")
	procGetFileAttributesExW       = modkernel32.NewProc("GetFileAttributesExW")
	procGetFileInformationByHandle = modkernel32.NewProc("GetFileInformationByHandle")
	procGetFileSize                = modkernel32.NewProc("GetFileSize")
	procGetFullPathNameW           = modkernel32.NewProc("GetFullPathNameW")
	procGetLastError               = modkernel32.NewProc("GetLastError")
	procGetLogicalDriveStringsA    = modkernel32.NewProc("GetLogicalDriveStringsA")
	procGetModuleFileNameW         = modkernel32.NewProc("GetModuleFileNameW")
	procGetModuleHandleA           = modkernel32.NewProc("GetModuleHandleA")
	procGetModuleHandleW           = modkernel32.NewProc("GetModuleHandleW")
	procGetPrivateProfileStringA   = modkernel32.NewProc("GetPrivateProfileStringA")
	procGetProcAddress             = modkernel32.NewProc("GetProcAddress")
	procGetProcessHeap             = modkernel32.NewProc("GetProcessHeap")
	procGetSystemInfo              = modkernel32.NewProc("GetSystemInfo")
	procGetSystemTime              = modkernel32.NewProc("GetSystemTime")
	procGetSystemTimeAsFileTime    = modkernel32.NewProc("GetSystemTimeAsFileTime")
	procGetTempFileNameW           = modkernel32.NewProc("GetTempFileNameW")
	procGetTickCount               = modkernel32.NewProc("GetTickCount")
	procGetVersionExA              = modkernel32.NewProc("GetVersionExA")
	procGetVersionExW              = modkernel32.NewProc("GetVersionExW")
	procGetVolumeInformationA      = modkernel32.NewProc("GetVolumeInformationA")
	procGetVolumeInformationW      = modkernel32.NewProc("GetVolumeInformationW")
	procHeapAlloc                  = modkernel32.NewProc("HeapAlloc")
	procHeapFree                   = modkernel32.NewProc("HeapFree")
	procInitializeCriticalSection  = modkernel32.NewProc("InitializeCriticalSection")
	procLeaveCriticalSection       = modkernel32.NewProc("LeaveCriticalSection")
	procLockFile                   = modkernel32.NewProc("LockFile")
	procLockFileEx                 = modkernel32.NewProc("LockFileEx")
	procLstrlenW                   = modkernel32.NewProc("lstrlenW")
	procMapViewOfFile              = modkernel32.NewProc("MapViewOfFile")
	procMoveFileW                  = modkernel32.NewProc("MoveFileW")
	procMultiByteToWideChar        = modkernel32.NewProc("MultiByteToWideChar")
	procOpenEventA                 = modkernel32.NewProc("OpenEventA")
	procOpenProcessToken           = modkernel32.NewProc("OpenProcessToken")
	procPeekConsoleInputW          = modkernel32.NewProc("PeekConsoleInputW")
	procPeekNamedPipe              = modkernel32.NewProc("PeekNamedPipe")
	procQueryPerformanceCounter    = modkernel32.NewProc("QueryPerformanceCounter")
	procQueryPerformanceFrequency  = modkernel32.NewProc("QueryPerformanceFrequency")
	procReadConsoleW               = modkernel32.NewProc("ReadConsoleW")
	procReadFile                   = modkernel32.NewProc("ReadFile")
	procResetEvent                 = modkernel32.NewProc("ResetEvent")
	procSearchPathW                = modkernel32.NewProc("SearchPathW")
	procSetConsoleCtrlHandler      = modkernel32.NewProc("SetConsoleCtrlHandler")
	procSetConsoleMode             = modkernel32.NewProc("SetConsoleMode")
	procSetConsoleTextAttribute    = modkernel32.NewProc("SetConsoleTextAttribute")
	procSetEvent                   = modkernel32.NewProc("SetEvent")
	procSetFilePointer             = modkernel32.NewProc("SetFilePointer")
	procSetFileTime                = modkernel32.NewProc("SetFileTime")
	procSleepEx                    = modkernel32.NewProc("SleepEx")
	procSystemTimeToFileTime       = modkernel32.NewProc("SystemTimeToFileTime")
	procTerminateThread            = modkernel32.NewProc("TerminateThread")
	procTryEnterCriticalSection    = modkernel32.NewProc("TryEnterCriticalSection")
	procUnlockFile                 = modkernel32.NewProc("UnlockFile")
	procUnlockFileEx               = modkernel32.NewProc("UnlockFileEx")
	procWaitForSingleObjectEx      = modkernel32.NewProc("WaitForSingleObjectEx")
	procWideCharToMultiByte        = modkernel32.NewProc("WideCharToMultiByte")
	procWriteConsoleA              = modkernel32.NewProc("WriteConsoleA")
	procWriteConsoleW              = modkernel32.NewProc("WriteConsoleW")
	procWriteFile                  = modkernel32.NewProc("WriteFile")

	//	procSetConsoleCP               = modkernel32.NewProc("SetConsoleCP")
	//	procSetThreadPriority          = modkernel32.NewProc("SetThreadPriority")
	//--

	modadvapi = windows.NewLazySystemDLL("advapi32.dll")
	//--
	procAccessCheck                = modadvapi.NewProc("AccessCheck")
	procAddAce                     = modadvapi.NewProc("AddAce")
	procEqualSid                   = modadvapi.NewProc("EqualSid")
	procGetAce                     = modadvapi.NewProc("GetAce")
	procGetAclInformation          = modadvapi.NewProc("GetAclInformation")
	procGetFileSecurityA           = modadvapi.NewProc("GetFileSecurityA")
	procGetFileSecurityW           = modadvapi.NewProc("GetFileSecurityW")
	procGetLengthSid               = modadvapi.NewProc("GetLengthSid")
	procGetNamedSecurityInfoW      = modadvapi.NewProc("GetNamedSecurityInfoW")
	procGetSecurityDescriptorDacl  = modadvapi.NewProc("GetSecurityDescriptorDacl")
	procGetSecurityDescriptorOwner = modadvapi.NewProc("GetSecurityDescriptorOwner")
	procGetSidIdentifierAuthority  = modadvapi.NewProc("GetSidIdentifierAuthority")
	procGetSidLengthRequired       = modadvapi.NewProc("GetSidLengthRequired")
	procGetSidSubAuthority         = modadvapi.NewProc("GetSidSubAuthority")
	procGetTokenInformation        = modadvapi.NewProc("GetTokenInformation")
	procImpersonateSelf            = modadvapi.NewProc("ImpersonateSelf")
	procInitializeAcl              = modadvapi.NewProc("InitializeAcl")
	procInitializeSid              = modadvapi.NewProc("InitializeSid")
	procOpenThreadToken            = modadvapi.NewProc("OpenThreadToken")
	procRevertToSelf               = modadvapi.NewProc("RevertToSelf")
	//--

	modws2_32 = windows.NewLazySystemDLL("ws2_32.dll")
	//--
	procWSAStartup = modws2_32.NewProc("WSAStartup")
	//--

	moduser32 = windows.NewLazySystemDLL("user32.dll")
	//--
	procCharLowerW                  = moduser32.NewProc("CharLowerW")
	procCreateWindowExW             = moduser32.NewProc("CreateWindowExW")
	procMsgWaitForMultipleObjectsEx = moduser32.NewProc("MsgWaitForMultipleObjectsEx")
	procPeekMessageW                = moduser32.NewProc("PeekMessageW")
	procRegisterClassW              = moduser32.NewProc("RegisterClassW")
	procUnregisterClassW            = moduser32.NewProc("UnregisterClassW")
	procWaitForInputIdle            = moduser32.NewProc("WaitForInputIdle")
	//--

	netapi             = windows.NewLazySystemDLL("netapi32.dll")
	procNetGetDCName   = netapi.NewProc("NetGetDCName")
	procNetUserGetInfo = netapi.NewProc("NetUserGetInfo")

	userenvapi                = windows.NewLazySystemDLL("userenv.dll")
	procGetProfilesDirectoryW = userenvapi.NewProc("GetProfilesDirectoryW")

	modcrt       = windows.NewLazySystemDLL("msvcrt.dll")
	procAccess   = modcrt.NewProc("_access")
	procChmod    = modcrt.NewProc("_chmod")
	procCtime64  = modcrt.NewProc("ctime64")
	procGmtime   = modcrt.NewProc("gmtime")
	procGmtime32 = modcrt.NewProc("_gmtime32")
	procGmtime64 = modcrt.NewProc("_gmtime64")
	procStati64  = modcrt.NewProc("_stati64")
	procStrftime = modcrt.NewProc("strftime")
	procStrnicmp = modcrt.NewProc("_strnicmp")
	procStrtod   = modcrt.NewProc("strtod")
	procTime64   = modcrt.NewProc("time64")
	procWcsncpy  = modcrt.NewProc("wcsncpy")
	procWcsrchr  = modcrt.NewProc("wcsrchr")

	moducrt             = windows.NewLazySystemDLL("ucrtbase.dll")
	procFindfirst32     = moducrt.NewProc("_findfirst32")
	procFindnext32      = moducrt.NewProc("_findnext32")
	procStat64i32       = moducrt.NewProc("_stat64i32")
	procWchmod          = moducrt.NewProc("_wchmod")
	procWfindfirst32    = moducrt.NewProc("_wfindfirst32")
	procWfindfirst64i32 = moducrt.NewProc("_wfindfirst64i32")
	procWfindnext32     = moducrt.NewProc("_wfindnext32")
	procWfindnext64i32  = moducrt.NewProc("_wfindnext64i32")
	procWmkdir          = moducrt.NewProc("_wmkdir")
	procWstat32         = moducrt.NewProc("_wstat32")
	procWstat64i32      = moducrt.NewProc("_wstat64i32")
)

var (
	threadCallback uintptr
)

func init() {
	isWindows = true
	threadCallback = windows.NewCallback(ThreadProc)
}

// ---------------------------------
// Windows filehandle-to-fd mapping
// so the lib-c interface contract looks
// like normal fds being passed around
// but we're mapping them back and forth to
// native windows file handles (windows.Handle)
//

var EBADF = errors.New("EBADF")

var w_nextFd int32 = 42
var w_fdLock sync.Mutex
var w_fd_to_file = map[int32]*file{}

type file struct {
	_fd    int32
	hadErr bool
	t      uintptr
	windows.Handle
}

func addFile(hdl windows.Handle, fd int32) uintptr {
	var f = file{_fd: fd, Handle: hdl}
	w_fdLock.Lock()
	defer w_fdLock.Unlock()
	w_fd_to_file[fd] = &f
	f.t = addObject(&f)
	return f.t
}

func remFile(f *file) {
	removeObject(f.t)
	w_fdLock.Lock()
	defer w_fdLock.Unlock()
	delete(w_fd_to_file, f._fd)
}

func fdToFile(fd int32) (*file, bool) {
	w_fdLock.Lock()
	defer w_fdLock.Unlock()
	f, ok := w_fd_to_file[fd]
	return f, ok
}

// Wrap the windows handle up tied to a unique fd
func wrapFdHandle(hdl windows.Handle) (uintptr, int32) {
	newFd := atomic.AddInt32(&w_nextFd, 1)
	return addFile(hdl, newFd), newFd
}

func (f *file) err() bool {
	return f.hadErr
}

func (f *file) setErr() {
	f.hadErr = true
}

func (tls *TLS) SetLastError(_dwErrCode uint32) {
	if tls != nil {
		tls.lastError = _dwErrCode
	}
}

// https://github.com/golang/go/issues/41220

func (tls *TLS) GetLastError() (r uint32) {
	if tls == nil {
		return 0
	}

	return tls.lastError
}

// -----------------------------------
// On windows we have to fetch these
//
// stdout, stdin, sterr
//
// Using the windows specific GetStdHandle
// they're mapped to the standard fds (0,1,2)
// Note: it's possible they don't exist
// if the app has been built for a GUI only
// target in windows. If that's the case
// panic seems like the only reasonable option
// ------------------------------

func newFile(t *TLS, fd int32) uintptr {

	if fd == unistd.STDIN_FILENO {
		h, err := windows.GetStdHandle(windows.STD_INPUT_HANDLE)
		if err != nil {
			panic("no console")
		}
		return addFile(h, fd)
	}
	if fd == unistd.STDOUT_FILENO {
		h, err := windows.GetStdHandle(windows.STD_OUTPUT_HANDLE)
		if err != nil {
			panic("no console")
		}
		return addFile(h, fd)
	}
	if fd == unistd.STDERR_FILENO {
		h, err := windows.GetStdHandle(windows.STD_ERROR_HANDLE)
		if err != nil {
			panic("no console")
		}
		return addFile(h, fd)
	}

	// should not get here -- unless newFile
	// is being used from somewhere we don't know about
	// to originate fds.

	panic("unknown fd source")
	return 0
}

func (f *file) close(t *TLS) int32 {
	remFile(f)
	err := windows.Close(f.Handle)
	if err != nil {
		return (-1) // EOF
	}
	return 0
}

func fwrite(fd int32, b []byte) (int, error) {
	if fd == unistd.STDOUT_FILENO {
		return write(b)
	}

	f, ok := fdToFile(fd)
	if !ok {
		return -1, EBADF
	}

	if dmesgs {
		dmesg("%v: fd %v: %s", origin(1), fd, b)
	}
	return windows.Write(f.Handle, b)
}

// int fprintf(FILE *stream, const char *format, ...);
func Xfprintf(t *TLS, stream, format, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v args=%v, (%v:)", t, args, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}

	n, _ := fwrite(f._fd, printf(format, args))
	return int32(n)
}

// int usleep(useconds_t usec);
func Xusleep(t *TLS, usec types.Useconds_t) int32 {
	if __ccgo_strace {
		trc("t=%v usec=%v, (%v:)", t, usec, origin(2))
	}
	gotime.Sleep(gotime.Microsecond * gotime.Duration(usec))
	return 0
}

// int getrusage(int who, struct rusage *usage);
func Xgetrusage(t *TLS, who int32, usage uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v who=%v usage=%v, (%v:)", t, who, usage, origin(2))
	}
	panic(todo(""))
	// if _, _, err := unix.Syscall(unix.SYS_GETRUSAGE, uintptr(who), usage, 0); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return 0
}

// int lstat(const char *pathname, struct stat *statbuf);
func Xlstat(t *TLS, pathname, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v statbuf=%v, (%v:)", t, statbuf, origin(2))
	}
	return Xlstat64(t, pathname, statbuf)
}

// int stat(const char *pathname, struct stat *statbuf);
func Xstat(t *TLS, pathname, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v statbuf=%v, (%v:)", t, statbuf, origin(2))
	}
	return Xstat64(t, pathname, statbuf)
}

// int chdir(const char *path);
func Xchdir(t *TLS, path uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v path=%v, (%v:)", t, path, origin(2))
	}
	err := windows.Chdir(GoString(path))
	if err != nil {
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %q: ok", origin(1), GoString(path))
	}
	return 0
}

var localtime time.Tm

// struct tm *localtime(const time_t *timep);
func Xlocaltime(_ *TLS, timep uintptr) uintptr {
	loc := getLocalLocation()
	ut := *(*time.Time_t)(unsafe.Pointer(timep))
	t := gotime.Unix(int64(ut), 0).In(loc)
	localtime.Ftm_sec = int32(t.Second())
	localtime.Ftm_min = int32(t.Minute())
	localtime.Ftm_hour = int32(t.Hour())
	localtime.Ftm_mday = int32(t.Day())
	localtime.Ftm_mon = int32(t.Month() - 1)
	localtime.Ftm_year = int32(t.Year() - 1900)
	localtime.Ftm_wday = int32(t.Weekday())
	localtime.Ftm_yday = int32(t.YearDay())
	localtime.Ftm_isdst = Bool32(isTimeDST(t))
	return uintptr(unsafe.Pointer(&localtime))
}

// struct tm *localtime(const time_t *timep);
func X_localtime64(_ *TLS, timep uintptr) uintptr {
	return Xlocaltime(nil, timep)
}

// struct tm *localtime_r(const time_t *timep, struct tm *result);
func Xlocaltime_r(_ *TLS, timep, result uintptr) uintptr {
	panic(todo(""))
	// loc := getLocalLocation()
	// ut := *(*unix.Time_t)(unsafe.Pointer(timep))
	// t := gotime.Unix(int64(ut), 0).In(loc)
	// (*time.Tm)(unsafe.Pointer(result)).Ftm_sec = int32(t.Second())
	// (*time.Tm)(unsafe.Pointer(result)).Ftm_min = int32(t.Minute())
	// (*time.Tm)(unsafe.Pointer(result)).Ftm_hour = int32(t.Hour())
	// (*time.Tm)(unsafe.Pointer(result)).Ftm_mday = int32(t.Day())
	// (*time.Tm)(unsafe.Pointer(result)).Ftm_mon = int32(t.Month() - 1)
	// (*time.Tm)(unsafe.Pointer(result)).Ftm_year = int32(t.Year() - 1900)
	// (*time.Tm)(unsafe.Pointer(result)).Ftm_wday = int32(t.Weekday())
	// (*time.Tm)(unsafe.Pointer(result)).Ftm_yday = int32(t.YearDay())
	// (*time.Tm)(unsafe.Pointer(result)).Ftm_isdst = Bool32(isTimeDST(t))
	// return result
}

// int _wopen(
//
//	const wchar_t *filename,
//	int oflag [,
//	int pmode]
//
// );
func X_wopen(t *TLS, pathname uintptr, flags int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v flags=%v args=%v, (%v:)", t, pathname, flags, args, origin(2))
	}
	var mode types.Mode_t
	if args != 0 {
		mode = *(*types.Mode_t)(unsafe.Pointer(args))
	}
	s := goWideString(pathname)
	h, err := windows.Open(GoString(pathname), int(flags), uint32(mode))
	if err != nil {
		if dmesgs {
			dmesg("%v: %q %#x: %v", origin(1), s, flags, err)
		}

		t.setErrno(err)
		return 0
	}

	_, n := wrapFdHandle(h)
	if dmesgs {
		dmesg("%v: %q flags %#x mode %#o: fd %v", origin(1), s, flags, mode, n)
	}
	return n
}

// int open(const char *pathname, int flags, ...);
func Xopen(t *TLS, pathname uintptr, flags int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v flags=%v args=%v, (%v:)", t, pathname, flags, args, origin(2))
	}
	return Xopen64(t, pathname, flags, args)
}

// int open(const char *pathname, int flags, ...);
func Xopen64(t *TLS, pathname uintptr, flags int32, cmode uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v flags=%v cmode=%v, (%v:)", t, pathname, flags, cmode, origin(2))
	}

	var mode types.Mode_t
	if cmode != 0 {
		mode = (types.Mode_t)(VaUint32(&cmode))
	}
	// 	fdcwd := fcntl.AT_FDCWD
	h, err := windows.Open(GoString(pathname), int(flags), uint32(mode))
	if err != nil {

		if dmesgs {
			dmesg("%v: %q %#x: %v", origin(1), GoString(pathname), flags, err)
		}

		t.setErrno(err)
		return -1
	}

	_, n := wrapFdHandle(h)
	if dmesgs {
		dmesg("%v: %q flags %#x mode %#o: fd %v", origin(1), GoString(pathname), flags, mode, n)
	}
	return n
}

// off_t lseek(int fd, off_t offset, int whence);
func Xlseek(t *TLS, fd int32, offset types.Off_t, whence int32) types.Off_t {
	if __ccgo_strace {
		trc("t=%v fd=%v offset=%v whence=%v, (%v:)", t, fd, offset, whence, origin(2))
	}
	return types.Off_t(Xlseek64(t, fd, offset, whence))
}

func whenceStr(whence int32) string {
	switch whence {
	case windows.FILE_CURRENT:
		return "SEEK_CUR"
	case windows.FILE_END:
		return "SEEK_END"
	case windows.FILE_BEGIN:
		return "SEEK_SET"
	default:
		return fmt.Sprintf("whence(%d)", whence)
	}
}

var fsyncStatbuf stat.Stat

// int fsync(int fd);
func Xfsync(t *TLS, fd int32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v, (%v:)", t, fd, origin(2))
	}

	f, ok := fdToFile(fd)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}
	err := windows.FlushFileBuffers(f.Handle)
	if err != nil {
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %d: ok", origin(1), fd)
	}
	return 0
}

// long sysconf(int name);
func Xsysconf(t *TLS, name int32) long {
	if __ccgo_strace {
		trc("t=%v name=%v, (%v:)", t, name, origin(2))
	}
	panic(todo(""))
	// switch name {
	// case unistd.X_SC_PAGESIZE:
	// 	return long(unix.Getpagesize())
	// }

	// panic(todo(""))
}

// int close(int fd);
func Xclose(t *TLS, fd int32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v, (%v:)", t, fd, origin(2))
	}

	f, ok := fdToFile(fd)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}

	err := windows.Close(f.Handle)
	if err != nil {
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: %d: ok", origin(1), fd)
	}
	return 0
}

// char *getcwd(char *buf, size_t size);
func Xgetcwd(t *TLS, buf uintptr, size types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v buf=%v size=%v, (%v:)", t, buf, size, origin(2))
	}

	b := make([]uint16, size)
	n, err := windows.GetCurrentDirectory(uint32(len(b)), &b[0])
	if err != nil {
		t.setErrno(err)
		return 0
	}
	// to bytes
	var wd = []byte(string(utf16.Decode(b[0:n])))
	if types.Size_t(len(wd)) > size {
		t.setErrno(errno.ERANGE)
		return 0
	}

	copy((*RawMem)(unsafe.Pointer(buf))[:], wd)
	(*RawMem)(unsafe.Pointer(buf))[len(wd)] = 0

	if dmesgs {
		dmesg("%v: %q: ok", origin(1), GoString(buf))
	}
	return buf
}

// int fstat(int fd, struct stat *statbuf);
func Xfstat(t *TLS, fd int32, statbuf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v statbuf=%v, (%v:)", t, fd, statbuf, origin(2))
	}
	return Xfstat64(t, fd, statbuf)
}

// int ftruncate(int fd, off_t length);
func Xftruncate(t *TLS, fd int32, length types.Off_t) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v length=%v, (%v:)", t, fd, length, origin(2))
	}
	return Xftruncate64(t, fd, length)
}

// int fcntl(int fd, int cmd, ... /* arg */ );
func Xfcntl(t *TLS, fd, cmd int32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v cmd=%v args=%v, (%v:)", t, cmd, args, origin(2))
	}
	return Xfcntl64(t, fd, cmd, args)
}

// int _read( // https://docs.microsoft.com/en-us/cpp/c-runtime-library/reference/read?view=msvc-160
//
//	int const fd,
//	void * const buffer,
//	unsigned const buffer_size
//
// );
func Xread(t *TLS, fd int32, buf uintptr, count uint32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v count=%v, (%v:)", t, fd, buf, count, origin(2))
	}
	f, ok := fdToFile(fd)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}

	var obuf = ((*RawMem)(unsafe.Pointer(buf)))[:count]
	n, err := windows.Read(f.Handle, obuf)
	if err != nil {
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		// dmesg("%v: %d %#x: %#x\n%s", origin(1), fd, count, n, hex.Dump(GoBytes(buf, int(n))))
		dmesg("%v: %d %#x: %#x", origin(1), fd, count, n)
	}
	return int32(n)
}

func X_read(t *TLS, fd int32, buf uintptr, count uint32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v count=%v, (%v:)", t, fd, buf, count, origin(2))
	}
	return Xread(t, fd, buf, count)
}

// int _write( // https://docs.microsoft.com/en-us/cpp/c-runtime-library/reference/write?view=msvc-160
//
//	int fd,
//	const void *buffer,
//	unsigned int count
//
// );
func Xwrite(t *TLS, fd int32, buf uintptr, count uint32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v count=%v, (%v:)", t, fd, buf, count, origin(2))
	}
	f, ok := fdToFile(fd)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}

	var obuf = ((*RawMem)(unsafe.Pointer(buf)))[:count]
	n, err := windows.Write(f.Handle, obuf)
	if err != nil {
		if dmesgs {
			dmesg("%v: fd %v, count %#x: %v", origin(1), fd, count, err)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		// dmesg("%v: %d %#x: %#x\n%s", origin(1), fd, count, n, hex.Dump(GoBytes(buf, int(n))))
		dmesg("%v: %d %#x: %#x", origin(1), fd, count, n)
	}
	return int32(n)
}

func X_write(t *TLS, fd int32, buf uintptr, count uint32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v buf=%v count=%v, (%v:)", t, fd, buf, count, origin(2))
	}
	return Xwrite(t, fd, buf, count)
}

// int fchmod(int fd, mode_t mode);
func Xfchmod(t *TLS, fd int32, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v mode=%v, (%v:)", t, fd, mode, origin(2))
	}
	panic(todo(""))
	// if _, _, err := unix.Syscall(unix.SYS_FCHMOD, uintptr(fd), uintptr(mode), 0); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// if dmesgs {
	// 	dmesg("%v: %d %#o: ok", origin(1), fd, mode)
	// }
	// return 0
}

// // int fchown(int fd, uid_t owner, gid_t group);
// func Xfchown(t *TLS, fd int32, owner types.Uid_t, group types.Gid_t) int32 {
// 	if _, _, err := unix.Syscall(unix.SYS_FCHOWN, uintptr(fd), uintptr(owner), uintptr(group)); err != 0 {
// 		t.setErrno(err)
// 		return -1
// 	}
//
// 	return 0
// }

// // uid_t geteuid(void);
// func Xgeteuid(t *TLS) types.Uid_t {
// 	n, _, _ := unix.Syscall(unix.SYS_GETEUID, 0, 0, 0)
// 	return types.Uid_t(n)
// }

// int munmap(void *addr, size_t length);
func Xmunmap(t *TLS, addr uintptr, length types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v addr=%v length=%v, (%v:)", t, addr, length, origin(2))
	}
	panic(todo(""))
	// if _, _, err := unix.Syscall(unix.SYS_MUNMAP, addr, uintptr(length), 0); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return 0
}

type Timeval = struct {
	Ftv_sec  int32
	Ftv_usec int32
}

// int gettimeofday(struct timeval *tv, struct timezone *tz);
func Xgettimeofday(t *TLS, tv, tz uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v tz=%v, (%v:)", t, tz, origin(2))
	}
	if tv == 0 {
		return 0
	}

	// This seems to work as well
	// var u64 uint64
	// procGetSystemTimeAsFileTime.Call(uintptr(unsafe.Pointer(&u64)), 0, 0)
	// u64 /= 10
	// u64 -= 11644473600000000
	// (*Timeval)(unsafe.Pointer(tv)).Ftv_sec = int32(u64/1e6)
	// (*Timeval)(unsafe.Pointer(tv)).Ftv_usec = int32(u64%1e6)
	// return 0

	// But let's use the golang.org/x/sys version
	windows.Gettimeofday((*windows.Timeval)(unsafe.Pointer(tv)))
	return 0
}

type Timespec = struct {
	Ftv_sec  time.Time_t
	Ftv_nsec int32
}

// int clock_gettime(clockid_t clk_id, struct timespec *tp);
func Xclock_gettime(t *TLS, clk_id int32, tp uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v clk_id=%v tp=%v, (%v:)", t, clk_id, tp, origin(2))
	}
	var u64 uint64 // [100ns]
	procGetSystemTimeAsFileTime.Call(uintptr(unsafe.Pointer(&u64)), 0, 0)
	(*Timespec)(unsafe.Pointer(tp)).Ftv_sec = time.Time_t((u64/10 - 11644473600000000) / 1e6)
	(*Timespec)(unsafe.Pointer(tp)).Ftv_nsec = int32((u64 * 100) % 1e9)
	return 0
}

// int getsockopt(int sockfd, int level, int optname, void *optval, socklen_t *optlen);
func Xgetsockopt(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
	// if _, _, err := unix.Syscall6(unix.SYS_GETSOCKOPT, uintptr(sockfd), uintptr(level), uintptr(optname), optval, optlen, 0); err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return 0
}

// // int setsockopt(int sockfd, int level, int optname, const void *optval, socklen_t optlen);
func Xsetsockopt(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// int ioctl(int fd, unsigned long request, ...);
func Xioctl(t *TLS, fd int32, request ulong, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v request=%v va=%v, (%v:)", t, fd, request, va, origin(2))
	}
	panic(todo(""))
	// var argp uintptr
	// if va != 0 {
	// 	argp = VaUintptr(&va)
	// }
	// n, _, err := unix.Syscall(unix.SYS_IOCTL, uintptr(fd), uintptr(request), argp)
	// if err != 0 {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return int32(n)
}

// int select(int nfds, fd_set *readfds, fd_set *writefds, fd_set *exceptfds, struct timeval *timeout);
func Xselect(t *TLS, nfds int32, readfds, writefds, exceptfds, timeout uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v nfds=%v timeout=%v, (%v:)", t, nfds, timeout, origin(2))
	}
	panic(todo(""))
	// n, err := unix.Select(
	// 	int(nfds),
	// 	(*unix.FdSet)(unsafe.Pointer(readfds)),
	// 	(*unix.FdSet)(unsafe.Pointer(writefds)),
	// 	(*unix.FdSet)(unsafe.Pointer(exceptfds)),
	// 	(*unix.Timeval)(unsafe.Pointer(timeout)),
	// )
	// if err != nil {
	// 	t.setErrno(err)
	// 	return -1
	// }

	// return int32(n)
}

// int mkfifo(const char *pathname, mode_t mode);
func Xmkfifo(t *TLS, pathname uintptr, mode types.Mode_t) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v mode=%v, (%v:)", t, pathname, mode, origin(2))
	}
	panic(todo(""))
	// 	if err := unix.Mkfifo(GoString(pathname), mode); err != nil {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return 0
}

// mode_t umask(mode_t mask);
func Xumask(t *TLS, mask types.Mode_t) types.Mode_t {
	if __ccgo_strace {
		trc("t=%v mask=%v, (%v:)", t, mask, origin(2))
	}
	panic(todo(""))
	// 	n, _, _ := unix.Syscall(unix.SYS_UMASK, uintptr(mask), 0, 0)
	// 	return types.Mode_t(n)
}

// int execvp(const char *file, char *const argv[]);
func Xexecvp(t *TLS, file, argv uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v argv=%v, (%v:)", t, argv, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_EXECVE, file, argv, Environ()); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return 0
}

// pid_t waitpid(pid_t pid, int *wstatus, int options);
func Xwaitpid(t *TLS, pid types.Pid_t, wstatus uintptr, optname int32) types.Pid_t {
	if __ccgo_strace {
		trc("t=%v pid=%v wstatus=%v optname=%v, (%v:)", t, pid, wstatus, optname, origin(2))
	}
	panic(todo(""))
	// 	n, _, err := unix.Syscall6(unix.SYS_WAIT4, uintptr(pid), wstatus, uintptr(optname), 0, 0, 0)
	// 	if err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return types.Pid_t(n)
}

// int uname(struct utsname *buf);
func Xuname(t *TLS, buf uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v buf=%v, (%v:)", t, buf, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_UNAME, buf, 0, 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return 0
}

// int getrlimit(int resource, struct rlimit *rlim);
func Xgetrlimit(t *TLS, resource int32, rlim uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v resource=%v rlim=%v, (%v:)", t, resource, rlim, origin(2))
	}
	return Xgetrlimit64(t, resource, rlim)
}

// int setrlimit(int resource, const struct rlimit *rlim);
func Xsetrlimit(t *TLS, resource int32, rlim uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v resource=%v rlim=%v, (%v:)", t, resource, rlim, origin(2))
	}
	return Xsetrlimit64(t, resource, rlim)
}

// int setrlimit(int resource, const struct rlimit *rlim);
func Xsetrlimit64(t *TLS, resource int32, rlim uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v resource=%v rlim=%v, (%v:)", t, resource, rlim, origin(2))
	}
	panic(todo(""))
	// 	if _, _, err := unix.Syscall(unix.SYS_SETRLIMIT, uintptr(resource), uintptr(rlim), 0); err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return 0
}

// // uid_t getuid(void);
// func Xgetuid(t *TLS) types.Uid_t {
// 	return types.Uid_t(os.Getuid())
// }

// pid_t getpid(void);
func Xgetpid(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return int32(os.Getpid())
}

// int system(const char *command);
func Xsystem(t *TLS, command uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v command=%v, (%v:)", t, command, origin(2))
	}
	s := GoString(command)
	if command == 0 {
		panic(todo(""))
	}

	cmd := exec.Command("sh", "-c", s)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		ps := err.(*exec.ExitError)
		return int32(ps.ExitCode())
	}

	return 0
}

// var staticGetpwuid pwd.Passwd
//
// func init() {
// 	atExit = append(atExit, func() { closePasswd(&staticGetpwuid) })
// }
//
// func closePasswd(p *pwd.Passwd) {
// 	Xfree(nil, p.Fpw_name)
// 	Xfree(nil, p.Fpw_passwd)
// 	Xfree(nil, p.Fpw_gecos)
// 	Xfree(nil, p.Fpw_dir)
// 	Xfree(nil, p.Fpw_shell)
// 	*p = pwd.Passwd{}
// }

// struct passwd *getpwuid(uid_t uid);
func Xgetpwuid(t *TLS, uid uint32) uintptr {
	if __ccgo_strace {
		trc("t=%v uid=%v, (%v:)", t, uid, origin(2))
	}
	panic(todo(""))
	// 	f, err := os.Open("/etc/passwd")
	// 	if err != nil {
	// 		panic(todo("", err))
	// 	}
	//
	// 	defer f.Close()
	//
	// 	sid := strconv.Itoa(int(uid))
	// 	sc := bufio.NewScanner(f)
	// 	for sc.Scan() {
	// 		// eg. "root:x:0:0:root:/root:/bin/bash"
	// 		a := strings.Split(sc.Text(), ":")
	// 		if len(a) < 7 {
	// 			panic(todo(""))
	// 		}
	//
	// 		if a[2] == sid {
	// 			uid, err := strconv.Atoi(a[2])
	// 			if err != nil {
	// 				panic(todo(""))
	// 			}
	//
	// 			gid, err := strconv.Atoi(a[3])
	// 			if err != nil {
	// 				panic(todo(""))
	// 			}
	//
	// 			closePasswd(&staticGetpwuid)
	// 			gecos := a[4]
	// 			if strings.Contains(gecos, ",") {
	// 				a := strings.Split(gecos, ",")
	// 				gecos = a[0]
	// 			}
	// 			initPasswd(t, &staticGetpwuid, a[0], a[1], uint32(uid), uint32(gid), gecos, a[5], a[6])
	// 			return uintptr(unsafe.Pointer(&staticGetpwuid))
	// 		}
	// 	}
	//
	// 	if sc.Err() != nil {
	// 		panic(todo(""))
	// 	}
	//
	// 	return 0
}

// func initPasswd(t *TLS, p *pwd.Passwd, name, pwd string, uid, gid uint32, gecos, dir, shell string) {
// 	p.Fpw_name = cString(t, name)
// 	p.Fpw_passwd = cString(t, pwd)
// 	p.Fpw_uid = uid
// 	p.Fpw_gid = gid
// 	p.Fpw_gecos = cString(t, gecos)
// 	p.Fpw_dir = cString(t, dir)
// 	p.Fpw_shell = cString(t, shell)
// }

// int setvbuf(FILE *stream, char *buf, int mode, size_t size);
func Xsetvbuf(t *TLS, stream, buf uintptr, mode int32, size types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v buf=%v mode=%v size=%v, (%v:)", t, buf, mode, size, origin(2))
	}
	return 0 //TODO
}

// int raise(int sig);
func Xraise(t *TLS, sig int32) int32 {
	if __ccgo_strace {
		trc("t=%v sig=%v, (%v:)", t, sig, origin(2))
	}
	panic(todo(""))
}

// int backtrace(void **buffer, int size);
func Xbacktrace(t *TLS, buf uintptr, size int32) int32 {
	if __ccgo_strace {
		trc("t=%v buf=%v size=%v, (%v:)", t, buf, size, origin(2))
	}
	panic(todo(""))
}

// void backtrace_symbols_fd(void *const *buffer, int size, int fd);
func Xbacktrace_symbols_fd(t *TLS, buffer uintptr, size, fd int32) {
	if __ccgo_strace {
		trc("t=%v buffer=%v fd=%v, (%v:)", t, buffer, fd, origin(2))
	}
	panic(todo(""))
}

// int fileno(FILE *stream);
func Xfileno(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	if stream == 0 {
		t.setErrno(errno.EBADF)
		return -1
	}

	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}
	return f._fd
}

// var staticGetpwnam pwd.Passwd
//
// func init() {
// 	atExit = append(atExit, func() { closePasswd(&staticGetpwnam) })
// }
//
// // struct passwd *getpwnam(const char *name);
// func Xgetpwnam(t *TLS, name uintptr) uintptr {
// 	f, err := os.Open("/etc/passwd")
// 	if err != nil {
// 		panic(todo("", err))
// 	}
//
// 	defer f.Close()
//
// 	sname := GoString(name)
// 	sc := bufio.NewScanner(f)
// 	for sc.Scan() {
// 		// eg. "root:x:0:0:root:/root:/bin/bash"
// 		a := strings.Split(sc.Text(), ":")
// 		if len(a) < 7 {
// 			panic(todo(""))
// 		}
//
// 		if a[0] == sname {
// 			uid, err := strconv.Atoi(a[2])
// 			if err != nil {
// 				panic(todo(""))
// 			}
//
// 			gid, err := strconv.Atoi(a[3])
// 			if err != nil {
// 				panic(todo(""))
// 			}
//
// 			closePasswd(&staticGetpwnam)
// 			gecos := a[4]
// 			if strings.Contains(gecos, ",") {
// 				a := strings.Split(gecos, ",")
// 				gecos = a[0]
// 			}
// 			initPasswd(t, &staticGetpwnam, a[0], a[1], uint32(uid), uint32(gid), gecos, a[5], a[6])
// 			return uintptr(unsafe.Pointer(&staticGetpwnam))
// 		}
// 	}
//
// 	if sc.Err() != nil {
// 		panic(todo(""))
// 	}
//
// 	return 0
// }
//
// var staticGetgrnam grp.Group
//
// func init() {
// 	atExit = append(atExit, func() { closeGroup(&staticGetgrnam) })
// }
//
// // struct group *getgrnam(const char *name);
// func Xgetgrnam(t *TLS, name uintptr) uintptr {
// 	f, err := os.Open("/etc/group")
// 	if err != nil {
// 		panic(todo(""))
// 	}
//
// 	defer f.Close()
//
// 	sname := GoString(name)
// 	sc := bufio.NewScanner(f)
// 	for sc.Scan() {
// 		// eg. "root:x:0:"
// 		a := strings.Split(sc.Text(), ":")
// 		if len(a) < 4 {
// 			panic(todo(""))
// 		}
//
// 		if a[0] == sname {
// 			closeGroup(&staticGetgrnam)
// 			gid, err := strconv.Atoi(a[2])
// 			if err != nil {
// 				panic(todo(""))
// 			}
//
// 			var names []string
// 			if a[3] != "" {
// 				names = strings.Split(a[3], ",")
// 			}
// 			initGroup(t, &staticGetgrnam, a[0], a[1], uint32(gid), names)
// 			return uintptr(unsafe.Pointer(&staticGetgrnam))
// 		}
// 	}
//
// 	if sc.Err() != nil {
// 		panic(todo(""))
// 	}
//
// 	return 0
// }
//
// func closeGroup(p *grp.Group) {
// 	Xfree(nil, p.Fgr_name)
// 	Xfree(nil, p.Fgr_passwd)
// 	if p.Fgr_mem != 0 {
// 		panic(todo(""))
// 	}
//
// 	*p = grp.Group{}
// }
//
// func initGroup(t *TLS, p *grp.Group, name, pwd string, gid uint32, names []string) {
// 	p.Fgr_name = cString(t, name)
// 	p.Fgr_passwd = cString(t, pwd)
// 	p.Fgr_gid = gid
// 	p.Fgr_mem = 0
// 	if len(names) != 0 {
// 		panic(todo("%q %q %v %q %v", name, pwd, gid, names, len(names)))
// 	}
// }
//
// func init() {
// 	atExit = append(atExit, func() { closeGroup(&staticGetgrgid) })
// }
//
// var staticGetgrgid grp.Group
//
// // struct group *getgrgid(gid_t gid);
// func Xgetgrgid(t *TLS, gid uint32) uintptr {
// 	f, err := os.Open("/etc/group")
// 	if err != nil {
// 		panic(todo(""))
// 	}
//
// 	defer f.Close()
//
// 	sid := strconv.Itoa(int(gid))
// 	sc := bufio.NewScanner(f)
// 	for sc.Scan() {
// 		// eg. "root:x:0:"
// 		a := strings.Split(sc.Text(), ":")
// 		if len(a) < 4 {
// 			panic(todo(""))
// 		}
//
// 		if a[2] == sid {
// 			closeGroup(&staticGetgrgid)
// 			var names []string
// 			if a[3] != "" {
// 				names = strings.Split(a[3], ",")
// 			}
// 			initGroup(t, &staticGetgrgid, a[0], a[1], gid, names)
// 			return uintptr(unsafe.Pointer(&staticGetgrgid))
// 		}
// 	}
//
// 	if sc.Err() != nil {
// 		panic(todo(""))
// 	}
//
// 	return 0
// }

// int mkstemps(char *template, int suffixlen);
func Xmkstemps(t *TLS, template uintptr, suffixlen int32) int32 {
	if __ccgo_strace {
		trc("t=%v template=%v suffixlen=%v, (%v:)", t, template, suffixlen, origin(2))
	}
	return Xmkstemps64(t, template, suffixlen)
}

// int mkstemps(char *template, int suffixlen);
func Xmkstemps64(t *TLS, template uintptr, suffixlen int32) int32 {
	if __ccgo_strace {
		trc("t=%v template=%v suffixlen=%v, (%v:)", t, template, suffixlen, origin(2))
	}
	panic(todo(""))
	// 	len := uintptr(Xstrlen(t, template))
	// 	x := template + uintptr(len-6) - uintptr(suffixlen)
	// 	for i := uintptr(0); i < 6; i++ {
	// 		if *(*byte)(unsafe.Pointer(x + i)) != 'X' {
	// 			t.setErrno(errno.EINVAL)
	// 			return -1
	// 		}
	// 	}
	//
	// 	fd, err := tempFile(template, x)
	// 	if err != 0 {
	// 		t.setErrno(err)
	// 		return -1
	// 	}
	//
	// 	return int32(fd)
}

// int mkstemp(char *template);
func Xmkstemp64(t *TLS, template uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v template=%v, (%v:)", t, template, origin(2))
	}
	return Xmkstemps64(t, template, 0)
}

// func newFtsent(t *TLS, info int, path string, stat *unix.Stat_t, err windows.Errno) (r *fts.FTSENT) {
// 	var statp uintptr
// 	if stat != nil {
// 		statp = Xmalloc(t, types.Size_t(unsafe.Sizeof(unix.Stat_t{})))
// 		if statp == 0 {
// 			panic("OOM")
// 		}
//
// 		*(*unix.Stat_t)(unsafe.Pointer(statp)) = *stat
// 	}
// 	csp := CString(path)
// 	if csp == 0 {
// 		panic("OOM")
// 	}
//
// 	return &fts.FTSENT{
// 		Ffts_info:    uint16(info),
// 		Ffts_path:    csp,
// 		Ffts_pathlen: uint16(len(path)),
// 		Ffts_statp:   statp,
// 		Ffts_errno:   int32(err),
// 	}
// }
//
// func newCFtsent(t *TLS, info int, path string, stat *unix.Stat_t, err windows.Errno) uintptr {
// 	p := Xcalloc(t, types.Size_t(unsafe.Sizeof(fts.FTSENT{})))
// 	if p == 0 {
// 		panic("OOM")
// 	}
//
// 	*(*fts.FTSENT)(unsafe.Pointer(p)) = *newFtsent(t, info, path, stat, err)
// 	return p
// }
//
// func ftsentClose(t *TLS, p uintptr) {
// 	Xfree(t, (*fts.FTSENT)(unsafe.Pointer(p)).Ffts_path)
// 	Xfree(t, (*fts.FTSENT)(unsafe.Pointer(p)).Ffts_statp)
// }

type ftstream struct {
	s []uintptr
	x int
}

// func (f *ftstream) close(t *TLS) {
// 	for _, p := range f.s {
// 		ftsentClose(t, p)
// 		Xfree(t, p)
// 	}
// 	*f = ftstream{}
// }
//
// // FTS *fts_open(char * const *path_argv, int options, int (*compar)(const FTSENT **, const FTSENT **));
// func Xfts_open(t *TLS, path_argv uintptr, options int32, compar uintptr) uintptr {
// 	return Xfts64_open(t, path_argv, options, compar)
// }

// FTS *fts_open(char * const *path_argv, int options, int (*compar)(const FTSENT **, const FTSENT **));
func Xfts64_open(t *TLS, path_argv uintptr, options int32, compar uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v path_argv=%v options=%v compar=%v, (%v:)", t, path_argv, options, compar, origin(2))
	}
	panic(todo(""))
	// 	f := &ftstream{}
	//
	// 	var walk func(string)
	// 	walk = func(path string) {
	// 		var fi os.FileInfo
	// 		var err error
	// 		switch {
	// 		case options&fts.FTS_LOGICAL != 0:
	// 			fi, err = os.Stat(path)
	// 		case options&fts.FTS_PHYSICAL != 0:
	// 			fi, err = os.Lstat(path)
	// 		default:
	// 			panic(todo(""))
	// 		}
	//
	// 		if err != nil {
	// 			panic(todo(""))
	// 		}
	//
	// 		var statp *unix.Stat_t
	// 		if options&fts.FTS_NOSTAT == 0 {
	// 			var stat unix.Stat_t
	// 			switch {
	// 			case options&fts.FTS_LOGICAL != 0:
	// 				if err := unix.Stat(path, &stat); err != nil {
	// 					panic(todo(""))
	// 				}
	// 			case options&fts.FTS_PHYSICAL != 0:
	// 				if err := unix.Lstat(path, &stat); err != nil {
	// 					panic(todo(""))
	// 				}
	// 			default:
	// 				panic(todo(""))
	// 			}
	//
	// 			statp = &stat
	// 		}
	//
	// 	out:
	// 		switch {
	// 		case fi.IsDir():
	// 			f.s = append(f.s, newCFtsent(t, fts.FTS_D, path, statp, 0))
	// 			g, err := os.Open(path)
	// 			switch x := err.(type) {
	// 			case nil:
	// 				// ok
	// 			case *os.PathError:
	// 				f.s = append(f.s, newCFtsent(t, fts.FTS_DNR, path, statp, errno.EACCES))
	// 				break out
	// 			default:
	// 				panic(todo("%q: %v %T", path, x, x))
	// 			}
	//
	// 			names, err := g.Readdirnames(-1)
	// 			g.Close()
	// 			if err != nil {
	// 				panic(todo(""))
	// 			}
	//
	// 			for _, name := range names {
	// 				walk(path + "/" + name)
	// 				if f == nil {
	// 					break out
	// 				}
	// 			}
	//
	// 			f.s = append(f.s, newCFtsent(t, fts.FTS_DP, path, statp, 0))
	// 		default:
	// 			info := fts.FTS_F
	// 			if fi.Mode()&os.ModeSymlink != 0 {
	// 				info = fts.FTS_SL
	// 			}
	// 			switch {
	// 			case statp != nil:
	// 				f.s = append(f.s, newCFtsent(t, info, path, statp, 0))
	// 			case options&fts.FTS_NOSTAT != 0:
	// 				f.s = append(f.s, newCFtsent(t, fts.FTS_NSOK, path, nil, 0))
	// 			default:
	// 				panic(todo(""))
	// 			}
	// 		}
	// 	}
	//
	// 	for {
	// 		p := *(*uintptr)(unsafe.Pointer(path_argv))
	// 		if p == 0 {
	// 			if f == nil {
	// 				return 0
	// 			}
	//
	// 			if compar != 0 {
	// 				panic(todo(""))
	// 			}
	//
	// 			return addObject(f)
	// 		}
	//
	// 		walk(GoString(p))
	// 		path_argv += unsafe.Sizeof(uintptr(0))
	// 	}
}

// FTSENT *fts_read(FTS *ftsp);
func Xfts_read(t *TLS, ftsp uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v ftsp=%v, (%v:)", t, ftsp, origin(2))
	}
	return Xfts64_read(t, ftsp)
}

// FTSENT *fts_read(FTS *ftsp);
func Xfts64_read(t *TLS, ftsp uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v ftsp=%v, (%v:)", t, ftsp, origin(2))
	}
	panic(todo(""))
	// 	f := winGetObject(ftsp).(*ftstream)
	// 	if f.x == len(f.s) {
	// 		t.setErrno(0)
	// 		return 0
	// 	}
	//
	// 	r := f.s[f.x]
	// 	if e := (*fts.FTSENT)(unsafe.Pointer(r)).Ffts_errno; e != 0 {
	// 		t.setErrno(e)
	// 	}
	// 	f.x++
	// 	return r
}

// int fts_close(FTS *ftsp);
func Xfts_close(t *TLS, ftsp uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ftsp=%v, (%v:)", t, ftsp, origin(2))
	}
	return Xfts64_close(t, ftsp)
}

// int fts_close(FTS *ftsp);
func Xfts64_close(t *TLS, ftsp uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ftsp=%v, (%v:)", t, ftsp, origin(2))
	}
	panic(todo(""))
	// 	winGetObject(ftsp).(*ftstream).close(t)
	// 	removeObject(ftsp)
	// 	return 0
}

// void tzset (void);
func Xtzset(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	//TODO
}

var strerrorBuf [256]byte

// char *strerror(int errnum);
func Xstrerror(t *TLS, errnum int32) uintptr {
	if __ccgo_strace {
		trc("t=%v errnum=%v, (%v:)", t, errnum, origin(2))
	}
	copy((*RawMem)(unsafe.Pointer(&strerrorBuf[0]))[:len(strerrorBuf):len(strerrorBuf)], fmt.Sprintf("errno %d\x00", errnum))
	return uintptr(unsafe.Pointer(&strerrorBuf[0]))
}

// void *dlopen(const char *filename, int flags);
func Xdlopen(t *TLS, filename uintptr, flags int32) uintptr {
	if __ccgo_strace {
		trc("t=%v filename=%v flags=%v, (%v:)", t, filename, flags, origin(2))
	}
	panic(todo(""))
}

// char *dlerror(void);
func Xdlerror(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// int dlclose(void *handle);
func Xdlclose(t *TLS, handle uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v handle=%v, (%v:)", t, handle, origin(2))
	}
	panic(todo(""))
}

// void *dlsym(void *handle, const char *symbol);
func Xdlsym(t *TLS, handle, symbol uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v symbol=%v, (%v:)", t, symbol, origin(2))
	}
	panic(todo(""))
}

// void perror(const char *s);
func Xperror(tls *TLS, msg uintptr) {
	if __ccgo_strace {
		trc("tls=%v msg=%v, (%v:)", tls, msg, origin(2))
	}
	if msg != 0 && *(*int8)(unsafe.Pointer(msg)) != 0 {
		fmt.Fprintf(os.Stderr, "%s: ", GoString(msg))
	}
	errstr := Xstrerror(tls, *(*int32)(unsafe.Pointer(X__errno_location(tls))))
	fmt.Fprintf(os.Stderr, "%s\n", GoString(errstr))
}

// int pclose(FILE *stream);
func Xpclose(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	panic(todo(""))
}

var gai_strerrorBuf [100]byte

// const char *gai_strerror(int errcode);
func Xgai_strerror(t *TLS, errcode int32) uintptr {
	if __ccgo_strace {
		trc("t=%v errcode=%v, (%v:)", t, errcode, origin(2))
	}
	copy(gai_strerrorBuf[:], fmt.Sprintf("gai error %d\x00", errcode))
	return uintptr(unsafe.Pointer(&gai_strerrorBuf))
}

// int tcgetattr(int fd, struct termios *termios_p);
func Xtcgetattr(t *TLS, fd int32, termios_p uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v termios_p=%v, (%v:)", t, fd, termios_p, origin(2))
	}
	panic(todo(""))
}

// int tcsetattr(int fd, int optional_actions, const struct termios *termios_p);
func Xtcsetattr(t *TLS, fd, optional_actions int32, termios_p uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v optional_actions=%v termios_p=%v, (%v:)", t, optional_actions, termios_p, origin(2))
	}
	panic(todo(""))
}

// // speed_t cfgetospeed(const struct termios *termios_p);
// func Xcfgetospeed(t *TLS, termios_p uintptr) termios.Speed_t {
// 	panic(todo(""))
// }

// int cfsetospeed(struct termios *termios_p, speed_t speed);
func Xcfsetospeed(t *TLS, termios_p uintptr, speed uint32) int32 {
	if __ccgo_strace {
		trc("t=%v termios_p=%v speed=%v, (%v:)", t, termios_p, speed, origin(2))
	}
	panic(todo(""))
}

// int cfsetispeed(struct termios *termios_p, speed_t speed);
func Xcfsetispeed(t *TLS, termios_p uintptr, speed uint32) int32 {
	if __ccgo_strace {
		trc("t=%v termios_p=%v speed=%v, (%v:)", t, termios_p, speed, origin(2))
	}
	panic(todo(""))
}

// pid_t fork(void);
func Xfork(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	t.setErrno(errno.ENOSYS)
	return -1
}

// char *setlocale(int category, const char *locale);
func Xsetlocale(t *TLS, category int32, locale uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v category=%v locale=%v, (%v:)", t, category, locale, origin(2))
	}
	return 0 //TODO
}

// // char *nl_langinfo(nl_item item);
// func Xnl_langinfo(t *TLS, item langinfo.Nl_item) uintptr {
// 	panic(todo(""))
// }

// FILE *popen(const char *command, const char *type);
func Xpopen(t *TLS, command, type1 uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v type1=%v, (%v:)", t, type1, origin(2))
	}
	panic(todo(""))
}

// char *realpath(const char *path, char *resolved_path);
func Xrealpath(t *TLS, path, resolved_path uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v resolved_path=%v, (%v:)", t, resolved_path, origin(2))
	}
	s, err := filepath.EvalSymlinks(GoString(path))
	if err != nil {
		if os.IsNotExist(err) {
			if dmesgs {
				dmesg("%v: %q: %v", origin(1), GoString(path), err)
			}
			t.setErrno(errno.ENOENT)
			return 0
		}

		panic(todo("", err))
	}

	if resolved_path == 0 {
		panic(todo(""))
	}

	if len(s) >= limits.PATH_MAX {
		s = s[:limits.PATH_MAX-1]
	}

	copy((*RawMem)(unsafe.Pointer(resolved_path))[:len(s):len(s)], s)
	(*RawMem)(unsafe.Pointer(resolved_path))[len(s)] = 0
	return resolved_path
}

// // char *inet_ntoa(struct in_addr in);
// func Xinet_ntoa(t *TLS, in1 in.In_addr) uintptr {
// 	panic(todo(""))
// }

// func X__ccgo_in6addr_anyp(t *TLS) uintptr {
// 	return uintptr(unsafe.Pointer(&in6_addr_any))
// }

func Xabort(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
	// 	if dmesgs {
	// 		dmesg("%v:\n%s", origin(1), debug.Stack())
	// 	}
	// 	p := Xmalloc(t, types.Size_t(unsafe.Sizeof(signal.Sigaction{})))
	// 	if p == 0 {
	//		panic("OOM")
	//	}
	//
	// 	*(*signal.Sigaction)(unsafe.Pointer(p)) = signal.Sigaction{
	// 		F__sigaction_handler: struct{ Fsa_handler signal.X__sighandler_t }{Fsa_handler: signal.SIG_DFL},
	// 	}
	// 	Xsigaction(t, signal.SIGABRT, p, 0)
	// 	Xfree(t, p)
	// 	unix.Kill(unix.Getpid(), windows.Signal(signal.SIGABRT))
	// 	panic(todo("unrechable"))
}

// int fflush(FILE *stream);
func Xfflush(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}
	err := windows.FlushFileBuffers(f.Handle)
	if err != nil {
		t.setErrno(err)
		return -1
	}
	return 0
}

// size_t fread(void *ptr, size_t size, size_t nmemb, FILE *stream);
func Xfread(t *TLS, ptr uintptr, size, nmemb types.Size_t, stream uintptr) types.Size_t {
	if __ccgo_strace {
		trc("t=%v ptr=%v nmemb=%v stream=%v, (%v:)", t, ptr, nmemb, stream, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return 0
	}

	var sz = size * nmemb
	var obuf = ((*RawMem)(unsafe.Pointer(ptr)))[:sz]
	n, err := windows.Read(f.Handle, obuf)
	if err != nil {
		f.setErr()
		return 0
	}

	if dmesgs {
		// dmesg("%v: %d %#x x %#x: %#x\n%s", origin(1), file(stream).fd(), size, nmemb, types.Size_t(m)/size, hex.Dump(GoBytes(ptr, int(m))))
		dmesg("%v: %d %#x x %#x: %#x\n%s", origin(1), f._fd, size, nmemb, types.Size_t(n)/size)
	}

	return types.Size_t(n) / size

}

// size_t fwrite(const void *ptr, size_t size, size_t nmemb, FILE *stream);
func Xfwrite(t *TLS, ptr uintptr, size, nmemb types.Size_t, stream uintptr) types.Size_t {
	if __ccgo_strace {
		trc("t=%v ptr=%v nmemb=%v stream=%v, (%v:)", t, ptr, nmemb, stream, origin(2))
	}
	if ptr == 0 || size == 0 {
		return 0
	}

	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return 0
	}

	var sz = size * nmemb
	var obuf = ((*RawMem)(unsafe.Pointer(ptr)))[:sz]
	n, err := windows.Write(f.Handle, obuf)
	if err != nil {
		f.setErr()
		return 0
	}

	if dmesgs {
		// 		// dmesg("%v: %d %#x x %#x: %#x\n%s", origin(1), file(stream).fd(), size, nmemb, types.Size_t(m)/size, hex.Dump(GoBytes(ptr, int(m))))
		dmesg("%v: %d %#x x %#x: %#x\n%s", origin(1), f._fd, size, nmemb, types.Size_t(n)/size)
	}
	return types.Size_t(n) / size
}

// int fclose(FILE *stream);
func Xfclose(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}
	return f.close(t)
}

// int fputc(int c, FILE *stream);
func Xfputc(t *TLS, c int32, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v stream=%v, (%v:)", t, c, stream, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}
	if _, err := fwrite(f._fd, []byte{byte(c)}); err != nil {
		return -1
	}
	return int32(byte(c))
}

// int fseek(FILE *stream, long offset, int whence);
func Xfseek(t *TLS, stream uintptr, offset long, whence int32) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v offset=%v whence=%v, (%v:)", t, stream, offset, whence, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}
	if n := Xlseek(t, f._fd, types.Off_t(offset), whence); n < 0 {
		if dmesgs {
			dmesg("%v: fd %v, off %#x, whence %v: %v", origin(1), f._fd, offset, whenceStr(whence), n)
		}
		f.setErr()
		return -1
	}

	if dmesgs {
		dmesg("%v: fd %v, off %#x, whence %v: ok", origin(1), f._fd, offset, whenceStr(whence))
	}
	return 0
}

// long ftell(FILE *stream);
func Xftell(t *TLS, stream uintptr) long {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}

	n := Xlseek(t, f._fd, 0, windows.FILE_CURRENT)
	if n < 0 {
		f.setErr()
		return -1
	}

	if dmesgs {
		dmesg("%v: fd %v, n %#x: ok %#x", origin(1), f._fd, n, long(n))
	}
	return long(n)
}

// int ferror(FILE *stream);
func Xferror(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}

	return Bool32(f.err())
}

// int getc(FILE *stream);
func Xfgetc(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return stdio.EOF
	}

	var buf [1]byte
	if n, _ := windows.Read(f.Handle, buf[:]); n != 0 {
		return int32(buf[0])
	}

	return stdio.EOF
}

// int ungetc(int c, FILE *stream);
func Xungetc(t *TLS, c int32, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v stream=%v, (%v:)", t, c, stream, origin(2))
	}
	panic(todo(""))
}

// int fscanf(FILE *stream, const char *format, ...);
func Xfscanf(t *TLS, stream, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v va=%v, (%v:)", t, va, origin(2))
	}
	panic(todo(""))
}

// int fputs(const char *s, FILE *stream);
func Xfputs(t *TLS, s, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}
	gS := GoString(s)
	if _, err := fwrite(f._fd, []byte(gS)); err != nil {
		return -1
	}
	return 0
}

// var getservbynameStaticResult netdb.Servent
//
// // struct servent *getservbyname(const char *name, const char *proto);
// func Xgetservbyname(t *TLS, name, proto uintptr) uintptr {
// 	var protoent *gonetdb.Protoent
// 	if proto != 0 {
// 		protoent = gonetdb.GetProtoByName(GoString(proto))
// 	}
// 	servent := gonetdb.GetServByName(GoString(name), protoent)
// 	if servent == nil {
// 		if dmesgs {
// 			dmesg("%q %q: nil (protoent %+v)", GoString(name), GoString(proto), protoent)
// 		}
// 		return 0
// 	}
//
// 	Xfree(t, (*netdb.Servent)(unsafe.Pointer(&getservbynameStaticResult)).Fs_name)
// 	if v := (*netdb.Servent)(unsafe.Pointer(&getservbynameStaticResult)).Fs_aliases; v != 0 {
// 		for {
// 			p := *(*uintptr)(unsafe.Pointer(v))
// 			if p == 0 {
// 				break
// 			}
//
// 			Xfree(t, p)
// 			v += unsafe.Sizeof(uintptr(0))
// 		}
// 		Xfree(t, v)
// 	}
// 	Xfree(t, (*netdb.Servent)(unsafe.Pointer(&getservbynameStaticResult)).Fs_proto)
// 	cname, err := CString(servent.Name)
// 	if err != nil {
// 		getservbynameStaticResult = netdb.Servent{}
// 		return 0
// 	}
//
// 	var protoname uintptr
// 	if protoent != nil {
// 		if protoname, err = CString(protoent.Name); err != nil {
// 			Xfree(t, cname)
// 			getservbynameStaticResult = netdb.Servent{}
// 			return 0
// 		}
// 	}
// 	var a []uintptr
// 	for _, v := range servent.Aliases {
// 		cs, err := CString(v)
// 		if err != nil {
// 			for _, v := range a {
// 				Xfree(t, v)
// 			}
// 			return 0
// 		}
//
// 		a = append(a, cs)
// 	}
// 	v := Xcalloc(t, types.Size_t(len(a)+1), types.Size_t(unsafe.Sizeof(uintptr(0))))
// 	if v == 0 {
// 		Xfree(t, cname)
// 		Xfree(t, protoname)
// 		for _, v := range a {
// 			Xfree(t, v)
// 		}
// 		getservbynameStaticResult = netdb.Servent{}
// 		return 0
// 	}
// 	for _, p := range a {
// 		*(*uintptr)(unsafe.Pointer(v)) = p
// 		v += unsafe.Sizeof(uintptr(0))
// 	}
//
// 	getservbynameStaticResult = netdb.Servent{
// 		Fs_name:    cname,
// 		Fs_aliases: v,
// 		Fs_port:    int32(servent.Port),
// 		Fs_proto:   protoname,
// 	}
// 	return uintptr(unsafe.Pointer(&getservbynameStaticResult))
// }

// func Xreaddir64(t *TLS, dir uintptr) uintptr {
// 	return Xreaddir(t, dir)
// }

// func fcntlCmdStr(cmd int32) string {
// 	switch cmd {
// 	case fcntl.F_GETOWN:
// 		return "F_GETOWN"
// 	case fcntl.F_SETLK:
// 		return "F_SETLK"
// 	case fcntl.F_GETLK:
// 		return "F_GETLK"
// 	case fcntl.F_SETFD:
// 		return "F_SETFD"
// 	case fcntl.F_GETFD:
// 		return "F_GETFD"
// 	default:
// 		return fmt.Sprintf("cmd(%d)", cmd)
// 	}
// }

// _CRTIMP extern int *__cdecl _errno(void); // /usr/share/mingw-w64/include/errno.h:17:
func X_errno(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return t.errnop
}

// int vfscanf(FILE * restrict stream, const char * restrict format, va_list arg);
func X__ms_vfscanf(t *TLS, stream, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	panic(todo(""))
}

// int vsscanf(const char *str, const char *format, va_list ap);
func X__ms_vsscanf(t *TLS, str, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	panic(todo(""))
}

// int vscanf(const char *format, va_list ap);
func X__ms_vscanf(t *TLS, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	panic(todo(""))
}

// int vsnprintf(char *str, size_t size, const char *format, va_list ap);
func X__ms_vsnprintf(t *TLS, str uintptr, size types.Size_t, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v str=%v size=%v ap=%v, (%v:)", t, str, size, ap, origin(2))
	}
	return Xvsnprintf(t, str, size, format, ap)
}

// int vfwscanf(FILE *stream, const wchar_t *format, va_list argptr;);
func X__ms_vfwscanf(t *TLS, stream uintptr, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v ap=%v, (%v:)", t, stream, ap, origin(2))
	}
	panic(todo(""))
}

// int vwscanf(const wchar_t * restrict format, va_list arg);
func X__ms_vwscanf(t *TLS, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	panic(todo(""))
}

// int _vsnwprintf(wchar_t *buffer, size_t count, const wchar_t *format, va_list argptr);
func X_vsnwprintf(t *TLS, buffer uintptr, count types.Size_t, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v buffer=%v count=%v ap=%v, (%v:)", t, buffer, count, ap, origin(2))
	}
	panic(todo(""))
}

// int vswscanf(const wchar_t *buffer, const wchar_t *format, va_list arglist);
func X__ms_vswscanf(t *TLS, stream uintptr, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v ap=%v, (%v:)", t, stream, ap, origin(2))
	}
	panic(todo(""))
}

// __acrt_iob_func
func X__acrt_iob_func(t *TLS, fd uint32) uintptr {
	if __ccgo_strace {
		trc("t=%v fd=%v, (%v:)", t, fd, origin(2))
	}

	f, ok := fdToFile(int32(fd))
	if !ok {
		t.setErrno(EBADF)
		return 0
	}
	return f.t
}

// BOOL SetEvent(
//
//	HANDLE hEvent
//
// );
func XSetEvent(t *TLS, hEvent uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hEvent=%v, (%v:)", t, hEvent, origin(2))
	}
	r0, _, err := procSetEvent.Call(hEvent, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// int _stricmp(
//
//	const char *string1,
//	const char *string2
//
// );
func X_stricmp(t *TLS, string1, string2 uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v string2=%v, (%v:)", t, string2, origin(2))
	}
	var s1 = strings.ToLower(GoString(string1))
	var s2 = strings.ToLower(GoString(string2))
	return int32(strings.Compare(s1, s2))
}

// BOOL HeapFree(
//
//	HANDLE                 hHeap,
//	DWORD                  dwFlags,
//	_Frees_ptr_opt_ LPVOID lpMem
//
// );
func XHeapFree(t *TLS, hHeap uintptr, dwFlags uint32, lpMem uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hHeap=%v dwFlags=%v lpMem=%v, (%v:)", t, hHeap, dwFlags, lpMem, origin(2))
	}
	r0, _, err := procHeapFree.Call(hHeap, uintptr(dwFlags), lpMem)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// HANDLE GetProcessHeap();
func XGetProcessHeap(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r0, _, err := procGetProcessHeap.Call(0, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return r0
}

// LPVOID HeapAlloc(
//
//	HANDLE hHeap,
//	DWORD  dwFlags,
//	SIZE_T dwBytes
//
// );
func XHeapAlloc(t *TLS, hHeap uintptr, dwFlags uint32, dwBytes types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v hHeap=%v dwFlags=%v dwBytes=%v, (%v:)", t, hHeap, dwFlags, dwBytes, origin(2))
	}
	r0, _, err := procHeapAlloc.Call(hHeap, uintptr(dwFlags), uintptr(dwBytes))
	if r0 == 0 {
		t.setErrno(err)
	}
	return r0
}

// WCHAR * gai_strerrorW(
//
//	int ecode
//
// );
func Xgai_strerrorW(t *TLS, _ ...interface{}) uintptr {
	panic(todo(""))
}

// servent * getservbyname(
//
//	const char *name,
//	const char *proto
//
// );
func Xgetservbyname(t *TLS, _ ...interface{}) uintptr {
	panic(todo(""))
}

// INT WSAAPI getaddrinfo(
//
//	PCSTR           pNodeName,
//	PCSTR           pServiceName,
//	const ADDRINFOA *pHints,
//	PADDRINFOA      *ppResult
//
// );
func XWspiapiGetAddrInfo(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// int wcscmp(
//
//	const wchar_t *string1,
//	const wchar_t *string2
//
// );
func Xwcscmp(t *TLS, string1, string2 uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v string2=%v, (%v:)", t, string2, origin(2))
	}
	var s1 = goWideString(string1)
	var s2 = goWideString(string2)
	return int32(strings.Compare(s1, s2))
}

// BOOL IsDebuggerPresent();
func XIsDebuggerPresent(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return 0
}

func XExitProcess(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// BOOL GetVersionExW(
//
//	LPOSVERSIONINFOW lpVersionInformation
//
// );
func XGetVersionExW(t *TLS, lpVersionInformation uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpVersionInformation=%v, (%v:)", t, lpVersionInformation, origin(2))
	}
	r0, _, err := procGetVersionExW.Call(lpVersionInformation, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// BOOL GetVolumeNameForVolumeMountPointW(
//
//	LPCWSTR lpszVolumeMountPoint,
//	LPWSTR  lpszVolumeName,
//	DWORD   cchBufferLength
//
// );
func XGetVolumeNameForVolumeMountPointW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// size_t wcslen(
//
//	const wchar_t *str
//
// );
func Xwcslen(t *TLS, str uintptr) types.Size_t {
	if __ccgo_strace {
		trc("t=%v str=%v, (%v:)", t, str, origin(2))
	}
	r0, _, _ := procLstrlenW.Call(str, 0, 0)
	return types.Size_t(r0)
}

// HANDLE WINAPI GetStdHandle(
//
//	_In_ DWORD nStdHandle
//
// );
func XGetStdHandle(t *TLS, nStdHandle uint32) uintptr {
	if __ccgo_strace {
		trc("t=%v nStdHandle=%v, (%v:)", t, nStdHandle, origin(2))
	}
	h, err := windows.GetStdHandle(nStdHandle)
	if err != nil {
		panic("no console")
	}
	return uintptr(h)
}

// BOOL CloseHandle(
//
//	HANDLE hObject
//
// );
func XCloseHandle(t *TLS, hObject uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hObject=%v, (%v:)", t, hObject, origin(2))
	}
	r := windows.CloseHandle(windows.Handle(hObject))
	if r != nil {
		return errno.EINVAL
	}
	return 1
}

// DWORD GetLastError();
func XGetLastError(t *TLS) uint32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	var rv = *(*int32)(unsafe.Pointer(t.errnop))
	return uint32(rv)

	//r1, _, _ := procGetLastError.Call(0, 0, 0)
	//return uint32(r1)
}

// DWORD SetFilePointer(
//
//	HANDLE hFile,
//	LONG   lDistanceToMove,
//	PLONG  lpDistanceToMoveHigh,
//	DWORD  dwMoveMethod
//
// );
func XSetFilePointer(t *TLS, hFile uintptr, lDistanceToMove long, lpDistanceToMoveHigh uintptr, dwMoveMethod uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v hFile=%v lDistanceToMove=%v lpDistanceToMoveHigh=%v dwMoveMethod=%v, (%v:)", t, hFile, lDistanceToMove, lpDistanceToMoveHigh, dwMoveMethod, origin(2))
	}
	r0, _, e1 := procSetFilePointer.Call(hFile, uintptr(lDistanceToMove), lpDistanceToMoveHigh, uintptr(dwMoveMethod), 0, 0)
	var uOff = uint32(r0)
	if uOff == 0xffffffff {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return uint32(r0)
}

// BOOL SetEndOfFile(
//
//	HANDLE hFile
//
// );
func XSetEndOfFile(t *TLS, hFile uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hFile=%v, (%v:)", t, hFile, origin(2))
	}
	err := windows.SetEndOfFile(windows.Handle(hFile))
	if err != nil {
		t.setErrno(err)
		return 0
	}
	return 1
}

// BOOL ReadFile(
//
//	HANDLE       hFile,
//	LPVOID       lpBuffer,
//	DWORD        nNumberOfBytesToRead,
//	LPDWORD      lpNumberOfBytesRead,
//	LPOVERLAPPED lpOverlapped
//
// );
func XReadFile(t *TLS, hFile, lpBuffer uintptr, nNumberOfBytesToRead uint32, lpNumberOfBytesRead, lpOverlapped uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpBuffer=%v nNumberOfBytesToRead=%v lpOverlapped=%v, (%v:)", t, lpBuffer, nNumberOfBytesToRead, lpOverlapped, origin(2))
	}
	r1, _, e1 := procReadFile.Call(hFile, lpBuffer, uintptr(nNumberOfBytesToRead), uintptr(lpNumberOfBytesRead), uintptr(lpOverlapped), 0)
	if r1 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return 0
	}
	return int32(r1)
}

// BOOL WriteFile(
//
//	HANDLE       hFile,
//	LPCVOID      lpBuffer,
//	DWORD        nNumberOfBytesToWrite,
//	LPDWORD      lpNumberOfBytesWritten,
//	LPOVERLAPPED lpOverlapped
//
// );
func XWriteFile(t *TLS, hFile, lpBuffer uintptr, nNumberOfBytesToWrite uint32, lpNumberOfBytesWritten, lpOverlapped uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpBuffer=%v nNumberOfBytesToWrite=%v lpOverlapped=%v, (%v:)", t, lpBuffer, nNumberOfBytesToWrite, lpOverlapped, origin(2))
	}
	r1, _, e1 := procWriteFile.Call(hFile, lpBuffer, uintptr(nNumberOfBytesToWrite), lpNumberOfBytesWritten, lpOverlapped, 0)
	if r1 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return 0
	}
	return int32(r1)
}

// DWORD GetFileAttributesW(
//
//	LPCWSTR lpFileName
//
// );
func XGetFileAttributesW(t *TLS, lpFileName uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v, (%v:)", t, lpFileName, origin(2))
	}
	attrs, err := windows.GetFileAttributes((*uint16)(unsafe.Pointer(lpFileName)))
	if attrs == windows.INVALID_FILE_ATTRIBUTES {
		if err != nil {
			t.setErrno(err)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return attrs
}

// HANDLE CreateFileW(
//
//	LPCWSTR               lpFileName,
//	DWORD                 dwDesiredAccess,
//	DWORD                 dwShareMode,
//	LPSECURITY_ATTRIBUTES lpSecurityAttributes,
//	DWORD                 dwCreationDisposition,
//	DWORD                 dwFlagsAndAttributes,
//	HANDLE                hTemplateFile
//
// );
func XCreateFileW(t *TLS, lpFileName uintptr, dwDesiredAccess, dwShareMode uint32, lpSecurityAttributes uintptr, dwCreationDisposition, dwFlagsAndAttributes uint32, hTemplateFile uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v dwShareMode=%v lpSecurityAttributes=%v dwFlagsAndAttributes=%v hTemplateFile=%v, (%v:)", t, lpFileName, dwShareMode, lpSecurityAttributes, dwFlagsAndAttributes, hTemplateFile, origin(2))
	}

	r0, _, e1 := procCreateFileW.Call(lpFileName, uintptr(dwDesiredAccess), uintptr(dwShareMode), lpSecurityAttributes,
		uintptr(dwCreationDisposition), uintptr(dwFlagsAndAttributes), hTemplateFile, 0, 0)
	h := windows.Handle(r0)
	if h == windows.InvalidHandle {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return r0
	}
	return uintptr(h)
}

// BOOL DuplicateHandle(
//
//	HANDLE   hSourceProcessHandle,
//	HANDLE   hSourceHandle,
//	HANDLE   hTargetProcessHandle,
//	LPHANDLE lpTargetHandle,
//	DWORD    dwDesiredAccess,
//	BOOL     bInheritHandle,
//	DWORD    dwOptions
//
// );
func XDuplicateHandle(t *TLS, hSourceProcessHandle, hSourceHandle, hTargetProcessHandle, lpTargetHandle uintptr, dwDesiredAccess uint32, bInheritHandle int32, dwOptions uint32) int32 {
	if __ccgo_strace {
		trc("t=%v lpTargetHandle=%v dwDesiredAccess=%v bInheritHandle=%v dwOptions=%v, (%v:)", t, lpTargetHandle, dwDesiredAccess, bInheritHandle, dwOptions, origin(2))
	}
	r0, _, err := procDuplicateHandle.Call(hSourceProcessHandle, hSourceHandle, hTargetProcessHandle,
		lpTargetHandle, uintptr(dwDesiredAccess), uintptr(bInheritHandle), uintptr(dwOptions), 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// HANDLE GetCurrentProcess();
func XGetCurrentProcess(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r0, _, e1 := procGetCurrentProcess.Call(0, 0, 0)
	if r0 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return r0
}

// BOOL FlushFileBuffers(
//
//	HANDLE hFile
//
// );
func XFlushFileBuffers(t *TLS, hFile uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hFile=%v, (%v:)", t, hFile, origin(2))
	}
	err := windows.FlushFileBuffers(windows.Handle(hFile))
	if err != nil {
		t.setErrno(err)
		return -1
	}
	return 1

}

// DWORD GetFileType(
//
//	HANDLE hFile
//
// );
func XGetFileType(t *TLS, hFile uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v hFile=%v, (%v:)", t, hFile, origin(2))
	}
	n, err := windows.GetFileType(windows.Handle(hFile))
	if err != nil {
		t.setErrno(err)
	}
	return n
}

// BOOL WINAPI GetConsoleMode(
//
//	_In_  HANDLE  hConsoleHandle,
//	_Out_ LPDWORD lpMode
//
// );
func XGetConsoleMode(t *TLS, hConsoleHandle, lpMode uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpMode=%v, (%v:)", t, lpMode, origin(2))
	}
	err := windows.GetConsoleMode(windows.Handle(hConsoleHandle), (*uint32)(unsafe.Pointer(lpMode)))
	if err != nil {
		t.setErrno(err)
		return 0
	}
	return 1
}

// BOOL GetCommState(
//
//	HANDLE hFile,
//	LPDCB  lpDCB
//
// );
func XGetCommState(t *TLS, hFile, lpDCB uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpDCB=%v, (%v:)", t, lpDCB, origin(2))
	}
	r1, _, err := procGetCommState.Call(hFile, lpDCB, 0)
	if r1 == 0 {
		t.setErrno(err)
		return 0
	}
	return int32(r1)
}

// int _wcsnicmp(
//
//	const wchar_t *string1,
//	const wchar_t *string2,
//	size_t count
//
// );
func X_wcsnicmp(t *TLS, string1, string2 uintptr, count types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v string2=%v count=%v, (%v:)", t, string2, count, origin(2))
	}

	var s1 = strings.ToLower(goWideString(string1))
	var l1 = len(s1)
	var s2 = strings.ToLower(goWideString(string2))
	var l2 = len(s2)

	// shorter is lesser
	if l1 < l2 {
		return -1
	}
	if l2 > l1 {
		return 1
	}

	// compare at most count
	var cmpLen = count
	if types.Size_t(l1) < cmpLen {
		cmpLen = types.Size_t(l1)
	}
	return int32(strings.Compare(s1[:cmpLen], s2[:cmpLen]))
}

// BOOL WINAPI ReadConsole(
//
//	_In_     HANDLE  hConsoleInput,
//	_Out_    LPVOID  lpBuffer,
//	_In_     DWORD   nNumberOfCharsToRead,
//	_Out_    LPDWORD lpNumberOfCharsRead,
//	_In_opt_ LPVOID  pInputControl
//
// );
func XReadConsoleW(t *TLS, hConsoleInput, lpBuffer uintptr, nNumberOfCharsToRead uint32, lpNumberOfCharsRead, pInputControl uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpBuffer=%v nNumberOfCharsToRead=%v pInputControl=%v, (%v:)", t, lpBuffer, nNumberOfCharsToRead, pInputControl, origin(2))
	}

	rv, _, err := procReadConsoleW.Call(hConsoleInput,
		lpBuffer, uintptr(nNumberOfCharsToRead), lpNumberOfCharsRead, pInputControl, 0)
	if rv == 0 {
		t.setErrno(err)
	}

	return int32(rv)
}

// BOOL WINAPI WriteConsoleW(
//
//	_In_             HANDLE  hConsoleOutput,
//	_In_       const VOID    *lpBuffer,
//	_In_             DWORD   nNumberOfCharsToWrite,
//	_Out_opt_        LPDWORD lpNumberOfCharsWritten,
//	_Reserved_       LPVOID  lpReserved
//
// );
func XWriteConsoleW(t *TLS, hConsoleOutput, lpBuffer uintptr, nNumberOfCharsToWrite uint32, lpNumberOfCharsWritten, lpReserved uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpBuffer=%v nNumberOfCharsToWrite=%v lpReserved=%v, (%v:)", t, lpBuffer, nNumberOfCharsToWrite, lpReserved, origin(2))
	}
	rv, _, err := procWriteConsoleW.Call(hConsoleOutput,
		lpBuffer, uintptr(nNumberOfCharsToWrite), lpNumberOfCharsWritten, lpReserved, 0)
	if rv == 0 {
		t.setErrno(err)
	}
	return int32(rv)
}

// DWORD WaitForSingleObject(
//
//	HANDLE hHandle,
//	DWORD  dwMilliseconds
//
// );
func XWaitForSingleObject(t *TLS, hHandle uintptr, dwMilliseconds uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v hHandle=%v dwMilliseconds=%v, (%v:)", t, hHandle, dwMilliseconds, origin(2))
	}
	rv, err := windows.WaitForSingleObject(windows.Handle(hHandle), dwMilliseconds)
	if err != nil {
		t.setErrno(err)
	}
	return rv
}

// BOOL ResetEvent(
//
//	HANDLE hEvent
//
// );
func XResetEvent(t *TLS, hEvent uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hEvent=%v, (%v:)", t, hEvent, origin(2))
	}
	rv, _, err := procResetEvent.Call(hEvent, 0, 0)
	if rv == 0 {
		t.setErrno(err)
	}
	return int32(rv)
}

// BOOL WINAPI PeekConsoleInput(
//
//	_In_  HANDLE        hConsoleInput,
//	_Out_ PINPUT_RECORD lpBuffer,
//	_In_  DWORD         nLength,
//	_Out_ LPDWORD       lpNumberOfEventsRead
//
// );
func XPeekConsoleInputW(t *TLS, hConsoleInput, lpBuffer uintptr, nLength uint32, lpNumberOfEventsRead uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpBuffer=%v nLength=%v lpNumberOfEventsRead=%v, (%v:)", t, lpBuffer, nLength, lpNumberOfEventsRead, origin(2))
	}
	r0, _, err := procPeekConsoleInputW.Call(hConsoleInput, lpBuffer, uintptr(nLength), lpNumberOfEventsRead, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// int WINAPIV wsprintfA(
//
//	LPSTR  ,
//	LPCSTR ,
//	...
//
// );
func XwsprintfA(t *TLS, buf, format, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v args=%v, (%v:)", t, args, origin(2))
	}
	return Xsprintf(t, buf, format, args)
}

// UINT WINAPI GetConsoleCP(void);
func XGetConsoleCP(t *TLS) uint32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r0, _, err := procGetConsoleCP.Call(0, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return uint32(r0)
}

// UINT WINAPI SetConsoleCP(UNIT);
//func setConsoleCP(cp uint32) uint32 {
//
//	r0, _, _ := procSetConsoleCP.Call(uintptr(cp), 0, 0)
//	if r0 == 0 {
//		panic("setcp failed")
//	}
//	return uint32(r0)
//}

// HANDLE CreateEventW(
//
//	LPSECURITY_ATTRIBUTES lpEventAttributes,
//	BOOL                  bManualReset,
//	BOOL                  bInitialState,
//	LPCWSTR               lpName
//
// );
func XCreateEventW(t *TLS, lpEventAttributes uintptr, bManualReset, bInitialState int32, lpName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpEventAttributes=%v bInitialState=%v lpName=%v, (%v:)", t, lpEventAttributes, bInitialState, lpName, origin(2))
	}
	r0, _, err := procCreateEventW.Call(lpEventAttributes, uintptr(bManualReset),
		uintptr(bInitialState), lpName, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return r0
}

type ThreadAdapter struct {
	token      uintptr
	tls        *TLS
	param      uintptr
	threadFunc func(*TLS, uintptr) uint32
}

func (ta *ThreadAdapter) run() uintptr {
	r := ta.threadFunc(ta.tls, ta.param)
	ta.tls.Close()
	removeObject(ta.token)
	return uintptr(r)
}

func ThreadProc(p uintptr) uintptr {
	adp, ok := winGetObject(p).(*ThreadAdapter)
	if !ok {
		panic("invalid thread")
	}
	return adp.run()
}

// HANDLE CreateThread(
//
//	LPSECURITY_ATTRIBUTES   lpThreadAttributes,
//	SIZE_T                  dwStackSize,
//	LPTHREAD_START_ROUTINE  lpStartAddress,
//	__drv_aliasesMem LPVOID lpParameter,
//	DWORD                   dwCreationFlags,
//	LPDWORD                 lpThreadId
//
// );
func XCreateThread(t *TLS, lpThreadAttributes uintptr, dwStackSize types.Size_t, lpStartAddress, lpParameter uintptr, dwCreationFlags uint32, lpThreadId uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpThreadAttributes=%v dwStackSize=%v lpParameter=%v dwCreationFlags=%v lpThreadId=%v, (%v:)", t, lpThreadAttributes, dwStackSize, lpParameter, dwCreationFlags, lpThreadId, origin(2))
	}
	f := (*struct{ f func(*TLS, uintptr) uint32 })(unsafe.Pointer(&struct{ uintptr }{lpStartAddress})).f
	var tAdp = ThreadAdapter{threadFunc: f, tls: NewTLS(), param: lpParameter}
	tAdp.token = addObject(&tAdp)

	r0, _, err := procCreateThread.Call(lpThreadAttributes, uintptr(dwStackSize),
		threadCallback, tAdp.token, uintptr(dwCreationFlags), lpThreadId)
	if r0 == 0 {
		t.setErrno(err)
	}
	return r0
}

// BOOL SetThreadPriority(
//
//	HANDLE hThread,
//	int    nPriority
//
// );
func XSetThreadPriority(t *TLS, hThread uintptr, nPriority int32) int32 {
	if __ccgo_strace {
		trc("t=%v hThread=%v nPriority=%v, (%v:)", t, hThread, nPriority, origin(2))
	}

	//r0, _, err := procSetThreadPriority.Call(hThread, uintptr(nPriority), 0)
	//if r0 == 0 {
	//	t.setErrno(err)
	//}
	//return int32(r0)
	return 1
}

// BOOL WINAPI SetConsoleMode(
//
//	_In_ HANDLE hConsoleHandle,
//	_In_ DWORD  dwMode
//
// );
func XSetConsoleMode(t *TLS, hConsoleHandle uintptr, dwMode uint32) int32 {
	if __ccgo_strace {
		trc("t=%v hConsoleHandle=%v dwMode=%v, (%v:)", t, hConsoleHandle, dwMode, origin(2))
	}
	rv, _, err := procSetConsoleMode.Call(hConsoleHandle, uintptr(dwMode), 0)
	if rv == 0 {
		t.setErrno(err)
	}
	return int32(rv)
}

func XPurgeComm(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XClearCommError(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// void DeleteCriticalSection(
//
//	LPCRITICAL_SECTION lpCriticalSection
//
// );
func XDeleteCriticalSection(t *TLS, lpCriticalSection uintptr) {
	if __ccgo_strace {
		trc("t=%v lpCriticalSection=%v, (%v:)", t, lpCriticalSection, origin(2))
	}
	procDeleteCriticalSection.Call(lpCriticalSection, 0, 0)
}

// void EnterCriticalSection(
//
//	LPCRITICAL_SECTION lpCriticalSection
//
// );
func XEnterCriticalSection(t *TLS, lpCriticalSection uintptr) {
	if __ccgo_strace {
		trc("t=%v lpCriticalSection=%v, (%v:)", t, lpCriticalSection, origin(2))
	}
	procEnterCriticalSection.Call(lpCriticalSection, 0, 0)
}

// BOOL TryEnterCriticalSection(
//
//	LPCRITICAL_SECTION lpCriticalSection
//
// );
func XTryEnterCriticalSection(t *TLS, lpCriticalSection uintptr) (r int32) {
	if __ccgo_strace {
		trc("t=%v lpCriticalSection=%v, (%v:)", t, lpCriticalSection, origin(2))
	}
	r0, _, err := procTryEnterCriticalSection.Call(lpCriticalSection)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// void LeaveCriticalSection(
//
//	LPCRITICAL_SECTION lpCriticalSection
//
// );
func XLeaveCriticalSection(t *TLS, lpCriticalSection uintptr) {
	if __ccgo_strace {
		trc("t=%v lpCriticalSection=%v, (%v:)", t, lpCriticalSection, origin(2))
	}
	procLeaveCriticalSection.Call(lpCriticalSection, 0, 0)
}

func XGetOverlappedResult(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XSetupComm(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XSetCommTimeouts(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// void InitializeCriticalSection(
//
//	LPCRITICAL_SECTION lpCriticalSection
//
// );
func XInitializeCriticalSection(t *TLS, lpCriticalSection uintptr) {
	if __ccgo_strace {
		trc("t=%v lpCriticalSection=%v, (%v:)", t, lpCriticalSection, origin(2))
	}
	// InitializeCriticalSection always succeeds, even in low memory situations.
	procInitializeCriticalSection.Call(lpCriticalSection, 0, 0)
}

func XBuildCommDCBW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XSetCommState(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XEscapeCommFunction(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XGetCommModemStatus(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// BOOL MoveFileW(
//
//	LPCWSTR lpExistingFileName,
//	LPCWSTR lpNewFileName
//
// );
func XMoveFileW(t *TLS, lpExistingFileName, lpNewFileName uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpNewFileName=%v, (%v:)", t, lpNewFileName, origin(2))
	}
	r0, _, err := procMoveFileW.Call(lpExistingFileName, lpNewFileName, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// DWORD GetFullPathNameW(
//
//	LPCWSTR lpFileName,
//	DWORD   nBufferLength,
//	LPWSTR  lpBuffer,
//	LPWSTR  *lpFilePart
//
// );
func XGetFullPathNameW(t *TLS, lpFileName uintptr, nBufferLength uint32, lpBuffer, lpFilePart uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v nBufferLength=%v lpFilePart=%v, (%v:)", t, lpFileName, nBufferLength, lpFilePart, origin(2))
	}
	r0, _, e1 := procGetFullPathNameW.Call(lpFileName, uintptr(nBufferLength), uintptr(lpBuffer), uintptr(lpFilePart), 0, 0)
	n := uint32(r0)
	if n == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return n
}

// __attribute__((dllimport)) LPWSTR CharLowerW(LPWSTR lpsz);
func XCharLowerW(tls *TLS, _lpsz uintptr) (r uintptr) {
	if __ccgo_strace {
		trc("lpsz=%+v", _lpsz)
		defer func() { trc(`XCharLowerW->%+v`, r) }()
	}
	r0, r1, err := procCharLowerW.Call(_lpsz)
	if err != windows.NOERROR {
		if __ccgo_strace {
			trc(`r0=%v r1=%v err=%v`, r0, r1, err)
		}
		tls.SetLastError(uint32(err.(windows.Errno)))
	}
	return r0
}

// BOOL CreateDirectoryW(
//
//	LPCWSTR                lpPathName,
//	LPSECURITY_ATTRIBUTES lpSecurityAttributes
//
// );
func XCreateDirectoryW(t *TLS, lpPathName, lpSecurityAttributes uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpSecurityAttributes=%v, (%v:)", t, lpSecurityAttributes, origin(2))
	}
	err := windows.CreateDirectory((*uint16)(unsafe.Pointer(lpPathName)),
		(*windows.SecurityAttributes)(unsafe.Pointer(lpSecurityAttributes)))
	if err != nil {
		t.setErrno(err)
		return 0
	}
	return 1
}

// BOOL SetFileAttributesW(
//
//	LPCWSTR lpFileName,
//	DWORD   dwFileAttributes
//
// );
func XSetFileAttributesW(t *TLS, lpFileName uintptr, dwFileAttributes uint32) int32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v dwFileAttributes=%v, (%v:)", t, lpFileName, dwFileAttributes, origin(2))
	}
	err := windows.SetFileAttributes((*uint16)(unsafe.Pointer(lpFileName)), dwFileAttributes)
	if err != nil {
		t.setErrno(err)
		return 0
	}
	return 1
}

// UINT GetTempFileNameW(
//
//	LPCWSTR lpPathName,
//	LPCWSTR lpPrefixString,
//	UINT    uUnique,
//	LPWSTR  lpTempFileName
//
// );
func XGetTempFileNameW(t *TLS, lpPathName, lpPrefixString uintptr, uUnique uint32, lpTempFileName uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v lpPrefixString=%v uUnique=%v lpTempFileName=%v, (%v:)", t, lpPrefixString, uUnique, lpTempFileName, origin(2))
	}
	r0, _, e1 := procGetTempFileNameW.Call(lpPathName, lpPrefixString, uintptr(uUnique), lpTempFileName, 0, 0)
	if r0 == 0 {
		t.setErrno(e1)
	}
	return uint32(r0)
}

// BOOL CopyFileW(
//
//	LPCWSTR lpExistingFileName,
//	LPCWSTR lpNewFileName,
//	BOOL    bFailIfExists
//
// );
func XCopyFileW(t *TLS, lpExistingFileName, lpNewFileName uintptr, bFailIfExists int32) int32 {
	if __ccgo_strace {
		trc("t=%v lpNewFileName=%v bFailIfExists=%v, (%v:)", t, lpNewFileName, bFailIfExists, origin(2))
	}
	r0, _, e1 := procCopyFileW.Call(lpExistingFileName, lpNewFileName, uintptr(bFailIfExists))
	if r0 == 0 {
		t.setErrno(e1)
	}
	return int32(r0)
}

// BOOL DeleteFileW(
//
//	LPCWSTR lpFileName
//
// );
func XDeleteFileW(t *TLS, lpFileName uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v, (%v:)", t, lpFileName, origin(2))
	}
	err := windows.DeleteFile((*uint16)(unsafe.Pointer(lpFileName)))
	if err != nil {
		t.setErrno(err)
		return 0
	}
	return 1
}

// BOOL RemoveDirectoryW(
//
//	LPCWSTR lpPathName
//
// );
func XRemoveDirectoryW(t *TLS, lpPathName uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpPathName=%v, (%v:)", t, lpPathName, origin(2))
	}
	err := windows.RemoveDirectory((*uint16)(unsafe.Pointer(lpPathName)))
	if err != nil {
		t.setErrno(err)
		return 0
	}
	return 1
}

// HANDLE FindFirstFileW(LPCWSTR lpFileName, LPWIN32_FIND_DATAW lpFindFileData);
func XFindFirstFileW(t *TLS, lpFileName, lpFindFileData uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpFindFileData=%v, (%v:)", t, lpFindFileData, origin(2))
	}
	r0, _, e1 := procFindFirstFileW.Call(lpFileName, lpFindFileData, 0)
	handle := windows.Handle(r0)
	if handle == windows.InvalidHandle {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return r0
}

// HANDLE FindFirstFileExW(
//
//	LPCWSTR            lpFileName,
//	FINDEX_INFO_LEVELS fInfoLevelId,
//	LPVOID             lpFindFileData,
//	FINDEX_SEARCH_OPS  fSearchOp,
//	LPVOID             lpSearchFilter,
//	DWORD              dwAdditionalFlags
//
// );
func XFindFirstFileExW(t *TLS, lpFileName uintptr, fInfoLevelId int32, lpFindFileData uintptr, fSearchOp int32, lpSearchFilter uintptr, dwAdditionalFlags uint32) uintptr {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v fInfoLevelId=%v lpFindFileData=%v fSearchOp=%v lpSearchFilter=%v dwAdditionalFlags=%v, (%v:)", t, lpFileName, fInfoLevelId, lpFindFileData, fSearchOp, lpSearchFilter, dwAdditionalFlags, origin(2))
	}
	r0, _, e1 := procFindFirstFileExW.Call(lpFileName, uintptr(fInfoLevelId), lpFindFileData, uintptr(fSearchOp), lpSearchFilter, uintptr(dwAdditionalFlags))
	handle := windows.Handle(r0)
	if handle == windows.InvalidHandle {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return r0
}

// BOOL FindClose(HANDLE hFindFile);
func XFindClose(t *TLS, hFindFile uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hFindFile=%v, (%v:)", t, hFindFile, origin(2))
	}
	r0, _, e1 := procFindClose.Call(hFindFile, 0, 0)
	if r0 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return int32(r0)
}

// BOOL FindNextFileW(
//
//	HANDLE             hFindFile,
//	LPWIN32_FIND_DATAW lpFindFileData
//
// );
func XFindNextFileW(t *TLS, hFindFile, lpFindFileData uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpFindFileData=%v, (%v:)", t, lpFindFileData, origin(2))
	}
	r0, _, e1 := procFindNextFileW.Call(hFindFile, lpFindFileData, 0)
	if r0 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return int32(r0)
}

// DWORD GetLogicalDriveStringsA(
//
//	DWORD nBufferLength,
//	LPSTR lpBuffer
//
// );
func XGetLogicalDriveStringsA(t *TLS, nBufferLength uint32, lpBuffer uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v nBufferLength=%v lpBuffer=%v, (%v:)", t, nBufferLength, lpBuffer, origin(2))
	}
	r0, _, err := procGetLogicalDriveStringsA.Call(uintptr(nBufferLength), lpBuffer, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return uint32(r0)
}

// BOOL GetVolumeInformationA(
//
//	LPCSTR  lpRootPathName,
//	LPSTR   lpVolumeNameBuffer,
//	DWORD   nVolumeNameSize,
//	LPDWORD lpVolumeSerialNumber,
//	LPDWORD lpMaximumComponentLength,
//	LPDWORD lpFileSystemFlags,
//	LPSTR   lpFileSystemNameBuffer,
//	DWORD   nFileSystemNameSize
//
// );
func XGetVolumeInformationA(t *TLS, lpRootPathName, lpVolumeNameBuffer uintptr, nVolumeNameSize uint32, lpVolumeSerialNumber, lpMaximumComponentLength, lpFileSystemFlags, lpFileSystemNameBuffer uintptr, nFileSystemNameSize uint32) int32 {
	if __ccgo_strace {
		trc("t=%v lpVolumeNameBuffer=%v nVolumeNameSize=%v lpFileSystemNameBuffer=%v nFileSystemNameSize=%v, (%v:)", t, lpVolumeNameBuffer, nVolumeNameSize, lpFileSystemNameBuffer, nFileSystemNameSize, origin(2))
	}
	r0, _, err := procGetVolumeInformationA.Call(lpRootPathName,
		lpVolumeNameBuffer,
		uintptr(nVolumeNameSize),
		lpVolumeSerialNumber,
		lpMaximumComponentLength,
		lpFileSystemFlags,
		lpFileSystemNameBuffer,
		uintptr(nFileSystemNameSize),
		0,
	)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// BOOL CreateHardLinkW(
//
//	LPCWSTR               lpFileName,
//	LPCWSTR               lpExistingFileName,
//	LPSECURITY_ATTRIBUTES lpSecurityAttributes
//
// );
func XCreateHardLinkW(t *TLS, lpFileName, lpExistingFileName, lpSecurityAttributes uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpSecurityAttributes=%v, (%v:)", t, lpSecurityAttributes, origin(2))
	}
	r0, _, err := procCreateHardLinkW.Call(lpFileName, lpExistingFileName, lpSecurityAttributes)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// BOOL DeviceIoControl(
//
//	HANDLE       hDevice,
//	DWORD        dwIoControlCode,
//	LPVOID       lpInBuffer,
//	DWORD        nInBufferSize,
//	LPVOID       lpOutBuffer,
//	DWORD        nOutBufferSize,
//	LPDWORD      lpBytesReturned,
//	LPOVERLAPPED lpOverlapped
//
// );
func XDeviceIoControl(t *TLS, hDevice uintptr, dwIoControlCode uint32, lpInBuffer uintptr, nInBufferSize uint32, lpOutBuffer uintptr, nOutBufferSize uint32, lpBytesReturned, lpOverlapped uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hDevice=%v dwIoControlCode=%v lpInBuffer=%v nInBufferSize=%v lpOutBuffer=%v nOutBufferSize=%v lpOverlapped=%v, (%v:)", t, hDevice, dwIoControlCode, lpInBuffer, nInBufferSize, lpOutBuffer, nOutBufferSize, lpOverlapped, origin(2))
	}
	r0, _, err := procDeviceIoControl.Call(hDevice, uintptr(dwIoControlCode), lpInBuffer,
		uintptr(nInBufferSize), lpOutBuffer, uintptr(nOutBufferSize), lpBytesReturned, lpOverlapped, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// int wcsncmp(
//
//	const wchar_t *string1,
//	const wchar_t *string2,
//	size_t count
//
// );
func Xwcsncmp(t *TLS, string1, string2 uintptr, count types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v string2=%v count=%v, (%v:)", t, string2, count, origin(2))
	}
	var s1 = goWideString(string1)
	var l1 = len(s1)
	var s2 = goWideString(string2)
	var l2 = len(s2)

	// shorter is lesser
	if l1 < l2 {
		return -1
	}
	if l2 > l1 {
		return 1
	}

	// compare at most count
	var cmpLen = count
	if types.Size_t(l1) < cmpLen {
		cmpLen = types.Size_t(l1)
	}
	return int32(strings.Compare(s1[:cmpLen], s2[:cmpLen]))
}

// int MultiByteToWideChar(
//
//	UINT                              CodePage,
//	DWORD                             dwFlags,
//	_In_NLS_string_(cbMultiByte)LPCCH lpMultiByteStr,
//	int                               cbMultiByte,
//	LPWSTR                            lpWideCharStr,
//	int                               cchWideChar
//
// );
func XMultiByteToWideChar(t *TLS, CodePage uint32, dwFlags uint32, lpMultiByteStr uintptr, cbMultiByte int32, lpWideCharStr uintptr, cchWideChar int32) int32 {
	if __ccgo_strace {
		trc("t=%v CodePage=%v dwFlags=%v lpMultiByteStr=%v cbMultiByte=%v lpWideCharStr=%v cchWideChar=%v, (%v:)", t, CodePage, dwFlags, lpMultiByteStr, cbMultiByte, lpWideCharStr, cchWideChar, origin(2))
	}
	r1, _, _ := procMultiByteToWideChar.Call(uintptr(CodePage), uintptr(dwFlags), uintptr(lpMultiByteStr),
		uintptr(cbMultiByte), uintptr(lpWideCharStr), uintptr(cchWideChar))
	return (int32(r1))
}

// void OutputDebugStringW(
//
//	LPCWSTR lpOutputString
//
// );
func XOutputDebugStringW(t *TLS, lpOutputString uintptr) {
	if __ccgo_strace {
		trc("t=%v lpOutputString=%v, (%v:)", t, lpOutputString, origin(2))
	}
	panic(todo(""))
}

func XMessageBeep(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

//====

// long _InterlockedCompareExchange(
//
//	long volatile * Destination,
//	long Exchange,
//	long Comparand
//
// );
func X_InterlockedCompareExchange(t *TLS, Destination uintptr, Exchange, Comparand long) long {
	if __ccgo_strace {
		trc("t=%v Destination=%v Comparand=%v, (%v:)", t, Destination, Comparand, origin(2))
	}

	// The function returns the initial value of the Destination parameter.
	var v = *(*int32)(unsafe.Pointer(Destination))
	_ = atomic.CompareAndSwapInt32((*int32)(unsafe.Pointer(Destination)), Comparand, Exchange)
	return long(v)
}

// int rename(const char *oldpath, const char *newpath);
func Xrename(t *TLS, oldpath, newpath uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v newpath=%v, (%v:)", t, newpath, origin(2))
	}
	panic(todo(""))
}

// BOOL AreFileApisANSI();
func XAreFileApisANSI(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}

	r0, _, _ := procAreFileApisANSI.Call(0, 0, 0)
	return int32(r0)
}

// HANDLE CreateFileA(
//
//	LPCSTR                lpFileName,
//	DWORD                 dwDesiredAccess,
//	DWORD                 dwShareMode,
//	LPSECURITY_ATTRIBUTES lpSecurityAttributes,
//	DWORD                 dwCreationDisposition,
//	DWORD                 dwFlagsAndAttributes,
//	HANDLE                hTemplateFile
//
// );
func XCreateFileA(t *TLS, lpFileName uintptr, dwDesiredAccess, dwShareMode uint32,
	lpSecurityAttributes uintptr, dwCreationDisposition, dwFlagsAndAttributes uint32, hTemplateFile uintptr) uintptr {

	r0, _, e1 := procCreateFileA.Call(lpFileName, uintptr(dwDesiredAccess), uintptr(dwShareMode), lpSecurityAttributes,
		uintptr(dwCreationDisposition), uintptr(dwFlagsAndAttributes), hTemplateFile, 0, 0)
	h := windows.Handle(r0)
	if h == windows.InvalidHandle {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return r0
	}
	return uintptr(h)

}

// HANDLE CreateFileMappingA(
//
//	HANDLE                hFile,
//	LPSECURITY_ATTRIBUTES lpFileMappingAttributes,
//	DWORD                 flProtect,
//	DWORD                 dwMaximumSizeHigh,
//	DWORD                 dwMaximumSizeLow,
//	LPCSTR                lpName
//
// );
func XCreateFileMappingA(t *TLS, hFile, lpFileMappingAttributes uintptr, flProtect, dwMaximumSizeHigh, dwMaximumSizeLow uint32, lpName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpFileMappingAttributes=%v dwMaximumSizeLow=%v lpName=%v, (%v:)", t, lpFileMappingAttributes, dwMaximumSizeLow, lpName, origin(2))
	}
	panic(todo(""))
}

// HANDLE CreateFileMappingW(
//
//	HANDLE                hFile,
//	LPSECURITY_ATTRIBUTES lpFileMappingAttributes,
//	DWORD                 flProtect,
//	DWORD                 dwMaximumSizeHigh,
//	DWORD                 dwMaximumSizeLow,
//	LPCWSTR               lpName
//
// );
func XCreateFileMappingW(t *TLS, hFile, lpFileMappingAttributes uintptr, flProtect, dwMaximumSizeHigh, dwMaximumSizeLow uint32, lpName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpFileMappingAttributes=%v dwMaximumSizeLow=%v lpName=%v, (%v:)", t, lpFileMappingAttributes, dwMaximumSizeLow, lpName, origin(2))
	}
	h, _, e1 := procCreateFileMappingW.Call(hFile, lpFileMappingAttributes, uintptr(flProtect),
		uintptr(dwMaximumSizeHigh), uintptr(dwMaximumSizeLow), lpName)
	if h == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return h
}

// HANDLE CreateMutexW(
//
//	LPSECURITY_ATTRIBUTES lpMutexAttributes,
//	BOOL                  bInitialOwner,
//	LPCWSTR               lpName
//
// );
func XCreateMutexW(t *TLS, lpMutexAttributes uintptr, bInitialOwner int32, lpName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpMutexAttributes=%v bInitialOwner=%v lpName=%v, (%v:)", t, lpMutexAttributes, bInitialOwner, lpName, origin(2))
	}
	panic(todo(""))
}

// BOOL DeleteFileA(
//
//	LPCSTR lpFileName
//
// );
func XDeleteFileA(t *TLS, lpFileName uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v, (%v:)", t, lpFileName, origin(2))
	}
	panic(todo(""))
}

// DWORD FormatMessageA(
//
//	DWORD   dwFlags,
//	LPCVOID lpSource,
//	DWORD   dwMessageId,
//	DWORD   dwLanguageId,
//	LPSTR   lpBuffer,
//	DWORD   nSize,
//	va_list *Arguments
//
// );
func XFormatMessageA(t *TLS, dwFlagsAndAttributes uint32, lpSource uintptr, dwMessageId, dwLanguageId uint32, lpBuffer uintptr, nSize uint32, Arguments uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v dwFlagsAndAttributes=%v lpSource=%v dwLanguageId=%v lpBuffer=%v nSize=%v Arguments=%v, (%v:)", t, dwFlagsAndAttributes, lpSource, dwLanguageId, lpBuffer, nSize, Arguments, origin(2))
	}
	panic(todo(""))
}

// DWORD FormatMessageW(
//
//	DWORD   dwFlags,
//	LPCVOID lpSource,
//	DWORD   dwMessageId,
//	DWORD   dwLanguageId,
//	LPWSTR  lpBuffer,
//	DWORD   nSize,
//	va_list *Arguments
//
// );
func XFormatMessageW(t *TLS, dwFlags uint32, lpSource uintptr, dwMessageId, dwLanguageId uint32, lpBuffer uintptr, nSize uint32, Arguments uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v dwFlags=%v lpSource=%v dwLanguageId=%v lpBuffer=%v nSize=%v Arguments=%v, (%v:)", t, dwFlags, lpSource, dwLanguageId, lpBuffer, nSize, Arguments, origin(2))
	}
	r0, _, e1 := procFormatMessageW.Call(uintptr(dwFlags), lpSource, uintptr(dwMessageId), uintptr(dwLanguageId),
		lpBuffer, uintptr(nSize), Arguments, 0, 0)
	n := uint32(r0)
	if n == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return n
}

// BOOL FreeLibrary(HMODULE hLibModule);
func XFreeLibrary(t *TLS, hLibModule uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hLibModule=%v, (%v:)", t, hLibModule, origin(2))
	}
	panic(todo(""))
}

// DWORD GetCurrentProcessId();
func XGetCurrentProcessId(t *TLS) uint32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r0, _, _ := procGetCurrentProcessId.Call(0, 0, 0)
	pid := uint32(r0)
	return pid
}

// BOOL GetDiskFreeSpaceA(
//
//	LPCSTR  lpRootPathName,
//	LPDWORD lpSectorsPerCluster,
//	LPDWORD lpBytesPerSector,
//	LPDWORD lpNumberOfFreeClusters,
//	LPDWORD lpTotalNumberOfClusters
//
// );
func XGetDiskFreeSpaceA(t *TLS, lpRootPathName, lpSectorsPerCluster, lpBytesPerSector, lpNumberOfFreeClusters, lpTotalNumberOfClusters uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpTotalNumberOfClusters=%v, (%v:)", t, lpTotalNumberOfClusters, origin(2))
	}
	panic(todo(""))
}

// BOOL GetDiskFreeSpaceW(
//
//	LPCWSTR lpRootPathName,
//	LPDWORD lpSectorsPerCluster,
//	LPDWORD lpBytesPerSector,
//	LPDWORD lpNumberOfFreeClusters,
//	LPDWORD lpTotalNumberOfClusters
//
// );
func XGetDiskFreeSpaceW(t *TLS, lpRootPathName, lpSectorsPerCluster, lpBytesPerSector, lpNumberOfFreeClusters, lpTotalNumberOfClusters uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpTotalNumberOfClusters=%v, (%v:)", t, lpTotalNumberOfClusters, origin(2))
	}
	panic(todo(""))
}

// DWORD GetFileAttributesA(
//
//	LPCSTR lpFileName
//
// );
func XGetFileAttributesA(t *TLS, lpFileName uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v, (%v:)", t, lpFileName, origin(2))
	}
	r0, _, err := procGetFileAttributesA.Call(lpFileName, 0, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return uint32(r0)
}

// BOOL GetFileAttributesExW(
//
//	LPCWSTR                lpFileName,
//	GET_FILEEX_INFO_LEVELS fInfoLevelId,
//	LPVOID                 lpFileInformation
//
// );
func XGetFileAttributesExW(t *TLS, lpFileName uintptr, fInfoLevelId int32, lpFileInformation uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v fInfoLevelId=%v lpFileInformation=%v, (%v:)", t, lpFileName, fInfoLevelId, lpFileInformation, origin(2))
	}
	r1, _, e1 := procGetFileAttributesExW.Call(lpFileName, uintptr(fInfoLevelId), lpFileInformation)
	if r1 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return 0
	}
	return int32(r1)
}

// DWORD GetFileSize(
//
//	HANDLE  hFile,
//	LPDWORD lpFileSizeHigh
//
// );
func XGetFileSize(t *TLS, hFile, lpFileSizeHigh uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v lpFileSizeHigh=%v, (%v:)", t, lpFileSizeHigh, origin(2))
	}
	r1, _, e1 := procGetFileSize.Call(hFile, lpFileSizeHigh, 0)
	if r1 == math.MaxUint32 {
		if lpFileSizeHigh == 0 {
			// If the function fails and lpFileSizeHigh is NULL, the return value is INVALID_FILE_SIZE.
			// Note that if the return value is INVALID_FILE_SIZE (0xffffffff),
			// an application must call GetLastError to determine whether the function has succeeded or failed.
			t.setErrno(e1)
			return math.MaxUint32
		} else {
			// If the function fails and lpFileSizeHigh is non-NULL, the return value is INVALID_FILE_SIZE
			// and GetLastError will return a value other than NO_ERROR.
			t.setErrno(e1)
			return math.MaxUint32
		}
	}
	return uint32(r1)
}

// DWORD GetFullPathNameA(
//
//	LPCSTR lpFileName,
//	DWORD  nBufferLength,
//	LPSTR  lpBuffer,
//	LPSTR  *lpFilePart
//
// );
func XGetFullPathNameA(t *TLS, lpFileName uintptr, nBufferLength uint32, lpBuffer, lpFilePart uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v nBufferLength=%v lpFilePart=%v, (%v:)", t, lpFileName, nBufferLength, lpFilePart, origin(2))
	}
	panic(todo(""))
}

// FARPROC GetProcAddress(HMODULE hModule, LPCSTR  lpProcName);
func XGetProcAddress(t *TLS, hModule, lpProcName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpProcName=%v, (%v:)", t, lpProcName, origin(2))
	}

	return 0

	//panic(todo(GoString(lpProcName)))
	//
	//r0, _, err := procGetProcAddress.Call(hModule, lpProcName, 0)
	//if r0 == 0 {
	//	t.setErrno(err)
	//}
	//return r0
}

// NTSYSAPI NTSTATUS RtlGetVersion( // ntdll.dll
//
//	PRTL_OSVERSIONINFOW lpVersionInformation
//
// );
func XRtlGetVersion(t *TLS, lpVersionInformation uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpVersionInformation=%v, (%v:)", t, lpVersionInformation, origin(2))
	}
	panic(todo(""))
}

// void GetSystemInfo(
//
//	LPSYSTEM_INFO lpSystemInfo
//
// );
func XGetSystemInfo(t *TLS, lpSystemInfo uintptr) {
	if __ccgo_strace {
		trc("t=%v lpSystemInfo=%v, (%v:)", t, lpSystemInfo, origin(2))
	}
	procGetSystemInfo.Call(lpSystemInfo, 0, 0)
}

// void GetSystemTime(LPSYSTEMTIME lpSystemTime);
func XGetSystemTime(t *TLS, lpSystemTime uintptr) {
	if __ccgo_strace {
		trc("t=%v lpSystemTime=%v, (%v:)", t, lpSystemTime, origin(2))
	}
	procGetSystemTime.Call(lpSystemTime, 0, 0)
}

// void GetSystemTimeAsFileTime(
//
//	LPFILETIME lpSystemTimeAsFileTime
//
// );
func XGetSystemTimeAsFileTime(t *TLS, lpSystemTimeAsFileTime uintptr) {
	if __ccgo_strace {
		trc("t=%v lpSystemTimeAsFileTime=%v, (%v:)", t, lpSystemTimeAsFileTime, origin(2))
	}
	procGetSystemTimeAsFileTime.Call(lpSystemTimeAsFileTime, 0, 0)
}

// DWORD GetTempPathA(
//
//	DWORD nBufferLength,
//	LPSTR lpBuffer
//
// );
func XGetTempPathA(t *TLS, nBufferLength uint32, lpBuffer uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v nBufferLength=%v lpBuffer=%v, (%v:)", t, nBufferLength, lpBuffer, origin(2))
	}
	panic(todo(""))
}

// DWORD GetTempPathW(
//
//	DWORD  nBufferLength,
//	LPWSTR lpBuffer
//
// );
func XGetTempPathW(t *TLS, nBufferLength uint32, lpBuffer uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v nBufferLength=%v lpBuffer=%v, (%v:)", t, nBufferLength, lpBuffer, origin(2))
	}
	rv, err := windows.GetTempPath(nBufferLength, (*uint16)(unsafe.Pointer(lpBuffer)))
	if err != nil {
		t.setErrno(err)
	}
	return rv
}

// DWORD GetTickCount();
func XGetTickCount(t *TLS) uint32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r0, _, _ := procGetTickCount.Call(0, 0, 0)
	return uint32(r0)
}

// BOOL GetVersionExA(
//
//	LPOSVERSIONINFOA lpVersionInformation
//
// );
func XGetVersionExA(t *TLS, lpVersionInformation uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpVersionInformation=%v, (%v:)", t, lpVersionInformation, origin(2))
	}
	r0, _, err := procGetVersionExA.Call(lpVersionInformation, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// HANDLE HeapCreate(
//
//	DWORD  flOptions,
//	SIZE_T dwInitialSize,
//	SIZE_T dwMaximumSize
//
// );
func XHeapCreate(t *TLS, flOptions uint32, dwInitialSize, dwMaximumSize types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v flOptions=%v dwMaximumSize=%v, (%v:)", t, flOptions, dwMaximumSize, origin(2))
	}
	panic(todo(""))
}

// BOOL HeapDestroy(
//
//	HANDLE hHeap
//
// );
func XHeapDestroy(t *TLS, hHeap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hHeap=%v, (%v:)", t, hHeap, origin(2))
	}
	panic(todo(""))
}

// LPVOID HeapReAlloc(
//
//	HANDLE                 hHeap,
//	DWORD                  dwFlags,
//	_Frees_ptr_opt_ LPVOID lpMem,
//	SIZE_T                 dwBytes
//
// );
func XHeapReAlloc(t *TLS, hHeap uintptr, dwFlags uint32, lpMem uintptr, dwBytes types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v hHeap=%v dwFlags=%v lpMem=%v dwBytes=%v, (%v:)", t, hHeap, dwFlags, lpMem, dwBytes, origin(2))
	}
	panic(todo(""))
}

// SIZE_T HeapSize(
//
//	HANDLE  hHeap,
//	DWORD   dwFlags,
//	LPCVOID lpMem
//
// );
func XHeapSize(t *TLS, hHeap uintptr, dwFlags uint32, lpMem uintptr) types.Size_t {
	if __ccgo_strace {
		trc("t=%v hHeap=%v dwFlags=%v lpMem=%v, (%v:)", t, hHeap, dwFlags, lpMem, origin(2))
	}
	panic(todo(""))
}

// BOOL HeapValidate(
//
//	HANDLE  hHeap,
//	DWORD   dwFlags,
//	LPCVOID lpMem
//
// );
func XHeapValidate(t *TLS, hHeap uintptr, dwFlags uint32, lpMem uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hHeap=%v dwFlags=%v lpMem=%v, (%v:)", t, hHeap, dwFlags, lpMem, origin(2))
	}
	panic(todo(""))
}

// SIZE_T HeapCompact(
//
//	HANDLE hHeap,
//	DWORD  dwFlags
//
// );
func XHeapCompact(t *TLS, hHeap uintptr, dwFlags uint32) types.Size_t {
	if __ccgo_strace {
		trc("t=%v hHeap=%v dwFlags=%v, (%v:)", t, hHeap, dwFlags, origin(2))
	}
	panic(todo(""))
}

// HMODULE LoadLibraryA(LPCSTR lpLibFileName);
func XLoadLibraryA(t *TLS, lpLibFileName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpLibFileName=%v, (%v:)", t, lpLibFileName, origin(2))
	}
	panic(todo(""))
}

// HMODULE LoadLibraryW(
//
//	LPCWSTR lpLibFileName
//
// );
func XLoadLibraryW(t *TLS, lpLibFileName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpLibFileName=%v, (%v:)", t, lpLibFileName, origin(2))
	}
	panic(todo(""))
}

// HLOCAL LocalFree(
//
//	HLOCAL hMem
//
// );
func XLocalFree(t *TLS, hMem uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v hMem=%v, (%v:)", t, hMem, origin(2))
	}
	h, err := windows.LocalFree(windows.Handle(hMem))
	if h != 0 {
		if err != nil {
			t.setErrno(err)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return uintptr(h)
	}
	return 0
}

// BOOL LockFile(
//
//	HANDLE hFile,
//	DWORD  dwFileOffsetLow,
//	DWORD  dwFileOffsetHigh,
//	DWORD  nNumberOfBytesToLockLow,
//	DWORD  nNumberOfBytesToLockHigh
//
// );
func XLockFile(t *TLS, hFile uintptr, dwFileOffsetLow, dwFileOffsetHigh, nNumberOfBytesToLockLow, nNumberOfBytesToLockHigh uint32) int32 {
	if __ccgo_strace {
		trc("t=%v hFile=%v nNumberOfBytesToLockHigh=%v, (%v:)", t, hFile, nNumberOfBytesToLockHigh, origin(2))
	}

	r1, _, e1 := procLockFile.Call(hFile, uintptr(dwFileOffsetLow), uintptr(dwFileOffsetHigh), uintptr(nNumberOfBytesToLockLow), uintptr(nNumberOfBytesToLockHigh), 0)
	if r1 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return 0
	}
	return int32(r1)

}

// BOOL LockFileEx(
//
//	HANDLE       hFile,
//	DWORD        dwFlags,
//	DWORD        dwReserved,
//	DWORD        nNumberOfBytesToLockLow,
//	DWORD        nNumberOfBytesToLockHigh,
//	LPOVERLAPPED lpOverlapped
//
// );
func XLockFileEx(t *TLS, hFile uintptr, dwFlags, dwReserved, nNumberOfBytesToLockLow, nNumberOfBytesToLockHigh uint32, lpOverlapped uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hFile=%v nNumberOfBytesToLockHigh=%v lpOverlapped=%v, (%v:)", t, hFile, nNumberOfBytesToLockHigh, lpOverlapped, origin(2))
	}
	r1, _, e1 := procLockFileEx.Call(hFile, uintptr(dwFlags), uintptr(dwReserved), uintptr(nNumberOfBytesToLockLow), uintptr(nNumberOfBytesToLockHigh), lpOverlapped)
	if r1 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return 0
	}
	return int32(r1)
}

// LPVOID MapViewOfFile(
//
//	HANDLE hFileMappingObject,
//	DWORD  dwDesiredAccess,
//	DWORD  dwFileOffsetHigh,
//	DWORD  dwFileOffsetLow,
//	SIZE_T dwNumberOfBytesToMap
//
// );
func XMapViewOfFile(t *TLS, hFileMappingObject uintptr, dwDesiredAccess, dwFileOffsetHigh, dwFileOffsetLow uint32, dwNumberOfBytesToMap types.Size_t) uintptr {
	if __ccgo_strace {
		trc("t=%v hFileMappingObject=%v dwFileOffsetLow=%v dwNumberOfBytesToMap=%v, (%v:)", t, hFileMappingObject, dwFileOffsetLow, dwNumberOfBytesToMap, origin(2))
	}
	h, _, e1 := procMapViewOfFile.Call(hFileMappingObject, uintptr(dwDesiredAccess),
		uintptr(dwFileOffsetHigh), uintptr(dwFileOffsetLow), uintptr(dwNumberOfBytesToMap), 0)
	if h == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return h
}

// BOOL QueryPerformanceCounter(
//
//	LARGE_INTEGER *lpPerformanceCount
//
// );
func XQueryPerformanceCounter(t *TLS, lpPerformanceCount uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpPerformanceCount=%v, (%v:)", t, lpPerformanceCount, origin(2))
	}
	r0, _, _ := procQueryPerformanceCounter.Call(lpPerformanceCount, 0, 0)
	return int32(r0)
}

// void Sleep(
//
//	DWORD dwMilliseconds
//
// );
func XSleep(t *TLS, dwMilliseconds uint32) {
	if __ccgo_strace {
		trc("t=%v dwMilliseconds=%v, (%v:)", t, dwMilliseconds, origin(2))
	}
	gotime.Sleep(gotime.Duration(dwMilliseconds) * gotime.Millisecond)
}

// BOOL SystemTimeToFileTime(const SYSTEMTIME *lpSystemTime, LPFILETIME lpFileTime);
func XSystemTimeToFileTime(t *TLS, lpSystemTime, lpFileTime uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpFileTime=%v, (%v:)", t, lpFileTime, origin(2))
	}
	r0, _, _ := procSystemTimeToFileTime.Call(lpSystemTime, lpFileTime, 0)
	return int32(r0)
}

// BOOL UnlockFile(
//
//	HANDLE hFile,
//	DWORD  dwFileOffsetLow,
//	DWORD  dwFileOffsetHigh,
//	DWORD  nNumberOfBytesToUnlockLow,
//	DWORD  nNumberOfBytesToUnlockHigh
//
// );
func XUnlockFile(t *TLS, hFile uintptr, dwFileOffsetLow, dwFileOffsetHigh, nNumberOfBytesToUnlockLow, nNumberOfBytesToUnlockHigh uint32) int32 {
	if __ccgo_strace {
		trc("t=%v hFile=%v nNumberOfBytesToUnlockHigh=%v, (%v:)", t, hFile, nNumberOfBytesToUnlockHigh, origin(2))
	}
	r1, _, e1 := procUnlockFile.Call(hFile, uintptr(dwFileOffsetLow), uintptr(dwFileOffsetHigh), uintptr(nNumberOfBytesToUnlockLow), uintptr(nNumberOfBytesToUnlockHigh), 0)
	if r1 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return 0
	}
	return int32(r1)
}

// BOOL UnlockFileEx(
//
//	HANDLE       hFile,
//	DWORD        dwReserved,
//	DWORD        nNumberOfBytesToUnlockLow,
//	DWORD        nNumberOfBytesToUnlockHigh,
//	LPOVERLAPPED lpOverlapped
//
// );
func XUnlockFileEx(t *TLS, hFile uintptr, dwReserved, nNumberOfBytesToUnlockLow, nNumberOfBytesToUnlockHigh uint32, lpOverlapped uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hFile=%v nNumberOfBytesToUnlockHigh=%v lpOverlapped=%v, (%v:)", t, hFile, nNumberOfBytesToUnlockHigh, lpOverlapped, origin(2))
	}
	r1, _, e1 := procUnlockFileEx.Call(hFile, uintptr(dwReserved), uintptr(nNumberOfBytesToUnlockLow), uintptr(nNumberOfBytesToUnlockHigh), lpOverlapped, 0)
	if r1 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return 0
	}
	return int32(r1)
}

// BOOL UnmapViewOfFile(
//
//	LPCVOID lpBaseAddress
//
// );
func XUnmapViewOfFile(t *TLS, lpBaseAddress uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpBaseAddress=%v, (%v:)", t, lpBaseAddress, origin(2))
	}
	err := windows.UnmapViewOfFile(lpBaseAddress)
	if err != nil {
		t.setErrno(err)
		return 0
	}
	return 1
}

// int WideCharToMultiByte(
//
//	UINT                               CodePage,
//	DWORD                              dwFlags,
//	_In_NLS_string_(cchWideChar)LPCWCH lpWideCharStr,
//	int                                cchWideChar,
//	LPSTR                              lpMultiByteStr,
//	int                                cbMultiByte,
//	LPCCH                              lpDefaultChar,
//	LPBOOL                             lpUsedDefaultChar
//
// );
func XWideCharToMultiByte(t *TLS, CodePage uint32, dwFlags uint32, lpWideCharStr uintptr, cchWideChar int32, lpMultiByteStr uintptr, cbMultiByte int32, lpDefaultChar, lpUsedDefaultChar uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v CodePage=%v dwFlags=%v lpWideCharStr=%v cchWideChar=%v lpMultiByteStr=%v cbMultiByte=%v lpUsedDefaultChar=%v, (%v:)", t, CodePage, dwFlags, lpWideCharStr, cchWideChar, lpMultiByteStr, cbMultiByte, lpUsedDefaultChar, origin(2))
	}
	r1, _, _ := procWideCharToMultiByte.Call(uintptr(CodePage), uintptr(dwFlags), lpWideCharStr,
		uintptr(cchWideChar), lpMultiByteStr, uintptr(cbMultiByte),
		lpDefaultChar, lpUsedDefaultChar, 0)
	return (int32(r1))
}

// void OutputDebugStringA(
//
//	LPCSTR lpOutputString
//
// )
func XOutputDebugStringA(t *TLS, lpOutputString uintptr) {
	if __ccgo_strace {
		trc("t=%v lpOutputString=%v, (%v:)", t, lpOutputString, origin(2))
	}
	panic(todo(""))
}

// BOOL FlushViewOfFile(
//
//	LPCVOID lpBaseAddress,
//	SIZE_T  dwNumberOfBytesToFlush
//
// );
func XFlushViewOfFile(t *TLS, lpBaseAddress uintptr, dwNumberOfBytesToFlush types.Size_t) int32 {
	if __ccgo_strace {
		trc("t=%v lpBaseAddress=%v dwNumberOfBytesToFlush=%v, (%v:)", t, lpBaseAddress, dwNumberOfBytesToFlush, origin(2))
	}
	err := windows.FlushViewOfFile(lpBaseAddress, uintptr(dwNumberOfBytesToFlush))
	if err != nil {
		t.setErrno(err)
		return 0
	}
	return 1
}

type _ino_t = uint16 /* types.h:43:24 */
type _dev_t = uint32 /* types.h:51:22 */
type _stat64 = struct {
	Fst_dev   _dev_t
	Fst_ino   _ino_t
	Fst_mode  uint16
	Fst_nlink int16
	Fst_uid   int16
	Fst_gid   int16
	_         [2]byte
	Fst_rdev  _dev_t
	_         [4]byte
	Fst_size  int64
	Fst_atime int64
	Fst_mtime int64
	Fst_ctime int64
} /* _mingw_stat64.h:83:3 */

var (
	Windows_Tick   int64 = 10000000
	SecToUnixEpoch int64 = 11644473600
)

func WindowsTickToUnixSeconds(windowsTicks int64) int64 {
	return (windowsTicks/Windows_Tick - SecToUnixEpoch)
}

// int _stat64(const char *path, struct __stat64 *buffer);
func X_stat64(t *TLS, path, buffer uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v buffer=%v, (%v:)", t, buffer, origin(2))
	}

	var fa windows.Win32FileAttributeData
	r1, _, e1 := procGetFileAttributesExA.Call(path, windows.GetFileExInfoStandard, (uintptr)(unsafe.Pointer(&fa)))
	if r1 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
		return -1
	}

	var bStat64 = (*_stat64)(unsafe.Pointer(buffer))
	var accessTime = int64(fa.LastAccessTime.HighDateTime)<<32 + int64(fa.LastAccessTime.LowDateTime)
	bStat64.Fst_atime = WindowsTickToUnixSeconds(accessTime)
	var modTime = int64(fa.LastWriteTime.HighDateTime)<<32 + int64(fa.LastWriteTime.LowDateTime)
	bStat64.Fst_mtime = WindowsTickToUnixSeconds(modTime)
	var crTime = int64(fa.CreationTime.HighDateTime)<<32 + int64(fa.CreationTime.LowDateTime)
	bStat64.Fst_ctime = WindowsTickToUnixSeconds(crTime)
	var fSz = int64(fa.FileSizeHigh)<<32 + int64(fa.FileSizeLow)
	bStat64.Fst_size = fSz
	bStat64.Fst_mode = WindowsAttrbiutesToStat(fa.FileAttributes)

	return 0
}

func WindowsAttrbiutesToStat(fa uint32) uint16 {
	var src_mode = fa & 0xff
	var st_mode uint16
	if (src_mode & windows.FILE_ATTRIBUTE_DIRECTORY) != 0 {
		st_mode = windows.S_IFDIR
	} else {
		st_mode = windows.S_IFREG
	}

	if src_mode&windows.FILE_ATTRIBUTE_READONLY != 0 {
		st_mode = st_mode | windows.S_IRUSR
	} else {
		st_mode = st_mode | windows.S_IRUSR | windows.S_IWUSR
	}
	// fill group fields
	st_mode = st_mode | (st_mode&0x700)>>3
	st_mode = st_mode | (st_mode&0x700)>>6
	return st_mode
}

// int _chsize(
//
//	int fd,
//	long size
//
// );
func X_chsize(t *TLS, fd int32, size long) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v size=%v, (%v:)", t, fd, size, origin(2))
	}

	f, ok := fdToFile(fd)
	if !ok {
		t.setErrno(EBADF)
		return -1
	}

	err := windows.Ftruncate(f.Handle, int64(size))
	if err != nil {
		t.setErrno(err)
		return -1
	}

	return 0
}

// int _snprintf(char *str, size_t size, const char *format, ...);
func X_snprintf(t *TLS, str uintptr, size types.Size_t, format, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v str=%v size=%v args=%v, (%v:)", t, str, size, args, origin(2))
	}
	return Xsnprintf(t, str, size, format, args)
}

const wErr_ERROR_INSUFFICIENT_BUFFER = 122

func win32FindDataToFileInfo(t *TLS, fdata *stat.X_finddata64i32_t, wfd *windows.Win32finddata) int32 {
	// t64 = 64-bit time value
	var accessTime = int64(wfd.LastAccessTime.HighDateTime)<<32 + int64(wfd.LastAccessTime.LowDateTime)
	fdata.Ftime_access = WindowsTickToUnixSeconds(accessTime)
	var modTime = int64(wfd.LastWriteTime.HighDateTime)<<32 + int64(wfd.LastWriteTime.LowDateTime)
	fdata.Ftime_write = WindowsTickToUnixSeconds(modTime)
	var crTime = int64(wfd.CreationTime.HighDateTime)<<32 + int64(wfd.CreationTime.LowDateTime)
	fdata.Ftime_create = WindowsTickToUnixSeconds(crTime)
	// i32 = 32-bit size
	fdata.Fsize = wfd.FileSizeLow
	fdata.Fattrib = wfd.FileAttributes

	var cp = XGetConsoleCP(t)
	var wcFn = (uintptr)(unsafe.Pointer(&wfd.FileName[0]))
	var mbcsFn = (uintptr)(unsafe.Pointer(&fdata.Fname[0]))
	rv := XWideCharToMultiByte(t, cp, 0, wcFn, -1, mbcsFn, 260, 0, 0)
	if rv == wErr_ERROR_INSUFFICIENT_BUFFER {
		t.setErrno(errno.ENOMEM)
		return -1
	}
	return 0
}

// intptr_t _findfirst64i32(
//
//	const char *filespec,
//	struct _finddata64i32_t *fileinfo
//
// );
func X_findfirst64i32(t *TLS, filespec, fileinfo uintptr) types.Intptr_t {
	if __ccgo_strace {
		trc("t=%v fileinfo=%v, (%v:)", t, fileinfo, origin(2))
	}

	// Note: this is the 'narrow' character findfirst -- expects output
	// as mbcs -- conversion below -- via ToFileInfo

	var gsFileSpec = GoString(filespec)
	namep, err := windows.UTF16PtrFromString(gsFileSpec)
	if err != nil {
		t.setErrno(err)
		return types.Intptr_t(-1)
	}

	var fdata = (*stat.X_finddata64i32_t)(unsafe.Pointer(fileinfo))
	var wfd windows.Win32finddata
	h, err := windows.FindFirstFile((*uint16)(unsafe.Pointer(namep)), &wfd)
	if err != nil {
		t.setErrno(err)
		return types.Intptr_t(-1)
	}
	rv := win32FindDataToFileInfo(t, fdata, &wfd)
	if rv != 0 {
		if h != 0 {
			windows.FindClose(h)
		}
		return types.Intptr_t(-1)
	}
	return types.Intptr_t(h)
}

// int _findnext64i32(
//
//	intptr_t handle,
//	struct _finddata64i32_t *fileinfo
//
// );
func X_findnext64i32(t *TLS, handle types.Intptr_t, fileinfo uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v handle=%v fileinfo=%v, (%v:)", t, handle, fileinfo, origin(2))
	}

	var fdata = (*stat.X_finddata64i32_t)(unsafe.Pointer(fileinfo))
	var wfd windows.Win32finddata

	err := windows.FindNextFile(windows.Handle(handle), &wfd)
	if err != nil {
		t.setErrno(err)
		return -1
	}

	rv := win32FindDataToFileInfo(t, fdata, &wfd)
	if rv != 0 {
		return -1
	}
	return 0
}

// int _findclose(
//
//	intptr_t handle
//
// );
func X_findclose(t *TLS, handle types.Intptr_t) int32 {
	if __ccgo_strace {
		trc("t=%v handle=%v, (%v:)", t, handle, origin(2))
	}

	err := windows.FindClose(windows.Handle(handle))
	if err != nil {
		t.setErrno(err)
		return -1
	}
	return 0
}

// DWORD GetEnvironmentVariableA(
//
//	LPCSTR lpName,
//	LPSTR  lpBuffer,
//	DWORD  nSize
//
// );
func XGetEnvironmentVariableA(t *TLS, lpName, lpBuffer uintptr, nSize uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v lpBuffer=%v nSize=%v, (%v:)", t, lpBuffer, nSize, origin(2))
	}
	r0, _, e1 := procGetEnvironmentVariableA.Call(lpName, lpBuffer, uintptr(nSize))
	n := uint32(r0)
	if n == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return n
}

// int _fstat64(
//
//	int fd,
//	struct __stat64 *buffer
//
// );
func X_fstat64(t *TLS, fd int32, buffer uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v buffer=%v, (%v:)", t, fd, buffer, origin(2))
	}

	f, ok := fdToFile(fd)
	if !ok {
		t.setErrno(EBADF)
		return -1
	}

	var d windows.ByHandleFileInformation
	err := windows.GetFileInformationByHandle(f.Handle, &d)
	if err != nil {
		t.setErrno(EBADF)
		return -1
	}

	var bStat64 = (*_stat64)(unsafe.Pointer(buffer))
	var accessTime = int64(d.LastAccessTime.HighDateTime)<<32 + int64(d.LastAccessTime.LowDateTime)
	bStat64.Fst_atime = WindowsTickToUnixSeconds(accessTime)
	var modTime = int64(d.LastWriteTime.HighDateTime)<<32 + int64(d.LastWriteTime.LowDateTime)
	bStat64.Fst_mtime = WindowsTickToUnixSeconds(modTime)
	var crTime = int64(d.CreationTime.HighDateTime)<<32 + int64(d.CreationTime.LowDateTime)
	bStat64.Fst_ctime = WindowsTickToUnixSeconds(crTime)
	var fSz = int64(d.FileSizeHigh)<<32 + int64(d.FileSizeLow)
	bStat64.Fst_size = fSz
	bStat64.Fst_mode = WindowsAttrbiutesToStat(d.FileAttributes)

	return 0
}

// HANDLE CreateEventA(
//
//	LPSECURITY_ATTRIBUTES lpEventAttributes,
//	BOOL                  bManualReset,
//	BOOL                  bInitialState,
//	LPCSTR                lpName
//
// );
func XCreateEventA(t *TLS, lpEventAttributes uintptr, bManualReset, bInitialState int32, lpName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpEventAttributes=%v bInitialState=%v lpName=%v, (%v:)", t, lpEventAttributes, bInitialState, lpName, origin(2))
	}
	r0, _, err := procCreateEventA.Call(lpEventAttributes, uintptr(bManualReset),
		uintptr(bInitialState), lpName, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return r0
}

// BOOL WINAPI CancelSynchronousIo(
//
//	_In_ HANDLE hThread
//
// );
func XCancelSynchronousIo(t *TLS, hThread uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hThread=%v, (%v:)", t, hThread, origin(2))
	}
	panic(todo(""))
}

func X_endthreadex(t *TLS, _ ...interface{}) {
	// NOOP
}

// The calling convention for beginthread is cdecl -- but in this
// case we're just intercepting it and sending it through CreateThread which expects stdcall
// and gets that via the go callback. This is safe because the thread is calling into go
// not a cdecl function which would expect the stack setup of cdecl.
func X_beginthread(t *TLS, procAddr uintptr, stack_sz uint32, args uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v procAddr=%v stack_sz=%v args=%v, (%v:)", t, procAddr, stack_sz, args, origin(2))
	}
	f := (*struct{ f func(*TLS, uintptr) uint32 })(unsafe.Pointer(&struct{ uintptr }{procAddr})).f
	var tAdp = ThreadAdapter{threadFunc: f, tls: NewTLS(), param: args}
	tAdp.token = addObject(&tAdp)

	r0, _, err := procCreateThread.Call(0, uintptr(stack_sz),
		threadCallback, tAdp.token, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// uintptr_t _beginthreadex( // NATIVE CODE
//
//	void *security,
//	unsigned stack_size,
//	unsigned ( __stdcall *start_address )( void * ),
//	void *arglist,
//	unsigned initflag,
//	unsigned *thrdaddr
//
// );
func X_beginthreadex(t *TLS, _ uintptr, stack_sz uint32, procAddr uintptr, args uintptr, initf uint32, thAddr uintptr) int32 {
	f := (*struct{ f func(*TLS, uintptr) uint32 })(unsafe.Pointer(&struct{ uintptr }{procAddr})).f
	var tAdp = ThreadAdapter{threadFunc: f, tls: NewTLS(), param: args}
	tAdp.token = addObject(&tAdp)

	r0, _, err := procCreateThread.Call(0, uintptr(stack_sz),
		threadCallback, tAdp.token, uintptr(initf), thAddr)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// DWORD GetCurrentThreadId();
func XGetCurrentThreadId(t *TLS) uint32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r0, _, _ := procGetCurrentThreadId.Call(0, 0, 0)
	return uint32(r0)
	//return uint32(t.ID)
}

// BOOL GetExitCodeThread(
//
//	HANDLE  hThread,
//	LPDWORD lpExitCode
//
// );
func XGetExitCodeThread(t *TLS, hThread, lpExitCode uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpExitCode=%v, (%v:)", t, lpExitCode, origin(2))
	}
	r0, _, _ := procGetExitCodeThread.Call(hThread, lpExitCode, 0)
	return int32(r0)
}

// DWORD WaitForSingleObjectEx(
//
//	HANDLE hHandle,
//	DWORD  dwMilliseconds,
//	BOOL   bAlertable
//
// );
func XWaitForSingleObjectEx(t *TLS, hHandle uintptr, dwMilliseconds uint32, bAlertable int32) uint32 {
	if __ccgo_strace {
		trc("t=%v hHandle=%v dwMilliseconds=%v bAlertable=%v, (%v:)", t, hHandle, dwMilliseconds, bAlertable, origin(2))
	}
	rv, _, _ := procWaitForSingleObjectEx.Call(hHandle, uintptr(dwMilliseconds), uintptr(bAlertable))
	return uint32(rv)
}

// DWORD MsgWaitForMultipleObjectsEx(
//
//	DWORD        nCount,
//	const HANDLE *pHandles,
//	DWORD        dwMilliseconds,
//	DWORD        dwWakeMask,
//	DWORD        dwFlags
//
// );
func XMsgWaitForMultipleObjectsEx(t *TLS, nCount uint32, pHandles uintptr, dwMilliseconds, dwWakeMask, dwFlags uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v nCount=%v pHandles=%v dwFlags=%v, (%v:)", t, nCount, pHandles, dwFlags, origin(2))
	}
	r0, _, err := procMsgWaitForMultipleObjectsEx.Call(uintptr(nCount),
		pHandles,
		uintptr(dwMilliseconds),
		uintptr(dwWakeMask),
		uintptr(dwFlags),
		0,
	)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return uint32(r0)
}

func XMessageBoxW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// DWORD GetModuleFileNameW(
//
//	HMODULE hModule,
//	LPWSTR  lpFileName,
//	DWORD   nSize
//
// );
func XGetModuleFileNameW(t *TLS, hModule, lpFileName uintptr, nSize uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v nSize=%v, (%v:)", t, lpFileName, nSize, origin(2))
	}
	r0, _, err := procGetModuleFileNameW.Call(hModule, lpFileName, uintptr(nSize))
	if r0 == 0 {
		t.setErrno(err)
	}
	return uint32(r0)
}

// NET_API_STATUS NET_API_FUNCTION NetGetDCName(
//
//	LPCWSTR ServerName,
//	LPCWSTR DomainName,
//	LPBYTE  *Buffer
//
// );
func XNetGetDCName(t *TLS, ServerName, DomainName, Buffer uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v Buffer=%v, (%v:)", t, Buffer, origin(2))
	}
	r0, _, err := procNetGetDCName.Call(ServerName, DomainName, Buffer)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// NET_API_STATUS NET_API_FUNCTION NetUserGetInfo(
//
//	LPCWSTR servername,
//	LPCWSTR username,
//	DWORD   level,
//	LPBYTE  *bufptr
//
// );
func XNetUserGetInfo(t *TLS, servername, username uintptr, level uint32, bufptr uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v username=%v level=%v bufptr=%v, (%v:)", t, username, level, bufptr, origin(2))
	}
	r0, _, err := procNetUserGetInfo.Call(servername,
		username,
		uintptr(level),
		bufptr,
		0,
		0,
	)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return uint32(r0)
}

func XlstrlenW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// USERENVAPI BOOL GetProfilesDirectoryW(
//
//	[out]     LPWSTR  lpProfileDir,
//	[in, out] LPDWORD lpcchSize
//
// );
func XGetProfilesDirectoryW(t *TLS, lpProfileDir, lpcchSize uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpcchSize=%v, (%v:)", t, lpcchSize, origin(2))
	}
	r0, _, err := procGetProfilesDirectoryW.Call(lpProfileDir, lpcchSize, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

func XNetApiBufferFree(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// DWORD GetPrivateProfileStringA(
//
//	LPCSTR lpAppName,
//	LPCSTR lpKeyName,
//	LPCSTR lpDefault,
//	LPSTR  lpReturnedString,
//	DWORD  nSize,
//	LPCSTR lpFileName
//
// );
func XGetPrivateProfileStringA(t *TLS, lpAppName, lpKeyName, lpDefault, lpReturnedString uintptr, nSize uint32, lpFileName uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v lpReturnedString=%v nSize=%v lpFileName=%v, (%v:)", t, lpReturnedString, nSize, lpFileName, origin(2))
	}
	r0, _, err := procGetPrivateProfileStringA.Call(lpAppName,
		lpKeyName,
		lpDefault,
		lpReturnedString,
		uintptr(nSize),
		lpFileName,
	)
	if err != windows.NOERROR {
		t.setErrno(0x02)
	}
	return uint32(r0)
}

func XGetWindowsDirectoryA(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// BOOL GetFileSecurityW(
//
//	LPCSTR               lpFileName,
//	SECURITY_INFORMATION RequestedInformation,
//	PSECURITY_DESCRIPTOR pSecurityDescriptor,
//	DWORD                nLength,
//	LPDWORD              lpnLengthNeeded
//
// );
func XGetFileSecurityW(t *TLS, lpFileName uintptr, RequestedInformation uint32, pSecurityDescriptor uintptr, nLength uint32, lpnLengthNeeded uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v RequestedInformation=%v pSecurityDescriptor=%v nLength=%v lpnLengthNeeded=%v, (%v:)", t, lpFileName, RequestedInformation, pSecurityDescriptor, nLength, lpnLengthNeeded, origin(2))
	}
	r0, _, err := procGetFileSecurityW.Call(lpFileName, uintptr(RequestedInformation), pSecurityDescriptor, uintptr(nLength), lpnLengthNeeded, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// BOOL GetSecurityDescriptorOwner(
//
//	PSECURITY_DESCRIPTOR pSecurityDescriptor,
//	PSID                 *pOwner,
//	LPBOOL               lpbOwnerDefaulted
//
// );
func XGetSecurityDescriptorOwner(t *TLS, pSecurityDescriptor, pOwner, lpbOwnerDefaulted uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpbOwnerDefaulted=%v, (%v:)", t, lpbOwnerDefaulted, origin(2))
	}
	r0, _, err := procGetSecurityDescriptorOwner.Call(pSecurityDescriptor, pOwner, lpbOwnerDefaulted)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)

}

// PSID_IDENTIFIER_AUTHORITY GetSidIdentifierAuthority(
//
//	PSID pSid
//
// );
func XGetSidIdentifierAuthority(t *TLS, pSid uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v pSid=%v, (%v:)", t, pSid, origin(2))
	}
	r0, _, err := procGetSidIdentifierAuthority.Call(pSid, 0, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return r0
}

// BOOL ImpersonateSelf(
//
//	SECURITY_IMPERSONATION_LEVEL ImpersonationLevel
//
// );
func XImpersonateSelf(t *TLS, ImpersonationLevel int32) int32 {
	if __ccgo_strace {
		trc("t=%v ImpersonationLevel=%v, (%v:)", t, ImpersonationLevel, origin(2))
	}
	r0, _, err := procImpersonateSelf.Call(uintptr(ImpersonationLevel), 0, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// BOOL OpenThreadToken(
//
//	HANDLE  ThreadHandle,
//	DWORD   DesiredAccess,
//	BOOL    OpenAsSelf,
//	PHANDLE TokenHandle
//
// );
func XOpenThreadToken(t *TLS, ThreadHandle uintptr, DesiredAccess uint32, OpenAsSelf int32, TokenHandle uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ThreadHandle=%v DesiredAccess=%v OpenAsSelf=%v TokenHandle=%v, (%v:)", t, ThreadHandle, DesiredAccess, OpenAsSelf, TokenHandle, origin(2))
	}
	r0, _, err := procOpenThreadToken.Call(ThreadHandle, uintptr(DesiredAccess), uintptr(OpenAsSelf), TokenHandle, 0, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// HANDLE GetCurrentThread();
func XGetCurrentThread(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r0, _, err := procGetCurrentThread.Call(0, 0, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return r0
}

// BOOL RevertToSelf();
func XRevertToSelf(t *TLS) int32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r0, _, err := procRevertToSelf.Call(0, 0, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// BOOL AccessCheck(
//
//	PSECURITY_DESCRIPTOR pSecurityDescriptor,
//	HANDLE               ClientToken,
//	DWORD                DesiredAccess,
//	PGENERIC_MAPPING     GenericMapping,
//	PPRIVILEGE_SET       PrivilegeSet,
//	LPDWORD              PrivilegeSetLength,
//	LPDWORD              GrantedAccess,
//	LPBOOL               AccessStatus
//
// );
func XAccessCheck(t *TLS, pSecurityDescriptor, ClientToken uintptr, DesiredAccess uint32, GenericMapping, PrivilegeSet, PrivilegeSetLength, GrantedAccess, AccessStatus uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ClientToken=%v DesiredAccess=%v AccessStatus=%v, (%v:)", t, ClientToken, DesiredAccess, AccessStatus, origin(2))
	}
	r0, _, err := procAccessCheck.Call(pSecurityDescriptor,
		ClientToken,
		uintptr(DesiredAccess),
		GenericMapping,
		PrivilegeSet,
		PrivilegeSetLength,
		GrantedAccess,
		AccessStatus,
		0,
	)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// int _wcsicmp(
//
//	const wchar_t *string1,
//	const wchar_t *string2
//
// );
func Xwcsicmp(t *TLS, string1, string2 uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v string2=%v, (%v:)", t, string2, origin(2))
	}
	var s1 = strings.ToLower(goWideString(string1))
	var s2 = strings.ToLower(goWideString(string2))
	return int32(strings.Compare(s1, s2))
}

// BOOL SetCurrentDirectoryW(
//
//	LPCTSTR lpPathName
//
// );
func XSetCurrentDirectoryW(t *TLS, lpPathName uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpPathName=%v, (%v:)", t, lpPathName, origin(2))
	}
	err := windows.SetCurrentDirectory((*uint16)(unsafe.Pointer(lpPathName)))
	if err != nil {
		t.setErrno(err)
		return 0
	}
	return 1
}

// DWORD GetCurrentDirectory(
//
//	DWORD  nBufferLength,
//	LPWTSTR lpBuffer
//
// );
func XGetCurrentDirectoryW(t *TLS, nBufferLength uint32, lpBuffer uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v nBufferLength=%v lpBuffer=%v, (%v:)", t, nBufferLength, lpBuffer, origin(2))
	}
	n, err := windows.GetCurrentDirectory(nBufferLength, (*uint16)(unsafe.Pointer(lpBuffer)))
	if err != nil {
		t.setErrno(err)
	}
	return n
}

// BOOL GetFileInformationByHandle(
//
//	HANDLE                       hFile,
//	LPBY_HANDLE_FILE_INFORMATION lpFileInformation
//
// );
func XGetFileInformationByHandle(t *TLS, hFile, lpFileInformation uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpFileInformation=%v, (%v:)", t, lpFileInformation, origin(2))
	}
	r1, _, e1 := procGetFileInformationByHandle.Call(hFile, lpFileInformation, 0)
	if r1 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return int32(r1)
}

// BOOL GetVolumeInformationW(
//
//	LPCWSTR lpRootPathName,
//	LPWSTR  lpVolumeNameBuffer,
//	DWORD   nVolumeNameSize,
//	LPDWORD lpVolumeSerialNumber,
//	LPDWORD lpMaximumComponentLength,
//	LPDWORD lpFileSystemFlags,
//	LPWSTR  lpFileSystemNameBuffer,
//	DWORD   nFileSystemNameSize
//
// );
func XGetVolumeInformationW(t *TLS, lpRootPathName, lpVolumeNameBuffer uintptr, nVolumeNameSize uint32, lpVolumeSerialNumber, lpMaximumComponentLength, lpFileSystemFlags, lpFileSystemNameBuffer uintptr, nFileSystemNameSize uint32) int32 {
	if __ccgo_strace {
		trc("t=%v lpVolumeNameBuffer=%v nVolumeNameSize=%v lpFileSystemNameBuffer=%v nFileSystemNameSize=%v, (%v:)", t, lpVolumeNameBuffer, nVolumeNameSize, lpFileSystemNameBuffer, nFileSystemNameSize, origin(2))
	}
	r0, _, err := procGetVolumeInformationW.Call(lpRootPathName,
		lpVolumeNameBuffer,
		uintptr(nVolumeNameSize),
		lpVolumeSerialNumber,
		lpMaximumComponentLength,
		lpFileSystemFlags,
		lpFileSystemNameBuffer,
		uintptr(nFileSystemNameSize),
		0,
	)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// wchar_t *wcschr(
//
//	const wchar_t *str,
//	wchar_t c
//
// );
func Xwcschr(t *TLS, str uintptr, c wchar_t) uintptr {
	if __ccgo_strace {
		trc("t=%v str=%v c=%v, (%v:)", t, str, c, origin(2))
	}
	var source = str
	for {
		var buf = *(*uint16)(unsafe.Pointer(source))
		if buf == 0 {
			return 0
		}
		if buf == c {
			return source
		}
		// wchar_t = 2 bytes
		source++
		source++
	}
}

// BOOL SetFileTime(
//
//	HANDLE         hFile,
//	const FILETIME *lpCreationTime,
//	const FILETIME *lpLastAccessTime,
//	const FILETIME *lpLastWriteTime
//
// );
func XSetFileTime(t *TLS, _hFile uintptr, _lpCreationTime, _lpLastAccessTime, _lpLastWriteTime uintptr) (r int32) {
	if __ccgo_strace {
		trc("hFile=%+v lpCreationTime=%+v lpLastAccessTime=%+v lpLastWriteTime=%+v", _hFile, _lpCreationTime, _lpLastAccessTime, _lpLastWriteTime)
		defer func() { trc(`XSetFileTime->%+v`, r) }()
	}
	r0, r1, err := procSetFileTime.Call(_hFile, _lpCreationTime, _lpLastAccessTime, _lpLastWriteTime)
	if err != windows.NOERROR {
		if __ccgo_strace {
			trc(`r0=%v r1=%v err=%v`, r0, r1, err)
		}
		t.SetLastError(uint32(err.(windows.Errno)))
	}
	return int32(r0)
}

// __attribute__((dllimport)) DWORD GetNamedSecurityInfoW (LPCWSTR pObjectName, SE_OBJECT_TYPE ObjectType, SECURITY_INFORMATION SecurityInfo, PSID *ppsidOwner, PSID *ppsidGroup, PACL *ppDacl, PACL *ppSacl, PSECURITY_DESCRIPTOR *ppSecurityDescriptor);
func XGetNamedSecurityInfoW(tls *TLS, _pObjectName uintptr, _ObjectType int32, _SecurityInfo uint32, _ppsidOwner uintptr, _ppsidGroup uintptr, _ppDacl uintptr, _ppSacl uintptr, _ppSecurityDescriptor uintptr) (r uint32) {
	if __ccgo_strace {
		trc("pObjectName=%+v ObjectType=%+v SecurityInfo=%+v ppsidOwner=%+v ppsidGroup=%+v ppDacl=%+v ppSacl=%+v ppSecurityDescriptor=%+v", _pObjectName, _ObjectType, _SecurityInfo, _ppsidOwner, _ppsidGroup, _ppDacl, _ppSacl, _ppSecurityDescriptor)
		defer func() { trc(`XGetNamedSecurityInfoW->%+v`, r) }()
	}
	r0, r1, err := procGetNamedSecurityInfoW.Call(_pObjectName, uintptr(_ObjectType), uintptr(_SecurityInfo), _ppsidOwner, _ppsidGroup, _ppDacl, _ppSacl, _ppSecurityDescriptor)
	if err != windows.NOERROR {
		if __ccgo_strace {
			trc(`r0=%v r1=%v err=%v`, r0, r1, err)
		}
		tls.SetLastError(uint32(err.(windows.Errno)))
	}
	return uint32(r0)
}

// __attribute__((dllimport)) WINBOOL OpenProcessToken (HANDLE ProcessHandle, DWORD DesiredAccess, PHANDLE TokenHandle);
func XOpenProcessToken(tls *TLS, _ProcessHandle uintptr, _DesiredAccess uint32, _TokenHandle uintptr) (r int32) {
	if __ccgo_strace {
		trc("ProcessHandle=%+v DesiredAccess=%+v TokenHandle=%+v", _ProcessHandle, _DesiredAccess, _TokenHandle)
		defer func() { trc(`XOpenProcessToken->%+v`, r) }()
	}
	r0, r1, err := procOpenProcessToken.Call(_ProcessHandle, uintptr(_DesiredAccess), _TokenHandle)
	if err != windows.NOERROR {
		if __ccgo_strace {
			trc(`r0=%v r1=%v err=%v`, r0, r1, err)
		}
		tls.SetLastError(uint32(err.(windows.Errno)))
	}
	return int32(r0)
}

// __attribute__((dllimport)) WINBOOL GetTokenInformation (HANDLE TokenHandle, TOKEN_INFORMATION_CLASS TokenInformationClass, LPVOID TokenInformation, DWORD TokenInformationLength, PDWORD ReturnLength);
func XGetTokenInformation(tls *TLS, _TokenHandle uintptr, _TokenInformationClass int32, _TokenInformation uintptr, _TokenInformationLength uint32, _ReturnLength uintptr) (r int32) {
	if __ccgo_strace {
		trc("TokenHandle=%+v TokenInformationClass=%+v TokenInformation=%+v TokenInformationLength=%+v ReturnLength=%+v", _TokenHandle, _TokenInformationClass, _TokenInformation, _TokenInformationLength, _ReturnLength)
		defer func() { trc(`XGetTokenInformation->%+v`, r) }()
	}
	r0, r1, err := procGetTokenInformation.Call(_TokenHandle, uintptr(_TokenInformationClass), _TokenInformation, uintptr(_TokenInformationLength), _ReturnLength)
	if err != windows.NOERROR {
		if __ccgo_strace {
			trc(`r0=%v r1=%v err=%v`, r0, r1, err)
		}
		tls.SetLastError(uint32(err.(windows.Errno)))
	}
	return int32(r0)
}

// __attribute__((dllimport)) WINBOOL EqualSid (PSID pSid1, PSID pSid2);
func XEqualSid(tls *TLS, _pSid1 uintptr, _pSid2 uintptr) (r int32) {
	if __ccgo_strace {
		trc("pSid1=%+v pSid2=%+v", _pSid1, _pSid2)
		defer func() { trc(`XEqualSid->%+v`, r) }()
	}
	r0, r1, err := procEqualSid.Call(_pSid1, _pSid2)
	if err != windows.NOERROR {
		if __ccgo_strace {
			trc(`r0=%v r1=%v err=%v`, r0, r1, err)
		}
		tls.SetLastError(uint32(err.(windows.Errno)))
	}
	return int32(r0)
}

// int WSAStartup(
//
//	WORD      wVersionRequired,
//	LPWSADATA lpWSAData
//
// );
func XWSAStartup(t *TLS, wVersionRequired uint16, lpWSAData uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v wVersionRequired=%v lpWSAData=%v, (%v:)", t, wVersionRequired, lpWSAData, origin(2))
	}
	r0, _, _ := procWSAStartup.Call(uintptr(wVersionRequired), lpWSAData, 0)
	if r0 != 0 {
		t.setErrno(r0)
	}
	return int32(r0)
}

// HMODULE GetModuleHandleA(LPCSTR lpModuleName);
func XGetModuleHandleA(t *TLS, lpModuleName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpModuleName=%v, (%v:)", t, lpModuleName, origin(2))
	}
	r0, _, err := procGetModuleHandleA.Call(lpModuleName, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return r0
}

// HMODULE GetModuleHandleW(
//
//	LPCWSTR lpModuleName
//
// );
func XGetModuleHandleW(t *TLS, lpModuleName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v lpModuleName=%v, (%v:)", t, lpModuleName, origin(2))
	}
	r0, _, err := procGetModuleHandleW.Call(lpModuleName, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return r0
}

// DWORD GetEnvironmentVariableW(
//
//	LPCWSTR lpName,
//	LPWSTR  lpBuffer,
//	DWORD   nSize
//
// );
func XGetEnvironmentVariableW(t *TLS, lpName, lpBuffer uintptr, nSize uint32) uint32 {
	if __ccgo_strace {
		trc("t=%v lpBuffer=%v nSize=%v, (%v:)", t, lpBuffer, nSize, origin(2))
	}
	r0, _, e1 := procGetEnvironmentVariableW.Call(lpName, lpBuffer, uintptr(nSize))
	n := uint32(r0)
	if n == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return n
}

// int lstrcmpiA(
//
//	LPCSTR lpString1,
//	LPCSTR lpString2
//
// );
func XlstrcmpiA(t *TLS, lpString1, lpString2 uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpString2=%v, (%v:)", t, lpString2, origin(2))
	}
	var s1 = strings.ToLower(GoString(lpString1))
	var s2 = strings.ToLower(GoString(lpString2))
	return int32(strings.Compare(s1, s2))
}

func XGetModuleFileNameA(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// UINT GetACP();
func XGetACP(t *TLS) uint32 {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	r0, _, _ := procGetACP.Call(0, 0, 0)
	return uint32(r0)
}

// BOOL GetUserNameW(
//
//	LPWSTR  lpBuffer,
//	LPDWORD pcbBuffer
//
// );
func XGetUserNameW(t *TLS, lpBuffer, pcbBuffer uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pcbBuffer=%v, (%v:)", t, pcbBuffer, origin(2))
	}
	u, err := user.Current()
	if err != nil {
		panic(todo(""))
		return 0
	}

	wcnt := *(*uint16)(unsafe.Pointer(pcbBuffer))
	s := utf16.Encode([]rune(u.Username))
	if len(s)+1 > int(wcnt) {
		panic(todo(""))
	}

	*(*uint16)(unsafe.Pointer(pcbBuffer)) = uint16(len(s) + 1)
	for _, v := range s {
		*(*uint16)(unsafe.Pointer(lpBuffer)) = v
		lpBuffer += 2
	}
	return 1
}

// HMODULE LoadLibraryExW(
//
//	LPCWSTR lpLibFileName,
//	HANDLE  hFile,
//	DWORD   dwFlags
//
// );
func XLoadLibraryExW(t *TLS, lpLibFileName, hFile uintptr, dwFlags uint32) uintptr {
	if __ccgo_strace {
		trc("t=%v hFile=%v dwFlags=%v, (%v:)", t, hFile, dwFlags, origin(2))
	}
	return 0 // If the function fails, the return value is NULL.
}

// wchar_t *wcscpy(
//
//	wchar_t *strDestination,
//	const wchar_t *strSource
//
// );
func Xwcscpy(t *TLS, strDestination, strSource uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v strSource=%v, (%v:)", t, strSource, origin(2))
	}
	if strSource == 0 {
		return 0
	}

	d := strDestination
	for {
		c := *(*uint16)(unsafe.Pointer(strSource))
		strSource += 2
		*(*uint16)(unsafe.Pointer(d)) = c
		d += 2
		if c == 0 {
			return strDestination
		}
	}
}

func XwsprintfW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// ATOM RegisterClassW(
//
//	const WNDCLASSW *lpWndClass
//
// );
func XRegisterClassW(t *TLS, lpWndClass uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpWndClass=%v, (%v:)", t, lpWndClass, origin(2))
	}
	r0, _, err := procRegisterClassW.Call(lpWndClass, 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

func XKillTimer(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XDestroyWindow(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// BOOL UnregisterClassW(
//
//	LPCWSTR   lpClassName,
//	HINSTANCE hInstance
//
// );
func XUnregisterClassW(t *TLS, lpClassName, hInstance uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v hInstance=%v, (%v:)", t, hInstance, origin(2))
	}
	r0, _, err := procUnregisterClassW.Call(lpClassName, hInstance, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

func XPostMessageW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XSetTimer(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// HWND CreateWindowExW(
//
//	DWORD     dwExStyle,
//	LPCWSTR   lpClassName,
//	LPCWSTR   lpWindowName,
//	DWORD     dwStyle,
//	int       X,
//	int       Y,
//	int       nWidth,
//	int       nHeight,
//	HWND      hWndParent,
//	HMENU     hMenu,
//	HINSTANCE hInstance,
//	LPVOID    lpParam
//
// );
func XCreateWindowExW(t *TLS, dwExStyle uint32, lpClassName, lpWindowName uintptr, dwStyle uint32, x, y, nWidth, nHeight int32, hWndParent, hMenu, hInstance, lpParam uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v dwExStyle=%v lpWindowName=%v dwStyle=%v nHeight=%v lpParam=%v, (%v:)", t, dwExStyle, lpWindowName, dwStyle, nHeight, lpParam, origin(2))
	}
	r0, _, err := procCreateWindowExW.Call(
		uintptr(dwExStyle),
		lpClassName,
		lpWindowName,
		uintptr(dwStyle),
		uintptr(x),
		uintptr(y),
		uintptr(nWidth),
		uintptr(nHeight),
		hWndParent,
		hMenu,
		hInstance,
		lpParam,
	)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return r0
}

// BOOL PeekMessageW(
//
//	LPMSG lpMsg,
//	HWND  hWnd,
//	UINT  wMsgFilterMin,
//	UINT  wMsgFilterMax,
//	UINT  wRemoveMsg
//
// );
func XPeekMessageW(t *TLS, lpMsg, hWnd uintptr, wMsgFilterMin, wMsgFilterMax, wRemoveMsg uint32) int32 {
	if __ccgo_strace {
		trc("t=%v hWnd=%v wRemoveMsg=%v, (%v:)", t, hWnd, wRemoveMsg, origin(2))
	}
	r0, _, err := procPeekMessageW.Call(lpMsg,
		hWnd,
		uintptr(wMsgFilterMin),
		uintptr(wMsgFilterMax),
		uintptr(wRemoveMsg),
		0,
	)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

func XGetMessageW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XPostQuitMessage(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XTranslateMessage(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XDispatchMessageW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// DWORD SleepEx(
//
//	DWORD dwMilliseconds,
//	BOOL  bAlertable
//
// );
func XSleepEx(t *TLS, dwMilliseconds uint32, bAlertable int32) uint32 {
	if __ccgo_strace {
		trc("t=%v dwMilliseconds=%v bAlertable=%v, (%v:)", t, dwMilliseconds, bAlertable, origin(2))
	}
	r0, _, _ := procSleepEx.Call(uintptr(dwMilliseconds), uintptr(bAlertable), 0)
	return uint32(r0)
}

// BOOL CreatePipe(
//
//	PHANDLE               hReadPipe,
//	PHANDLE               hWritePipe,
//	LPSECURITY_ATTRIBUTES lpPipeAttributes,
//	DWORD                 nSize
//
// );
func XCreatePipe(t *TLS, hReadPipe, hWritePipe, lpPipeAttributes uintptr, nSize uint32) int32 {
	if __ccgo_strace {
		trc("t=%v lpPipeAttributes=%v nSize=%v, (%v:)", t, lpPipeAttributes, nSize, origin(2))
	}
	r0, _, err := procCreatePipe.Call(hReadPipe, hWritePipe, lpPipeAttributes, uintptr(nSize), 0, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// BOOL CreateProcessW(
//
//	LPCWSTR               lpApplicationName,
//	LPWSTR                lpCommandLine,
//	LPSECURITY_ATTRIBUTES lpProcessAttributes,
//	LPSECURITY_ATTRIBUTES lpThreadAttributes,
//	BOOL                  bInheritHandles,
//	DWORD                 dwCreationFlags,
//	LPVOID                lpEnvironment,
//	LPCWSTR               lpCurrentDirectory,
//	LPSTARTUPINFOW        lpStartupInfo,
//	LPPROCESS_INFORMATION lpProcessInformation
//
// );
func XCreateProcessW(t *TLS, lpApplicationName, lpCommandLine, lpProcessAttributes, lpThreadAttributes uintptr, bInheritHandles int32, dwCreationFlags uint32,
	lpEnvironment, lpCurrentDirectory, lpStartupInfo, lpProcessInformation uintptr) int32 {

	r1, _, e1 := procCreateProcessW.Call(lpApplicationName, lpCommandLine, lpProcessAttributes, lpThreadAttributes,
		uintptr(bInheritHandles), uintptr(dwCreationFlags), lpEnvironment, lpCurrentDirectory, lpStartupInfo, lpProcessInformation, 0, 0)
	if r1 == 0 {
		if e1 != windows.NOERROR {
			t.setErrno(e1)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}

	return int32(r1)
}

// DWORD WaitForInputIdle(
//
//	HANDLE hProcess,
//	DWORD  dwMilliseconds
//
// );
func XWaitForInputIdle(t *TLS, hProcess uintptr, dwMilliseconds uint32) int32 {
	if __ccgo_strace {
		trc("t=%v hProcess=%v dwMilliseconds=%v, (%v:)", t, hProcess, dwMilliseconds, origin(2))
	}
	r0, _, _ := procWaitForInputIdle.Call(hProcess, uintptr(dwMilliseconds), 0)
	return int32(r0)
}

// DWORD SearchPathW(
//
//	LPCWSTR lpPath,
//	LPCWSTR lpFileName,
//	LPCWSTR lpExtension,
//	DWORD   nBufferLength,
//	LPWSTR  lpBuffer,
//	LPWSTR  *lpFilePart
//
// );
func XSearchPathW(t *TLS, lpPath, lpFileName, lpExtension uintptr, nBufferLength uint32, lpBuffer, lpFilePart uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpExtension=%v nBufferLength=%v lpFilePart=%v, (%v:)", t, lpExtension, nBufferLength, lpFilePart, origin(2))
	}
	r0, _, err := procSearchPathW.Call(lpPath, lpFileName, lpExtension, uintptr(nBufferLength), lpBuffer, lpFilePart)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

func XGetShortPathNameW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// BOOL GetExitCodeProcess(
//
//	HANDLE  hProcess,
//	LPDWORD lpExitCode
//
// );
func XGetExitCodeProcess(t *TLS, hProcess, lpExitCode uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpExitCode=%v, (%v:)", t, lpExitCode, origin(2))
	}
	r0, _, err := procGetExitCodeProcess.Call(hProcess, lpExitCode, 0)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// BOOL PeekNamedPipe(
//
//	HANDLE  hNamedPipe,
//	LPVOID  lpBuffer,
//	DWORD   nBufferSize,
//	LPDWORD lpBytesRead,
//	LPDWORD lpTotalBytesAvail,
//	LPDWORD lpBytesLeftThisMessage
//
// );
func XPeekNamedPipe(t *TLS, hNamedPipe, lpBuffer uintptr, nBufferSize uint32, lpBytesRead, lpTotalBytesAvail, lpBytesLeftThisMessage uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpBuffer=%v nBufferSize=%v lpBytesLeftThisMessage=%v, (%v:)", t, lpBuffer, nBufferSize, lpBytesLeftThisMessage, origin(2))
	}
	r0, _, err := procPeekNamedPipe.Call(hNamedPipe, lpBuffer, uintptr(nBufferSize), lpBytesRead, lpTotalBytesAvail, lpBytesLeftThisMessage)
	if r0 == 0 {
		t.setErrno(err)
	}
	return int32(r0)
}

// long _InterlockedExchange(
//
//	long volatile * Target,
//	long Value
//
// );
func X_InterlockedExchange(t *TLS, Target uintptr, Value long) long {
	if __ccgo_strace {
		trc("t=%v Target=%v Value=%v, (%v:)", t, Target, Value, origin(2))
	}
	old := atomic.SwapInt32((*int32)(unsafe.Pointer(Target)), Value)
	return old
}

// BOOL TerminateThread(
//
//	[in, out] HANDLE hThread,
//	[in]      DWORD  dwExitCode
//
// );
func XTerminateThread(t *TLS, hThread uintptr, dwExitCode uint32) int32 {
	if __ccgo_strace {
		trc("t=%v hThread=%v dwExitCode=%v, (%v:)", t, hThread, dwExitCode, origin(2))
	}
	r0, _, err := procTerminateThread.Call(hThread, uintptr(dwExitCode), 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// BOOL GetComputerNameW(
//
//	LPWSTR  lpBuffer,
//	LPDWORD nSize
//
// );
func XGetComputerNameW(t *TLS, lpBuffer, nSize uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v nSize=%v, (%v:)", t, nSize, origin(2))
	}
	panic(todo(""))
}

func Xgethostname(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XSendMessageW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XWSAGetLastError(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func Xclosesocket(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XWspiapiFreeAddrInfo(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XWspiapiGetNameInfo(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XIN6_ADDR_EQUAL(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func X__ccgo_in6addr_anyp(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XIN6_IS_ADDR_V4MAPPED(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XSetHandleInformation(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func Xioctlsocket(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XGetWindowLongPtrW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XSetWindowLongPtrW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XWSAAsyncSelect(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func Xinet_ntoa(t *TLS, _ ...interface{}) uintptr {
	panic(todo(""))
}

func X_controlfp(t *TLS, _ ...interface{}) uint32 {
	panic(todo(""))
}

// BOOL QueryPerformanceFrequency(
//
//	LARGE_INTEGER *lpFrequency
//
// );
func XQueryPerformanceFrequency(t *TLS, lpFrequency uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpFrequency=%v, (%v:)", t, lpFrequency, origin(2))
	}

	r1, _, err := procQueryPerformanceFrequency.Call(lpFrequency, 0, 0)
	if r1 == 0 {
		t.setErrno(err)
		return 0
	}
	return int32(r1)
}

func inDST(t gotime.Time) bool {

	jan1st := gotime.Date(t.Year(), 1, 1, 0, 0, 0, 0, t.Location()) // January 1st is always outside DST window

	_, off1 := t.Zone()
	_, off2 := jan1st.Zone()

	return off1 != off2
}

// void _ftime( struct _timeb *timeptr );
func X_ftime(t *TLS, timeptr uintptr) {
	if __ccgo_strace {
		trc("t=%v timeptr=%v, (%v:)", t, timeptr, origin(2))
	}
	var tm = gotime.Now()
	var tPtr = (*time.X__timeb64)(unsafe.Pointer(timeptr))
	tPtr.Ftime = tm.Unix()
	tPtr.Fmillitm = uint16(gotime.Duration(tm.Nanosecond()) / gotime.Millisecond)
	if inDST(tm) {
		tPtr.Fdstflag = 1
	}
	_, offset := tm.Zone()
	tPtr.Ftimezone = int16(offset)
}

func XDdeInitializeW(t *TLS, _ ...interface{}) uint32 {
	panic(todo(""))
}

func XDdeCreateStringHandleW(t *TLS, _ ...interface{}) uintptr {
	panic(todo(""))
}

func XDdeNameService(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func X_snwprintf(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XDdeQueryStringW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// int _wcsicmp(
//
//	const wchar_t *string1,
//	const wchar_t *string2
//
// );
func X_wcsicmp(t *TLS, string1, string2 uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v string2=%v, (%v:)", t, string2, origin(2))
	}
	return Xwcsicmp(t, string1, string2)
}

func XDdeCreateDataHandle(t *TLS, _ ...interface{}) uintptr {
	panic(todo(""))
}

func XDdeAccessData(t *TLS, _ ...interface{}) uintptr {
	panic(todo(""))
}

func XDdeUnaccessData(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XDdeUninitialize(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XDdeConnect(t *TLS, _ ...interface{}) uintptr {
	panic(todo(""))
}

func XDdeFreeStringHandle(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegisterClassExW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XGlobalGetAtomNameW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XGlobalAddAtomW(t *TLS, _ ...interface{}) uint16 {
	panic(todo(""))
}

func XEnumWindows(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XIsWindow(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XGlobalDeleteAtom(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XDdeGetLastError(t *TLS, _ ...interface{}) uint32 {
	panic(todo(""))
}

// HDDEDATA DdeClientTransaction(
//
//	LPBYTE  pData,
//	DWORD   cbData,
//	HCONV   hConv,
//	HSZ     hszItem,
//	UINT    wFmt,
//	UINT    wType,
//	DWORD   dwTimeout,
//	LPDWORD pdwResult
//
// );
func XDdeClientTransaction(t *TLS, pData uintptr, cbData uint32, hConv uintptr, hszItem uintptr, wFmt, wType, dwTimeout uint32, pdwResult uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v pData=%v cbData=%v hConv=%v hszItem=%v dwTimeout=%v pdwResult=%v, (%v:)", t, pData, cbData, hConv, hszItem, dwTimeout, pdwResult, origin(2))
	}
	panic(todo(""))
}

func XDdeAbandonTransaction(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XDdeFreeDataHandle(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XDdeGetData(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XDdeDisconnect(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegCloseKey(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegDeleteValueW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegEnumKeyExW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegQueryValueExW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegEnumValueW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegConnectRegistryW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegCreateKeyExW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegOpenKeyExW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegDeleteKeyW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

func XRegSetValueExW(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// int _vsnwprintf(
//
//	wchar_t *buffer,
//	size_t count,
//	const wchar_t *format,
//	va_list argptr
//
// );
func X__mingw_vsnwprintf(t *TLS, buffer uintptr, count types.Size_t, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v buffer=%v count=%v va=%v, (%v:)", t, buffer, count, va, origin(2))
	}
	panic(todo(""))
}

// int vprintf(const char *format, va_list ap);

func X__mingw_vprintf(t *TLS, s, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	return Xvprintf(t, s, ap)
}

// int vfscanf(FILE * restrict stream, const char * restrict format, va_list arg);
func X__mingw_vfscanf(t *TLS, stream, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	panic(todo(""))
}

// int vsscanf(const char *str, const char *format, va_list ap);
func X__mingw_vsscanf(t *TLS, str, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	return Xsscanf(t, str, format, ap)
}

// int vfprintf(FILE * restrict stream, const char * restrict format, va_list arg);
func X__mingw_vfprintf(t *TLS, f uintptr, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v f=%v va=%v, (%v:)", t, f, va, origin(2))
	}
	return Xvfprintf(t, f, format, va)
}

// int vsprintf(char * restrict s, const char * restrict format, va_list arg);
func X__mingw_vsprintf(t *TLS, s, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	return Xvsprintf(t, s, format, ap)
}

// int vsnprintf(char *str, size_t size, const char *format, va_list ap);
func X__mingw_vsnprintf(t *TLS, str uintptr, size types.Size_t, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v str=%v size=%v ap=%v, (%v:)", t, str, size, ap, origin(2))
	}
	return Xvsnprintf(t, str, size, format, ap)
}

// int putchar(int char)
func X_putchar(t *TLS, c int32) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v, (%v:)", t, c, origin(2))
	}
	if _, err := fwrite(unistd.STDOUT_FILENO, []byte{byte(c)}); err != nil {
		return -1
	}
	return int32(byte(c))
}

// int vfwscanf(FILE *stream, const wchar_t *format, va_list argptr;);
func X__mingw_vfwscanf(t *TLS, stream uintptr, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v ap=%v, (%v:)", t, stream, ap, origin(2))
	}
	panic(todo(""))
}

// int vswscanf(const wchar_t *buffer, const wchar_t *format, va_list arglist);
func X__mingw_vswscanf(t *TLS, stream uintptr, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v ap=%v, (%v:)", t, stream, ap, origin(2))
	}
	panic(todo(""))
}

// int vfwprintf(FILE * restrict stream, const wchar_t * restrict format, va_list arg);
func X__mingw_vfwprintf(t *TLS, stream, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v ap=%v, (%v:)", t, ap, origin(2))
	}
	panic(todo(""))
}

// int putchar(int c);
func Xputchar(t *TLS, c int32) int32 {
	if __ccgo_strace {
		trc("t=%v c=%v, (%v:)", t, c, origin(2))
	}
	if _, err := fwrite(unistd.STDOUT_FILENO, []byte{byte(c)}); err != nil {
		return -1
	}
	return int32(byte(c))
}

// void _assert(
//
//	char const* message,
//	char const* filename,
//	unsigned line
//
// );
func X_assert(t *TLS, message, filename uintptr, line uint32) {
	if __ccgo_strace {
		trc("t=%v filename=%v line=%v, (%v:)", t, filename, line, origin(2))
	}
	panic(todo(""))
}

// char *strdup(const char *s);
func X_strdup(t *TLS, s uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v s=%v, (%v:)", t, s, origin(2))
	}
	panic(todo(""))
}

// int _access(
//
//	const char *path,
//	int mode
//
// );
func X_access(t *TLS, pathname uintptr, mode int32) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v mode=%v, (%v:)", t, pathname, mode, origin(2))
	}

	var path = GoString(pathname)

	info, err := os.Stat(path)
	if err != nil {
		// doesn't exist
		return errno.ENOENT
	}

	switch mode {
	case 0:
		// exists
		return 0
	case 2:
		// write-only
		// Check if the user bit is enabled in file permission
		if info.Mode().Perm()&(1<<(uint(7))) == 1 {
			// write-able
			return 0
		}
	case 4:
		// read-only
		// Check if the user bit is enabled in file permission
		if info.Mode().Perm()&(1<<(uint(7))) == 0 {
			// not set, so read-only
			return 0
		}
	case 6:
		// r/w
		if info.Mode().Perm()&(1<<(uint(7))) == 1 {
			// write-able
			return 0
		}
	}

	return errno.EACCES

}

// BOOL WINAPI SetConsoleCtrlHandler(
//
//	_In_opt_ PHANDLER_ROUTINE HandlerRoutine,
//	_In_     BOOL             Add
//
// );
func XSetConsoleCtrlHandler(t *TLS, HandlerRoutine uintptr, Add int32) int32 {
	if __ccgo_strace {
		trc("t=%v HandlerRoutine=%v Add=%v, (%v:)", t, HandlerRoutine, Add, origin(2))
	}

	//var fcc = &struct {
	//	f func(*TLS, uint32) int32
	//}{}
	//fcc = (*struct{ f func(*TLS, uint32) int32 })(unsafe.Pointer(HandlerRoutine))
	//var hdlr = fcc.f
	//
	//_, _, err := procSetConsoleCtrlHandler.Call(
	//windows.NewCallback(func(controlType uint) uint {
	//		return uint( hdlr(t, uint32(controlType)) )
	//	}), 1)
	//
	//if err != nil {
	//	panic("failed: SetConsoleCtrlHandler")
	//}

	return 0
}

// DebugBreak
func XDebugBreak(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// int _isatty( int fd );
func X_isatty(t *TLS, fd int32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v, (%v:)", t, fd, origin(2))
	}

	f, ok := fdToFile(fd)
	if !ok {
		t.setErrno(errno.EBADF)
		return 0
	}

	if fd == unistd.STDOUT_FILENO ||
		fd == unistd.STDIN_FILENO ||
		fd == unistd.STDERR_FILENO {
		var mode uint32
		err := windows.GetConsoleMode(f.Handle, &mode)
		if err != nil {
			t.setErrno(errno.EINVAL)
			return 0
		}
		// is console
		return 1
	}

	return 0
}

// BOOL WINAPI SetConsoleTextAttribute(
//
//	_In_ HANDLE hConsoleOutput,
//	_In_ WORD   wAttributes
//
// );
func XSetConsoleTextAttribute(t *TLS, hConsoleOutput uintptr, wAttributes uint16) int32 {
	if __ccgo_strace {
		trc("t=%v hConsoleOutput=%v wAttributes=%v, (%v:)", t, hConsoleOutput, wAttributes, origin(2))
	}
	r1, _, _ := procSetConsoleTextAttribute.Call(hConsoleOutput, uintptr(wAttributes), 0)
	return int32(r1)
}

// BOOL WINAPI GetConsoleScreenBufferInfo(
//
//	_In_  HANDLE                      hConsoleOutput,
//	_Out_ PCONSOLE_SCREEN_BUFFER_INFO lpConsoleScreenBufferInfo
//
// );
func XGetConsoleScreenBufferInfo(t *TLS, hConsoleOutput, lpConsoleScreenBufferInfo uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpConsoleScreenBufferInfo=%v, (%v:)", t, lpConsoleScreenBufferInfo, origin(2))
	}
	r1, _, _ := procGetConsoleScreenBufferInfo.Call(hConsoleOutput, lpConsoleScreenBufferInfo, 0)
	return int32(r1)
}

// FILE *_popen(
//
//	const char *command,
//	const char *mode
//
// );
func X_popen(t *TLS, command, mode uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v mode=%v, (%v:)", t, mode, origin(2))
	}
	panic(todo(""))
}

// int _wunlink(
//
//	const wchar_t *filename
//
// );
func X_wunlink(t *TLS, filename uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v filename=%v, (%v:)", t, filename, origin(2))
	}
	panic(todo(""))
}

func Xclosedir(tls *TLS, dir uintptr) int32 {
	if __ccgo_strace {
		trc("tls=%v dir=%v, (%v:)", tls, dir, origin(2))
	}
	panic(todo(""))
}

func Xopendir(tls *TLS, name uintptr) uintptr {
	if __ccgo_strace {
		trc("tls=%v name=%v, (%v:)", tls, name, origin(2))
	}
	panic(todo(""))
}

func Xreaddir(tls *TLS, dir uintptr) uintptr {
	if __ccgo_strace {
		trc("tls=%v dir=%v, (%v:)", tls, dir, origin(2))
	}
	panic(todo(""))
}

// int _unlink(
//
//	const char *filename
//
// );
func X_unlink(t *TLS, filename uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v filename=%v, (%v:)", t, filename, origin(2))
	}
	panic(todo(""))
}

// int pclose(FILE *stream);
func X_pclose(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	panic(todo(""))
}

// int setmode (int fd, int mode);
func Xsetmode(t *TLS, fd, mode int32) int32 {
	if __ccgo_strace {
		trc("t=%v mode=%v, (%v:)", t, mode, origin(2))
	}
	return X_setmode(t, fd, mode)
}

// int _setmode (int fd, int mode);
func X_setmode(t *TLS, fd, mode int32) int32 {
	if __ccgo_strace {
		trc("t=%v mode=%v, (%v:)", t, mode, origin(2))
	}

	_, ok := fdToFile(fd)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}

	// we're always in binary mode.
	// at least for now.

	if mode == fcntl.O_BINARY {
		return fcntl.O_BINARY
	} else {
		t.setErrno(errno.EINVAL)
		return -1
	}
}

// int _mkdir(const char *dirname);
func X_mkdir(t *TLS, dirname uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v dirname=%v, (%v:)", t, dirname, origin(2))
	}
	panic(todo(""))
}

// int _chmod( const char *filename, int pmode );
func X_chmod(t *TLS, filename uintptr, pmode int32) int32 {
	if __ccgo_strace {
		trc("t=%v filename=%v pmode=%v, (%v:)", t, filename, pmode, origin(2))
	}
	panic(todo(""))
}

// int _fileno(FILE *stream);
func X_fileno(t *TLS, stream uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	f, ok := winGetObject(stream).(*file)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}
	return f._fd
}

// void rewind(FILE *stream);
func Xrewind(t *TLS, stream uintptr) {
	if __ccgo_strace {
		trc("t=%v stream=%v, (%v:)", t, stream, origin(2))
	}
	Xfseek(t, stream, 0, unistd.SEEK_SET)
}

// __atomic_load_n
func X__atomic_load_n(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// __atomic_store_n
func X__atomic_store_n(t *TLS, _ ...interface{}) int32 {
	panic(todo(""))
}

// __builtin_add_overflow
func X__builtin_add_overflow(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// __builtin_mul_overflow
func X__builtin_mul_overflow(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

// __builtin_sub_overflow
func X__builtin_sub_overflow(t *TLS) {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	panic(todo(""))
}

func goWideBytes(p uintptr, n int) []uint16 {
	b := GoBytes(p, 2*n)
	var w []uint16
	for i := 0; i < len(b); i += 2 {
		w = append(w, *(*uint16)(unsafe.Pointer(&b[i])))
	}
	return w
}

// This version does include the zero terminator in the returned Go string.
func goWideString(p uintptr) string {
	if p == 0 {
		return ""
	}
	var w []uint16
	var raw = (*RawMem)(unsafe.Pointer(p))
	var i = 0
	for {
		wc := *(*uint16)(unsafe.Pointer(&raw[i]))
		w = append(w, wc)
		// append until U0000
		if wc == 0 {
			break
		}
		i = i + 2
	}
	s := utf16.Decode(w)
	return string(s)
}

func goWideStringN(p uintptr, n int) string {
	panic(todo(""))
}

// This version does not include the zero terminator in the returned Go string.
func goWideStringNZ(p uintptr) string {
	if p == 0 {
		return ""
	}

	var w []uint16
	var raw = (*RawMem)(unsafe.Pointer(p))
	var i = 0
	for {
		wc := *(*uint16)(unsafe.Pointer(&raw[i]))
		if wc == 0 {
			break
		}

		w = append(w, wc)
		i = i + 2
	}
	s := utf16.Decode(w)
	return string(s)
}

// LPWSTR GetCommandLineW();
func XGetCommandLineW(t *TLS) uintptr {
	if __ccgo_strace {
		trc("t=%v, (%v:)", t, origin(2))
	}
	return uintptr(unsafe.Pointer(windows.GetCommandLine()))
}

// BOOL AddAccessDeniedAce(
//
//	PACL  pAcl,
//	DWORD dwAceRevision,
//	DWORD AccessMask,
//	PSID  pSid
//
// );
func XAddAccessDeniedAce(t *TLS, pAcl uintptr, dwAceRevision, AccessMask uint32, pSid uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v pAcl=%v AccessMask=%v pSid=%v, (%v:)", t, pAcl, AccessMask, pSid, origin(2))
	}
	panic(todo(""))
}

// __attribute__((dllimport)) WINBOOL AddAce (PACL pAcl, DWORD dwAceRevision, DWORD dwStartingAceIndex, LPVOID pAceList, DWORD nAceListLength);
func XAddAce(tls *TLS, _pAcl uintptr, _dwAceRevision uint32, _dwStartingAceIndex uint32, _pAceList uintptr, _nAceListLength uint32) (r uint32) {
	if __ccgo_strace {
		trc("pAcl=%+v dwAceRevision=%+v dwStartingAceIndex=%+v pAceList=%+v nAceListLength=%+v", _pAcl, _dwAceRevision, _dwStartingAceIndex, _pAceList, _nAceListLength)
		defer func() { trc(`XAddAce->%+v`, r) }()
	}
	r0, r1, err := procAddAce.Call(_pAcl, uintptr(_dwAceRevision), uintptr(_dwStartingAceIndex), _pAceList, uintptr(_nAceListLength))
	if err != windows.NOERROR {
		if __ccgo_strace {
			trc(`r0=%v r1=%v err=%v`, r0, r1, err)
		}
		tls.SetLastError(uint32(err.(windows.Errno)))
	}
	return uint32(r0)
}

// __attribute__((dllimport)) WINBOOL GetAce (PACL pAcl, DWORD dwAceIndex, LPVOID *pAce);
func XGetAce(tls *TLS, _pAcl uintptr, _dwAceIndex uint32, _pAce uintptr) (r int32) {
	if __ccgo_strace {
		trc("pAcl=%+v dwAceIndex=%+v pAce=%+v", _pAcl, _dwAceIndex, _pAce)
		defer func() { trc(`XGetAce->%+v`, r) }()
	}
	r0, r1, err := procGetAce.Call(_pAcl, uintptr(_dwAceIndex), _pAce)
	if err != windows.NOERROR {
		if __ccgo_strace {
			trc(`r0=%v r1=%v err=%v`, r0, r1, err)
		}
		tls.SetLastError(uint32(err.(windows.Errno)))
	}
	return int32(r0)
}

// BOOL GetAclInformation(
//
//	PACL                  pAcl,
//	LPVOID                pAclInformation,
//	DWORD                 nAclInformationLength,
//	ACL_INFORMATION_CLASS dwAclInformationClass
//
// );
func XGetAclInformation(t *TLS, pAcl, pAclInformation uintptr, nAclInformationLength uint32, dwAclInformationClass int32) int32 {
	if __ccgo_strace {
		trc("t=%v pAclInformation=%v dwAclInformationClass=%v, (%v:)", t, pAclInformation, dwAclInformationClass, origin(2))
	}
	r0, _, err := procGetAclInformation.Call(pAclInformation,
		pAclInformation,
		uintptr(nAclInformationLength),
		uintptr(dwAclInformationClass),
		0,
		0,
	)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// BOOL GetFileSecurityA(
//
//	LPCSTR               lpFileName,
//	SECURITY_INFORMATION RequestedInformation,
//	PSECURITY_DESCRIPTOR pSecurityDescriptor,
//	DWORD                nLength,
//	LPDWORD              lpnLengthNeeded
//
// );
func XGetFileSecurityA(t *TLS, lpFileName uintptr, RequestedInformation uint32, pSecurityDescriptor uintptr, nLength uint32, lpnLengthNeeded uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpFileName=%v RequestedInformation=%v pSecurityDescriptor=%v nLength=%v lpnLengthNeeded=%v, (%v:)", t, lpFileName, RequestedInformation, pSecurityDescriptor, nLength, lpnLengthNeeded, origin(2))
	}
	r0, _, err := procGetFileSecurityA.Call(lpFileName,
		uintptr(RequestedInformation),
		pSecurityDescriptor,
		uintptr(nLength),
		lpnLengthNeeded,
		0,
	)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// __attribute__((dllimport)) DWORD GetLengthSid (PSID pSid);
func XGetLengthSid(tls *TLS, _pSid uintptr) (r uint32) {
	if __ccgo_strace {
		trc("pSid=%+v", _pSid)
		defer func() { trc(`XGetLengthSid->%+v`, r) }()
	}
	r0, r1, err := procGetLengthSid.Call(_pSid)
	if err != windows.NOERROR {
		if __ccgo_strace {
			trc(`r0=%v r1=%v err=%v`, r0, r1, err)
		}
		tls.SetLastError(uint32(err.(windows.Errno)))
	}
	return uint32(r0)
}

// BOOL GetSecurityDescriptorDacl(
//
//	PSECURITY_DESCRIPTOR pSecurityDescriptor,
//	LPBOOL               lpbDaclPresent,
//	PACL                 *pDacl,
//	LPBOOL               lpbDaclDefaulted
//
// );
func XGetSecurityDescriptorDacl(t *TLS, pSecurityDescriptor, lpbDaclPresent, pDacl, lpbDaclDefaulted uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v lpbDaclDefaulted=%v, (%v:)", t, lpbDaclDefaulted, origin(2))
	}
	r0, _, err := procGetSecurityDescriptorDacl.Call(pSecurityDescriptor,
		lpbDaclPresent,
		pDacl,
		lpbDaclDefaulted,
		0,
		0,
	)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// DWORD GetSidLengthRequired(
//
//	UCHAR nSubAuthorityCount
//
// );
func XGetSidLengthRequired(t *TLS, nSubAuthorityCount uint8) int32 {
	if __ccgo_strace {
		trc("t=%v nSubAuthorityCount=%v, (%v:)", t, nSubAuthorityCount, origin(2))
	}
	r0, _, err := procGetSidLengthRequired.Call(uintptr(nSubAuthorityCount), 0, 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// PDWORD GetSidSubAuthority(
//
//	PSID  pSid,
//	DWORD nSubAuthority
//
// );
func XGetSidSubAuthority(t *TLS, pSid uintptr, nSubAuthority uint32) uintptr {
	if __ccgo_strace {
		trc("t=%v pSid=%v nSubAuthority=%v, (%v:)", t, pSid, nSubAuthority, origin(2))
	}
	r0, _, err := procGetSidSubAuthority.Call(pSid, uintptr(nSubAuthority), 0)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return r0
}

// __attribute__((dllimport)) WINBOOL InitializeAcl (PACL pAcl, DWORD nAclLength, DWORD dwAclRevision);
func XInitializeAcl(tls *TLS, _pAcl uintptr, _nAclLength uint32, _dwAclRevision uint32) (r int32) {
	if __ccgo_strace {
		trc("pAcl=%+v nAclLength=%+v dwAclRevision=%+v", _pAcl, _nAclLength, _dwAclRevision)
		defer func() { trc(`XInitializeAcl->%+v`, r) }()
	}
	r0, r1, err := procInitializeAcl.Call(_pAcl, uintptr(_nAclLength), uintptr(_dwAclRevision))
	if err != windows.NOERROR {
		if __ccgo_strace {
			trc(`r0=%v r1=%v err=%v`, r0, r1, err)
		}
		tls.SetLastError(uint32(err.(windows.Errno)))
	}
	return int32(r0)
}

// BOOL InitializeSid(
//
//	PSID                      Sid,
//	PSID_IDENTIFIER_AUTHORITY pIdentifierAuthority,
//	BYTE                      nSubAuthorityCount
//
// );
func XInitializeSid(t *TLS, Sid, pIdentifierAuthority uintptr, nSubAuthorityCount uint8) int32 {
	if __ccgo_strace {
		trc("t=%v pIdentifierAuthority=%v nSubAuthorityCount=%v, (%v:)", t, pIdentifierAuthority, nSubAuthorityCount, origin(2))
	}
	r0, _, err := procInitializeSid.Call(Sid, pIdentifierAuthority, uintptr(nSubAuthorityCount))
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// VOID RaiseException(
//
//	DWORD           dwExceptionCode,
//	DWORD           dwExceptionFlags,
//	DWORD           nNumberOfArguments,
//	const ULONG_PTR *lpArguments
//
// );
func XRaiseException(t *TLS, dwExceptionCode, dwExceptionFlags, nNumberOfArguments uint32, lpArguments uintptr) {
	if __ccgo_strace {
		trc("t=%v nNumberOfArguments=%v lpArguments=%v, (%v:)", t, nNumberOfArguments, lpArguments, origin(2))
	}
	panic(todo(""))
}

// UINT SetErrorMode(
//
//	UINT uMode
//
// );
func XSetErrorMode(t *TLS, uMode uint32) int32 {
	if __ccgo_strace {
		trc("t=%v uMode=%v, (%v:)", t, uMode, origin(2))
	}
	panic(todo(""))
}

// DWORD SetNamedSecurityInfoA(
//
//	LPSTR                pObjectName,
//	SE_OBJECT_TYPE       ObjectType,
//	SECURITY_INFORMATION SecurityInfo,
//	PSID                 psidOwner,
//	PSID                 psidGroup,
//	PACL                 pDacl,
//	PACL                 pSacl
//
// );
func XSetNamedSecurityInfoA(t *TLS, pObjectName uintptr, ObjectType int32, SecurityInfo uint32, psidOwner, psidGroup, pDacl, pSacl uintptr) uint32 {
	if __ccgo_strace {
		trc("t=%v pObjectName=%v SecurityInfo=%v pSacl=%v, (%v:)", t, pObjectName, SecurityInfo, pSacl, origin(2))
	}
	panic(todo(""))
}

// BOOL CreateProcessA(
//
//	LPCSTR                lpApplicationName,
//	LPSTR                 lpCommandLine,
//	LPSECURITY_ATTRIBUTES lpProcessAttributes,
//	LPSECURITY_ATTRIBUTES lpThreadAttributes,
//	BOOL                  bInheritHandles,
//	DWORD                 dwCreationFlags,
//	LPVOID                lpEnvironment,
//	LPCSTR                lpCurrentDirectory,
//	LPSTARTUPINFOA        lpStartupInfo,
//	LPPROCESS_INFORMATION lpProcessInformation
//
// );
func XCreateProcessA(t *TLS, lpApplicationName, lpCommandLine, lpProcessAttributes, lpThreadAttributes uintptr, bInheritHandles int32,
	dwCreationFlags uint32, lpEnvironment, lpCurrentDirectory, lpStartupInfo, lpProcessInformation uintptr) int32 {
	r1, _, err := procCreateProcessA.Call(lpApplicationName, lpCommandLine, lpProcessAttributes, lpThreadAttributes,
		uintptr(bInheritHandles), uintptr(dwCreationFlags), lpEnvironment, lpCurrentDirectory, lpStartupInfo, lpProcessInformation, 0, 0)
	if r1 == 0 {
		if err != windows.NOERROR {
			t.setErrno(err)
		} else {
			t.setErrno(errno.EINVAL)
		}
	}
	return int32(r1)
}

// unsigned int _set_abort_behavior(
//
//	unsigned int flags,
//	unsigned int mask
//
// );
func X_set_abort_behavior(t *TLS, _ ...interface{}) uint32 {
	panic(todo(""))
}

// HANDLE OpenEventA(
//
//	DWORD  dwDesiredAccess,
//	BOOL   bInheritHandle,
//	LPCSTR lpName
//
// );
func XOpenEventA(t *TLS, dwDesiredAccess uint32, bInheritHandle uint32, lpName uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v dwDesiredAccess=%v bInheritHandle=%v lpName=%v, (%v:)", t, dwDesiredAccess, bInheritHandle, lpName, origin(2))
	}
	r0, _, err := procOpenEventA.Call(uintptr(dwDesiredAccess), uintptr(bInheritHandle), lpName)
	if r0 == 0 {
		t.setErrno(err)
	}
	return r0
}

// size_t _msize(
//
//	void *memblock
//
// );
func X_msize(t *TLS, memblock uintptr) types.Size_t {
	if __ccgo_strace {
		trc("t=%v memblock=%v, (%v:)", t, memblock, origin(2))
	}
	return types.Size_t(UsableSize(memblock))
}

// unsigned long _byteswap_ulong ( unsigned long val );
func X_byteswap_ulong(t *TLS, val ulong) ulong {
	if __ccgo_strace {
		trc("t=%v val=%v, (%v:)", t, val, origin(2))
	}
	return X__builtin_bswap32(t, val)
}

// unsigned __int64 _byteswap_uint64 ( unsigned __int64 val );
func X_byteswap_uint64(t *TLS, val uint64) uint64 {
	if __ccgo_strace {
		trc("t=%v val=%v, (%v:)", t, val, origin(2))
	}
	return X__builtin_bswap64(t, val)
}

// int _commit(
//
//	int fd
//
// );
func X_commit(t *TLS, fd int32) int32 {
	if __ccgo_strace {
		trc("t=%v fd=%v, (%v:)", t, fd, origin(2))
	}
	return Xfsync(t, fd)
}

// int _stati64(
//
//	const char *path,
//	struct _stati64 *buffer
//
// );
func X_stati64(t *TLS, path, buffer uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v path=%v buffer=%v, (%v:)", t, path, buffer, origin(2))
	}
	r0, _, err := procStati64.Call(uintptr(path), uintptr(buffer))
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// int _fstati64(int fd, struct _stati64 *buffer);
func X_fstati64(t *TLS, fd int32, buffer uintptr) int32 {
	return X_fstat64(t, fd, buffer)
}

// int _findnext32(
//
//	intptr_t handle,
//	struct _finddata32_t *fileinfo
//
// );
func X_findnext32(t *TLS, handle types.Intptr_t, buffer uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v handle=%v buffer=%v, (%v:)", t, handle, buffer, origin(2))
	}
	r0, _, err := procFindnext32.Call(uintptr(handle), buffer)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// intptr_t _findfirst32(
//
//	const char *filespec,
//	struct _finddata32_t *fileinfo
//
// );
func X_findfirst32(t *TLS, filespec, fileinfo uintptr) types.Intptr_t {
	if __ccgo_strace {
		trc("t=%v fileinfo=%v, (%v:)", t, fileinfo, origin(2))
	}
	r0, _, err := procFindfirst32.Call(filespec, fileinfo)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return types.Intptr_t(r0)
}

/*-
 * Copyright (c) 1990 The Regents of the University of California.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the University nor the names of its contributors
 *    may be used to endorse or promote products derived from this software
 *    without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE REGENTS OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 */

// long strtol(const char *nptr, char **endptr, int base);
func Xstrtol(t *TLS, nptr, endptr uintptr, base int32) long {
	if __ccgo_strace {
		trc("t=%v endptr=%v base=%v, (%v:)", t, endptr, base, origin(2))
	}

	var s uintptr = nptr
	var acc ulong
	var c byte
	var cutoff ulong
	var neg int32
	var any int32
	var cutlim int32

	/*
	 * Skip white space and pick up leading +/- sign if any.
	 * If base is 0, allow 0x for hex and 0 for octal, else
	 * assume decimal; if base is already 16, allow 0x.
	 */
	for {
		c = *(*byte)(unsafe.Pointer(s))
		PostIncUintptr(&s, 1)
		var sp = strings.TrimSpace(string(c))
		if len(sp) > 0 {
			break
		}
	}

	if c == '-' {
		neg = 1
		c = *(*byte)(unsafe.Pointer(s))
		PostIncUintptr(&s, 1)
	} else if c == '+' {
		c = *(*byte)(unsafe.Pointer(s))
		PostIncUintptr(&s, 1)
	}

	sp := *(*byte)(unsafe.Pointer(s))

	if (base == 0 || base == 16) &&
		c == '0' && (sp == 'x' || sp == 'X') {
		PostIncUintptr(&s, 1)
		c = *(*byte)(unsafe.Pointer(s)) //s[1];
		PostIncUintptr(&s, 1)
		base = 16
	}
	if base == 0 {
		if c == '0' {
			base = 0
		} else {
			base = 10
		}
	}
	/*
	 * Compute the cutoff value between legal numbers and illegal
	 * numbers.  That is the largest legal value, divided by the
	 * base.  An input number that is greater than this value, if
	 * followed by a legal input character, is too big.  One that
	 * is equal to this value may be valid or not; the limit
	 * between valid and invalid numbers is then based on the last
	 * digit.  For instance, if the range for longs is
	 * [-2147483648..2147483647] and the input base is 10,
	 * cutoff will be set to 214748364 and cutlim to either
	 * 7 (neg==0) or 8 (neg==1), meaning that if we have accumulated
	 * a value > 214748364, or equal but the next digit is > 7 (or 8),
	 * the number is too big, and we will return a range error.
	 *
	 * Set any if any `digits' consumed; make it negative to indicate
	 * overflow.
	 */
	var ULONG_MAX ulong = 0xFFFFFFFF
	var LONG_MAX long = long(ULONG_MAX >> 1)
	var LONG_MIN long = ^LONG_MAX

	if neg == 1 {
		cutoff = ulong(-1 * LONG_MIN)
	} else {
		cutoff = ulong(LONG_MAX)
	}
	cutlim = int32(cutoff % ulong(base))
	cutoff = cutoff / ulong(base)

	acc = 0
	any = 0

	for {
		var cs = string(c)
		if unicode.IsDigit([]rune(cs)[0]) {
			c -= '0'
		} else if unicode.IsLetter([]rune(cs)[0]) {
			if unicode.IsUpper([]rune(cs)[0]) {
				c -= 'A' - 10
			} else {
				c -= 'a' - 10
			}
		} else {
			break
		}

		if int32(c) >= base {
			break
		}
		if any < 0 || acc > cutoff || (acc == cutoff && int32(c) > cutlim) {
			any = -1

		} else {
			any = 1
			acc *= ulong(base)
			acc += ulong(c)
		}

		c = *(*byte)(unsafe.Pointer(s))
		PostIncUintptr(&s, 1)
	}

	if any < 0 {
		if neg == 1 {
			acc = ulong(LONG_MIN)
		} else {
			acc = ulong(LONG_MAX)
		}
		t.setErrno(errno.ERANGE)
	} else if neg == 1 {
		acc = -acc
	}

	if endptr != 0 {
		if any == 1 {
			PostDecUintptr(&s, 1)
			AssignPtrUintptr(endptr, s)
		} else {
			AssignPtrUintptr(endptr, nptr)
		}
	}
	return long(acc)
}

// unsigned long int strtoul(const char *nptr, char **endptr, int base);
func Xstrtoul(t *TLS, nptr, endptr uintptr, base int32) ulong {
	if __ccgo_strace {
		trc("t=%v endptr=%v base=%v, (%v:)", t, endptr, base, origin(2))
	}
	var s uintptr = nptr
	var acc ulong
	var c byte
	var cutoff ulong
	var neg int32
	var any int32
	var cutlim int32

	/*
	 * Skip white space and pick up leading +/- sign if any.
	 * If base is 0, allow 0x for hex and 0 for octal, else
	 * assume decimal; if base is already 16, allow 0x.
	 */
	for {
		c = *(*byte)(unsafe.Pointer(s))
		PostIncUintptr(&s, 1)
		var sp = strings.TrimSpace(string(c))
		if len(sp) > 0 {
			break
		}
	}

	if c == '-' {
		neg = 1
		c = *(*byte)(unsafe.Pointer(s))
		PostIncUintptr(&s, 1)
	} else if c == '+' {
		c = *(*byte)(unsafe.Pointer(s))
		PostIncUintptr(&s, 1)
	}

	sp := *(*byte)(unsafe.Pointer(s))

	if (base == 0 || base == 16) &&
		c == '0' && (sp == 'x' || sp == 'X') {
		PostIncUintptr(&s, 1)
		c = *(*byte)(unsafe.Pointer(s)) //s[1];
		PostIncUintptr(&s, 1)
		base = 16
	}
	if base == 0 {
		if c == '0' {
			base = 0
		} else {
			base = 10
		}
	}
	var ULONG_MAX ulong = 0xFFFFFFFF

	cutoff = ULONG_MAX / ulong(base)
	cutlim = int32(ULONG_MAX % ulong(base))

	acc = 0
	any = 0

	for {
		var cs = string(c)
		if unicode.IsDigit([]rune(cs)[0]) {
			c -= '0'
		} else if unicode.IsLetter([]rune(cs)[0]) {
			if unicode.IsUpper([]rune(cs)[0]) {
				c -= 'A' - 10
			} else {
				c -= 'a' - 10
			}
		} else {
			break
		}

		if int32(c) >= base {
			break
		}
		if any < 0 || acc > cutoff || (acc == cutoff && int32(c) > cutlim) {
			any = -1

		} else {
			any = 1
			acc *= ulong(base)
			acc += ulong(c)
		}

		c = *(*byte)(unsafe.Pointer(s))
		PostIncUintptr(&s, 1)
	}

	if any < 0 {
		acc = ULONG_MAX
		t.setErrno(errno.ERANGE)
	} else if neg == 1 {
		acc = -acc
	}

	if endptr != 0 {
		if any == 1 {
			PostDecUintptr(&s, 1)
			AssignPtrUintptr(endptr, s)
		} else {
			AssignPtrUintptr(endptr, nptr)
		}
	}
	return acc
}

// int __isoc99_sscanf(const char *str, const char *format, ...);
func X__isoc99_sscanf(t *TLS, str, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v va=%v, (%v:)", t, va, origin(2))
	}
	r := scanf(strings.NewReader(GoString(str)), format, va)
	// if dmesgs {
	// 	dmesg("%v: %q %q: %d", origin(1), GoString(str), GoString(format), r)
	// }
	return r
}

// int sscanf(const char *str, const char *format, ...);
func Xsscanf(t *TLS, str, format, va uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v va=%v, (%v:)", t, va, origin(2))
	}
	r := scanf(strings.NewReader(GoString(str)), format, va)
	// if dmesgs {
	// 	dmesg("%v: %q %q: %d", origin(1), GoString(str), GoString(format), r)
	// }
	return r
}

var _toint4 = Float64FromInt32(1) / Float64FromFloat64(2.220446049250313e-16)

func Xrint(tls *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("tls=%v x=%v, (%v:)", tls, x, origin(2))
	}
	bp := tls.Alloc(16)
	defer tls.Free(16)
	var e, s int32
	var y Tdouble_t
	var v1 float64
	var _ /* u at bp+0 */ struct {
		Fi [0]Tuint64_t
		Ff float64
	}
	_, _, _, _ = e, s, y, v1
	*(*struct {
		Fi [0]Tuint64_t
		Ff float64
	})(unsafe.Pointer(bp)) = struct {
		Fi [0]Tuint64_t
		Ff float64
	}{}
	*(*float64)(unsafe.Pointer(bp)) = x
	e = Int32FromUint64(*(*Tuint64_t)(unsafe.Pointer(bp)) >> int32(52) & uint64(0x7ff))
	s = Int32FromUint64(*(*Tuint64_t)(unsafe.Pointer(bp)) >> int32(63))
	if e >= Int32FromInt32(0x3ff)+Int32FromInt32(52) {
		return x
	}
	if s != 0 {
		y = x - _toint4 + _toint4
	} else {
		y = x + _toint4 - _toint4
	}
	if y == Float64FromInt32(0) {
		if s != 0 {
			v1 = -Float64FromFloat64(0)
		} else {
			v1 = Float64FromInt32(0)
		}
		return v1
	}
	return y
}

// FILE *fdopen(int fd, const char *mode);
func Xfdopen(t *TLS, fd int32, mode uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v fd=%v mode=%v, (%v:)", t, fd, mode, origin(2))
	}
	panic(todo(""))
}

// struct tm *_gmtime64( const __time64_t *sourceTime );
func X_gmtime64(t *TLS, sourceTime uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v sourceTime=%v, (%v:)", t, sourceTime, origin(2))
	}
	r0, _, err := procGmtime64.Call(uintptr(sourceTime))
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return uintptr(r0)
}

// __time64_t _mktime64(struct tm *timeptr);
func X_mktime64(t *TLS, timeptr uintptr) time.X__time64_t {
	if __ccgo_strace {
		trc("t=%v timeptr=%v, (%v:)", t, timeptr, origin(2))
	}
	return time.X__time64_t(Xmktime(t, timeptr))
}

// char * gai_strerrorA(int ecode);
func Xgai_strerrorA(t *TLS, ecode int32) uintptr {
	if __ccgo_strace {
		trc("t=%v ecode=%v, (%v:)", t, ecode, origin(2))
	}
	panic(todo(""))
}

// https://github.com/Alexpux/mingw-w64/blob/master/mingw-w64-headers/crt/sys/timeb.h#L69
//
// struct __timeb64 {
//     __time64_t time;
//     unsigned short millitm;
//     short timezone;
//     short dstflag;
//   };

type __timeb64 struct {
	time     types.X__time64_t
	millitm  uint32
	timezone int16
	dstflag  int16
}

// void _ftime64( struct __timeb64 *timeptr );
func X_ftime64(t *TLS, timeptr uintptr) {
	if __ccgo_strace {
		trc("t=%v timeptr=%v, (%v:)", t, timeptr, origin(2))
	}
	tm := gotime.Now()
	(*__timeb64)(unsafe.Pointer(timeptr)).time = types.X__time64_t(tm.Unix())

	//TODO When Go 1.16 is no more supported
	// (*__timeb64)(unsafe.Pointer(timeptr)).millitm = uint32(tm.UnixMilli() % 1000)

	(*__timeb64)(unsafe.Pointer(timeptr)).millitm = uint32(int64(tm.Nanosecond()) / 1e6)
}

func X__ccgo_getMutexType(tls *TLS, m uintptr) int32 { /* pthread_mutex_lock.c:3:5: */
	if __ccgo_strace {
		trc("tls=%v m=%v, (%v:)", tls, m, origin(2))
	}
	return *(*int32)(unsafe.Pointer(m)) & 15
}

func X__ccgo_pthreadAttrGetDetachState(tls *TLS, a uintptr) int32 { /* pthread_attr_get.c:3:5: */
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	return *(*int32)(unsafe.Pointer(a))
}

func X__ccgo_pthreadMutexattrGettype(tls *TLS, a uintptr) int32 { /* pthread_attr_get.c:93:5: */
	if __ccgo_strace {
		trc("tls=%v a=%v, (%v:)", tls, a, origin(2))
	}
	return *(*int32)(unsafe.Pointer(a)) & int32(3)
}

func Xchmod(t *TLS, pathname uintptr, mode int32) int32 {
	r0, _, err := procChmod.Call(pathname, uintptr(mode))
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// typedef enum _COMPUTER_NAME_FORMAT {
//   ComputerNameNetBIOS,
//   ComputerNameDnsHostname,
//   ComputerNameDnsDomain,
//   ComputerNameDnsFullyQualified,
//   ComputerNamePhysicalNetBIOS,
//   ComputerNamePhysicalDnsHostname,
//   ComputerNamePhysicalDnsDomain,
//   ComputerNamePhysicalDnsFullyQualified,
//   ComputerNameMax
// } COMPUTER_NAME_FORMAT;

// BOOL GetComputerNameExW(
//
//	[in]      COMPUTER_NAME_FORMAT NameType,
//	[out]     LPWSTR               lpBuffer,
//	[in, out] LPDWORD              nSize
//
// );
func XGetComputerNameExW(t *TLS, nameType int32, lpBuffer, nSize uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v nameType=%v nSize=%v, (%v:)", t, nameType, nSize, origin(2))
	}
	r0, _, err := procGetComputerNameExW.Call(uintptr(nameType), lpBuffer, nSize)
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// double _copysign(
//
//	double x,
//	double y
//
// );

func X_copysign(t *TLS, x, y float64) float64 {
	if __ccgo_strace {
		trc("t=%v y=%v, (%v:)", t, y, origin(2))
	}
	return Xcopysign(t, x, y)
}

// int _wtoi(
//
//	const wchar_t *str
//
// );
func X_wtoi(t *TLS, str uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v str=%v, (%v:)", t, str, origin(2))
	}
	panic(todo(""))
}

func allocW(t *TLS, v string) (r uintptr) {
	s := utf16.Encode([]rune(v))
	p := Xcalloc(t, types.Size_t(len(s)+1), 2)
	if p == 0 {
		panic(todo(""))
	}

	r = p
	for _, v := range s {
		*(*uint16)(unsafe.Pointer(p)) = v
		p += 2
	}
	return r
}

// wchar_t *_wgetenv(
//
//	const wchar_t *varname
//
// );
func X_wgetenv(t *TLS, varname uintptr) uintptr {
	if __ccgo_strace {
		trc("t=%v varname=%v, (%v:)", t, varname, origin(2))
	}
	if !wenvValid {
		bootWinEnviron(t)
	}
	k := strings.ToLower(goWideStringNZ(varname))
	for _, v := range winEnviron[:len(winEnviron)-1] {
		s := strings.ToLower(goWideStringNZ(v))
		x := strings.IndexByte(s, '=')
		if s[:x] == k {
			// trc("%v: %q -> %q", origin(1), goWideStringNZ(varname), goWideStringNZ(v))
			return v
		}
	}

	// trc("%v: %q -> %q", origin(1), goWideStringNZ(varname), "")
	return 0
}

// int _wputenv(
//
//	const wchar_t *envstring
//
// );
func X_wputenv(t *TLS, envstring uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v envstring=%v, (%v:)", t, envstring, origin(2))
	}
	if !wenvValid {
		bootWinEnviron(t)
	}
	s0 := goWideStringNZ(envstring)
	s := strings.ToLower(s0)
	x := strings.IndexByte(s, '=')
	k := s[:x]
	for i, v := range winEnviron[:len(winEnviron)-1] {
		s2 := strings.ToLower(goWideStringNZ(v))
		x := strings.IndexByte(s2, '=')
		if s2[:x] == k {
			Xfree(t, v)
			winEnviron[i] = allocW(t, s0)
			return 0
		}
	}

	np := allocW(t, s0)
	winEnviron = winEnviron[:len(winEnviron)-1]
	winEnviron = append(winEnviron, np, 0)
	wenviron = uintptr(unsafe.Pointer(&winEnviron[0]))
	return 0
}

func bootWinEnviron(t *TLS) {
	winEnviron = winEnviron[:0]
	p := Environ()
	for {
		q := *(*uintptr)(unsafe.Pointer(p))
		p += unsafe.Sizeof(uintptr(0))
		if q == 0 {
			break
		}

		s := GoString(q)
		// trc("%v: %q", origin(1), s)
		r := allocW(t, s)
		winEnviron = append(winEnviron, r)
	}
	wenviron = uintptr(unsafe.Pointer(&winEnviron[0]))
	wenvValid = true
}

func Xfabsl(t *TLS, x float64) float64 {
	if __ccgo_strace {
		trc("t=%v x=%v, (%v:)", t, x, origin(2))
	}
	return math.Abs(x)
}

func X__stdio_common_vfprintf(t *TLS, args ...interface{}) int32     { panic("TODO") }
func X__stdio_common_vfprintf_p(t *TLS, args ...interface{}) int32   { panic("TODO") }
func X__stdio_common_vfprintf_s(t *TLS, args ...interface{}) int32   { panic("TODO") }
func X__stdio_common_vfscanf(t *TLS, args ...interface{}) int32      { panic("TODO") }
func X__stdio_common_vfwprintf_s(t *TLS, args ...interface{}) int32  { panic("TODO") }
func X__stdio_common_vfwscanf(t *TLS, args ...interface{}) int32     { panic("TODO") }
func X__stdio_common_vsnprintf_s(t *TLS, args ...interface{}) int32  { panic("TODO") }
func X__stdio_common_vsnwprintf_s(t *TLS, args ...interface{}) int32 { panic("TODO") }
func X__stdio_common_vsprintf(t *TLS, args ...interface{}) int32     { panic("TODO") }
func X__stdio_common_vsprintf_p(t *TLS, args ...interface{}) int32   { panic("TODO") }
func X__stdio_common_vsprintf_s(t *TLS, args ...interface{}) int32   { panic("TODO") }
func X__stdio_common_vsscanf(t *TLS, args ...interface{}) int32      { panic("TODO") }
func X__stdio_common_vswprintf(t *TLS, args ...interface{}) int32    { panic("TODO") }
func X__stdio_common_vswprintf_s(t *TLS, args ...interface{}) int32  { panic("TODO") }
func X__stdio_common_vswscanf(t *TLS, args ...interface{}) int32     { panic("TODO") }

func X_lseeki64(t *TLS, fd int32, offset int64, whence int32) int64 {
	if __ccgo_strace {
		trc("t=%v fd=%v offset=%v whence=%v, (%v:)", t, fd, offset, whence, origin(2))
	}

	f, ok := fdToFile(fd)
	if !ok {
		t.setErrno(errno.EBADF)
		return -1
	}

	n, err := windows.Seek(f.Handle, offset, int(whence))
	if err != nil {
		if dmesgs {
			dmesg("%v: fd %v, off %#x, whence %v: %v", origin(1), f._fd, offset, whenceStr(whence), n)
		}
		t.setErrno(err)
		return -1
	}

	if dmesgs {
		dmesg("%v: fd %v, off %#x, whence %v: ok", origin(1), f._fd, offset, whenceStr(whence))
	}
	return n
}

func Xislower(tls *TLS, c int32) int32 { /* islower.c:4:5: */
	if __ccgo_strace {
		trc("tls=%v c=%v, (%v:)", tls, c, origin(2))
	}
	return Bool32(uint32(c)-uint32('a') < uint32(26))
}

func Xisupper(tls *TLS, c int32) int32 { /* isupper.c:4:5: */
	if __ccgo_strace {
		trc("tls=%v c=%v, (%v:)", tls, c, origin(2))
	}
	return Bool32(uint32(c)-uint32('A') < uint32(26))
}

// int access(const char *pathname, int mode);
func Xaccess(t *TLS, pathname uintptr, mode int32) int32 {
	if __ccgo_strace {
		trc("t=%v pathname=%v mode=%v, (%v:)", t, pathname, mode, origin(2))
	}
	r0, _, err := procAccess.Call(uintptr(pathname), uintptr(mode))
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

// int _vscprintf(const char *format, va_list argptr);
func X_vscprintf(t *TLS, format uintptr, argptr uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v format=%v argptr=%v, (%v:)", t, format, argptr, origin(2))
	}

	return int32(len(printf(format, argptr)))
}

// int _stat32i64(const char *path, struct _stat32i64 *buffer);
func X_stat64i32(t *TLS, path uintptr, buffer uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v path=%v buffer=%v, (%v:)", t, path, buffer, origin(2))
	}
	r0, _, err := procStat64i32.Call(uintptr(path), uintptr(buffer))
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return int32(r0)
}

func AtomicLoadNUint8(ptr uintptr, memorder int32) uint8 {
	return byte(a_load_8(ptr))
}

// struct tm *gmtime( const time_t *sourceTime );
// func Xgmtime(t *TLS, sourceTime uintptr) uintptr {
// 	if __ccgo_strace {
// 		trc("t=%v sourceTime=%v, (%v:)", t, sourceTime, origin(2))
// 	}
// 	 r0, _, err := procGmtime.Call(uintptr(sourceTime))
// 	 if err != windows.NOERROR {
// 	 	t.setErrno(err)
// 	 }
// 	 return uintptr(r0)
// }

var _tm time.Tm

// /tmp/libc/musl-master/src/time/gmtime.c:4:11:
func Xgmtime(tls *TLS, t uintptr) (r uintptr) { // /tmp/libc/musl-master/src/time/gmtime.c:7:2:
	if __ccgo_strace {
		trc("tls=%v t=%v, (%v:)", tls, t, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	r = Xgmtime_r(tls, t, uintptr(unsafe.Pointer(&_tm)))
	return r
}

var _days_in_month = [12]int8{
	0:  int8(31),
	1:  int8(30),
	2:  int8(31),
	3:  int8(30),
	4:  int8(31),
	5:  int8(31),
	6:  int8(30),
	7:  int8(31),
	8:  int8(30),
	9:  int8(31),
	10: int8(31),
	11: int8(29),
}

var x___utc = [4]int8{'U', 'T', 'C'}

func Xgmtime_r(tls *TLS, t uintptr, tm uintptr) (r uintptr) {
	if __ccgo_strace {
		trc("tls=%v t=%v tm=%v, (%v:)", tls, t, tm, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	if x___secs_to_tm(tls, int64(*(*time.Time_t)(unsafe.Pointer(t))), tm) < 0 {
		*(*int32)(unsafe.Pointer(X__errno_location(tls))) = int32(errno.EOVERFLOW)
		return uintptr(0)
	}
	(*time.Tm)(unsafe.Pointer(tm)).Ftm_isdst = 0
	return tm
}

func x___secs_to_tm(tls *TLS, t int64, tm uintptr) (r int32) {
	var c_cycles, leap, months, q_cycles, qc_cycles, remdays, remsecs, remyears, wday, yday int32
	var days, secs, years int64
	_, _, _, _, _, _, _, _, _, _, _, _, _ = c_cycles, days, leap, months, q_cycles, qc_cycles, remdays, remsecs, remyears, secs, wday, yday, years
	/* Reject time_t values whose year would overflow int */
	if t < int64(-Int32FromInt32(1)-Int32FromInt32(0x7fffffff))*Int64FromInt64(31622400) || t > Int64FromInt32(limits.INT_MAX)*Int64FromInt64(31622400) {
		return -int32(1)
	}
	secs = t - (Int64FromInt64(946684800) + int64(Int32FromInt32(86400)*(Int32FromInt32(31)+Int32FromInt32(29))))
	days = secs / int64(86400)
	remsecs = int32(secs % int64(86400))
	if remsecs < 0 {
		remsecs += int32(86400)
		days--
	}
	wday = int32((int64(3) + days) % int64(7))
	if wday < 0 {
		wday += int32(7)
	}
	qc_cycles = int32(days / int64(Int32FromInt32(365)*Int32FromInt32(400)+Int32FromInt32(97)))
	remdays = int32(days % int64(Int32FromInt32(365)*Int32FromInt32(400)+Int32FromInt32(97)))
	if remdays < 0 {
		remdays += Int32FromInt32(365)*Int32FromInt32(400) + Int32FromInt32(97)
		qc_cycles--
	}
	c_cycles = remdays / (Int32FromInt32(365)*Int32FromInt32(100) + Int32FromInt32(24))
	if c_cycles == int32(4) {
		c_cycles--
	}
	remdays -= c_cycles * (Int32FromInt32(365)*Int32FromInt32(100) + Int32FromInt32(24))
	q_cycles = remdays / (Int32FromInt32(365)*Int32FromInt32(4) + Int32FromInt32(1))
	if q_cycles == int32(25) {
		q_cycles--
	}
	remdays -= q_cycles * (Int32FromInt32(365)*Int32FromInt32(4) + Int32FromInt32(1))
	remyears = remdays / int32(365)
	if remyears == int32(4) {
		remyears--
	}
	remdays -= remyears * int32(365)
	leap = BoolInt32(!(remyears != 0) && (q_cycles != 0 || !(c_cycles != 0)))
	yday = remdays + int32(31) + int32(28) + leap
	if yday >= int32(365)+leap {
		yday -= int32(365) + leap
	}
	years = int64(remyears+int32(4)*q_cycles+int32(100)*c_cycles) + int64(400)*int64(int64(qc_cycles))
	months = 0
	for {
		if !(int32(_days_in_month[months]) <= remdays) {
			break
		}
		remdays -= int32(_days_in_month[months])
		goto _1
	_1:
		months++
	}
	if months >= int32(10) {
		months -= int32(12)
		years++
	}
	if years+int64(100) > int64(limits.INT_MAX) || years+int64(100) < int64(-Int32FromInt32(1)-Int32FromInt32(0x7fffffff)) {
		return -int32(1)
	}
	(*time.Tm)(unsafe.Pointer(tm)).Ftm_year = int32(years + int64(100))
	(*time.Tm)(unsafe.Pointer(tm)).Ftm_mon = months + int32(2)
	(*time.Tm)(unsafe.Pointer(tm)).Ftm_mday = remdays + int32(1)
	(*time.Tm)(unsafe.Pointer(tm)).Ftm_wday = wday
	(*time.Tm)(unsafe.Pointer(tm)).Ftm_yday = yday
	(*time.Tm)(unsafe.Pointer(tm)).Ftm_hour = remsecs / int32(3600)
	(*time.Tm)(unsafe.Pointer(tm)).Ftm_min = remsecs / int32(60) % int32(60)
	(*time.Tm)(unsafe.Pointer(tm)).Ftm_sec = remsecs % int32(60)
	return 0
}

// size_t strftime(
//
//	char *strDest,
//	size_t maxsize,
//	const char *format,
//	const struct tm *timeptr
//
// );
func Xstrftime(tls *TLS, s uintptr, n size_t, f uintptr, tm uintptr) (r size_t) {
	if __ccgo_strace {
		trc("tls=%v s=%v n=%v f=%v tm=%v, (%v:)", tls, s, n, f, tm, origin(2))
		defer func() { trc("-> %v", r) }()
	}
	tt := gotime.Date(
		int((*time.Tm)(unsafe.Pointer(tm)).Ftm_year+1900),
		gotime.Month((*time.Tm)(unsafe.Pointer(tm)).Ftm_mon+1),
		int((*time.Tm)(unsafe.Pointer(tm)).Ftm_mday),
		int((*time.Tm)(unsafe.Pointer(tm)).Ftm_hour),
		int((*time.Tm)(unsafe.Pointer(tm)).Ftm_min),
		int((*time.Tm)(unsafe.Pointer(tm)).Ftm_sec),
		0,
		gotime.UTC,
	)
	fmt := GoString(f)
	var result string
	if fmt != "" {
		result = strftime.Format(fmt, tt)
	}
	switch r = size_t(len(result)); {
	case r > n:
		r = 0
	default:
		copy((*RawMem)(unsafe.Pointer(s))[:r:r], result)
		*(*byte)(unsafe.Pointer(s + uintptr(r))) = 0
	}
	return r

}

func X__mingw_strtod(t *TLS, s uintptr, p uintptr) float64 {
	return Xstrtod(t, s, p)
}

func Xstrtod(t *TLS, s uintptr, p uintptr) float64 {
	if __ccgo_strace {
		trc("tls=%v s=%v p=%v, (%v:)", t, s, p, origin(2))
	}
	r0, _, err := procStrtod.Call(uintptr(s), uintptr(p))
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return math.Float64frombits(uint64(r0))
}

// int vsnprintf(char *str, size_t size, const char *format, va_list ap);
func X_vsnprintf(t *TLS, str uintptr, size types.Size_t, format, ap uintptr) int32 {
	if __ccgo_strace {
		trc("t=%v str=%v size=%v ap=%v, (%v:)", t, str, size, ap, origin(2))
	}
	return Xvsnprintf(t, str, size, format, ap)
}

func X__ccgo_SyscallFP() {
	s := fmt.Sprintf("%s\nTODO syscall: function pointer", debug.Stack())
	panic(s)
}

func CreateThread(t *TLS, lpThreadAttributes uintptr, dwStackSize types.Size_t, lpStartAddress, lpParameter uintptr, dwCreationFlags uint32, lpThreadId uintptr) uintptr {
	return XCreateThread(t, lpThreadAttributes, dwStackSize, lpStartAddress, lpParameter, dwCreationFlags, lpThreadId)
}

// wchar_t *wcsncpy(wchar_t *strDest, const wchar_t *strSource, size_t count);
func Xwcsncpy(t *TLS, strDest, strSource uintptr, count types.Size_t) uintptr {
	r0, _, err := procWcsncpy.Call(strDest, strSource, uintptr(count))
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return r0
}

// wchar_t *wcsrchr(const wchar_t *str, wchar_t c);
func Xwcsrchr(t *TLS, str uintptr, c types.Wchar_t) uintptr {
	r0, _, err := procWcsrchr.Call(str, uintptr(c))
	if err != windows.NOERROR {
		t.setErrno(err)
	}
	return r0
}

// __attribute__ ((__dllimport__)) char * __attribute__((__cdecl__)) _ctime64(const __time64_t *_Time);
func X_ctime64(tls *TLS, __Time uintptr) (r uintptr) {
	if __ccgo_strace {
		trc("_Time=%+v", __Time)
		defer func() { trc(`X_ctime64->%+v`, r) }()
	}
	r0, _, err := procCtime64.Call(__Time)
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return uintptr(r0)
}

// __attribute__ ((__dllimport__)) __time64_t __attribute__((__cdecl__)) _time64(__time64_t *_Time);
func X_time64(tls *TLS, __Time uintptr) (r int64) {
	if __ccgo_strace {
		trc("_Time=%+v", __Time)
		defer func() { trc(`X_time64->%+v`, r) }()
	}
	r0, _, err := procTime64.Call(__Time)
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return int64(r0)
}

// __attribute__ ((__dllimport__)) int __attribute__((__cdecl__)) _strnicmp(const char *_Str1,const char *_Str2,size_t _MaxCount);
func X_strnicmp(tls *TLS, __Str1 uintptr, __Str2 uintptr, __MaxCount types.Size_t) (r int32) {
	if __ccgo_strace {
		trc("_Str1=%+v _Str2=%+v _MaxCount=%+v", __Str1, __Str2, __MaxCount)
		defer func() { trc(`X_strnicmp->%+v`, r) }()
	}
	r0, _, err := procStrnicmp.Call(__Str1, __Str2, uintptr(__MaxCount))
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return int32(r0)
}

func X__builtin_ctz(t *TLS, n uint32) int32 {
	return int32(mbits.TrailingZeros32(n))
}

// intptr_t _wfindfirst64i32(const wchar_t *filespec, struct _wfinddata64i32_t *fileinfo);
func X_wfindfirst64i32(tls *TLS, filespec, fileinfo uintptr) (r types.Intptr_t) {
	r0, _, err := procWfindfirst64i32.Call(filespec, fileinfo)
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return types.Intptr_t(r0)
}

// int _wfindnext64i32(intptr_t handle, struct _wfinddata64i32_t *fileinfo);
func X_wfindnext64i32(tls *TLS, handle types.Intptr_t, fileinfo uintptr) (r int32) {
	r0, _, err := procWfindnext64i32.Call(uintptr(handle), fileinfo)
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return int32(r0)
}

// int _wchmod( const wchar_t *filename, int pmode );
func X_wchmod(tls *TLS, filename uintptr, pmode int32) (r int32) {
	r0, _, err := procWchmod.Call(filename, uintptr(pmode))
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return int32(r0)
}

// int _wmkdir(const wchar_t *dirname);
func X_wmkdir(tls *TLS, dirname uintptr) (r int32) {
	r0, _, err := procWmkdir.Call(dirname)
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return int32(r0)
}

// int _wstat64i32(const wchar_t *path, struct _stat64i32 *buffer);
func X_wstat64i32(tls *TLS, path, buffer uintptr) (r int32) {
	r0, _, err := procWstat64i32.Call(path, buffer)
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return int32(r0)
}

// intptr_t _wfindfirst32(const wchar_t *filespec, struct _wfinddata32_t *fileinfo);
func X_wfindfirst32(tls *TLS, filespec, fileinfo uintptr) (r types.Intptr_t) {
	r0, _, err := procWfindfirst32.Call(filespec, fileinfo)
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return types.Intptr_t(r0)
}

// int _wfindnext32(intptr_t handle, struct _wfinddata32_t *fileinfo);
func X_wfindnext32(tls *TLS, handle types.Intptr_t, fileinfo uintptr) (r int32) {
	r0, _, err := procWfindnext32.Call(uintptr(handle), fileinfo)
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return int32(r0)
}

// int _wstat32(const wchar_t *path, struct __stat32 *buffer);
func X_wstat32(tls *TLS, path, buffer uintptr) (r int32) {
	r0, _, err := procWstat32.Call(path, buffer)
	if err != windows.NOERROR {
		tls.setErrno(int32(err.(windows.Errno)))
	}
	return int32(r0)
}
