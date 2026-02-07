package cli

import (
	"encoding/json"
	"flag"
	"fmt"
	"strconv"
	"strings"
)

// Uint64Slice wraps []int64 to satisfy flag.Value
type Uint64Slice struct {
	slice      []uint64
	separator  separatorSpec
	hasBeenSet bool
}

// NewUint64Slice makes an *Uint64Slice with default values
func NewUint64Slice(defaults ...uint64) *Uint64Slice {
	return &Uint64Slice{slice: append([]uint64{}, defaults...)}
}

// clone allocate a copy of self object
func (i *Uint64Slice) clone() *Uint64Slice {
	n := &Uint64Slice{
		slice:      make([]uint64, len(i.slice)),
		hasBeenSet: i.hasBeenSet,
	}
	copy(n.slice, i.slice)
	return n
}

// Set parses the value into an integer and appends it to the list of values
func (i *Uint64Slice) Set(value string) error {
	if !i.hasBeenSet {
		i.slice = []uint64{}
		i.hasBeenSet = true
	}

	if strings.HasPrefix(value, slPfx) {
		// Deserializing assumes overwrite
		_ = json.Unmarshal([]byte(strings.Replace(value, slPfx, "", 1)), &i.slice)
		i.hasBeenSet = true
		return nil
	}

	for _, s := range i.separator.flagSplitMultiValues(value) {
		tmp, err := strconv.ParseUint(strings.TrimSpace(s), 0, 64)
		if err != nil {
			return err
		}

		i.slice = append(i.slice, tmp)
	}

	return nil
}

func (i *Uint64Slice) WithSeparatorSpec(spec separatorSpec) {
	i.separator = spec
}

// String returns a readable representation of this value (for usage defaults)
func (i *Uint64Slice) String() string {
	v := i.slice
	if v == nil {
		// treat nil the same as zero length non-nil
		v = make([]uint64, 0)
	}
	str := fmt.Sprintf("%d", v)
	str = strings.Replace(str, " ", ", ", -1)
	str = strings.Replace(str, "[", "{", -1)
	str = strings.Replace(str, "]", "}", -1)
	return fmt.Sprintf("[]uint64%s", str)
}

// Serialize allows Uint64Slice to fulfill Serializer
func (i *Uint64Slice) Serialize() string {
	jsonBytes, _ := json.Marshal(i.slice)
	return fmt.Sprintf("%s%s", slPfx, string(jsonBytes))
}

// Value returns the slice of ints set by this flag
func (i *Uint64Slice) Value() []uint64 {
	return i.slice
}

// Get returns the slice of ints set by this flag
func (i *Uint64Slice) Get() interface{} {
	return *i
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *Uint64SliceFlag) String() string {
	return FlagStringer(f)
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *Uint64SliceFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *Uint64SliceFlag) GetUsage() string {
	return f.Usage
}

// GetCategory returns the category for the flag
func (f *Uint64SliceFlag) GetCategory() string {
	return f.Category
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *Uint64SliceFlag) GetValue() string {
	var defaultVals []string
	if f.Value != nil && len(f.Value.Value()) > 0 {
		for _, i := range f.Value.Value() {
			defaultVals = append(defaultVals, strconv.FormatUint(i, 10))
		}
	}
	return strings.Join(defaultVals, ", ")
}

// GetDefaultText returns the default text for this flag
func (f *Uint64SliceFlag) GetDefaultText() string {
	if f.DefaultText != "" {
		return f.DefaultText
	}
	return f.GetValue()
}

// GetEnvVars returns the env vars for this flag
func (f *Uint64SliceFlag) GetEnvVars() []string {
	return f.EnvVars
}

// IsSliceFlag implements DocGenerationSliceFlag.
func (f *Uint64SliceFlag) IsSliceFlag() bool {
	return true
}

// Apply populates the flag given the flag set and environment
func (f *Uint64SliceFlag) Apply(set *flag.FlagSet) error {
	// apply any default
	if f.Destination != nil && f.Value != nil {
		f.Destination.slice = make([]uint64, len(f.Value.slice))
		copy(f.Destination.slice, f.Value.slice)
	}

	// resolve setValue (what we will assign to the set)
	var setValue *Uint64Slice
	switch {
	case f.Destination != nil:
		setValue = f.Destination
	case f.Value != nil:
		setValue = f.Value.clone()
	default:
		setValue = new(Uint64Slice)
		setValue.WithSeparatorSpec(f.separator)
	}

	if val, source, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok && val != "" {
		for _, s := range f.separator.flagSplitMultiValues(val) {
			if err := setValue.Set(strings.TrimSpace(s)); err != nil {
				return fmt.Errorf("could not parse %q as uint64 slice value from %s for flag %s: %s", val, source, f.Name, err)
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

func (f *Uint64SliceFlag) WithSeparatorSpec(spec separatorSpec) {
	f.separator = spec
}

// Get returns the flag’s value in the given Context.
func (f *Uint64SliceFlag) Get(ctx *Context) []uint64 {
	return ctx.Uint64Slice(f.Name)
}

// RunAction executes flag action if set
func (f *Uint64SliceFlag) RunAction(c *Context) error {
	if f.Action != nil {
		return f.Action(c, c.Uint64Slice(f.Name))
	}

	return nil
}

// Uint64Slice looks up the value of a local Uint64SliceFlag, returns
// nil if not found
func (cCtx *Context) Uint64Slice(name string) []uint64 {
	if fs := cCtx.lookupFlagSet(name); fs != nil {
		return lookupUint64Slice(name, fs)
	}
	return nil
}

func lookupUint64Slice(name string, set *flag.FlagSet) []uint64 {
	f := set.Lookup(name)
	if f != nil {
		if slice, ok := unwrapFlagValue(f.Value).(*Uint64Slice); ok {
			return slice.Value()
		}
	}
	return nil
}
