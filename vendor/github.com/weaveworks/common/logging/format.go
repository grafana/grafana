package logging

import (
	"flag"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

// Format is a settable identifier for the output format of logs
type Format struct {
	s      string
	Logrus logrus.Formatter
}

// RegisterFlags adds the log format flag to the provided flagset.
func (f *Format) RegisterFlags(fs *flag.FlagSet) {
	f.Set("logfmt")
	fs.Var(f, "log.format", "Output log messages in the given format. Valid formats: [logfmt, json]")
}

func (f Format) String() string {
	return f.s
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (f *Format) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var format string
	if err := unmarshal(&format); err != nil {
		return err
	}
	return f.Set(format)
}

// MarshalYAML implements yaml.Marshaler.
func (f Format) MarshalYAML() (interface{}, error) {
	return f.String(), nil
}

// Set updates the value of the output format.  Implements flag.Value
func (f *Format) Set(s string) error {
	switch s {
	case "logfmt":
		f.Logrus = &logrus.JSONFormatter{}
	case "json":
		f.Logrus = &logrus.JSONFormatter{}
	default:
		return errors.Errorf("unrecognized log format %q", s)
	}
	f.s = s
	return nil
}
