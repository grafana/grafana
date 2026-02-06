# purego
[![Go Reference](https://pkg.go.dev/badge/github.com/ebitengine/purego?GOOS=darwin.svg)](https://pkg.go.dev/github.com/ebitengine/purego?GOOS=darwin)

A library for calling C functions from Go without Cgo.

> This is beta software so expect bugs and potentially API breaking changes
> but each release will be tagged to avoid breaking people's code.
> Bug reports are encouraged.

## Motivation

The [Ebitengine](https://github.com/hajimehoshi/ebiten) game engine was ported to use only Go on Windows. This enabled
cross-compiling to Windows from any other operating system simply by setting `GOOS=windows`. The purego project was
born to bring that same vision to the other platforms supported by Ebitengine.

## Benefits

- **Simple Cross-Compilation**: No C means you can build for other platforms easily without a C compiler.
- **Faster Compilation**: Efficiently cache your entirely Go builds.
- **Smaller Binaries**: Using Cgo generates a C wrapper function for each C function called. Purego doesn't!
- **Dynamic Linking**: Load symbols at runtime and use it as a plugin system.
- **Foreign Function Interface**: Call into other languages that are compiled into shared objects.
- **Cgo Fallback**: Works even with CGO_ENABLED=1 so incremental porting is possible. 
This also means unsupported GOARCHs (freebsd/riscv64, linux/mips, etc.) will still work
except for float arguments and return values.

## Supported Platforms

- **FreeBSD**: amd64, arm64
- **Linux**: amd64, arm64
- **macOS / iOS**: amd64, arm64
- **Windows**: 386*, amd64, arm*, arm64

`*` These architectures only support SyscallN and NewCallback

## Example

The example below only showcases purego use for macOS and Linux. The other platforms require special handling which can
be seen in the complete example at [examples/libc](https://github.com/ebitengine/purego/tree/main/examples/libc) which supports Windows and FreeBSD.

```go
package main

import (
	"fmt"
	"runtime"

	"github.com/ebitengine/purego"
)

func getSystemLibrary() string {
	switch runtime.GOOS {
	case "darwin":
		return "/usr/lib/libSystem.B.dylib"
	case "linux":
		return "libc.so.6"
	default:
		panic(fmt.Errorf("GOOS=%s is not supported", runtime.GOOS))
	}
}

func main() {
	libc, err := purego.Dlopen(getSystemLibrary(), purego.RTLD_NOW|purego.RTLD_GLOBAL)
	if err != nil {
		panic(err)
	}
	var puts func(string)
	purego.RegisterLibFunc(&puts, libc, "puts")
	puts("Calling C from Go without Cgo!")
}
```

Then to run: `CGO_ENABLED=0 go run main.go`

## Questions

If you have questions about how to incorporate purego in your project or want to discuss
how it works join the [Discord](https://discord.gg/HzGZVD6BkY)!

### External Code

Purego uses code that originates from the Go runtime. These files are under the BSD-3
License that can be found [in the Go Source](https://github.com/golang/go/blob/master/LICENSE).
This is a list of the copied files:

* `abi_*.h` from package `runtime/cgo`
* `zcallback_darwin_*.s` from package `runtime`
* `internal/fakecgo/abi_*.h` from package `runtime/cgo`
* `internal/fakecgo/asm_GOARCH.s` from package `runtime/cgo`
* `internal/fakecgo/callbacks.go` from package `runtime/cgo`
* `internal/fakecgo/go_GOOS_GOARCH.go` from package `runtime/cgo`
* `internal/fakecgo/iscgo.go` from package `runtime/cgo`
* `internal/fakecgo/setenv.go` from package `runtime/cgo`
* `internal/fakecgo/freebsd.go` from package `runtime/cgo`

The files `abi_*.h` and `internal/fakecgo/abi_*.h` are the same because Bazel does not support cross-package use of
`#include` so we need each one once per package. (cf. [issue](https://github.com/bazelbuild/rules_go/issues/3636))
