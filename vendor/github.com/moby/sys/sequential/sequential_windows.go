package sequential

import (
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Create is a copy of [os.Create], modified to use sequential file access.
//
// It uses [windows.FILE_FLAG_SEQUENTIAL_SCAN] rather than [windows.FILE_ATTRIBUTE_NORMAL]
// as implemented in golang. Refer to the [Win32 API documentation] for details
// on sequential file access.
//
// [Win32 API documentation]: https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea#FILE_FLAG_SEQUENTIAL_SCAN
func Create(name string) (*os.File, error) {
	return openFileSequential(name, windows.O_RDWR|windows.O_CREAT|windows.O_TRUNC)
}

// Open is a copy of [os.Open], modified to use sequential file access.
//
// It uses [windows.FILE_FLAG_SEQUENTIAL_SCAN] rather than [windows.FILE_ATTRIBUTE_NORMAL]
// as implemented in golang. Refer to the [Win32 API documentation] for details
// on sequential file access.
//
// [Win32 API documentation]: https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea#FILE_FLAG_SEQUENTIAL_SCAN
func Open(name string) (*os.File, error) {
	return openFileSequential(name, windows.O_RDONLY)
}

// OpenFile is a copy of [os.OpenFile], modified to use sequential file access.
//
// It uses [windows.FILE_FLAG_SEQUENTIAL_SCAN] rather than [windows.FILE_ATTRIBUTE_NORMAL]
// as implemented in golang. Refer to the [Win32 API documentation] for details
// on sequential file access.
//
// [Win32 API documentation]: https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea#FILE_FLAG_SEQUENTIAL_SCAN
func OpenFile(name string, flag int, _ os.FileMode) (*os.File, error) {
	return openFileSequential(name, flag)
}

func openFileSequential(name string, flag int) (file *os.File, err error) {
	if name == "" {
		return nil, &os.PathError{Op: "open", Path: name, Err: windows.ERROR_FILE_NOT_FOUND}
	}
	r, e := openSequential(name, flag|windows.O_CLOEXEC)
	if e != nil {
		return nil, &os.PathError{Op: "open", Path: name, Err: e}
	}
	return os.NewFile(uintptr(r), name), nil
}

func makeInheritSa() *windows.SecurityAttributes {
	var sa windows.SecurityAttributes
	sa.Length = uint32(unsafe.Sizeof(sa))
	sa.InheritHandle = 1
	return &sa
}

func openSequential(path string, mode int) (fd windows.Handle, err error) {
	if len(path) == 0 {
		return windows.InvalidHandle, windows.ERROR_FILE_NOT_FOUND
	}
	pathp, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return windows.InvalidHandle, err
	}
	var access uint32
	switch mode & (windows.O_RDONLY | windows.O_WRONLY | windows.O_RDWR) {
	case windows.O_RDONLY:
		access = windows.GENERIC_READ
	case windows.O_WRONLY:
		access = windows.GENERIC_WRITE
	case windows.O_RDWR:
		access = windows.GENERIC_READ | windows.GENERIC_WRITE
	}
	if mode&windows.O_CREAT != 0 {
		access |= windows.GENERIC_WRITE
	}
	if mode&windows.O_APPEND != 0 {
		access &^= windows.GENERIC_WRITE
		access |= windows.FILE_APPEND_DATA
	}
	sharemode := uint32(windows.FILE_SHARE_READ | windows.FILE_SHARE_WRITE)
	var sa *windows.SecurityAttributes
	if mode&windows.O_CLOEXEC == 0 {
		sa = makeInheritSa()
	}
	var createmode uint32
	switch {
	case mode&(windows.O_CREAT|windows.O_EXCL) == (windows.O_CREAT | windows.O_EXCL):
		createmode = windows.CREATE_NEW
	case mode&(windows.O_CREAT|windows.O_TRUNC) == (windows.O_CREAT | windows.O_TRUNC):
		createmode = windows.CREATE_ALWAYS
	case mode&windows.O_CREAT == windows.O_CREAT:
		createmode = windows.OPEN_ALWAYS
	case mode&windows.O_TRUNC == windows.O_TRUNC:
		createmode = windows.TRUNCATE_EXISTING
	default:
		createmode = windows.OPEN_EXISTING
	}
	// Use FILE_FLAG_SEQUENTIAL_SCAN rather than FILE_ATTRIBUTE_NORMAL as implemented in golang.
	// https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea#FILE_FLAG_SEQUENTIAL_SCAN
	h, e := windows.CreateFile(pathp, access, sharemode, sa, createmode, windows.FILE_FLAG_SEQUENTIAL_SCAN, 0)
	return h, e
}

// Helpers for CreateTemp
var (
	rand   uint32
	randmu sync.Mutex
)

func reseed() uint32 {
	return uint32(time.Now().UnixNano() + int64(os.Getpid()))
}

func nextSuffix() string {
	randmu.Lock()
	r := rand
	if r == 0 {
		r = reseed()
	}
	r = r*1664525 + 1013904223 // constants from Numerical Recipes
	rand = r
	randmu.Unlock()
	return strconv.Itoa(int(1e9 + r%1e9))[1:]
}

// CreateTemp is a copy of [os.CreateTemp], modified to use sequential file access.
//
// It uses [windows.FILE_FLAG_SEQUENTIAL_SCAN] rather than [windows.FILE_ATTRIBUTE_NORMAL]
// as implemented in golang. Refer to the [Win32 API documentation] for details
// on sequential file access.
//
// [Win32 API documentation]: https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea#FILE_FLAG_SEQUENTIAL_SCAN
func CreateTemp(dir, prefix string) (f *os.File, err error) {
	if dir == "" {
		dir = os.TempDir()
	}

	nconflict := 0
	for i := 0; i < 10000; i++ {
		name := filepath.Join(dir, prefix+nextSuffix())
		f, err = openFileSequential(name, windows.O_RDWR|windows.O_CREAT|windows.O_EXCL)
		if os.IsExist(err) {
			if nconflict++; nconflict > 10 {
				randmu.Lock()
				rand = reseed()
				randmu.Unlock()
			}
			continue
		}
		break
	}
	return
}
