package flag

import (
	"time"
)

// ScheduledStep is one change of the flag.
type ScheduledStep struct {
	InternalFlag `yaml:",inline"`
	Date         *time.Time `json:"date,omitempty" yaml:"date,omitempty" toml:"date,omitempty"`
}
