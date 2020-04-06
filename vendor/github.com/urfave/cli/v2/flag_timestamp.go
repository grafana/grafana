package cli

import (
	"flag"
	"fmt"
	"time"
)

// Timestamp wrap to satisfy golang's flag interface.
type Timestamp struct {
	timestamp  *time.Time
	hasBeenSet bool
	layout     string
}

// Timestamp constructor
func NewTimestamp(timestamp time.Time) *Timestamp {
	return &Timestamp{timestamp: &timestamp}
}

// Set the timestamp value directly
func (t *Timestamp) SetTimestamp(value time.Time) {
	if !t.hasBeenSet {
		t.timestamp = &value
		t.hasBeenSet = true
	}
}

// Set the timestamp string layout for future parsing
func (t *Timestamp) SetLayout(layout string) {
	t.layout = layout
}

// Parses the string value to timestamp
func (t *Timestamp) Set(value string) error {
	timestamp, err := time.Parse(t.layout, value)
	if err != nil {
		return err
	}

	t.timestamp = &timestamp
	t.hasBeenSet = true
	return nil
}

// String returns a readable representation of this value (for usage defaults)
func (t *Timestamp) String() string {
	return fmt.Sprintf("%#v", t.timestamp)
}

// Value returns the timestamp value stored in the flag
func (t *Timestamp) Value() *time.Time {
	return t.timestamp
}

// Get returns the flag structure
func (t *Timestamp) Get() interface{} {
	return *t
}

// TimestampFlag is a flag with type time
type TimestampFlag struct {
	Name        string
	Aliases     []string
	Usage       string
	EnvVars     []string
	FilePath    string
	Required    bool
	Hidden      bool
	Layout      string
	Value       *Timestamp
	DefaultText string
	HasBeenSet  bool
}

// IsSet returns whether or not the flag has been set through env or file
func (f *TimestampFlag) IsSet() bool {
	return f.HasBeenSet
}

// String returns a readable representation of this value
// (for usage defaults)
func (f *TimestampFlag) String() string {
	return FlagStringer(f)
}

// Names returns the names of the flag
func (f *TimestampFlag) Names() []string {
	return flagNames(f)
}

// IsRequired returns whether or not the flag is required
func (f *TimestampFlag) IsRequired() bool {
	return f.Required
}

// TakesValue returns true of the flag takes a value, otherwise false
func (f *TimestampFlag) TakesValue() bool {
	return true
}

// GetUsage returns the usage string for the flag
func (f *TimestampFlag) GetUsage() string {
	return f.Usage
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *TimestampFlag) GetValue() string {
	if f.Value != nil {
		return f.Value.timestamp.String()
	}
	return ""
}

// Apply populates the flag given the flag set and environment
func (f *TimestampFlag) Apply(set *flag.FlagSet) error {
	if f.Layout == "" {
		return fmt.Errorf("timestamp Layout is required")
	}
	f.Value = &Timestamp{}
	f.Value.SetLayout(f.Layout)

	if val, ok := flagFromEnvOrFile(f.EnvVars, f.FilePath); ok {
		if err := f.Value.Set(val); err != nil {
			return fmt.Errorf("could not parse %q as timestamp value for flag %s: %s", val, f.Name, err)
		}
		f.HasBeenSet = true
	}

	for _, name := range f.Names() {
		set.Var(f.Value, name, f.Usage)
	}
	return nil
}

// Timestamp gets the timestamp from a flag name
func (c *Context) Timestamp(name string) *time.Time {
	if fs := lookupFlagSet(name, c); fs != nil {
		return lookupTimestamp(name, fs)
	}
	return nil
}

// Fetches the timestamp value from the local timestampWrap
func lookupTimestamp(name string, set *flag.FlagSet) *time.Time {
	f := set.Lookup(name)
	if f != nil {
		return (f.Value.(*Timestamp)).Value()
	}
	return nil
}
