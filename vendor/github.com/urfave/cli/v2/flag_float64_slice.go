package cli

import (
	"encoding/json"
	"flag"
	"fmt"
	"strconv"
	"strings"
)

// Float64Slice wraps []float64 to satisfy flag.Value
type Float64Slice struct {
	slice      []float64
	hasBeenSet bool
}

// NewFloat64Slice makes a *Float64Slice with default values
func NewFloat64Slice(defaults ...float64) *Float64Slice {
	return &Float64Slice{slice: append([]float64{}, defaults...)}
}

// Set parses the value into a float64 and appends it to the list of values
func (f *Float64Slice) Set(value string) error {
	if !f.hasBeenSet {
		f.slice = []float64{}
		f.hasBeenSet = true
	}

	if strings.HasPrefix(value, slPfx) {
		// Deserializing assumes overwrite
		_ = json.Unmarshal([]byte(strings.Replace(value, slPfx, "", 1)), &f.slice)
		f.hasBeenSet = true
		return nil
	}

	tmp, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return err
	}

	f.slice = append(f.slice, tmp)
	return nil
}

// String returns a readable representation of this value (for usage defaults)
func (f *Float64Slice) String() string {
	return fmt.Sprintf("%#v", f.slice)
}

// Serialize allows Float64Slice to fulfill Serializer
func (f *Float64Slice) Serialize() string {
	jsonBytes, _ := json.Marshal(f.slice)
	return fmt.Sprintf("%s%s", slPfx, string(jsonBytes))
}

// Value returns the slice of float64s set by this flag
func (f *Float64Slice) Value() []float64 {
	return f.slice
}

// Get returns the slice of float64s set by this flag
func (f *Float64Slice) Get() interface{} {
	return *f
}

// Float64SliceFlag is a flag with type *Float64Slice
type Float64SliceFlag struct {
	Name        string
	Aliases     []string
	Usage       string
	EnvVars     []string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       *Float64Slice
	DefaultText string
	HasBeenSet  bool
}

// IsSet returns whether or not the flag has been set through env or file
func (f *Float64SliceFlag) IsSet() bool {
	return f.HasBeenSet
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *Float64SliceFlag) String() string {
	return FlagStringer(f)
}

// Names returns the names of the flag
func (f *Float64SliceFlag) Names() []string {
	return flagNames(f)
}

// IsRequired returns whether or not the flag is required
func (f *Float64SliceFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true if the flag takes a value, otherwise false
func (f *Float64SliceFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *Float64SliceFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *Float64SliceFlag) GetValue() string {
	if f.Value != nil {
		return f.Value.String()
	}
	return ""
}

// Apply populates the flag given the flag set and environment
func (f *Float64SliceFlag) Apply(set *flag.FlagSet) error {
	if val, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok {
		if val != "" {
			f.Value = &Float64Slice{}

			for _, s := range strings.Split(val, ",") {
				if err := f.Value.Set(strings.TrimSpace(s)); err != nil {
					return fmt.Errorf("could not parse %q as float64 slice value for flag %s: %s", f.Value, f.Name, err)
				}
			}

			f.HasBeenSet = true
		}
	}

	for _, name := range f.Names() {
		if f.Value == nil {
			f.Value = &Float64Slice{}
		}
		set.Var(f.Value, name, f.Usage)
	}

	return nil
}

// Float64Slice looks up the value of a local Float64SliceFlag, returns
// nil if not found
func (c *Context) Float64Slice(name string) []float64 {
	if fs := lookupFlagSet(name, c); fs != nil {
		return lookupFloat64Slice(name, fs)
	}
	return nil
}

func lookupFloat64Slice(name string, set *flag.FlagSet) []float64 {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := (f.Value.(*Float64Slice)).Value(), error(nil)
		if err != nil {
			return nil
		}
		return parsed
	}
	return nil
}
