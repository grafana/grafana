package cli

type (
	UintSlice       = SliceBase[uint, IntegerConfig, uintValue[uint]]
	Uint8Slice      = SliceBase[uint8, IntegerConfig, uintValue[uint8]]
	Uint16Slice     = SliceBase[uint16, IntegerConfig, uintValue[uint16]]
	Uint32Slice     = SliceBase[uint32, IntegerConfig, uintValue[uint32]]
	Uint64Slice     = SliceBase[uint64, IntegerConfig, uintValue[uint64]]
	UintSliceFlag   = FlagBase[[]uint, IntegerConfig, UintSlice]
	Uint8SliceFlag  = FlagBase[[]uint8, IntegerConfig, Uint8Slice]
	Uint16SliceFlag = FlagBase[[]uint16, IntegerConfig, Uint16Slice]
	Uint32SliceFlag = FlagBase[[]uint32, IntegerConfig, Uint32Slice]
	Uint64SliceFlag = FlagBase[[]uint64, IntegerConfig, Uint64Slice]
)

var (
	NewUintSlice   = NewSliceBase[uint, IntegerConfig, uintValue[uint]]
	NewUint8Slice  = NewSliceBase[uint8, IntegerConfig, uintValue[uint8]]
	NewUint16Slice = NewSliceBase[uint16, IntegerConfig, uintValue[uint16]]
	NewUint32Slice = NewSliceBase[uint32, IntegerConfig, uintValue[uint32]]
	NewUint64Slice = NewSliceBase[uint64, IntegerConfig, uintValue[uint64]]
)

// UintSlice looks up the value of a local UintSliceFlag, returns
// nil if not found
func (cmd *Command) UintSlice(name string) []uint {
	return getUintSlice[uint](cmd, name)
}

// Uint8Slice looks up the value of a local Uint8SliceFlag, returns
// nil if not found
func (cmd *Command) Uint8Slice(name string) []uint8 {
	return getUintSlice[uint8](cmd, name)
}

// Uint16Slice looks up the value of a local Uint16SliceFlag, returns
// nil if not found
func (cmd *Command) Uint16Slice(name string) []uint16 {
	return getUintSlice[uint16](cmd, name)
}

// Uint32Slice looks up the value of a local Uint32SliceFlag, returns
// nil if not found
func (cmd *Command) Uint32Slice(name string) []uint32 {
	return getUintSlice[uint32](cmd, name)
}

// Uint64Slice looks up the value of a local Uint64SliceFlag, returns
// nil if not found
func (cmd *Command) Uint64Slice(name string) []uint64 {
	return getUintSlice[uint64](cmd, name)
}

func getUintSlice[T uint | uint8 | uint16 | uint32 | uint64](cmd *Command, name string) []T {
	if v, ok := cmd.Value(name).([]T); ok {
		tracef("uint slice available for flag name %[1]q with value=%[2]v (cmd=%[3]q)", name, v, cmd.Name)

		return v
	}

	tracef("uint slice NOT available for flag name %[1]q (cmd=%[2]q)", name, cmd.Name)
	return nil
}
