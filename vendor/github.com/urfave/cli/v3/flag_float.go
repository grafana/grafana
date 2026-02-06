package cli

import (
	"strconv"
	"unsafe"
)

type (
	FloatFlag   = FlagBase[float64, NoConfig, floatValue[float64]]
	Float32Flag = FlagBase[float32, NoConfig, floatValue[float32]]
	Float64Flag = FlagBase[float64, NoConfig, floatValue[float64]]
)

// -- float Value
type floatValue[T float32 | float64] struct {
	val *T
}

// Below functions are to satisfy the ValueCreator interface

func (f floatValue[T]) Create(val T, p *T, c NoConfig) Value {
	*p = val

	return &floatValue[T]{val: p}
}

func (f floatValue[T]) ToString(b T) string {
	return strconv.FormatFloat(float64(b), 'g', -1, int(unsafe.Sizeof(T(0))*8))
}

// Below functions are to satisfy the flag.Value interface

func (f *floatValue[T]) Set(s string) error {
	v, err := strconv.ParseFloat(s, int(unsafe.Sizeof(T(0))*8))
	if err != nil {
		return err
	}
	*f.val = T(v)
	return nil
}

func (f *floatValue[T]) Get() any { return *f.val }

func (f *floatValue[T]) String() string {
	return strconv.FormatFloat(float64(*f.val), 'g', -1, int(unsafe.Sizeof(T(0))*8))
}

// Float looks up the value of a local FloatFlag, returns
// 0 if not found
func (cmd *Command) Float(name string) float64 {
	return getFloat[float64](cmd, name)
}

// Float32 looks up the value of a local Float32Flag, returns
// 0 if not found
func (cmd *Command) Float32(name string) float32 {
	return getFloat[float32](cmd, name)
}

// Float64 looks up the value of a local Float64Flag, returns
// 0 if not found
func (cmd *Command) Float64(name string) float64 {
	return getFloat[float64](cmd, name)
}

func getFloat[T float32 | float64](cmd *Command, name string) T {
	if v, ok := cmd.Value(name).(T); ok {
		tracef("float available for flag name %[1]q with value=%[2]v (cmd=%[3]q)", name, v, cmd.Name)

		return v
	}

	tracef("float NOT available for flag name %[1]q (cmd=%[2]q)", name, cmd.Name)
	return 0
}
