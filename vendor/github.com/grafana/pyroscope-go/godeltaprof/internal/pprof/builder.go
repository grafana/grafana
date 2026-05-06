package pprof

type ProfileBuilder interface {
	LocsForStack(stk []uintptr) (newLocs []uint64)
	Sample(values []int64, locs []uint64, blockSize int64)
	Build()
}

type ProfileConfig struct {
	PeriodType        ValueType
	Period            int64
	SampleType        []ValueType
	DefaultSampleType string
}

type ValueType struct {
	Typ, Unit string
}
