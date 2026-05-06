package cli

import (
	"flag"
	"fmt"
	"strconv"
	"strings"
)

// Int64Slice is an opaque type for []int to satisfy flag.Value and flag.Getter
type Int64Slice []int64

// Set parses the value into an integer and appends it to the list of values
func (f *Int64Slice) Set(value string) error {
	tmp, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return err
	}
	*f = append(*f, tmp)
	return nil
}

// String returns a readable representation of this value (for usage defaults)
func (f *Int64Slice) String() string {
	slice := make([]string, len(*f))
	for i, v := range *f {
		slice[i] = strconv.FormatInt(v, 10)
	}

	return strings.Join(slice, ",")
}

// Value returns the slice of ints set by this flag
func (f *Int64Slice) Value() []int64 {
	return *f
}

// Get returns the slice of ints set by this flag
func (f *Int64Slice) Get() interface{} {
	return *f
}

// Int64SliceFlag is a flag with type *Int64Slice
type Int64SliceFlag struct {
	Name     string
	Usage    string
	EnvVar   string
	FilePath string
	Required bool
	Hidden   bool
	Value    *Int64Slice
}

// String returns a readable representation of this value
// (for usage defaults)
func (f Int64SliceFlag) String() string {
	return FlagStringer(f)
}

// GetName returns the name of the flag
func (f Int64SliceFlag) GetName() string {
	return f.Name
}

// IsRequired returns whether or not the flag is required
func (f Int64SliceFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f Int64SliceFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f Int64SliceFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f Int64SliceFlag) GetValue() string {
	if f.Value != nil {
		return f.Value.String()
	}
	return ""
}

// Apply populates the flag given the flag set and environment
// Ignores errors
func (f Int64SliceFlag) Apply(set *flag.FlagSet) {
	_ = f.ApplyWithError(set)
}

// ApplyWithError populates the flag given the flag set and environment
func (f Int64SliceFlag) ApplyWithError(set *flag.FlagSet) error {
	if envVal, ok := flagFromFileEnv(f.FilePath, f.EnvVar); ok {
		newVal := &Int64Slice{}
		for _, s := range strings.Split(envVal, ",") {
			s = strings.TrimSpace(s)
			if err := newVal.Set(s); err != nil {
				return fmt.Errorf("could not parse %s as int64 slice value for flag %s: %s", envVal, f.Name, err)
			}
		}
		if f.Value == nil {
			f.Value = newVal
		} else {
			*f.Value = *newVal
		}
	}

	eachName(f.Name, func(name string) {
		if f.Value == nil {
			f.Value = &Int64Slice{}
		}
		set.Var(f.Value, name, f.Usage)
	})

	return nil
}

// Int64Slice looks up the value of a local Int64SliceFlag, returns
// nil if not found
func (c *Context) Int64Slice(name string) []int64 {
	return lookupInt64Slice(name, c.flagSet)
}

// GlobalInt64Slice looks up the value of a global Int64SliceFlag, returns
// nil if not found
func (c *Context) GlobalInt64Slice(name string) []int64 {
	if fs := lookupGlobalFlagSet(name, c); fs != nil {
		return lookupInt64Slice(name, fs)
	}
	return nil
}

func lookupInt64Slice(name string, set *flag.FlagSet) []int64 {
	f := set.Lookup(name)
	if f != nil {
		value, ok := f.Value.(*Int64Slice)
		if !ok {
			return nil
		}

		// extract the slice from asserted value
		parsed := value.Value()

		// extract default value from the flag
		var defaultVal []int64
		for _, v := range strings.Split(f.DefValue, ",") {
			if v != "" {
				int64Value, err := strconv.ParseInt(v, 10, 64)
				if err != nil {
					panic(err)
				}
				defaultVal = append(defaultVal, int64Value)
			}
		}
		// if the current value is not equal to the default value
		// remove the default values from the flag
		if !isInt64SliceEqual(parsed, defaultVal) {
			for _, v := range defaultVal {
				parsed = removeFromInt64Slice(parsed, v)
			}
		}
		return parsed
	}
	return nil
}

func removeFromInt64Slice(slice []int64, val int64) []int64 {
	for i, v := range slice {
		if v == val {
			ret := append([]int64{}, slice[:i]...)
			ret = append(ret, slice[i+1:]...)
			return ret
		}
	}
	return slice
}

func isInt64SliceEqual(newValue, defaultValue []int64) bool {
	// If one is nil, the other must also be nil.
	if (newValue == nil) != (defaultValue == nil) {
		return false
	}

	if len(newValue) != len(defaultValue) {
		return false
	}

	for i, v := range newValue {
		if v != defaultValue[i] {
			return false
		}
	}

	return true
}
