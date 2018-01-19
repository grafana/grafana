// +build js,!windows

package syscall

import (
	"runtime"
	"unsafe"

	"github.com/gopherjs/gopherjs/js"
)

func runtime_envs() []string {
	process := js.Global.Get("process")
	if process == js.Undefined {
		return nil
	}
	jsEnv := process.Get("env")
	envkeys := js.Global.Get("Object").Call("keys", jsEnv)
	envs := make([]string, envkeys.Length())
	for i := 0; i < envkeys.Length(); i++ {
		key := envkeys.Index(i).String()
		envs[i] = key + "=" + jsEnv.Get(key).String()
	}
	return envs
}

func setenv_c(k, v string) {
	process := js.Global.Get("process")
	if process != js.Undefined {
		process.Get("env").Set(k, v)
	}
}

var syscallModule *js.Object
var alreadyTriedToLoad = false
var minusOne = -1

func syscall(name string) *js.Object {
	defer func() {
		recover()
		// return nil if recovered
	}()
	if syscallModule == nil {
		if alreadyTriedToLoad {
			return nil
		}
		alreadyTriedToLoad = true
		require := js.Global.Get("require")
		if require == js.Undefined {
			panic("")
		}
		syscallModule = require.Invoke("syscall")
	}
	return syscallModule.Get(name)
}

func Syscall(trap, a1, a2, a3 uintptr) (r1, r2 uintptr, err Errno) {
	if f := syscall("Syscall"); f != nil {
		r := f.Invoke(trap, a1, a2, a3)
		return uintptr(r.Index(0).Int()), uintptr(r.Index(1).Int()), Errno(r.Index(2).Int())
	}
	if trap == SYS_WRITE && (a1 == 1 || a1 == 2) {
		array := js.InternalObject(a2)
		slice := make([]byte, array.Length())
		js.InternalObject(slice).Set("$array", array)
		printToConsole(slice)
		return uintptr(array.Length()), 0, 0
	}
	if trap == SYS_EXIT {
		runtime.Goexit()
	}
	printWarning()
	return uintptr(minusOne), 0, EACCES
}

func Syscall6(trap, a1, a2, a3, a4, a5, a6 uintptr) (r1, r2 uintptr, err Errno) {
	if f := syscall("Syscall6"); f != nil {
		r := f.Invoke(trap, a1, a2, a3, a4, a5, a6)
		return uintptr(r.Index(0).Int()), uintptr(r.Index(1).Int()), Errno(r.Index(2).Int())
	}
	if trap != 202 { // kern.osrelease on OS X, happens in init of "os" package
		printWarning()
	}
	return uintptr(minusOne), 0, EACCES
}

func RawSyscall(trap, a1, a2, a3 uintptr) (r1, r2 uintptr, err Errno) {
	if f := syscall("Syscall"); f != nil {
		r := f.Invoke(trap, a1, a2, a3)
		return uintptr(r.Index(0).Int()), uintptr(r.Index(1).Int()), Errno(r.Index(2).Int())
	}
	printWarning()
	return uintptr(minusOne), 0, EACCES
}

func RawSyscall6(trap, a1, a2, a3, a4, a5, a6 uintptr) (r1, r2 uintptr, err Errno) {
	if f := syscall("Syscall6"); f != nil {
		r := f.Invoke(trap, a1, a2, a3, a4, a5, a6)
		return uintptr(r.Index(0).Int()), uintptr(r.Index(1).Int()), Errno(r.Index(2).Int())
	}
	printWarning()
	return uintptr(minusOne), 0, EACCES
}

func BytePtrFromString(s string) (*byte, error) {
	array := js.Global.Get("Uint8Array").New(len(s) + 1)
	for i, b := range []byte(s) {
		if b == 0 {
			return nil, EINVAL
		}
		array.SetIndex(i, b)
	}
	array.SetIndex(len(s), 0)
	return (*byte)(unsafe.Pointer(array.Unsafe())), nil
}
