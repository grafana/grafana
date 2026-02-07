package cli

import (
	"strconv"
	"unsafe"
)

type (
	IntFlag   = FlagBase[int, IntegerConfig, intValue[int]]
	Int8Flag  = FlagBase[int8, IntegerConfig, intValue[int8]]
	Int16Flag = FlagBase[int16, IntegerConfig, intValue[int16]]
	Int32Flag = FlagBase[int32, IntegerConfig, intValue[int32]]
	Int64Flag = FlagBase[int64, IntegerConfig, intValue[int64]]
)

// IntegerConfig is the configuration for all integer type flags
type IntegerConfig struct {
	Base int
}

// -- int Value
type intValue[T int | int8 | int16 | int32 | int64] struct {
	val  *T
	base int
}

// Below functions are to satisfy the ValueCreator interface

func (i intValue[T]) Create(val T, p *T, c IntegerConfig) Value {
	*p = val

	return &intValue[T]{
		val:  p,
		base: c.Base,
	}
}

func (i intValue[T]) ToString(b T) string {
	if i.base == 0 {
		i.base = 10
	}

	return strconv.FormatInt(int64(b), i.base)
}

// Below functions are to satisfy the flag.Value interface

func (i *intValue[T]) Set(s string) error {
	v, err := strconv.ParseInt(s, i.base, int(unsafe.Sizeof(T(0))*8))
	if err != nil {
		return err
	}
	*i.val = T(v)
	return err
}

func (i *intValue[T]) Get() any { return *i.val }

func (i *intValue[T]) String() string {
	base := i.base
	if base == 0 {
		base = 10
	}

	return strconv.FormatInt(int64(*i.val), base)
}

// Int looks up the value of a local Int64Flag, returns
// 0 if not found
func (cmd *Command) Int(name string) int {
	return getInt[int](cmd, name)
}

// Int8 looks up the value of a local Int8Flag, returns
// 0 if not found
func (cmd *Command) Int8(name string) int8 {
	return getInt[int8](cmd, name)
}

// Int16 looks up the value of a local Int16Flag, returns
// 0 if not found
func (cmd *Command) Int16(name string) int16 {
	return getInt[int16](cmd, name)
}

// Int32 looks up the value of a local Int32Flag, returns
// 0 if not found
func (cmd *Command) Int32(name string) int32 {
	return getInt[int32](cmd, name)
}

// Int64 looks up the value of a local Int64Flag, returns
// 0 if not found
func (cmd *Command) Int64(name string) int64 {
	return getInt[int64](cmd, name)
}

func getInt[T int | int8 | int16 | int32 | int64](cmd *Command, name string) T {
	if v, ok := cmd.Value(name).(T); ok {
		tracef("int available for flag name %[1]q with value=%[2]v (cmd=%[3]q)", name, v, cmd.Name)

		return v
	}

	tracef("int NOT available for flag name %[1]q (cmd=%[2]q)", name, cmd.Name)
	return 0
}
