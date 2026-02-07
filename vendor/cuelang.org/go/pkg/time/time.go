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

// Package time defines time-related types.
//
// In CUE time values are represented as a string of the format
// time.RFC3339Nano.
package time

import (
	"fmt"
	"time"
)

// These are predefined layouts for use in Time.Format and time.Parse.
// The reference time used in the layouts is the specific time:
//
//	Mon Jan 2 15:04:05 MST 2006
//
// which is Unix time 1136239445. Since MST is GMT-0700,
// the reference time can be thought of as
//
//	01/02 03:04:05PM '06 -0700
//
// To define your own format, write down what the reference time would look
// like formatted your way; see the values of constants like ANSIC,
// StampMicro or Kitchen for examples. The model is to demonstrate what the
// reference time looks like so that the Format and Parse methods can apply
// the same transformation to a general time value.
//
// Some valid layouts are invalid time values for time.Parse, due to formats
// such as _ for space padding and Z for zone information.
//
// Within the format string, an underscore _ represents a space that may be
// replaced by a digit if the following number (a day) has two digits; for
// compatibility with fixed-width Unix time formats.
//
// A decimal point followed by one or more zeros represents a fractional
// second, printed to the given number of decimal places. A decimal point
// followed by one or more nines represents a fractional second, printed to
// the given number of decimal places, with trailing zeros removed.
// When parsing (only), the input may contain a fractional second
// field immediately after the seconds field, even if the layout does not
// signify its presence. In that case a decimal point followed by a maximal
// series of digits is parsed as a fractional second.
//
// Numeric time zone offsets format as follows:
//
//	-0700  ±hhmm
//	-07:00 ±hh:mm
//	-07    ±hh
//
// Replacing the sign in the format with a Z triggers
// the ISO 8601 behavior of printing Z instead of an
// offset for the UTC zone. Thus:
//
//	Z0700  Z or ±hhmm
//	Z07:00 Z or ±hh:mm
//	Z07    Z or ±hh
//
// The recognized day of week formats are "Mon" and "Monday".
// The recognized month formats are "Jan" and "January".
//
// Text in the format string that is not recognized as part of the reference
// time is echoed verbatim during Format and expected to appear verbatim
// in the input to Parse.
//
// The executable example for Time.Format demonstrates the working
// of the layout string in detail and is a good reference.
//
// Note that the RFC822, RFC850, and RFC1123 formats should be applied
// only to local times. Applying them to UTC times will use "UTC" as the
// time zone abbreviation, while strictly speaking those RFCs require the
// use of "GMT" in that case.
// In general RFC1123Z should be used instead of RFC1123 for servers
// that insist on that format, and RFC3339 should be preferred for new protocols.
// RFC3339, RFC822, RFC822Z, RFC1123, and RFC1123Z are useful for formatting;
// when used with time.Parse they do not accept all the time formats
// permitted by the RFCs.
// The RFC3339Nano format removes trailing zeros from the seconds field
// and thus may not sort correctly once formatted.
const (
	ANSIC       = "Mon Jan _2 15:04:05 2006"
	UnixDate    = "Mon Jan _2 15:04:05 MST 2006"
	RubyDate    = "Mon Jan 02 15:04:05 -0700 2006"
	RFC822      = "02 Jan 06 15:04 MST"
	RFC822Z     = "02 Jan 06 15:04 -0700" // RFC822 with numeric zone
	RFC850      = "Monday, 02-Jan-06 15:04:05 MST"
	RFC1123     = "Mon, 02 Jan 2006 15:04:05 MST"
	RFC1123Z    = "Mon, 02 Jan 2006 15:04:05 -0700" // RFC1123 with numeric zone
	RFC3339     = "2006-01-02T15:04:05Z07:00"
	RFC3339Nano = "2006-01-02T15:04:05.999999999Z07:00"
	RFC3339Date = "2006-01-02"
	Kitchen     = "3:04PM"
	Kitchen24   = "15:04"
)

const (
	January   = 1
	February  = 2
	March     = 3
	April     = 4
	May       = 5
	June      = 6
	July      = 7
	August    = 8
	September = 9
	October   = 10
	November  = 11
	December  = 12
)

const (
	Sunday    = 0
	Monday    = 1
	Tuesday   = 2
	Wednesday = 3
	Thursday  = 4
	Friday    = 5
	Saturday  = 6
)

// Time validates a RFC3339 date-time.
//
// Caveat: this implementation uses the Go implementation, which does not
// accept leap seconds.
func Time(s string) (bool, error) {
	return timeFormat(s, time.RFC3339Nano)
}

func timeFormat(value, layout string) (bool, error) {
	_, err := time.ParseInLocation(layout, value, time.UTC)
	if err != nil {
		// Use our own error, the time package's error as the Go error is too
		// confusing within this context.
		return false, fmt.Errorf("invalid time %q", value)
	}
	return true, nil
}

// Format defines a type string that must adhere to a certain layout.
//
// See Parse for a description on layout strings.
func Format(value, layout string) (bool, error) {
	return timeFormat(value, layout)
}

// FormatString returns a textual representation of the time value.
// The formatted value is formatted according to the layout defined by the
// argument. See Parse for more information on the layout string.
func FormatString(layout, value string) (string, error) {
	t, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return "", err
	}
	return t.Format(layout), nil
}

// Parse parses a formatted string and returns the time value it represents.
// The layout defines the format by showing how the reference time,
// defined to be
//
//	Mon Jan 2 15:04:05 -0700 MST 2006
//
// would be interpreted if it were the value; it serves as an example of
// the input format. The same interpretation will then be made to the
// input string.
//
// Predefined layouts ANSIC, UnixDate, RFC3339 and others describe standard
// and convenient representations of the reference time. For more information
// about the formats and the definition of the reference time, see the
// documentation for ANSIC and the other constants defined by this package.
// Also, the executable example for Time.Format demonstrates the working
// of the layout string in detail and is a good reference.
//
// Elements omitted from the value are assumed to be zero or, when
// zero is impossible, one, so parsing "3:04pm" returns the time
// corresponding to Jan 1, year 0, 15:04:00 UTC (note that because the year is
// 0, this time is before the zero Time).
// Years must be in the range 0000..9999. The day of the week is checked
// for syntax but it is otherwise ignored.
//
// In the absence of a time zone indicator, Parse returns a time in UTC.
//
// When parsing a time with a zone offset like -0700, if the offset corresponds
// to a time zone used by the current location (Local), then Parse uses that
// location and zone in the returned time. Otherwise it records the time as
// being in a fabricated location with time fixed at the given zone offset.
//
// Parse currently does not support zone abbreviations like MST. All are
// interpreted as UTC.
func Parse(layout, value string) (string, error) {
	// TODO: should we support locations? The result will be non-hermetic.
	// See comments on github.com/cue-lang/cue/issues/1522.
	t, err := time.ParseInLocation(layout, value, time.UTC)
	if err != nil {
		return "", err
	}
	return t.UTC().Format(time.RFC3339Nano), nil
}

// Unix returns the Time, in UTC, corresponding to the given Unix time,
// sec seconds and nsec nanoseconds since January 1, 1970 UTC.
// It is valid to pass nsec outside the range [0, 999999999].
// Not all sec values have a corresponding time value. One such
// value is 1<<63-1 (the largest int64 value).
func Unix(sec int64, nsec int64) string {
	t := time.Unix(sec, nsec)
	return t.UTC().Format(time.RFC3339Nano)
}

// Parts holds individual parts of a parsed time stamp.
type Parts struct {
	Year   int `json:"year"`
	Month  int `json:"month"`
	Day    int `json:"day"`
	Hour   int `json:"hour"`
	Minute int `json:"minute"`

	// Second is equal to div(Nanosecond, 1_000_000_000)
	Second     int `json:"second"`
	Nanosecond int `json:"nanosecond"`
}

// Split parses a time string into its individual parts.
func Split(t string) (*Parts, error) {
	st, err := time.Parse(time.RFC3339Nano, t)
	if err != nil {
		return nil, err
	}
	year, month, day := st.Date()
	return &Parts{
		Year:   year,
		Month:  int(month),
		Day:    day,
		Hour:   st.Hour(),
		Minute: st.Minute(),

		Second:     st.Second(),
		Nanosecond: st.Nanosecond(),
	}, nil
}
