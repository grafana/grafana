package cli

type (
	IntSlice       = SliceBase[int, IntegerConfig, intValue[int]]
	Int8Slice      = SliceBase[int8, IntegerConfig, intValue[int8]]
	Int16Slice     = SliceBase[int16, IntegerConfig, intValue[int16]]
	Int32Slice     = SliceBase[int32, IntegerConfig, intValue[int32]]
	Int64Slice     = SliceBase[int64, IntegerConfig, intValue[int64]]
	IntSliceFlag   = FlagBase[[]int, IntegerConfig, IntSlice]
	Int8SliceFlag  = FlagBase[[]int8, IntegerConfig, Int8Slice]
	Int16SliceFlag = FlagBase[[]int16, IntegerConfig, Int16Slice]
	Int32SliceFlag = FlagBase[[]int32, IntegerConfig, Int32Slice]
	Int64SliceFlag = FlagBase[[]int64, IntegerConfig, Int64Slice]
)

var (
	NewIntSlice   = NewSliceBase[int, IntegerConfig, intValue[int]]
	NewInt8Slice  = NewSliceBase[int8, IntegerConfig, intValue[int8]]
	NewInt16Slice = NewSliceBase[int16, IntegerConfig, intValue[int16]]
	NewInt32Slice = NewSliceBase[int32, IntegerConfig, intValue[int32]]
	NewInt64Slice = NewSliceBase[int64, IntegerConfig, intValue[int64]]
)

// IntSlice looks up the value of a local IntSliceFlag, returns
// nil if not found
func (cmd *Command) IntSlice(name string) []int {
	return getNumberSlice[int](cmd, name)
}

// Int8Slice looks up the value of a local Int8SliceFlag, returns
// nil if not found
func (cmd *Command) Int8Slice(name string) []int8 {
	return getNumberSlice[int8](cmd, name)
}

// Int16Slice looks up the value of a local Int16SliceFlag, returns
// nil if not found
func (cmd *Command) Int16Slice(name string) []int16 {
	return getNumberSlice[int16](cmd, name)
}

// Int32Slice looks up the value of a local Int32SliceFlag, returns
// nil if not found
func (cmd *Command) Int32Slice(name string) []int32 {
	return getNumberSlice[int32](cmd, name)
}

// Int64Slice looks up the value of a local Int64SliceFlag, returns
// nil if not found
func (cmd *Command) Int64Slice(name string) []int64 {
	return getNumberSlice[int64](cmd, name)
}
