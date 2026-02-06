package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// TakesValue returns true of the flag takes a value, otherwise false
func (f *Float64Flag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *Float64Flag) GetUsage() string {
	return f.Usage
}

// GetCategory returns the category for the flag
func (f *Float64Flag) GetCategory() string {
	return f.Category
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *Float64Flag) GetValue() string {
	return fmt.Sprintf("%v", f.Value)
}

// GetDefaultText returns the default text for this flag
func (f *Float64Flag) GetDefaultText() string {
	if f.DefaultText != "" {
		return f.DefaultText
	}
	if f.defaultValueSet {
		return fmt.Sprintf("%v", f.defaultValue)
	}
	return fmt.Sprintf("%v", f.Value)
}

// GetEnvVars returns the env vars for this flag
func (f *Float64Flag) GetEnvVars() []string {
	return f.EnvVars
}

// Apply populates the flag given the flag set and environment
func (f *Float64Flag) Apply(set *flag.FlagSet) error {
	f.defaultValue = f.Value
	f.defaultValueSet = true

	if val, source, found := flagFromEnvOrFile(f.EnvVars, f.FilePath); found {
		if val != "" {
			valFloat, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return fmt.Errorf("could not parse %q as float64 value from %s for flag %s: %s", val, source, f.Name, err)
			}

			f.Value = valFloat
			f.HasBeenSet = true
		}
	}

	for _, name := range f.Names() {
		if f.Destination != nil {
			set.Float64Var(f.Destination, name, f.Value, f.Usage)
			continue
		}
		set.Float64(name, f.Value, f.Usage)
	}

	return nil
}

// Get returns the flag’s value in the given Context.
func (f *Float64Flag) Get(ctx *Context) float64 {
	return ctx.Float64(f.Name)
}

// RunAction executes flag action if set
func (f *Float64Flag) RunAction(c *Context) error {
	if f.Action != nil {
		return f.Action(c, c.Float64(f.Name))
	}

	return nil
}

// Float64 looks up the value of a local Float64Flag, returns
// 0 if not found
func (cCtx *Context) Float64(name string) float64 {
	if fs := cCtx.lookupFlagSet(name); fs != nil {
		return lookupFloat64(name, fs)
	}
	return 0
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
