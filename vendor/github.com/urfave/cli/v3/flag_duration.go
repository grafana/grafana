package cli

import (
	"fmt"
	"time"
)

type DurationFlag = FlagBase[time.Duration, NoConfig, durationValue]

// -- time.Duration Value
type durationValue time.Duration

// Below functions are to satisfy the ValueCreator interface

func (d durationValue) Create(val time.Duration, p *time.Duration, c NoConfig) Value {
	*p = val
	return (*durationValue)(p)
}

func (d durationValue) ToString(val time.Duration) string {
	return fmt.Sprintf("%v", val)
}

// Below functions are to satisfy the flag.Value interface

func (d *durationValue) Set(s string) error {
	v, err := time.ParseDuration(s)
	if err != nil {
		return err
	}
	*d = durationValue(v)
	return err
}

func (d *durationValue) Get() any { return time.Duration(*d) }

func (d *durationValue) String() string { return (*time.Duration)(d).String() }

func (cmd *Command) Duration(name string) time.Duration {
	if v, ok := cmd.Value(name).(time.Duration); ok {
		tracef("duration available for flag name %[1]q with value=%[2]v (cmd=%[3]q)", name, v, cmd.Name)
		return v
	}

	tracef("bool NOT available for flag name %[1]q (cmd=%[2]q)", name, cmd.Name)
	return 0
}
