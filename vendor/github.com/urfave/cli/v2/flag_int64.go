package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// Int64Flag is a flag with type int64
type Int64Flag struct {
	Name        string
	Aliases     []string
	Usage       string
	EnvVars     []string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       int64
	DefaultText string
	Destination *int64
	HasBeenSet  bool
}

// IsSet returns whether or not the flag has been set through env or file
func (f *Int64Flag) IsSet() bool {
	return f.HasBeenSet
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *Int64Flag) String() string {
	return FlagStringer(f)
}

// Names returns the names of the flag
func (f *Int64Flag) Names() []string {
	return flagNames(f)
}

// IsRequired returns whether or not the flag is required
func (f *Int64Flag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *Int64Flag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *Int64Flag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *Int64Flag) GetValue() string {
	return fmt.Sprintf("%d", f.Value)
}

// Apply populates the flag given the flag set and environment
func (f *Int64Flag) Apply(set *flag.FlagSet) error {
	if val, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok {
		if val != "" {
			valInt, err := strconv.ParseInt(val, 0, 64)

			if err != nil {
				return fmt.Errorf("could not parse %q as int value for flag %s: %s", val, f.Name, err)
			}

			f.Value = valInt
			f.HasBeenSet = true
		}
	}

	for _, name := range f.Names() {
		if f.Destination != nil {
			set.Int64Var(f.Destination, name, f.Value, f.Usage)
			continue
		}
		set.Int64(name, f.Value, f.Usage)
	}
	return nil
}

// Int64 looks up the value of a local Int64Flag, returns
// 0 if not found
func (c *Context) Int64(name string) int64 {
	if fs := lookupFlagSet(name, c); fs != nil {
		return lookupInt64(name, fs)
	}
	return 0
}

func lookupInt64(name string, set *flag.FlagSet) int64 {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := strconv.ParseInt(f.Value.String(), 0, 64)
		if err != nil {
			return 0
		}
		return parsed
	}
	return 0
}
