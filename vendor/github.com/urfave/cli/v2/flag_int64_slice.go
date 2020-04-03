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
	hasBeenSet bool
}

// NewInt64Slice makes an *Int64Slice with default values
func NewInt64Slice(defaults ...int64) *Int64Slice {
	return &Int64Slice{slice: append([]int64{}, defaults...)}
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

	tmp, err := strconv.ParseInt(value, 0, 64)
	if err != nil {
		return err
	}

	i.slice = append(i.slice, tmp)

	return nil
}

// String returns a readable representation of this value (for usage defaults)
func (i *Int64Slice) String() string {
	return fmt.Sprintf("%#v", i.slice)
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

// Int64SliceFlag is a flag with type *Int64Slice
type Int64SliceFlag struct {
	Name        string
	Aliases     []string
	Usage       string
	EnvVars     []string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       *Int64Slice
	DefaultText string
	HasBeenSet  bool
}

// IsSet returns whether or not the flag has been set through env or file
func (f *Int64SliceFlag) IsSet() bool {
	return f.HasBeenSet
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *Int64SliceFlag) String() string {
	return FlagStringer(f)
}

// Names returns the names of the flag
func (f *Int64SliceFlag) Names() []string {
	return flagNames(f)
}

// IsRequired returns whether or not the flag is required
func (f *Int64SliceFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *Int64SliceFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f Int64SliceFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *Int64SliceFlag) GetValue() string {
	if f.Value != nil {
		return f.Value.String()
	}
	return ""
}

// Apply populates the flag given the flag set and environment
func (f *Int64SliceFlag) Apply(set *flag.FlagSet) error {
	if val, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok {
		f.Value = &Int64Slice{}

		for _, s := range strings.Split(val, ",") {
			if err := f.Value.Set(strings.TrimSpace(s)); err != nil {
				return fmt.Errorf("could not parse %q as int64 slice value for flag %s: %s", val, f.Name, err)
			}
		}

		f.HasBeenSet = true
	}

	for _, name := range f.Names() {
		if f.Value == nil {
			f.Value = &Int64Slice{}
		}
		set.Var(f.Value, name, f.Usage)
	}

	return nil
}

// Int64Slice looks up the value of a local Int64SliceFlag, returns
// nil if not found
func (c *Context) Int64Slice(name string) []int64 {
	return lookupInt64Slice(name, c.flagSet)
}

func lookupInt64Slice(name string, set *flag.FlagSet) []int64 {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := (f.Value.(*Int64Slice)).Value(), error(nil)
		if err != nil {
			return nil
		}
		return parsed
	}
	return nil
}
