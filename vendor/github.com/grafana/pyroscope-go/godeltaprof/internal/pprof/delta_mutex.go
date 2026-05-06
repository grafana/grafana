package pprof

import (
	"runtime"
)

type mutexPrevValue struct {
	count    int64
	inanosec int64
}

type mutexAccValue struct {
	count  int64
	cycles int64
}

type DeltaMutexProfiler struct {
	m profMap[mutexPrevValue, mutexAccValue]
}

// PrintCountCycleProfile outputs block profile records (for block or mutex profiles)
// as the pprof-proto format output. Translations from cycle count to time duration
// are done because The proto expects count and time (nanoseconds) instead of count
// and the number of cycles for block, contention profiles.
// Possible 'scaler' functions are scaleBlockProfile and scaleMutexProfile.
func (d *DeltaMutexProfiler) PrintCountCycleProfile(b ProfileBuilder, scaler MutexProfileScaler, records []runtime.BlockProfileRecord) error {

	cpuGHz := float64(runtime_cyclesPerSecond()) / 1e9

	values := []int64{0, 0}
	var locs []uint64
	// deduplicate: accumulate count and cycles in entry.acc for equal stacks
	for i := range records {
		r := &records[i]
		entry := d.m.Lookup(r.Stack(), 0)
		entry.acc.count += r.Count // accumulate unscaled
		entry.acc.cycles += r.Cycles
	}

	// do the delta using the accumulated values and previous values
	for i := range records {
		r := &records[i]
		stk := r.Stack()
		entry := d.m.Lookup(stk, 0)
		accCount := entry.acc.count
		accCycles := entry.acc.cycles
		if accCount == 0 && accCycles == 0 {
			continue
		}
		entry.acc = mutexAccValue{}
		count, nanosec := ScaleMutexProfile(scaler, accCount, float64(accCycles)/cpuGHz)
		inanosec := int64(nanosec)

		// do the delta
		values[0] = count - entry.prev.count
		values[1] = inanosec - entry.prev.inanosec
		entry.prev.count = count
		entry.prev.inanosec = inanosec

		if values[0] < 0 || values[1] < 0 {
			continue
		}
		if values[0] == 0 && values[1] == 0 {
			continue
		}

		// For count profiles, all stack addresses are
		// return PCs, which is what appendLocsForStack expects.
		locs = b.LocsForStack(stk)
		b.Sample(values, locs, 0)
	}
	b.Build()
	return nil
}

func MutexProfileConfig() ProfileConfig {
	return ProfileConfig{
		PeriodType: ValueType{"contentions", "count"},
		Period:     1,
		SampleType: []ValueType{
			{"contentions", "count"},
			{"delay", "nanoseconds"},
		},
	}
}
