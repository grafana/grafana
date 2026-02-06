package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// IntFlag is a flag with type int
type IntFlag struct {
	Name        string
	Usage       string
	EnvVar      string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       int
	Destination *int
}

// String returns a readable representation of this value
// (for usage defaults)
func (f IntFlag) String() string {
	return FlagStringer(f)
}

// GetName returns the name of the flag
func (f IntFlag) GetName() string {
	return f.Name
}

// IsRequired returns whether or not the flag is required
func (f IntFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f IntFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f IntFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f IntFlag) GetValue() string {
	return fmt.Sprintf("%d", f.Value)
}

// Apply populates the flag given the flag set and environment
// Ignores errors
func (f IntFlag) Apply(set *flag.FlagSet) {
	_ = f.ApplyWithError(set)
}

// ApplyWithError populates the flag given the flag set and environment
func (f IntFlag) ApplyWithError(set *flag.FlagSet) error {
	if envVal, ok := flagFromFileEnv(f.FilePath, f.EnvVar); ok {
		envValInt, err := strconv.ParseInt(envVal, 0, 64)
		if err != nil {
			return fmt.Errorf("could not parse %s as int value for flag %s: %s", envVal, f.Name, err)
		}
		f.Value = int(envValInt)
	}

	eachName(f.Name, func(name string) {
		if f.Destination != nil {
			set.IntVar(f.Destination, name, f.Value, f.Usage)
			return
		}
		set.Int(name, f.Value, f.Usage)
	})

	return nil
}

// Int looks up the value of a local IntFlag, returns
// 0 if not found
func (c *Context) Int(name string) int {
	return lookupInt(name, c.flagSet)
}

// GlobalInt looks up the value of a global IntFlag, returns
// 0 if not found
func (c *Context) GlobalInt(name string) int {
	if fs := lookupGlobalFlagSet(name, c); fs != nil {
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
