// Copyright 2019 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package time

import (
	"time"
)

// Common durations. There is no definition for units of Day or larger
// to avoid confusion across daylight savings time zone transitions.
//
// To count the number of units in a Duration, divide:
//
//	second := time.Second
//	fmt.Print(int64(second/time.Millisecond)) // prints 1000
//
// To convert an integer number of units to a Duration, multiply:
//
//	seconds := 10
//	fmt.Print(time.Duration(seconds)*time.Second) // prints 10s
const (
	Nanosecond  = 1
	Microsecond = 1000
	Millisecond = 1000000
	Second      = 1000000000
	Minute      = 60000000000
	Hour        = 3600000000000
)

// Duration validates a duration string.
//
// Note: this format also accepts strings of the form '1h3m', '2ms', etc.
// To limit this to seconds only, as often used in JSON, add the !~"hmuµn"
// constraint.
func Duration(s string) (bool, error) {
	if _, err := time.ParseDuration(s); err != nil {
		return false, err
	}
	return true, nil
}

// FormatDuration converts nanoseconds to a string representing the duration in
// the form "72h3m0.5s".
//
// Leading zero units are omitted. As a special case, durations less than
// one second use a smaller unit (milli-, micro-, or nanoseconds) to ensure
// that the leading digit is non-zero. The zero duration formats as 0s.
func FormatDuration(d int64) string {
	return time.Duration(d).String()
}

// ParseDuration reports the nanoseconds represented by a duration string.
//
// A duration string is a possibly signed sequence of
// decimal numbers, each with optional fraction and a unit suffix,
// such as "300ms", "-1.5h" or "2h45m".
// Valid time units are "ns", "us" (or "µs"), "ms", "s", "m", "h".
func ParseDuration(s string) (int64, error) {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0, err
	}
	return int64(d), nil
}
