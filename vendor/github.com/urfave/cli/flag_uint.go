package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// UintFlag is a flag with type uint
type UintFlag struct {
	Name        string
	Usage       string
	EnvVar      string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       uint
	Destination *uint
}

// String returns a readable representation of this value
// (for usage defaults)
func (f UintFlag) String() string {
	return FlagStringer(f)
}

// GetName returns the name of the flag
func (f UintFlag) GetName() string {
	return f.Name
}

// IsRequired returns whether or not the flag is required
func (f UintFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f UintFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f UintFlag) GetUsage() string {
	return f.Usage
}

// Apply populates the flag given the flag set and environment
// Ignores errors
func (f UintFlag) Apply(set *flag.FlagSet) {
	_ = f.ApplyWithError(set)
}

// ApplyWithError populates the flag given the flag set and environment
func (f UintFlag) ApplyWithError(set *flag.FlagSet) error {
	if envVal, ok := flagFromFileEnv(f.FilePath, f.EnvVar); ok {
		envValInt, err := strconv.ParseUint(envVal, 0, 64)
		if err != nil {
			return fmt.Errorf("could not parse %s as uint value for flag %s: %s", envVal, f.Name, err)
		}

		f.Value = uint(envValInt)
	}

	eachName(f.Name, func(name string) {
		if f.Destination != nil {
			set.UintVar(f.Destination, name, f.Value, f.Usage)
			return
		}
		set.Uint(name, f.Value, f.Usage)
	})

	return nil
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f UintFlag) GetValue() string {
	return fmt.Sprintf("%d", f.Value)
}

// Uint looks up the value of a local UintFlag, returns
// 0 if not found
func (c *Context) Uint(name string) uint {
	return lookupUint(name, c.flagSet)
}

// GlobalUint looks up the value of a global UintFlag, returns
// 0 if not found
func (c *Context) GlobalUint(name string) uint {
	if fs := lookupGlobalFlagSet(name, c); fs != nil {
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
