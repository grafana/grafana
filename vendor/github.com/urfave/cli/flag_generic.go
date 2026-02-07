package cli

import (
	"flag"
	"fmt"
)

// Generic is a generic parseable type identified by a specific flag
type Generic interface {
	Set(value string) error
	String() string
}

// GenericFlag is a flag with type Generic
type GenericFlag struct {
	Name      string
	Usage     string
	EnvVar    string
	FilePath  string
	Required  bool
	Hidden    bool
	TakesFile bool
	Value     Generic
}

// String returns a readable representation of this value
// (for usage defaults)
func (f GenericFlag) String() string {
	return FlagStringer(f)
}

// GetName returns the name of the flag
func (f GenericFlag) GetName() string {
	return f.Name
}

// IsRequired returns whether or not the flag is required
func (f GenericFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f GenericFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f GenericFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f GenericFlag) GetValue() string {
	if f.Value != nil {
		return f.Value.String()
	}
	return ""
}

// Apply takes the flagset and calls Set on the generic flag with the value
// provided by the user for parsing by the flag
// Ignores parsing errors
func (f GenericFlag) Apply(set *flag.FlagSet) {
	_ = f.ApplyWithError(set)
}

// ApplyWithError takes the flagset and calls Set on the generic flag with the value
// provided by the user for parsing by the flag
func (f GenericFlag) ApplyWithError(set *flag.FlagSet) error {
	val := f.Value
	if fileEnvVal, ok := flagFromFileEnv(f.FilePath, f.EnvVar); ok {
		if err := val.Set(fileEnvVal); err != nil {
			return fmt.Errorf("could not parse %s as value for flag %s: %s", fileEnvVal, f.Name, err)
		}
	}

	eachName(f.Name, func(name string) {
		set.Var(f.Value, name, f.Usage)
	})

	return nil
}

// Generic looks up the value of a local GenericFlag, returns
// nil if not found
func (c *Context) Generic(name string) interface{} {
	return lookupGeneric(name, c.flagSet)
}

// GlobalGeneric looks up the value of a global GenericFlag, returns
// nil if not found
func (c *Context) GlobalGeneric(name string) interface{} {
	if fs := lookupGlobalFlagSet(name, c); fs != nil {
		return lookupGeneric(name, fs)
	}
	return nil
}

func lookupGeneric(name string, set *flag.FlagSet) interface{} {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := f.Value, error(nil)
		if err != nil {
			return nil
		}
		return parsed
	}
	return nil
}
