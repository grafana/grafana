package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// BoolFlag is a flag with type bool
type BoolFlag struct {
	Name        string
	Usage       string
	EnvVar      string
	FilePath    string
	Required    bool
	Hidden      bool
	Destination *bool
}

// String returns a readable representation of this value
// (for usage defaults)
func (f BoolFlag) String() string {
	return FlagStringer(f)
}

// GetName returns the name of the flag
func (f BoolFlag) GetName() string {
	return f.Name
}

// IsRequired returns whether or not the flag is required
func (f BoolFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f BoolFlag) TakesValue() bool {
	return false
}

// GetUsage returns the usage string for the flag
func (f BoolFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f BoolFlag) GetValue() string {
	return ""
}

// Bool looks up the value of a local BoolFlag, returns
// false if not found
func (c *Context) Bool(name string) bool {
	return lookupBool(name, c.flagSet)
}

// GlobalBool looks up the value of a global BoolFlag, returns
// false if not found
func (c *Context) GlobalBool(name string) bool {
	if fs := lookupGlobalFlagSet(name, c); fs != nil {
		return lookupBool(name, fs)
	}
	return false
}

// Apply populates the flag given the flag set and environment
// Ignores errors
func (f BoolFlag) Apply(set *flag.FlagSet) {
	_ = f.ApplyWithError(set)
}

// ApplyWithError populates the flag given the flag set and environment
func (f BoolFlag) ApplyWithError(set *flag.FlagSet) error {
	val := false
	if envVal, ok := flagFromFileEnv(f.FilePath, f.EnvVar); ok {
		if envVal == "" {
			val = false
		} else {
			envValBool, err := strconv.ParseBool(envVal)
			if err != nil {
				return fmt.Errorf("could not parse %s as bool value for flag %s: %s", envVal, f.Name, err)
			}
			val = envValBool
		}
	}

	eachName(f.Name, func(name string) {
		if f.Destination != nil {
			set.BoolVar(f.Destination, name, val, f.Usage)
			return
		}
		set.Bool(name, val, f.Usage)
	})

	return nil
}

func lookupBool(name string, set *flag.FlagSet) bool {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := strconv.ParseBool(f.Value.String())
		if err != nil {
			return false
		}
		return parsed
	}
	return false
}
