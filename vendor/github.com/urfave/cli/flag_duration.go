package cli

import (
	"flag"
	"fmt"
	"time"
)

// DurationFlag is a flag with type time.Duration (see https://golang.org/pkg/time/#ParseDuration)
type DurationFlag struct {
	Name        string
	Usage       string
	EnvVar      string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       time.Duration
	Destination *time.Duration
}

// String returns a readable representation of this value
// (for usage defaults)
func (f DurationFlag) String() string {
	return FlagStringer(f)
}

// GetName returns the name of the flag
func (f DurationFlag) GetName() string {
	return f.Name
}

// IsRequired returns whether or not the flag is required
func (f DurationFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f DurationFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f DurationFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f DurationFlag) GetValue() string {
	return f.Value.String()
}

// Duration looks up the value of a local DurationFlag, returns
// 0 if not found
func (c *Context) Duration(name string) time.Duration {
	return lookupDuration(name, c.flagSet)
}

// GlobalDuration looks up the value of a global DurationFlag, returns
// 0 if not found
func (c *Context) GlobalDuration(name string) time.Duration {
	if fs := lookupGlobalFlagSet(name, c); fs != nil {
		return lookupDuration(name, fs)
	}
	return 0
}

// Apply populates the flag given the flag set and environment
// Ignores errors
func (f DurationFlag) Apply(set *flag.FlagSet) {
	_ = f.ApplyWithError(set)
}

// ApplyWithError populates the flag given the flag set and environment
func (f DurationFlag) ApplyWithError(set *flag.FlagSet) error {
	if envVal, ok := flagFromFileEnv(f.FilePath, f.EnvVar); ok {
		envValDuration, err := time.ParseDuration(envVal)
		if err != nil {
			return fmt.Errorf("could not parse %s as duration for flag %s: %s", envVal, f.Name, err)
		}

		f.Value = envValDuration
	}

	eachName(f.Name, func(name string) {
		if f.Destination != nil {
			set.DurationVar(f.Destination, name, f.Value, f.Usage)
			return
		}
		set.Duration(name, f.Value, f.Usage)
	})

	return nil
}

func lookupDuration(name string, set *flag.FlagSet) time.Duration {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := time.ParseDuration(f.Value.String())
		if err != nil {
			return 0
		}
		return parsed
	}
	return 0
}
