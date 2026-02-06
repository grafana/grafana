package lua

const (
	// BaseLibName is here for consistency; the base functions have no namespace/library.
	BaseLibName = ""
	// LoadLibName is here for consistency; the loading system has no namespace/library.
	LoadLibName = "package"
	// TabLibName is the name of the table Library.
	TabLibName = "table"
	// IoLibName is the name of the io Library.
	IoLibName = "io"
	// OsLibName is the name of the os Library.
	OsLibName = "os"
	// StringLibName is the name of the string Library.
	StringLibName = "string"
	// MathLibName is the name of the math Library.
	MathLibName = "math"
	// DebugLibName is the name of the debug Library.
	DebugLibName = "debug"
	// ChannelLibName is the name of the channel Library.
	ChannelLibName = "channel"
	// CoroutineLibName is the name of the coroutine Library.
	CoroutineLibName = "coroutine"
)

type luaLib struct {
	libName string
	libFunc LGFunction
}

var luaLibs = []luaLib{
	luaLib{LoadLibName, OpenPackage},
	luaLib{BaseLibName, OpenBase},
	luaLib{TabLibName, OpenTable},
	luaLib{IoLibName, OpenIo},
	luaLib{OsLibName, OpenOs},
	luaLib{StringLibName, OpenString},
	luaLib{MathLibName, OpenMath},
	luaLib{DebugLibName, OpenDebug},
	luaLib{ChannelLibName, OpenChannel},
	luaLib{CoroutineLibName, OpenCoroutine},
}

// OpenLibs loads the built-in libraries. It is equivalent to running OpenLoad,
// then OpenBase, then iterating over the other OpenXXX functions in any order.
func (ls *LState) OpenLibs() {
	// NB: Map iteration order in Go is deliberately randomised, so must open Load/Base
	// prior to iterating.
	for _, lib := range luaLibs {
		ls.Push(ls.NewFunction(lib.libFunc))
		ls.Push(LString(lib.libName))
		ls.Call(1, 0)
	}
}
