package flagext

import (
	"fmt"
	"time"
)

// Time usable as flag or in YAML config.
type Time time.Time

// String implements flag.Value
func (t Time) String() string {
	if time.Time(t).IsZero() {
		return "0"
	}

	return time.Time(t).Format(time.RFC3339)
}

// Set implements flag.Value
func (t *Time) Set(s string) error {
	if s == "0" {
		*t = Time(time.Time{})
		return nil
	}

	p, err := time.Parse("2006-01-02", s)
	if err == nil {
		*t = Time(p)
		return nil
	}

	p, err = time.Parse("2006-01-02T15:04", s)
	if err == nil {
		*t = Time(p)
		return nil
	}

	p, err = time.Parse("2006-01-02T15:04:05Z07:00", s)
	if err == nil {
		*t = Time(p)
		return nil
	}

	return fmt.Errorf("failed to parse time: %q", s)
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (t *Time) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	if err := unmarshal(&s); err != nil {
		return err
	}
	return t.Set(s)
}

// MarshalYAML implements yaml.Marshaler.
func (t Time) MarshalYAML() (interface{}, error) {
	return t.String(), nil
}
