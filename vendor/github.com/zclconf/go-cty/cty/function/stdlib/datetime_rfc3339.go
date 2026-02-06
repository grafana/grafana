package stdlib

import (
	"errors"
	"strconv"
	"time"
)

// This file inlines some RFC3339 parsing code that was added to the Go standard
// library's "time" package during the Go 1.20 development period but then
// reverted prior to release to follow the Go proposals process first.
//
// Our goal is to support only valid RFC3339 strings regardless of what version
// of Go is being used, because the Go stdlib is just an implementation detail
// of the cty stdlib and so these functions should not very their behavior
// significantly due to being compiled against a different Go version.
//
// These inline copies of the code from upstream should likely stay here
// indefinitely even if functionality like this _is_ accepted in a later version
// of Go, because this now defines cty's definition of RFC3339 parsing as
// intentionally independent of Go's.

func parseStrictRFC3339(str string) (time.Time, error) {
	t, ok := parseRFC3339(str)
	if !ok {
		// If parsing failed then we'll try to use time.Parse to gather up a
		// helpful error object.
		_, err := time.Parse(time.RFC3339, str)
		if err != nil {
			return time.Time{}, err
		}

		// The parse template syntax cannot correctly validate RFC 3339.
		// Explicitly check for cases that Parse is unable to validate for.
		// See https://go.dev/issue/54580.
		num2 := func(str string) byte { return 10*(str[0]-'0') + (str[1] - '0') }
		switch {
		case str[len("2006-01-02T")+1] == ':': // hour must be two digits
			return time.Time{}, &time.ParseError{
				Layout:     time.RFC3339,
				Value:      str,
				LayoutElem: "15",
				ValueElem:  str[len("2006-01-02T"):][:1],
				Message:    ": hour must have two digits",
			}
		case str[len("2006-01-02T15:04:05")] == ',': // sub-second separator must be a period
			return time.Time{}, &time.ParseError{
				Layout:     time.RFC3339,
				Value:      str,
				LayoutElem: ".",
				ValueElem:  ",",
				Message:    ": sub-second separator must be a period",
			}
		case str[len(str)-1] != 'Z':
			switch {
			case num2(str[len(str)-len("07:00"):]) >= 24: // timezone hour must be in range
				return time.Time{}, &time.ParseError{
					Layout:     time.RFC3339,
					Value:      str,
					LayoutElem: "Z07:00",
					ValueElem:  str[len(str)-len("Z07:00"):],
					Message:    ": timezone hour out of range",
				}
			case num2(str[len(str)-len("00"):]) >= 60: // timezone minute must be in range
				return time.Time{}, &time.ParseError{
					Layout:     time.RFC3339,
					Value:      str,
					LayoutElem: "Z07:00",
					ValueElem:  str[len(str)-len("Z07:00"):],
					Message:    ": timezone minute out of range",
				}
			}
		default: // unknown error; should not occur
			return time.Time{}, &time.ParseError{
				Layout:     time.RFC3339,
				Value:      str,
				LayoutElem: time.RFC3339,
				ValueElem:  str,
				Message:    "",
			}
		}
	}
	return t, nil
}

func parseRFC3339(s string) (time.Time, bool) {
	// parseUint parses s as an unsigned decimal integer and
	// verifies that it is within some range.
	// If it is invalid or out-of-range,
	// it sets ok to false and returns the min value.
	ok := true
	parseUint := func(s string, min, max int) (x int) {
		for _, c := range []byte(s) {
			if c < '0' || '9' < c {
				ok = false
				return min
			}
			x = x*10 + int(c) - '0'
		}
		if x < min || max < x {
			ok = false
			return min
		}
		return x
	}

	// Parse the date and time.
	if len(s) < len("2006-01-02T15:04:05") {
		return time.Time{}, false
	}
	year := parseUint(s[0:4], 0, 9999)                            // e.g., 2006
	month := parseUint(s[5:7], 1, 12)                             // e.g., 01
	day := parseUint(s[8:10], 1, daysIn(time.Month(month), year)) // e.g., 02
	hour := parseUint(s[11:13], 0, 23)                            // e.g., 15
	min := parseUint(s[14:16], 0, 59)                             // e.g., 04
	sec := parseUint(s[17:19], 0, 59)                             // e.g., 05
	if !ok || !(s[4] == '-' && s[7] == '-' && s[10] == 'T' && s[13] == ':' && s[16] == ':') {
		return time.Time{}, false
	}
	s = s[19:]

	// Parse the fractional second.
	var nsec int
	if len(s) >= 2 && s[0] == '.' && isDigit(s, 1) {
		n := 2
		for ; n < len(s) && isDigit(s, n); n++ {
		}
		nsec, _, _ = parseNanoseconds(s, n)
		s = s[n:]
	}

	// Parse the time zone.
	loc := time.UTC
	if len(s) != 1 || s[0] != 'Z' {
		if len(s) != len("-07:00") {
			return time.Time{}, false
		}
		hr := parseUint(s[1:3], 0, 23) // e.g., 07
		mm := parseUint(s[4:6], 0, 59) // e.g., 00
		if !ok || !((s[0] == '-' || s[0] == '+') && s[3] == ':') {
			return time.Time{}, false
		}
		zoneOffsetSecs := (hr*60 + mm) * 60
		if s[0] == '-' {
			zoneOffsetSecs = -zoneOffsetSecs
		}
		loc = time.FixedZone("", zoneOffsetSecs)
	}
	t := time.Date(year, time.Month(month), day, hour, min, sec, nsec, loc)

	return t, true
}

func isDigit(s string, i int) bool {
	if len(s) <= i {
		return false
	}
	c := s[i]
	return '0' <= c && c <= '9'
}

func parseNanoseconds(value string, nbytes int) (ns int, rangeErrString string, err error) {
	if value[0] != '.' && value[0] != ',' {
		err = errBadTimestamp
		return
	}
	if nbytes > 10 {
		value = value[:10]
		nbytes = 10
	}
	if ns, err = strconv.Atoi(value[1:nbytes]); err != nil {
		return
	}
	if ns < 0 {
		rangeErrString = "fractional second"
		return
	}
	// We need nanoseconds, which means scaling by the number
	// of missing digits in the format, maximum length 10.
	scaleDigits := 10 - nbytes
	for i := 0; i < scaleDigits; i++ {
		ns *= 10
	}
	return
}

// These are internal errors used by the date parsing code and are not ever
// returned by public functions.
var errBadTimestamp = errors.New("bad value for field")

// daysBefore[m] counts the number of days in a non-leap year
// before month m begins. There is an entry for m=12, counting
// the number of days before January of next year (365).
var daysBefore = [...]int32{
	0,
	31,
	31 + 28,
	31 + 28 + 31,
	31 + 28 + 31 + 30,
	31 + 28 + 31 + 30 + 31,
	31 + 28 + 31 + 30 + 31 + 30,
	31 + 28 + 31 + 30 + 31 + 30 + 31,
	31 + 28 + 31 + 30 + 31 + 30 + 31 + 31,
	31 + 28 + 31 + 30 + 31 + 30 + 31 + 31 + 30,
	31 + 28 + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 31,
	31 + 28 + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 31 + 30,
	31 + 28 + 31 + 30 + 31 + 30 + 31 + 31 + 30 + 31 + 30 + 31,
}

func daysIn(m time.Month, year int) int {
	if m == time.February && isLeap(year) {
		return 29
	}
	return int(daysBefore[m] - daysBefore[m-1])
}

func isLeap(year int) bool {
	return year%4 == 0 && (year%100 != 0 || year%400 == 0)
}
