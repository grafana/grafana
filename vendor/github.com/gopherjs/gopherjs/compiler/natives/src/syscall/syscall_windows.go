// +build js

package syscall

import "runtime"

var minusOne = -1

func Syscall(trap, nargs, a1, a2, a3 uintptr) (r1, r2 uintptr, err Errno) {
	printWarning()
	return uintptr(minusOne), 0, EACCES
}

func Syscall6(trap, nargs, a1, a2, a3, a4, a5, a6 uintptr) (r1, r2 uintptr, err Errno) {
	printWarning()
	return uintptr(minusOne), 0, EACCES
}

func Syscall9(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9 uintptr) (r1, r2 uintptr, err Errno) {
	printWarning()
	return uintptr(minusOne), 0, EACCES
}

func Syscall12(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12 uintptr) (r1, r2 uintptr, err Errno) {
	printWarning()
	return uintptr(minusOne), 0, EACCES
}

func Syscall15(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15 uintptr) (r1, r2 uintptr, err Errno) {
	printWarning()
	return uintptr(minusOne), 0, EACCES
}

func loadlibrary(filename *uint16) (handle uintptr, err Errno) {
	printWarning()
	return uintptr(minusOne), EACCES
}

func getprocaddress(handle uintptr, procname *uint8) (proc uintptr, err Errno) {
	printWarning()
	return uintptr(minusOne), EACCES
}

func (d *LazyDLL) Load() error {
	return &DLLError{Msg: "system calls not available, see https://github.com/gopherjs/gopherjs/blob/master/doc/syscalls.md"}
}

func (p *LazyProc) Find() error {
	return &DLLError{Msg: "system calls not available, see https://github.com/gopherjs/gopherjs/blob/master/doc/syscalls.md"}
}

func getStdHandle(h int) (fd Handle) {
	if h == STD_OUTPUT_HANDLE {
		return 1
	}
	if h == STD_ERROR_HANDLE {
		return 2
	}
	return 0
}

func GetConsoleMode(console Handle, mode *uint32) (err error) {
	return DummyError{}
}

func WriteFile(handle Handle, buf []byte, done *uint32, overlapped *Overlapped) (err error) {
	if handle == 1 || handle == 2 {
		printToConsole(buf)
		*done = uint32(len(buf))
		return nil
	}
	printWarning()
	return nil
}

func ExitProcess(exitcode uint32) {
	runtime.Goexit()
}

func GetCommandLine() (cmd *uint16) {
	return
}

func CommandLineToArgv(cmd *uint16, argc *int32) (argv *[8192]*[8192]uint16, err error) {
	return nil, DummyError{}
}

func Getenv(key string) (value string, found bool) {
	return "", false
}

func GetTimeZoneInformation(tzi *Timezoneinformation) (rc uint32, err error) {
	return 0, DummyError{}
}

type DummyError struct{}

func (e DummyError) Error() string {
	return ""
}
