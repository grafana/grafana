package cli

import (
	"encoding/json"
	"flag"
	"fmt"
	"strconv"
	"strings"
)

// IntSlice wraps []int to satisfy flag.Value
type IntSlice struct {
	slice      []int
	hasBeenSet bool
}

// NewIntSlice makes an *IntSlice with default values
func NewIntSlice(defaults ...int) *IntSlice {
	return &IntSlice{slice: append([]int{}, defaults...)}
}

// TODO: Consistently have specific Set function for Int64 and Float64 ?
// SetInt directly adds an integer to the list of values
func (i *IntSlice) SetInt(value int) {
	if !i.hasBeenSet {
		i.slice = []int{}
		i.hasBeenSet = true
	}

	i.slice = append(i.slice, value)
}

// Set parses the value into an integer and appends it to the list of values
func (i *IntSlice) Set(value string) error {
	if !i.hasBeenSet {
		i.slice = []int{}
		i.hasBeenSet = true
	}

	if strings.HasPrefix(value, slPfx) {
		// Deserializing assumes overwrite
		_ = json.Unmarshal([]byte(strings.Replace(value, slPfx, "", 1)), &i.slice)
		i.hasBeenSet = true
		return nil
	}

	tmp, err := strconv.ParseInt(value, 0, 64)
	if err != nil {
		return err
	}

	i.slice = append(i.slice, int(tmp))

	return nil
}

// String returns a readable representation of this value (for usage defaults)
func (i *IntSlice) String() string {
	return fmt.Sprintf("%#v", i.slice)
}

// Serialize allows IntSlice to fulfill Serializer
func (i *IntSlice) Serialize() string {
	jsonBytes, _ := json.Marshal(i.slice)
	return fmt.Sprintf("%s%s", slPfx, string(jsonBytes))
}

// Value returns the slice of ints set by this flag
func (i *IntSlice) Value() []int {
	return i.slice
}

// Get returns the slice of ints set by this flag
func (i *IntSlice) Get() interface{} {
	return *i
}

// IntSliceFlag is a flag with type *IntSlice
type IntSliceFlag struct {
	Name        string
	Aliases     []string
	Usage       string
	EnvVars     []string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       *IntSlice
	DefaultText string
	HasBeenSet  bool
}

// IsSet returns whether or not the flag has been set through env or file
func (f *IntSliceFlag) IsSet() bool {
	return f.HasBeenSet
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *IntSliceFlag) String() string {
	return FlagStringer(f)
}

// Names returns the names of the flag
func (f *IntSliceFlag) Names() []string {
	return flagNames(f)
}

// IsRequired returns whether or not the flag is required
func (f *IntSliceFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *IntSliceFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f IntSliceFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *IntSliceFlag) GetValue() string {
	if f.Value != nil {
		return f.Value.String()
	}
	return ""
}

// Apply populates the flag given the flag set and environment
func (f *IntSliceFlag) Apply(set *flag.FlagSet) error {
	if val, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok {
		f.Value = &IntSlice{}

		for _, s := range strings.Split(val, ",") {
			if err := f.Value.Set(strings.TrimSpace(s)); err != nil {
				return fmt.Errorf("could not parse %q as int slice value for flag %s: %s", val, f.Name, err)
			}
		}

		f.HasBeenSet = true
	}

	for _, name := range f.Names() {
		if f.Value == nil {
			f.Value = &IntSlice{}
		}
		set.Var(f.Value, name, f.Usage)
	}

	return nil
}

// IntSlice looks up the value of a local IntSliceFlag, returns
// nil if not found
func (c *Context) IntSlice(name string) []int {
	if fs := lookupFlagSet(name, c); fs != nil {
		return lookupIntSlice(name, c.flagSet)
	}
	return nil
}

func lookupIntSlice(name string, set *flag.FlagSet) []int {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := (f.Value.(*IntSlice)).Value(), error(nil)
		if err != nil {
			return nil
		}
		return parsed
	}
	return nil
}
