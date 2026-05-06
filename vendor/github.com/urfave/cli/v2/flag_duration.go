package cli

import (
	"flag"
	"fmt"
	"time"
)

// TakesValue returns true of the flag takes a value, otherwise false
func (f *DurationFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *DurationFlag) GetUsage() string {
	return f.Usage
}

// GetCategory returns the category for the flag
func (f *DurationFlag) GetCategory() string {
	return f.Category
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *DurationFlag) GetValue() string {
	return f.Value.String()
}

// GetDefaultText returns the default text for this flag
func (f *DurationFlag) GetDefaultText() string {
	if f.DefaultText != "" {
		return f.DefaultText
	}
	if f.defaultValueSet {
		return f.defaultValue.String()
	}
	return f.Value.String()
}

// GetEnvVars returns the env vars for this flag
func (f *DurationFlag) GetEnvVars() []string {
	return f.EnvVars
}

// Apply populates the flag given the flag set and environment
func (f *DurationFlag) Apply(set *flag.FlagSet) error {
	// set default value so that environment wont be able to overwrite it
	f.defaultValue = f.Value
	f.defaultValueSet = true

	if val, source, found := flagFromEnvOrFile(f.EnvVars, f.FilePath); found {
		if val != "" {
			valDuration, err := time.ParseDuration(val)

			if err != nil {
				return fmt.Errorf("could not parse %q as duration value from %s for flag %s: %s", val, source, f.Name, err)
			}

			f.Value = valDuration
			f.HasBeenSet = true
		}
	}

	for _, name := range f.Names() {
		if f.Destination != nil {
			set.DurationVar(f.Destination, name, f.Value, f.Usage)
			continue
		}
		set.Duration(name, f.Value, f.Usage)
	}
	return nil
}

// Get returns the flag’s value in the given Context.
func (f *DurationFlag) Get(ctx *Context) time.Duration {
	return ctx.Duration(f.Name)
}

// RunAction executes flag action if set
func (f *DurationFlag) RunAction(c *Context) error {
	if f.Action != nil {
		return f.Action(c, c.Duration(f.Name))
	}

	return nil
}

// Duration looks up the value of a local DurationFlag, returns
// 0 if not found
func (cCtx *Context) Duration(name string) time.Duration {
	if fs := cCtx.lookupFlagSet(name); fs != nil {
		return lookupDuration(name, fs)
	}
	return 0
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
