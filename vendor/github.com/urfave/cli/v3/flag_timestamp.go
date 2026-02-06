package cli

import (
	"errors"
	"fmt"
	"time"
)

type TimestampFlag = FlagBase[time.Time, TimestampConfig, timestampValue]

// TimestampConfig defines the config for timestamp flags
type TimestampConfig struct {
	Timezone *time.Location
	// Available layouts for flag value.
	//
	// Note that value for formats with missing year/date will be interpreted as current year/date respectively.
	//
	// Read more about time layouts: https://pkg.go.dev/time#pkg-constants
	Layouts []string
}

// timestampValue wrap to satisfy golang's flag interface.
type timestampValue struct {
	timestamp  *time.Time
	hasBeenSet bool
	layouts    []string
	location   *time.Location
}

var _ ValueCreator[time.Time, TimestampConfig] = timestampValue{}

// Below functions are to satisfy the ValueCreator interface

func (t timestampValue) Create(val time.Time, p *time.Time, c TimestampConfig) Value {
	*p = val
	return &timestampValue{
		timestamp: p,
		layouts:   c.Layouts,
		location:  c.Timezone,
	}
}

func (t timestampValue) ToString(b time.Time) string {
	if b.IsZero() {
		return ""
	}
	return fmt.Sprintf("%v", b)
}

// Below functions are to satisfy the Value interface

// Parses the string value to timestamp
func (t *timestampValue) Set(value string) error {
	var timestamp time.Time
	var err error

	if t.location == nil {
		t.location = time.UTC
	}

	if len(t.layouts) == 0 {
		return errors.New("got nil/empty layouts slice")
	}

	for _, layout := range t.layouts {
		var locErr error

		timestamp, locErr = time.ParseInLocation(layout, value, t.location)
		if locErr != nil {
			if err == nil {
				err = locErr
				continue
			}

			err = newMultiError(err, locErr)
			continue
		}

		err = nil
		break
	}

	if err != nil {
		return err
	}

	defaultTS, _ := time.ParseInLocation(time.TimeOnly, time.TimeOnly, timestamp.Location())

	n := time.Now().In(timestamp.Location())

	// If format is missing date (or year only), set it explicitly to current
	if timestamp.Truncate(time.Hour*24).UnixNano() == defaultTS.Truncate(time.Hour*24).UnixNano() {
		timestamp = time.Date(
			n.Year(),
			n.Month(),
			n.Day(),
			timestamp.Hour(),
			timestamp.Minute(),
			timestamp.Second(),
			timestamp.Nanosecond(),
			timestamp.Location(),
		)
	} else if timestamp.Year() == 0 {
		timestamp = time.Date(
			n.Year(),
			timestamp.Month(),
			timestamp.Day(),
			timestamp.Hour(),
			timestamp.Minute(),
			timestamp.Second(),
			timestamp.Nanosecond(),
			timestamp.Location(),
		)
	}

	if t.timestamp != nil {
		*t.timestamp = timestamp
	}
	t.hasBeenSet = true
	return nil
}

// String returns a readable representation of this value (for usage defaults)
func (t *timestampValue) String() string {
	return fmt.Sprintf("%#v", t.timestamp)
}

// Get returns the flag structure
func (t *timestampValue) Get() any {
	return *t.timestamp
}

// Timestamp gets the timestamp from a flag name
func (cmd *Command) Timestamp(name string) time.Time {
	if v, ok := cmd.Value(name).(time.Time); ok {
		tracef("time.Time available for flag name %[1]q with value=%[2]v (cmd=%[3]q)", name, v, cmd.Name)
		return v
	}

	tracef("time.Time NOT available for flag name %[1]q (cmd=%[2]q)", name, cmd.Name)
	return time.Time{}
}
