package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// Float64Flag is a flag with type float64
type Float64Flag struct {
	Name        string
	Usage       string
	EnvVar      string
	FilePath    string
	Required    bool
	Hidden      bool
	Value       float64
	Destination *float64
}

// String returns a readable representation of this value
// (for usage defaults)
func (f Float64Flag) String() string {
	return FlagStringer(f)
}

// GetName returns the name of the flag
func (f Float64Flag) GetName() string {
	return f.Name
}

// IsRequired returns whether or not the flag is required
func (f Float64Flag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f Float64Flag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f Float64Flag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f Float64Flag) GetValue() string {
	return fmt.Sprintf("%f", f.Value)
}

// Float64 looks up the value of a local Float64Flag, returns
// 0 if not found
func (c *Context) Float64(name string) float64 {
	return lookupFloat64(name, c.flagSet)
}

// GlobalFloat64 looks up the value of a global Float64Flag, returns
// 0 if not found
func (c *Context) GlobalFloat64(name string) float64 {
	if fs := lookupGlobalFlagSet(name, c); fs != nil {
		return lookupFloat64(name, fs)
	}
	return 0
}

// Apply populates the flag given the flag set and environment
// Ignores errors
func (f Float64Flag) Apply(set *flag.FlagSet) {
	_ = f.ApplyWithError(set)
}

// ApplyWithError populates the flag given the flag set and environment
func (f Float64Flag) ApplyWithError(set *flag.FlagSet) error {
	if envVal, ok := flagFromFileEnv(f.FilePath, f.EnvVar); ok {
		envValFloat, err := strconv.ParseFloat(envVal, 10)
		if err != nil {
			return fmt.Errorf("could not parse %s as float64 value for flag %s: %s", envVal, f.Name, err)
		}

		f.Value = envValFloat
	}

	eachName(f.Name, func(name string) {
		if f.Destination != nil {
			set.Float64Var(f.Destination, name, f.Value, f.Usage)
			return
		}
		set.Float64(name, f.Value, f.Usage)
	})

	return nil
}

func lookupFloat64(name string, set *flag.FlagSet) float64 {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := strconv.ParseFloat(f.Value.String(), 64)
		if err != nil {
			return 0
		}
		return parsed
	}
	return 0
}
