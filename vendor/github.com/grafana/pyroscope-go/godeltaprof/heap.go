package godeltaprof

import (
	"io"
	"runtime"
	"sync"

	"github.com/grafana/pyroscope-go/godeltaprof/internal/pprof"
)

// HeapProfiler is a stateful profiler for heap allocations in Go programs.
// It is based on runtime.MemProfile and provides similar functionality to
// pprof.WriteHeapProfile, but with some key differences.
//
// The HeapProfiler tracks the delta of heap allocations since the last
// profile was written, effectively providing a snapshot of the changes
// in heap usage between two points in time. This is in contrast to the
// pprof.WriteHeapProfile function, which accumulates profiling data
// and results in profiles that represent the entire lifetime of the program.
//
// The HeapProfiler is safe for concurrent use, as it serializes access to
// its internal state using a sync.Mutex. This ensures that multiple goroutines
// can call the Profile method without causing any data race issues.
//
// Usage:
//
//	hp := godeltaprof.NewHeapProfiler()
//	...
//	err := hp.Profile(someWriter)
type HeapProfiler struct {
	impl    pprof.DeltaHeapProfiler
	mutex   sync.Mutex
	options pprof.ProfileBuilderOptions
}

func NewHeapProfiler() *HeapProfiler {
	return &HeapProfiler{
		impl: pprof.DeltaHeapProfiler{},
		options: pprof.ProfileBuilderOptions{
			GenericsFrames: true,
			LazyMapping:    true,
		}}
}

func NewHeapProfilerWithOptions(options ProfileOptions) *HeapProfiler {
	return &HeapProfiler{
		impl: pprof.DeltaHeapProfiler{},
		options: pprof.ProfileBuilderOptions{
			GenericsFrames: options.GenericsFrames,
			LazyMapping:    options.LazyMappings,
		},
	}
}

func (d *HeapProfiler) Profile(w io.Writer) error {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	// Find out how many records there are (MemProfile(nil, true)),
	// allocate that many records, and get the data.
	// There's a race—more records might be added between
	// the two calls—so allocate a few extra records for safety
	// and also try again if we're very unlucky.
	// The loop should only execute one iteration in the common case.
	var p []runtime.MemProfileRecord
	n, ok := runtime.MemProfile(nil, true)
	for {
		// Allocate room for a slightly bigger profile,
		// in case a few more entries have been added
		// since the call to MemProfile.
		p = make([]runtime.MemProfileRecord, n+50)
		n, ok = runtime.MemProfile(p, true)
		if ok {
			p = p[0:n]
			break
		}
		// Profile grew; try again.
	}
	rate := int64(runtime.MemProfileRate)
	b := pprof.NewProfileBuilder(w, &d.options, pprof.HeapProfileConfig(rate))
	return d.impl.WriteHeapProto(b, p, rate)
}
