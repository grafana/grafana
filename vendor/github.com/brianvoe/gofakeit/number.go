package gofakeit

import (
	"math"
	"math/rand"
)

// Number will generate a random number between given min And max
func Number(min int, max int) int {
	return randIntRange(min, max)
}

// Uint8 will generate a random uint8 value
func Uint8() uint8 {
	return uint8(randIntRange(0, math.MaxUint8))
}

// Uint16 will generate a random uint16 value
func Uint16() uint16 {
	return uint16(randIntRange(0, math.MaxUint16))
}

// Uint32 will generate a random uint32 value
func Uint32() uint32 {
	return uint32(randIntRange(0, math.MaxInt32))
}

// Uint64 will generate a random uint64 value
func Uint64() uint64 {
	return uint64(rand.Int63n(math.MaxInt64))
}

// Int8 will generate a random Int8 value
func Int8() int8 {
	return int8(randIntRange(math.MinInt8, math.MaxInt8))
}

// Int16 will generate a random int16 value
func Int16() int16 {
	return int16(randIntRange(math.MinInt16, math.MaxInt16))
}

// Int32 will generate a random int32 value
func Int32() int32 {
	return int32(randIntRange(math.MinInt32, math.MaxInt32))
}

// Int64 will generate a random int64 value
func Int64() int64 {
	return rand.Int63n(math.MaxInt64) + math.MinInt64
}

// Float32 will generate a random float32 value
func Float32() float32 {
	return randFloat32Range(math.SmallestNonzeroFloat32, math.MaxFloat32)
}

// Float32Range will generate a random float32 value between min and max
func Float32Range(min, max float32) float32 {
	return randFloat32Range(min, max)
}

// Float64 will generate a random float64 value
func Float64() float64 {
	return randFloat64Range(math.SmallestNonzeroFloat64, math.MaxFloat64)
}

// Float64Range will generate a random float64 value between min and max
func Float64Range(min, max float64) float64 {
	return randFloat64Range(min, max)
}

// Numerify will replace # with random numerical values
func Numerify(str string) string {
	return replaceWithNumbers(str)
}

// ShuffleInts will randomize a slice of ints
func ShuffleInts(a []int) {
	for i := range a {
		j := rand.Intn(i + 1)
		a[i], a[j] = a[j], a[i]
	}
}
