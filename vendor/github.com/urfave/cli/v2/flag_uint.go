package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// UintFlag is a flag with type uint
type UintFlag struct {
	Name        string
	Aliases     []string
	Usage       string
	EnvVars     []string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       uint
	DefaultText string
	Destination *uint
	HasBeenSet  bool
}

// IsSet returns whether or not the flag has been set through env or file
func (f *UintFlag) IsSet() bool {
	return f.HasBeenSet
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *UintFlag) String() string {
	return FlagStringer(f)
}

// Names returns the names of the flag
func (f *UintFlag) Names() []string {
	return flagNames(f)
}

// IsRequired returns whether or not the flag is required
func (f *UintFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *UintFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *UintFlag) GetUsage() string {
	return f.Usage
}

// Apply populates the flag given the flag set and environment
func (f *UintFlag) Apply(set *flag.FlagSet) error {
	if val, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok {
		if val != "" {
			valInt, err := strconv.ParseUint(val, 0, 64)
			if err != nil {
				return fmt.Errorf("could not parse %q as uint value for flag %s: %s", val, f.Name, err)
			}

			f.Value = uint(valInt)
			f.HasBeenSet = true
		}
	}

	for _, name := range f.Names() {
		if f.Destination != nil {
			set.UintVar(f.Destination, name, f.Value, f.Usage)
			continue
		}
		set.Uint(name, f.Value, f.Usage)
	}

	return nil
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *UintFlag) GetValue() string {
	return fmt.Sprintf("%d", f.Value)
}

// Uint looks up the value of a local UintFlag, returns
// 0 if not found
func (c *Context) Uint(name string) uint {
	if fs := lookupFlagSet(name, c); fs != nil {
		return lookupUint(name, fs)
	}
	return 0
}

func lookupUint(name string, set *flag.FlagSet) uint {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := strconv.ParseUint(f.Value.String(), 0, 64)
		if err != nil {
			return 0
		}
		return uint(parsed)
	}
	return 0
}
