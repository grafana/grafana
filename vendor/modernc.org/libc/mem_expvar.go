//go:build libc.memexpvar

package libc

import "expvar"

func init() {
	// make sure to build with -tags=memory.counters to have the actual data accumulated in memory allocator
	expvar.Publish("memory.allocator", expvar.Func(func() interface{} {
		return MemStat()
	}))
}
