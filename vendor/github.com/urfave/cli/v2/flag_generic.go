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
	Name        string
	Aliases     []string
	Usage       string
	EnvVars     []string
	FilePath    string
	Required    bool
	Hidden      bool
	TakesFile   bool
	Value       Generic
	DefaultText string
	HasBeenSet  bool
}

// IsSet returns whether or not the flag has been set through env or file
func (f *GenericFlag) IsSet() bool {
	return f.HasBeenSet
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *GenericFlag) String() string {
	return FlagStringer(f)
}

// Names returns the names of the flag
func (f *GenericFlag) Names() []string {
	return flagNames(f)
}

// IsRequired returns whether or not the flag is required
func (f *GenericFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *GenericFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *GenericFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *GenericFlag) GetValue() string {
	if f.Value != nil {
		return f.Value.String()
	}
	return ""
}

// Apply takes the flagset and calls Set on the generic flag with the value
// provided by the user for parsing by the flag
func (f GenericFlag) Apply(set *flag.FlagSet) error {
	if val, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok {
		if val != "" {
			if err := f.Value.Set(val); err != nil {
				return fmt.Errorf("could not parse %q as value for flag %s: %s", val, f.Name, err)
			}

			f.HasBeenSet = true
		}
	}

	for _, name := range f.Names() {
		set.Var(f.Value, name, f.Usage)
	}

	return nil
}

// Generic looks up the value of a local GenericFlag, returns
// nil if not found
func (c *Context) Generic(name string) interface{} {
	if fs := lookupFlagSet(name, c); fs != nil {
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
