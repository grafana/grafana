// WARNING: this file is generated. DO NOT EDIT

package cli

import "time"

// Float64SliceFlag is a flag with type *Float64Slice
type Float64SliceFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       *Float64Slice
	Destination *Float64Slice

	Aliases []string
	EnvVars []string

	defaultValue    *Float64Slice
	defaultValueSet bool

	separator separatorSpec

	Action func(*Context, []float64) error
}

// IsSet returns whether or not the flag has been set through env or file
func (f *Float64SliceFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *Float64SliceFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *Float64SliceFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *Float64SliceFlag) IsVisible() bool {
	return !f.Hidden
}

// GenericFlag is a flag with type Generic
type GenericFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       Generic
	Destination Generic

	Aliases []string
	EnvVars []string

	defaultValue    Generic
	defaultValueSet bool

	TakesFile bool

	Action func(*Context, interface{}) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *GenericFlag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *GenericFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *GenericFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *GenericFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *GenericFlag) IsVisible() bool {
	return !f.Hidden
}

// Int64SliceFlag is a flag with type *Int64Slice
type Int64SliceFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       *Int64Slice
	Destination *Int64Slice

	Aliases []string
	EnvVars []string

	defaultValue    *Int64Slice
	defaultValueSet bool

	separator separatorSpec

	Action func(*Context, []int64) error
}

// IsSet returns whether or not the flag has been set through env or file
func (f *Int64SliceFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *Int64SliceFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *Int64SliceFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *Int64SliceFlag) IsVisible() bool {
	return !f.Hidden
}

// IntSliceFlag is a flag with type *IntSlice
type IntSliceFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       *IntSlice
	Destination *IntSlice

	Aliases []string
	EnvVars []string

	defaultValue    *IntSlice
	defaultValueSet bool

	separator separatorSpec

	Action func(*Context, []int) error
}

// IsSet returns whether or not the flag has been set through env or file
func (f *IntSliceFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *IntSliceFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *IntSliceFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *IntSliceFlag) IsVisible() bool {
	return !f.Hidden
}

// PathFlag is a flag with type Path
type PathFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       Path
	Destination *Path

	Aliases []string
	EnvVars []string

	defaultValue    Path
	defaultValueSet bool

	TakesFile bool

	Action func(*Context, Path) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *PathFlag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *PathFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *PathFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *PathFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *PathFlag) IsVisible() bool {
	return !f.Hidden
}

// StringSliceFlag is a flag with type *StringSlice
type StringSliceFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       *StringSlice
	Destination *StringSlice

	Aliases []string
	EnvVars []string

	defaultValue    *StringSlice
	defaultValueSet bool

	separator separatorSpec

	TakesFile bool

	Action func(*Context, []string) error

	KeepSpace bool
}

// IsSet returns whether or not the flag has been set through env or file
func (f *StringSliceFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *StringSliceFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *StringSliceFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *StringSliceFlag) IsVisible() bool {
	return !f.Hidden
}

// TimestampFlag is a flag with type *Timestamp
type TimestampFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       *Timestamp
	Destination *Timestamp

	Aliases []string
	EnvVars []string

	defaultValue    *Timestamp
	defaultValueSet bool

	Layout string

	Timezone *time.Location

	Action func(*Context, *time.Time) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *TimestampFlag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *TimestampFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *TimestampFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *TimestampFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *TimestampFlag) IsVisible() bool {
	return !f.Hidden
}

// Uint64SliceFlag is a flag with type *Uint64Slice
type Uint64SliceFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       *Uint64Slice
	Destination *Uint64Slice

	Aliases []string
	EnvVars []string

	defaultValue    *Uint64Slice
	defaultValueSet bool

	separator separatorSpec

	Action func(*Context, []uint64) error
}

// IsSet returns whether or not the flag has been set through env or file
func (f *Uint64SliceFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *Uint64SliceFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *Uint64SliceFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *Uint64SliceFlag) IsVisible() bool {
	return !f.Hidden
}

// UintSliceFlag is a flag with type *UintSlice
type UintSliceFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       *UintSlice
	Destination *UintSlice

	Aliases []string
	EnvVars []string

	defaultValue    *UintSlice
	defaultValueSet bool

	separator separatorSpec

	Action func(*Context, []uint) error
}

// IsSet returns whether or not the flag has been set through env or file
func (f *UintSliceFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *UintSliceFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *UintSliceFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *UintSliceFlag) IsVisible() bool {
	return !f.Hidden
}

// BoolFlag is a flag with type bool
type BoolFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       bool
	Destination *bool

	Aliases []string
	EnvVars []string

	defaultValue    bool
	defaultValueSet bool

	Count *int

	DisableDefaultText bool

	Action func(*Context, bool) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *BoolFlag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *BoolFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *BoolFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *BoolFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *BoolFlag) IsVisible() bool {
	return !f.Hidden
}

// Float64Flag is a flag with type float64
type Float64Flag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       float64
	Destination *float64

	Aliases []string
	EnvVars []string

	defaultValue    float64
	defaultValueSet bool

	Action func(*Context, float64) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *Float64Flag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *Float64Flag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *Float64Flag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *Float64Flag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *Float64Flag) IsVisible() bool {
	return !f.Hidden
}

// IntFlag is a flag with type int
type IntFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       int
	Destination *int

	Aliases []string
	EnvVars []string

	defaultValue    int
	defaultValueSet bool

	Base int

	Action func(*Context, int) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *IntFlag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *IntFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *IntFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *IntFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *IntFlag) IsVisible() bool {
	return !f.Hidden
}

// Int64Flag is a flag with type int64
type Int64Flag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       int64
	Destination *int64

	Aliases []string
	EnvVars []string

	defaultValue    int64
	defaultValueSet bool

	Base int

	Action func(*Context, int64) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *Int64Flag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *Int64Flag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *Int64Flag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *Int64Flag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *Int64Flag) IsVisible() bool {
	return !f.Hidden
}

// StringFlag is a flag with type string
type StringFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       string
	Destination *string

	Aliases []string
	EnvVars []string

	defaultValue    string
	defaultValueSet bool

	TakesFile bool

	Action func(*Context, string) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *StringFlag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *StringFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *StringFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *StringFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *StringFlag) IsVisible() bool {
	return !f.Hidden
}

// DurationFlag is a flag with type time.Duration
type DurationFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       time.Duration
	Destination *time.Duration

	Aliases []string
	EnvVars []string

	defaultValue    time.Duration
	defaultValueSet bool

	Action func(*Context, time.Duration) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *DurationFlag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *DurationFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *DurationFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *DurationFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *DurationFlag) IsVisible() bool {
	return !f.Hidden
}

// UintFlag is a flag with type uint
type UintFlag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       uint
	Destination *uint

	Aliases []string
	EnvVars []string

	defaultValue    uint
	defaultValueSet bool

	Base int

	Action func(*Context, uint) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *UintFlag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *UintFlag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *UintFlag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *UintFlag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *UintFlag) IsVisible() bool {
	return !f.Hidden
}

// Uint64Flag is a flag with type uint64
type Uint64Flag struct {
	Name string

	Category    string
	DefaultText string
	FilePath    string
	Usage       string

	Required   bool
	Hidden     bool
	HasBeenSet bool

	Value       uint64
	Destination *uint64

	Aliases []string
	EnvVars []string

	defaultValue    uint64
	defaultValueSet bool

	Base int

	Action func(*Context, uint64) error
}

// String returns a readable representation of this value (for usage defaults)
func (f *Uint64Flag) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *Uint64Flag) IsSet() bool {
	return f.HasBeenSet
}

// Names returns the names of the flag
func (f *Uint64Flag) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *Uint64Flag) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *Uint64Flag) IsVisible() bool {
	return !f.Hidden
}

// vim:ro
