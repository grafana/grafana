package cli

import (
	"flag"
	"fmt"
	"strconv"
)

// TakesValue returns true of the flag takes a value, otherwise false
func (f *Uint64Flag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *Uint64Flag) GetUsage() string {
	return f.Usage
}

// GetCategory returns the category for the flag
func (f *Uint64Flag) GetCategory() string {
	return f.Category
}

// Apply populates the flag given the flag set and environment
func (f *Uint64Flag) Apply(set *flag.FlagSet) error {
	// set default value so that environment wont be able to overwrite it
	f.defaultValue = f.Value
	f.defaultValueSet = true

	if val, source, found := flagFromEnvOrFile(f.EnvVars, f.FilePath); found {
		if val != "" {
			valInt, err := strconv.ParseUint(val, f.Base, 64)
			if err != nil {
				return fmt.Errorf("could not parse %q as uint64 value from %s for flag %s: %s", val, source, f.Name, err)
			}

			f.Value = valInt
			f.HasBeenSet = true
		}
	}

	for _, name := range f.Names() {
		if f.Destination != nil {
			set.Uint64Var(f.Destination, name, f.Value, f.Usage)
			continue
		}
		set.Uint64(name, f.Value, f.Usage)
	}

	return nil
}

// RunAction executes flag action if set
func (f *Uint64Flag) RunAction(c *Context) error {
	if f.Action != nil {
		return f.Action(c, c.Uint64(f.Name))
	}

	return nil
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *Uint64Flag) GetValue() string {
	return fmt.Sprintf("%d", f.Value)
}

// GetDefaultText returns the default text for this flag
func (f *Uint64Flag) GetDefaultText() string {
	if f.DefaultText != "" {
		return f.DefaultText
	}
	if f.defaultValueSet {
		return fmt.Sprintf("%d", f.defaultValue)
	}
	return fmt.Sprintf("%d", f.Value)
}

// GetEnvVars returns the env vars for this flag
func (f *Uint64Flag) GetEnvVars() []string {
	return f.EnvVars
}

// Get returns the flag’s value in the given Context.
func (f *Uint64Flag) Get(ctx *Context) uint64 {
	return ctx.Uint64(f.Name)
}

// Uint64 looks up the value of a local Uint64Flag, returns
// 0 if not found
func (cCtx *Context) Uint64(name string) uint64 {
	if fs := cCtx.lookupFlagSet(name); fs != nil {
		return lookupUint64(name, fs)
	}
	return 0
}

func lookupUint64(name string, set *flag.FlagSet) uint64 {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := strconv.ParseUint(f.Value.String(), 0, 64)
		if err != nil {
			return 0
		}
		return parsed
	}
	return 0
}
