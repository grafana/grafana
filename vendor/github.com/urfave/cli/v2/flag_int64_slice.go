package cli

import (
	"encoding/json"
	"flag"
	"fmt"
	"strconv"
	"strings"
)

// Int64Slice wraps []int64 to satisfy flag.Value
type Int64Slice struct {
	slice      []int64
	separator  separatorSpec
	hasBeenSet bool
}

// NewInt64Slice makes an *Int64Slice with default values
func NewInt64Slice(defaults ...int64) *Int64Slice {
	return &Int64Slice{slice: append([]int64{}, defaults...)}
}

// clone allocate a copy of self object
func (i *Int64Slice) clone() *Int64Slice {
	n := &Int64Slice{
		slice:      make([]int64, len(i.slice)),
		hasBeenSet: i.hasBeenSet,
	}
	copy(n.slice, i.slice)
	return n
}

func (i *Int64Slice) WithSeparatorSpec(spec separatorSpec) {
	i.separator = spec
}

// Set parses the value into an integer and appends it to the list of values
func (i *Int64Slice) Set(value string) error {
	if !i.hasBeenSet {
		i.slice = []int64{}
		i.hasBeenSet = true
	}

	if strings.HasPrefix(value, slPfx) {
		// Deserializing assumes overwrite
		_ = json.Unmarshal([]byte(strings.Replace(value, slPfx, "", 1)), &i.slice)
		i.hasBeenSet = true
		return nil
	}

	for _, s := range i.separator.flagSplitMultiValues(value) {
		tmp, err := strconv.ParseInt(strings.TrimSpace(s), 0, 64)
		if err != nil {
			return err
		}

		i.slice = append(i.slice, tmp)
	}

	return nil
}

// String returns a readable representation of this value (for usage defaults)
func (i *Int64Slice) String() string {
	v := i.slice
	if v == nil {
		// treat nil the same as zero length non-nil
		v = make([]int64, 0)
	}
	return fmt.Sprintf("%#v", v)
}

// Serialize allows Int64Slice to fulfill Serializer
func (i *Int64Slice) Serialize() string {
	jsonBytes, _ := json.Marshal(i.slice)
	return fmt.Sprintf("%s%s", slPfx, string(jsonBytes))
}

// Value returns the slice of ints set by this flag
func (i *Int64Slice) Value() []int64 {
	return i.slice
}

// Get returns the slice of ints set by this flag
func (i *Int64Slice) Get() interface{} {
	return *i
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *Int64SliceFlag) String() string {
	return FlagStringer(f)
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *Int64SliceFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *Int64SliceFlag) GetUsage() string {
	return f.Usage
}

// GetCategory returns the category for the flag
func (f *Int64SliceFlag) GetCategory() string {
	return f.Category
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *Int64SliceFlag) GetValue() string {
	var defaultVals []string
	if f.Value != nil && len(f.Value.Value()) > 0 {
		for _, i := range f.Value.Value() {
			defaultVals = append(defaultVals, strconv.FormatInt(i, 10))
		}
	}
	return strings.Join(defaultVals, ", ")
}

// GetDefaultText returns the default text for this flag
func (f *Int64SliceFlag) GetDefaultText() string {
	if f.DefaultText != "" {
		return f.DefaultText
	}
	return f.GetValue()
}

// GetEnvVars returns the env vars for this flag
func (f *Int64SliceFlag) GetEnvVars() []string {
	return f.EnvVars
}

// IsSliceFlag implements DocGenerationSliceFlag.
func (f *Int64SliceFlag) IsSliceFlag() bool {
	return true
}

// Apply populates the flag given the flag set and environment
func (f *Int64SliceFlag) Apply(set *flag.FlagSet) error {
	// apply any default
	if f.Destination != nil && f.Value != nil {
		f.Destination.slice = make([]int64, len(f.Value.slice))
		copy(f.Destination.slice, f.Value.slice)
	}

	// resolve setValue (what we will assign to the set)
	var setValue *Int64Slice
	switch {
	case f.Destination != nil:
		setValue = f.Destination
	case f.Value != nil:
		setValue = f.Value.clone()
	default:
		setValue = new(Int64Slice)
		setValue.WithSeparatorSpec(f.separator)
	}

	if val, source, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok && val != "" {
		for _, s := range f.separator.flagSplitMultiValues(val) {
			if err := setValue.Set(strings.TrimSpace(s)); err != nil {
				return fmt.Errorf("could not parse %q as int64 slice value from %s for flag %s: %s", val, source, f.Name, err)
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

func (f *Int64SliceFlag) WithSeparatorSpec(spec separatorSpec) {
	f.separator = spec
}

// Get returns the flag’s value in the given Context.
func (f *Int64SliceFlag) Get(ctx *Context) []int64 {
	return ctx.Int64Slice(f.Name)
}

// RunAction executes flag action if set
func (f *Int64SliceFlag) RunAction(c *Context) error {
	if f.Action != nil {
		return f.Action(c, c.Int64Slice(f.Name))
	}

	return nil
}

// Int64Slice looks up the value of a local Int64SliceFlag, returns
// nil if not found
func (cCtx *Context) Int64Slice(name string) []int64 {
	if fs := cCtx.lookupFlagSet(name); fs != nil {
		return lookupInt64Slice(name, fs)
	}
	return nil
}

func lookupInt64Slice(name string, set *flag.FlagSet) []int64 {
	f := set.Lookup(name)
	if f != nil {
		if slice, ok := unwrapFlagValue(f.Value).(*Int64Slice); ok {
			return slice.Value()
		}
	}
	return nil
}
