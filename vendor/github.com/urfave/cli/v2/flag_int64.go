package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// TakesValue returns true of the flag takes a value, otherwise false
func (f *Int64Flag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *Int64Flag) GetUsage() string {
	return f.Usage
}

// GetCategory returns the category for the flag
func (f *Int64Flag) GetCategory() string {
	return f.Category
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *Int64Flag) GetValue() string {
	return fmt.Sprintf("%d", f.Value)
}

// GetDefaultText returns the default text for this flag
func (f *Int64Flag) GetDefaultText() string {
	if f.DefaultText != "" {
		return f.DefaultText
	}
	if f.defaultValueSet {
		return fmt.Sprintf("%d", f.defaultValue)
	}
	return fmt.Sprintf("%d", f.Value)
}

// GetEnvVars returns the env vars for this flag
func (f *Int64Flag) GetEnvVars() []string {
	return f.EnvVars
}

// Apply populates the flag given the flag set and environment
func (f *Int64Flag) Apply(set *flag.FlagSet) error {
	// set default value so that environment wont be able to overwrite it
	f.defaultValue = f.Value
	f.defaultValueSet = true

	if val, source, found := flagFromEnvOrFile(f.EnvVars, f.FilePath); found {
		if val != "" {
			valInt, err := strconv.ParseInt(val, f.Base, 64)

			if err != nil {
				return fmt.Errorf("could not parse %q as int value from %s for flag %s: %s", val, source, f.Name, err)
			}

			f.Value = valInt
			f.HasBeenSet = true
		}
	}

	for _, name := range f.Names() {
		if f.Destination != nil {
			set.Int64Var(f.Destination, name, f.Value, f.Usage)
			continue
		}
		set.Int64(name, f.Value, f.Usage)
	}
	return nil
}

// Get returns the flag’s value in the given Context.
func (f *Int64Flag) Get(ctx *Context) int64 {
	return ctx.Int64(f.Name)
}

// RunAction executes flag action if set
func (f *Int64Flag) RunAction(c *Context) error {
	if f.Action != nil {
		return f.Action(c, c.Int64(f.Name))
	}

	return nil
}

// Int64 looks up the value of a local Int64Flag, returns
// 0 if not found
func (cCtx *Context) Int64(name string) int64 {
	if fs := cCtx.lookupFlagSet(name); fs != nil {
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
