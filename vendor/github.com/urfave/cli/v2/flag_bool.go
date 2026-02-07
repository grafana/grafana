package cli

import (
	"errors"
	"flag"
	"fmt"
	"strconv"
)

// boolValue needs to implement the boolFlag internal interface in flag
// to be able to capture bool fields and values
//
//	type boolFlag interface {
//		  Value
//		  IsBoolFlag() bool
//	}
type boolValue struct {
	destination *bool
	count       *int
}

func newBoolValue(val bool, p *bool, count *int) *boolValue {
	*p = val
	return &boolValue{
		destination: p,
		count:       count,
	}
}

func (b *boolValue) Set(s string) error {
	v, err := strconv.ParseBool(s)
	if err != nil {
		err = errors.New("parse error")
		return err
	}
	*b.destination = v
	if b.count != nil {
		*b.count = *b.count + 1
	}
	return err
}

func (b *boolValue) Get() interface{} { return *b.destination }

func (b *boolValue) String() string {
	if b.destination != nil {
		return strconv.FormatBool(*b.destination)
	}
	return strconv.FormatBool(false)
}

func (b *boolValue) IsBoolFlag() bool { return true }

func (b *boolValue) Count() int {
	if b.count != nil && *b.count > 0 {
		return *b.count
	}
	return 0
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *BoolFlag) TakesValue() bool {
	return false
}

// GetUsage returns the usage string for the flag
func (f *BoolFlag) GetUsage() string {
	return f.Usage
}

// GetCategory returns the category for the flag
func (f *BoolFlag) GetCategory() string {
	return f.Category
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *BoolFlag) GetValue() string {
	return ""
}

// GetDefaultText returns the default text for this flag
func (f *BoolFlag) GetDefaultText() string {
	if f.DefaultText != "" {
		return f.DefaultText
	}
	if f.defaultValueSet {
		return fmt.Sprintf("%v", f.defaultValue)
	}
	return fmt.Sprintf("%v", f.Value)
}

// GetEnvVars returns the env vars for this flag
func (f *BoolFlag) GetEnvVars() []string {
	return f.EnvVars
}

// RunAction executes flag action if set
func (f *BoolFlag) RunAction(c *Context) error {
	if f.Action != nil {
		return f.Action(c, c.Bool(f.Name))
	}

	return nil
}

// Apply populates the flag given the flag set and environment
func (f *BoolFlag) Apply(set *flag.FlagSet) error {
	// set default value so that environment wont be able to overwrite it
	f.defaultValue = f.Value
	f.defaultValueSet = true

	if val, source, found := flagFromEnvOrFile(f.EnvVars, f.FilePath); found {
		if val != "" {
			valBool, err := strconv.ParseBool(val)

			if err != nil {
				return fmt.Errorf("could not parse %q as bool value from %s for flag %s: %s", val, source, f.Name, err)
			}

			f.Value = valBool
		} else {
			// empty value implies that the env is defined but set to empty string, we have to assume that this is
			// what the user wants. If user doesnt want this then the env needs to be deleted or the flag removed from
			// file
			f.Value = false
		}
		f.HasBeenSet = true
	}

	count := f.Count
	dest := f.Destination

	if count == nil {
		count = new(int)
	}

	// since count will be incremented for each alias as well
	// subtract number of aliases from overall count
	*count -= len(f.Aliases)

	if dest == nil {
		dest = new(bool)
	}

	for _, name := range f.Names() {
		value := newBoolValue(f.Value, dest, count)
		set.Var(value, name, f.Usage)
	}

	return nil
}

// Get returns the flag’s value in the given Context.
func (f *BoolFlag) Get(ctx *Context) bool {
	return ctx.Bool(f.Name)
}

// Bool looks up the value of a local BoolFlag, returns
// false if not found
func (cCtx *Context) Bool(name string) bool {
	if fs := cCtx.lookupFlagSet(name); fs != nil {
		return lookupBool(name, fs)
	}
	return false
}

func lookupBool(name string, set *flag.FlagSet) bool {
	f := set.Lookup(name)
	if f != nil {
		parsed, err := strconv.ParseBool(f.Value.String())
		if err != nil {
			return false
		}
		return parsed
	}
	return false
}
