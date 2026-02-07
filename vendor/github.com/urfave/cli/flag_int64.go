package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// Int64Flag is a flag with type int64
type Int64Flag struct {
	Name        string
	Usage       string
	EnvVar      string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       int64
	Destination *int64
}

// String returns a readable representation of this value
// (for usage defaults)
func (f Int64Flag) String() string {
	return FlagStringer(f)
}

// GetName returns the name of the flag
func (f Int64Flag) GetName() string {
	return f.Name
}

// IsRequired returns whether or not the flag is required
func (f Int64Flag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f Int64Flag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f Int64Flag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f Int64Flag) GetValue() string {
	return fmt.Sprintf("%d", f.Value)
}

// Apply populates the flag given the flag set and environment
// Ignores errors
func (f Int64Flag) Apply(set *flag.FlagSet) {
	_ = f.ApplyWithError(set)
}

// ApplyWithError populates the flag given the flag set and environment
func (f Int64Flag) ApplyWithError(set *flag.FlagSet) error {
	if envVal, ok := flagFromFileEnv(f.FilePath, f.EnvVar); ok {
		envValInt, err := strconv.ParseInt(envVal, 0, 64)
		if err != nil {
			return fmt.Errorf("could not parse %s as int value for flag %s: %s", envVal, f.Name, err)
		}

		f.Value = envValInt
	}

	eachName(f.Name, func(name string) {
		if f.Destination != nil {
			set.Int64Var(f.Destination, name, f.Value, f.Usage)
			return
		}
		set.Int64(name, f.Value, f.Usage)
	})

	return nil
}

// Int64 looks up the value of a local Int64Flag, returns
// 0 if not found
func (c *Context) Int64(name string) int64 {
	return lookupInt64(name, c.flagSet)
}

// GlobalInt64 looks up the value of a global Int64Flag, returns
// 0 if not found
func (c *Context) GlobalInt64(name string) int64 {
	if fs := lookupGlobalFlagSet(name, c); fs != nil {
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
