package cli

import "flag"

// StringFlag is a flag with type string
type StringFlag struct {
	Name        string
	Usage       string
	EnvVar      string
	FilePath    string
	Required    bool
	Hidden      bool
	TakesFile   bool
	Value       string
	Destination *string
}

// String returns a readable representation of this value
// (for usage defaults)
func (f StringFlag) String() string {
	return FlagStringer(f)
}

// GetName returns the name of the flag
func (f StringFlag) GetName() string {
	return f.Name
}

// IsRequired returns whether or not the flag is required
func (f StringFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f StringFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f StringFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f StringFlag) GetValue() string {
	return f.Value
}

// Apply populates the flag given the flag set and environment
// Ignores errors
func (f StringFlag) Apply(set *flag.FlagSet) {
	_ = f.ApplyWithError(set)
}

// ApplyWithError populates the flag given the flag set and environment
func (f StringFlag) ApplyWithError(set *flag.FlagSet) error {
	if envVal, ok := flagFromFileEnv(f.FilePath, f.EnvVar); ok {
		f.Value = envVal
	}

	eachName(f.Name, func(name string) {
		if f.Destination != nil {
			set.StringVar(f.Destination, name, f.Value, f.Usage)
			return
		}
		set.String(name, f.Value, f.Usage)
	})

	return nil
}

// String looks up the value of a local StringFlag, returns
// "" if not found
func (c *Context) String(name string) string {
	return lookupString(name, c.flagSet)
}

// GlobalString looks up the value of a global StringFlag, returns
// "" if not found
func (c *Context) GlobalString(name string) string {
	if fs := lookupGlobalFlagSet(name, c); fs != nil {
		return lookupString(name, fs)
	}
	return ""
}

func lookupString(name string, set *flag.FlagSet) string {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := f.Value.String(), error(nil)
		if err != nil {
			return ""
		}
		return parsed
	}
	return ""
}
