//go:build windows
// +build windows

package flags

import (
	"syscall"
	"unsafe"
)

type (
	SHORT int16
	WORD  uint16

	SMALL_RECT struct {
		Left   SHORT
		Top    SHORT
		Right  SHORT
		Bottom SHORT
	}

	COORD struct {
		X SHORT
		Y SHORT
	}

	CONSOLE_SCREEN_BUFFER_INFO struct {
		Size              COORD
		CursorPosition    COORD
		Attributes        WORD
		Window            SMALL_RECT
		MaximumWindowSize COORD
	}
)

var kernel32DLL = syscall.NewLazyDLL("kernel32.dll")
var getConsoleScreenBufferInfoProc = kernel32DLL.NewProc("GetConsoleScreenBufferInfo")

func getError(r1, r2 uintptr, lastErr error) error {
	// If the function fails, the return value is zero.
	if r1 == 0 {
		if lastErr != nil {
			return lastErr
		}
		return syscall.EINVAL
	}
	return nil
}

func getStdHandle(stdhandle int) (uintptr, error) {
	handle, err := syscall.GetStdHandle(stdhandle)
	if err != nil {
		return 0, err
	}
	return uintptr(handle), nil
}

// GetConsoleScreenBufferInfo retrieves information about the specified console screen buffer.
// http://msdn.microsoft.com/en-us/library/windows/desktop/ms683171(v=vs.85).aspx
func GetConsoleScreenBufferInfo(handle uintptr) (*CONSOLE_SCREEN_BUFFER_INFO, error) {
	var info CONSOLE_SCREEN_BUFFER_INFO
	if err := getError(getConsoleScreenBufferInfoProc.Call(handle, uintptr(unsafe.Pointer(&info)), 0)); err != nil {
		return nil, err
	}
	return &info, nil
}

func getTerminalColumns() int {
	defaultWidth := 80

	stdoutHandle, err := getStdHandle(syscall.STD_OUTPUT_HANDLE)
	if err != nil {
		return defaultWidth
	}

	info, err := GetConsoleScreenBufferInfo(stdoutHandle)
	if err != nil {
		return defaultWidth
	}

	if info.MaximumWindowSize.X > 0 {
		return int(info.MaximumWindowSize.X)
	}

	return defaultWidth
}
