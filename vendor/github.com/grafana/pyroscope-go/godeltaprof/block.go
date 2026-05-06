package godeltaprof

import (
	"io"
	"runtime"
	"sort"
	"sync"

	"github.com/grafana/pyroscope-go/godeltaprof/internal/pprof"
)

// BlockProfiler is a stateful profiler for goroutine blocking events and mutex contention in Go programs.
// Depending on the function used to create the BlockProfiler, it uses either runtime.BlockProfile or runtime.MutexProfile.
// The BlockProfiler provides similar functionality to pprof.Lookup("block").WriteTo and pprof.Lookup("mutex").WriteTo,
// but with some key differences.
//
// The BlockProfiler tracks the delta of blocking events or mutex contention since the last
// profile was written, effectively providing a snapshot of the changes
// between two points in time. This is in contrast to the
// pprof.Lookup functions, which accumulate profiling data
// and result in profiles that represent the entire lifetime of the program.
//
// The BlockProfiler is safe for concurrent use, as it serializes access to
// its internal state using a sync.Mutex. This ensures that multiple goroutines
// can call the Profile method without causing any data race issues.
type BlockProfiler struct {
	impl           pprof.DeltaMutexProfiler
	mutex          sync.Mutex
	runtimeProfile func([]runtime.BlockProfileRecord) (int, bool)
	scaleProfile   pprof.MutexProfileScaler
	options        pprof.ProfileBuilderOptions
}

// NewMutexProfiler creates a new BlockProfiler instance for profiling mutex contention.
// The resulting BlockProfiler uses runtime.MutexProfile as its data source.
//
// Usage:
//
//		mp := godeltaprof.NewMutexProfiler()
//	    ...
//	    err := mp.Profile(someWriter)
func NewMutexProfiler() *BlockProfiler {
	return &BlockProfiler{
		runtimeProfile: runtime.MutexProfile,
		scaleProfile:   pprof.ScalerMutexProfile,
		impl:           pprof.DeltaMutexProfiler{},
		options: pprof.ProfileBuilderOptions{
			GenericsFrames: true,
			LazyMapping:    true,
		},
	}
}

func NewMutexProfilerWithOptions(options ProfileOptions) *BlockProfiler {
	return &BlockProfiler{
		runtimeProfile: runtime.MutexProfile,
		scaleProfile:   pprof.ScalerMutexProfile,
		impl:           pprof.DeltaMutexProfiler{},
		options: pprof.ProfileBuilderOptions{
			GenericsFrames: options.GenericsFrames,
			LazyMapping:    options.LazyMappings,
		},
	}
}

// NewBlockProfiler creates a new BlockProfiler instance for profiling goroutine blocking events.
// The resulting BlockProfiler uses runtime.BlockProfile as its data source.
//
// Usage:
//
//	bp := godeltaprof.NewBlockProfiler()
//	...
//	err := bp.Profile(someWriter)
func NewBlockProfiler() *BlockProfiler {
	return &BlockProfiler{
		runtimeProfile: runtime.BlockProfile,
		scaleProfile:   pprof.ScalerBlockProfile,
		impl:           pprof.DeltaMutexProfiler{},
		options: pprof.ProfileBuilderOptions{
			GenericsFrames: true,
			LazyMapping:    true,
		},
	}
}

func NewBlockProfilerWithOptions(options ProfileOptions) *BlockProfiler {
	return &BlockProfiler{
		runtimeProfile: runtime.BlockProfile,
		scaleProfile:   pprof.ScalerBlockProfile,
		impl:           pprof.DeltaMutexProfiler{},
		options: pprof.ProfileBuilderOptions{
			GenericsFrames: options.GenericsFrames,
			LazyMapping:    options.LazyMappings,
		},
	}
}

func (d *BlockProfiler) Profile(w io.Writer) error {
	d.mutex.Lock()
	defer d.mutex.Unlock()

	var p []runtime.BlockProfileRecord
	n, ok := d.runtimeProfile(nil)
	for {
		p = make([]runtime.BlockProfileRecord, n+50)
		n, ok = d.runtimeProfile(p)
		if ok {
			p = p[:n]
			break
		}
	}

	sort.Slice(p, func(i, j int) bool { return p[i].Cycles > p[j].Cycles })

	stc := pprof.MutexProfileConfig()
	b := pprof.NewProfileBuilder(w, &d.options, stc)
	return d.impl.PrintCountCycleProfile(b, d.scaleProfile, p)
}
