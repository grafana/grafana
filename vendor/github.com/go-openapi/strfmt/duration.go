// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package strfmt

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func init() {
	d := Duration(0)
	// register this format in the default registry
	Default.Add("duration", &d, IsDuration)
}

const (
	hoursInDay = 24
	daysInWeek = 7
)

var (
	timeUnits = [][]string{
		{"ns", "nano"},
		{"us", "µs", "micro"},
		{"ms", "milli"},
		{"s", "sec"},
		{"m", "min"},
		{"h", "hr", "hour"},
		{"d", "day"},
		{"w", "wk", "week"},
	}

	timeMultiplier = map[string]time.Duration{
		"ns": time.Nanosecond,
		"us": time.Microsecond,
		"ms": time.Millisecond,
		"s":  time.Second,
		"m":  time.Minute,
		"h":  time.Hour,
		"d":  hoursInDay * time.Hour,
		"w":  hoursInDay * daysInWeek * time.Hour,
	}

	durationMatcher = regexp.MustCompile(`^(((?:-\s?)?\d+)(\.\d+)?\s*([A-Za-zµ]+))`)
)

// IsDuration returns true if the provided string is a valid duration
func IsDuration(str string) bool {
	_, err := ParseDuration(str)
	return err == nil
}

// Duration represents a duration
//
// Duration stores a period of time as a nanosecond count, with the largest
// repesentable duration being approximately 290 years.
//
// swagger:strfmt duration
type Duration time.Duration

// MarshalText turns this instance into text
func (d Duration) MarshalText() ([]byte, error) {
	return []byte(time.Duration(d).String()), nil
}

// UnmarshalText hydrates this instance from text
func (d *Duration) UnmarshalText(data []byte) error { // validation is performed later on
	dd, err := ParseDuration(string(data))
	if err != nil {
		return err
	}
	*d = Duration(dd)
	return nil
}

// ParseDuration parses a duration from a string, compatible with scala duration syntax
func ParseDuration(cand string) (time.Duration, error) {
	if dur, err := time.ParseDuration(cand); err == nil {
		return dur, nil
	}

	var dur time.Duration
	ok := false
	const expectGroups = 4
	for _, match := range durationMatcher.FindAllStringSubmatch(cand, -1) {
		if len(match) < expectGroups {
			continue
		}

		// remove possible leading - and spaces
		value, negative := strings.CutPrefix(match[2], "-")

		// if the duration contains a decimal separator determine a divising factor
		const neutral = 1.0
		divisor := neutral
		decimal, hasDecimal := strings.CutPrefix(match[3], ".")
		if hasDecimal {
			divisor = math.Pow10(len(decimal))
			value += decimal // consider the value as an integer: will change units later on
		}

		// if the string is a valid duration, parse it
		factor, err := strconv.Atoi(strings.TrimSpace(value)) // converts string to int
		if err != nil {
			return 0, err
		}

		if negative {
			factor = -factor
		}

		unit := strings.ToLower(strings.TrimSpace(match[4]))

		for _, variants := range timeUnits {
			last := len(variants) - 1
			multiplier := timeMultiplier[variants[0]]

			for i, variant := range variants {
				if (last == i && strings.HasPrefix(unit, variant)) || strings.EqualFold(variant, unit) {
					ok = true
					if divisor != neutral {
						multiplier = time.Duration(float64(multiplier) / divisor) // convert to duration only after having reduced the scale
					}
					dur += (time.Duration(factor) * multiplier)
				}
			}
		}
	}

	if ok {
		return dur, nil
	}
	return 0, fmt.Errorf("unable to parse %s as duration: %w", cand, ErrFormat)
}

// Scan reads a Duration value from database driver type.
func (d *Duration) Scan(raw any) error {
	switch v := raw.(type) {
	// TODO: case []byte: // ?
	case int64:
		*d = Duration(v)
	case float64:
		*d = Duration(int64(v))
	case nil:
		*d = Duration(0)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.Duration from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts Duration to a primitive value ready to be written to a database.
func (d Duration) Value() (driver.Value, error) {
	return driver.Value(int64(d)), nil
}

// String converts this duration to a string
func (d Duration) String() string {
	return time.Duration(d).String()
}

// MarshalJSON returns the Duration as JSON
func (d Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Duration(d).String())
}

// UnmarshalJSON sets the Duration from JSON
func (d *Duration) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}

	var dstr string
	if err := json.Unmarshal(data, &dstr); err != nil {
		return err
	}
	tt, err := ParseDuration(dstr)
	if err != nil {
		return err
	}
	*d = Duration(tt)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (d *Duration) DeepCopyInto(out *Duration) {
	*out = *d
}

// DeepCopy copies the receiver into a new Duration.
func (d *Duration) DeepCopy() *Duration {
	if d == nil {
		return nil
	}
	out := new(Duration)
	d.DeepCopyInto(out)
	return out
}
