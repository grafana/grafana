package cli

import (
	"encoding/json"
	"flag"
	"fmt"
	"strconv"
	"strings"
)

// UintSlice wraps []int to satisfy flag.Value
type UintSlice struct {
	slice      []uint
	separator  separatorSpec
	hasBeenSet bool
}

// NewUintSlice makes an *UintSlice with default values
func NewUintSlice(defaults ...uint) *UintSlice {
	return &UintSlice{slice: append([]uint{}, defaults...)}
}

// clone allocate a copy of self object
func (i *UintSlice) clone() *UintSlice {
	n := &UintSlice{
		slice:      make([]uint, len(i.slice)),
		hasBeenSet: i.hasBeenSet,
	}
	copy(n.slice, i.slice)
	return n
}

// TODO: Consistently have specific Set function for Int64 and Float64 ?
// SetInt directly adds an integer to the list of values
func (i *UintSlice) SetUint(value uint) {
	if !i.hasBeenSet {
		i.slice = []uint{}
		i.hasBeenSet = true
	}

	i.slice = append(i.slice, value)
}

// Set parses the value into an integer and appends it to the list of values
func (i *UintSlice) Set(value string) error {
	if !i.hasBeenSet {
		i.slice = []uint{}
		i.hasBeenSet = true
	}

	if strings.HasPrefix(value, slPfx) {
		// Deserializing assumes overwrite
		_ = json.Unmarshal([]byte(strings.Replace(value, slPfx, "", 1)), &i.slice)
		i.hasBeenSet = true
		return nil
	}

	for _, s := range i.separator.flagSplitMultiValues(value) {
		tmp, err := strconv.ParseUint(strings.TrimSpace(s), 0, 32)
		if err != nil {
			return err
		}

		i.slice = append(i.slice, uint(tmp))
	}

	return nil
}

func (i *UintSlice) WithSeparatorSpec(spec separatorSpec) {
	i.separator = spec
}

// String returns a readable representation of this value (for usage defaults)
func (i *UintSlice) String() string {
	v := i.slice
	if v == nil {
		// treat nil the same as zero length non-nil
		v = make([]uint, 0)
	}
	str := fmt.Sprintf("%d", v)
	str = strings.Replace(str, " ", ", ", -1)
	str = strings.Replace(str, "[", "{", -1)
	str = strings.Replace(str, "]", "}", -1)
	return fmt.Sprintf("[]uint%s", str)
}

// Serialize allows UintSlice to fulfill Serializer
func (i *UintSlice) Serialize() string {
	jsonBytes, _ := json.Marshal(i.slice)
	return fmt.Sprintf("%s%s", slPfx, string(jsonBytes))
}

// Value returns the slice of ints set by this flag
func (i *UintSlice) Value() []uint {
	return i.slice
}

// Get returns the slice of ints set by this flag
func (i *UintSlice) Get() interface{} {
	return *i
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *UintSliceFlag) String() string {
	return FlagStringer(f)
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *UintSliceFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *UintSliceFlag) GetUsage() string {
	return f.Usage
}

// GetCategory returns the category for the flag
func (f *UintSliceFlag) GetCategory() string {
	return f.Category
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *UintSliceFlag) GetValue() string {
	var defaultVals []string
	if f.Value != nil && len(f.Value.Value()) > 0 {
		for _, i := range f.Value.Value() {
			defaultVals = append(defaultVals, strconv.FormatUint(uint64(i), 10))
		}
	}
	return strings.Join(defaultVals, ", ")
}

// GetDefaultText returns the default text for this flag
func (f *UintSliceFlag) GetDefaultText() string {
	if f.DefaultText != "" {
		return f.DefaultText
	}
	return f.GetValue()
}

// GetEnvVars returns the env vars for this flag
func (f *UintSliceFlag) GetEnvVars() []string {
	return f.EnvVars
}

// IsSliceFlag implements DocGenerationSliceFlag.
func (f *UintSliceFlag) IsSliceFlag() bool {
	return true
}

// Apply populates the flag given the flag set and environment
func (f *UintSliceFlag) Apply(set *flag.FlagSet) error {
	// apply any default
	if f.Destination != nil && f.Value != nil {
		f.Destination.slice = make([]uint, len(f.Value.slice))
		copy(f.Destination.slice, f.Value.slice)
	}

	// resolve setValue (what we will assign to the set)
	var setValue *UintSlice
	switch {
	case f.Destination != nil:
		setValue = f.Destination
	case f.Value != nil:
		setValue = f.Value.clone()
	default:
		setValue = new(UintSlice)
		setValue.WithSeparatorSpec(f.separator)
	}

	if val, source, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok && val != "" {
		for _, s := range f.separator.flagSplitMultiValues(val) {
			if err := setValue.Set(strings.TrimSpace(s)); err != nil {
				return fmt.Errorf("could not parse %q as uint slice value from %s for flag %s: %s", val, source, f.Name, err)
			}
		}

		// Set this to false so that we reset the slice if we then set values from
		// flags that have already been set by the environment.
		setValue.hasBeenSet = false
		f.HasBeenSet = true
	}

	for _, name := range f.Names() {
		set.Var(setValue, name, f.Usage)
	}

	return nil
}

func (f *UintSliceFlag) WithSeparatorSpec(spec separatorSpec) {
	f.separator = spec
}

// Get returns the flag’s value in the given Context.
func (f *UintSliceFlag) Get(ctx *Context) []uint {
	return ctx.UintSlice(f.Name)
}

// RunAction executes flag action if set
func (f *UintSliceFlag) RunAction(c *Context) error {
	if f.Action != nil {
		return f.Action(c, c.UintSlice(f.Name))
	}

	return nil
}

// UintSlice looks up the value of a local UintSliceFlag, returns
// nil if not found
func (cCtx *Context) UintSlice(name string) []uint {
	if fs := cCtx.lookupFlagSet(name); fs != nil {
		return lookupUintSlice(name, fs)
	}
	return nil
}

func lookupUintSlice(name string, set *flag.FlagSet) []uint {
	f := set.Lookup(name)
	if f != nil {
		if slice, ok := unwrapFlagValue(f.Value).(*UintSlice); ok {
			return slice.Value()
		}
	}
	return nil
}
