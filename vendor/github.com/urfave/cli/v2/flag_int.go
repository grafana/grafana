package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// IntFlag is a flag with type int
type IntFlag struct {
	Name        string
	Aliases     []string
	Usage       string
	EnvVars     []string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       int
	DefaultText string
	Destination *int
	HasBeenSet  bool
}

// IsSet returns whether or not the flag has been set through env or file
func (f *IntFlag) IsSet() bool {
	return f.HasBeenSet
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *IntFlag) String() string {
	return FlagStringer(f)
}

// Names returns the names of the flag
func (f *IntFlag) Names() []string {
	return flagNames(f)
}

// IsRequired returns whether or not the flag is required
func (f *IntFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *IntFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *IntFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *IntFlag) GetValue() string {
	return fmt.Sprintf("%d", f.Value)
}

// Apply populates the flag given the flag set and environment
func (f *IntFlag) Apply(set *flag.FlagSet) error {
	if val, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok {
		if val != "" {
			valInt, err := strconv.ParseInt(val, 0, 64)

			if err != nil {
				return fmt.Errorf("could not parse %q as int value for flag %s: %s", val, f.Name, err)
			}

			f.Value = int(valInt)
			f.HasBeenSet = true
		}
	}

	for _, name := range f.Names() {
		if f.Destination != nil {
			set.IntVar(f.Destination, name, f.Value, f.Usage)
			continue
		}
		set.Int(name, f.Value, f.Usage)
	}

	return nil
}

// Int looks up the value of a local IntFlag, returns
// 0 if not found
func (c *Context) Int(name string) int {
	if fs := lookupFlagSet(name, c); fs != nil {
		return lookupInt(name, fs)
	}
	return 0
}

func lookupInt(name string, set *flag.FlagSet) int {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := strconv.ParseInt(f.Value.String(), 0, 64)
		if err != nil {
			return 0
		}
		return int(parsed)
	}
	return 0
}
