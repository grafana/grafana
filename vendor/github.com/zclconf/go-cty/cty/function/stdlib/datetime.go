package stdlib

import (
	"bufio"
	"bytes"
	"fmt"
	"strings"
	"time"

	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function"
)

var FormatDateFunc = function.New(&function.Spec{
	Description: `Formats a timestamp given in RFC 3339 syntax into another timestamp in some other machine-oriented time syntax, as described in the format string.`,
	Params: []function.Parameter{
		{
			Name: "format",
			Type: cty.String,
		},
		{
			Name: "time",
			Type: cty.String,
		},
	},
	Type:         function.StaticReturnType(cty.String),
	RefineResult: refineNonNull,
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		formatStr := args[0].AsString()
		timeStr := args[1].AsString()
		t, err := parseTimestamp(timeStr)
		if err != nil {
			return cty.DynamicVal, function.NewArgError(1, err)
		}

		var buf bytes.Buffer
		sc := bufio.NewScanner(strings.NewReader(formatStr))
		sc.Split(splitDateFormat)
		const esc = '\''
		for sc.Scan() {
			tok := sc.Bytes()

			// The leading byte signals the token type
			switch {
			case tok[0] == esc:
				if tok[len(tok)-1] != esc || len(tok) == 1 {
					return cty.DynamicVal, function.NewArgErrorf(0, "unterminated literal '")
				}
				if len(tok) == 2 {
					// Must be a single escaped quote, ''
					buf.WriteByte(esc)
				} else {
					// The content (until a closing esc) is printed out verbatim
					// except that we must un-double any double-esc escapes in
					// the middle of the string.
					raw := tok[1 : len(tok)-1]
					for i := 0; i < len(raw); i++ {
						buf.WriteByte(raw[i])
						if raw[i] == esc {
							i++ // skip the escaped quote
						}
					}
				}

			case startsDateFormatVerb(tok[0]):
				switch tok[0] {
				case 'Y':
					y := t.Year()
					switch len(tok) {
					case 2:
						fmt.Fprintf(&buf, "%02d", y%100)
					case 4:
						fmt.Fprintf(&buf, "%04d", y)
					default:
						return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q: year must either be \"YY\" or \"YYYY\"", tok)
					}
				case 'M':
					m := t.Month()
					switch len(tok) {
					case 1:
						fmt.Fprintf(&buf, "%d", m)
					case 2:
						fmt.Fprintf(&buf, "%02d", m)
					case 3:
						buf.WriteString(m.String()[:3])
					case 4:
						buf.WriteString(m.String())
					default:
						return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q: month must be \"M\", \"MM\", \"MMM\", or \"MMMM\"", tok)
					}
				case 'D':
					d := t.Day()
					switch len(tok) {
					case 1:
						fmt.Fprintf(&buf, "%d", d)
					case 2:
						fmt.Fprintf(&buf, "%02d", d)
					default:
						return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q: day of month must either be \"D\" or \"DD\"", tok)
					}
				case 'E':
					d := t.Weekday()
					switch len(tok) {
					case 3:
						buf.WriteString(d.String()[:3])
					case 4:
						buf.WriteString(d.String())
					default:
						return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q: day of week must either be \"EEE\" or \"EEEE\"", tok)
					}
				case 'h':
					h := t.Hour()
					switch len(tok) {
					case 1:
						fmt.Fprintf(&buf, "%d", h)
					case 2:
						fmt.Fprintf(&buf, "%02d", h)
					default:
						return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q: 24-hour must either be \"h\" or \"hh\"", tok)
					}
				case 'H':
					h := t.Hour() % 12
					if h == 0 {
						h = 12
					}
					switch len(tok) {
					case 1:
						fmt.Fprintf(&buf, "%d", h)
					case 2:
						fmt.Fprintf(&buf, "%02d", h)
					default:
						return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q: 12-hour must either be \"H\" or \"HH\"", tok)
					}
				case 'A', 'a':
					if len(tok) != 2 {
						return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q: must be \"%s%s\"", tok, tok[0:1], tok[0:1])
					}
					upper := tok[0] == 'A'
					switch t.Hour() / 12 {
					case 0:
						if upper {
							buf.WriteString("AM")
						} else {
							buf.WriteString("am")
						}
					case 1:
						if upper {
							buf.WriteString("PM")
						} else {
							buf.WriteString("pm")
						}
					}
				case 'm':
					m := t.Minute()
					switch len(tok) {
					case 1:
						fmt.Fprintf(&buf, "%d", m)
					case 2:
						fmt.Fprintf(&buf, "%02d", m)
					default:
						return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q: minute must either be \"m\" or \"mm\"", tok)
					}
				case 's':
					s := t.Second()
					switch len(tok) {
					case 1:
						fmt.Fprintf(&buf, "%d", s)
					case 2:
						fmt.Fprintf(&buf, "%02d", s)
					default:
						return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q: second must either be \"s\" or \"ss\"", tok)
					}
				case 'Z':
					// We'll just lean on Go's own formatter for this one, since
					// the necessary information is unexported.
					switch len(tok) {
					case 1:
						buf.WriteString(t.Format("Z07:00"))
					case 3:
						str := t.Format("-0700")
						switch str {
						case "+0000":
							buf.WriteString("UTC")
						default:
							buf.WriteString(str)
						}
					case 4:
						buf.WriteString(t.Format("-0700"))
					case 5:
						buf.WriteString(t.Format("-07:00"))
					default:
						return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q: timezone must be Z, ZZZZ, or ZZZZZ", tok)
					}
				default:
					return cty.DynamicVal, function.NewArgErrorf(0, "invalid date format verb %q", tok)
				}

			default:
				// Any other starting character indicates a literal sequence
				buf.Write(tok)
			}
		}

		return cty.StringVal(buf.String()), nil
	},
})

// TimeAddFunc is a function that adds a duration to a timestamp, returning a new timestamp.
var TimeAddFunc = function.New(&function.Spec{
	Description: `Adds the duration represented by the given duration string to the given RFC 3339 timestamp string, returning another RFC 3339 timestamp.`,
	Params: []function.Parameter{
		{
			Name: "timestamp",
			Type: cty.String,
		},
		{
			Name: "duration",
			Type: cty.String,
		},
	},
	Type: function.StaticReturnType(cty.String),
	Impl: func(args []cty.Value, retType cty.Type) (cty.Value, error) {
		ts, err := parseTimestamp(args[0].AsString())
		if err != nil {
			return cty.UnknownVal(cty.String), err
		}
		duration, err := time.ParseDuration(args[1].AsString())
		if err != nil {
			return cty.UnknownVal(cty.String), err
		}

		return cty.StringVal(ts.Add(duration).Format(time.RFC3339)), nil
	},
})

// FormatDate reformats a timestamp given in RFC3339 syntax into another time
// syntax defined by a given format string.
//
// The format string uses letter mnemonics to represent portions of the
// timestamp, with repetition signifying length variants of each portion.
// Single quote characters ' can be used to quote sequences of literal letters
// that should not be interpreted as formatting mnemonics.
//
// The full set of supported mnemonic sequences is listed below:
//
//     YY       Year modulo 100 zero-padded to two digits, like "06".
//     YYYY     Four (or more) digit year, like "2006".
//     M        Month number, like "1" for January.
//     MM       Month number zero-padded to two digits, like "01".
//     MMM      English month name abbreviated to three letters, like "Jan".
//     MMMM     English month name unabbreviated, like "January".
//     D        Day of month number, like "2".
//     DD       Day of month number zero-padded to two digits, like "02".
//     EEE      English day of week name abbreviated to three letters, like "Mon".
//     EEEE     English day of week name unabbreviated, like "Monday".
//     h        24-hour number, like "2".
//     hh       24-hour number zero-padded to two digits, like "02".
//     H        12-hour number, like "2".
//     HH       12-hour number zero-padded to two digits, like "02".
//     AA       Hour AM/PM marker in uppercase, like "AM".
//     aa       Hour AM/PM marker in lowercase, like "am".
//     m        Minute within hour, like "5".
//     mm       Minute within hour zero-padded to two digits, like "05".
//     s        Second within minute, like "9".
//     ss       Second within minute zero-padded to two digits, like "09".
//     ZZZZ     Timezone offset with just sign and digit, like "-0800".
//     ZZZZZ    Timezone offset with colon separating hours and minutes, like "-08:00".
//     Z        Like ZZZZZ but with a special case "Z" for UTC.
//     ZZZ      Like ZZZZ but with a special case "UTC" for UTC.
//
// The format syntax is optimized mainly for generating machine-oriented
// timestamps rather than human-oriented timestamps; the English language
// portions of the output reflect the use of English names in a number of
// machine-readable date formatting standards. For presentation to humans,
// a locale-aware time formatter (not included in this package) is a better
// choice.
//
// The format syntax is not compatible with that of any other language, but
// is optimized so that patterns for common standard date formats can be
// recognized quickly even by a reader unfamiliar with the format syntax.
func FormatDate(format cty.Value, timestamp cty.Value) (cty.Value, error) {
	return FormatDateFunc.Call([]cty.Value{format, timestamp})
}

// splitDataFormat is a bufio.SplitFunc used to tokenize a date format.
func splitDateFormat(data []byte, atEOF bool) (advance int, token []byte, err error) {
	if len(data) == 0 {
		return 0, nil, nil
	}

	const esc = '\''

	switch {

	case data[0] == esc:
		// If we have another quote immediately after then this is a single
		// escaped escape.
		if len(data) > 1 && data[1] == esc {
			return 2, data[:2], nil
		}

		// Beginning of quoted sequence, so we will seek forward until we find
		// the closing quote, ignoring escaped quotes along the way.
		for i := 1; i < len(data); i++ {
			if data[i] == esc {
				if (i + 1) == len(data) {
					if atEOF {
						// We have a closing quote and are at the end of our input
						return len(data), data, nil
					} else {
						// We need at least one more byte to decide if this is an
						// escape or a terminator.
						return 0, nil, nil
					}
				}
				if data[i+1] == esc {
					i++ // doubled-up quotes are an escape sequence
					continue
				}
				// We've found the closing quote
				return i + 1, data[:i+1], nil
			}
		}
		// If we fall out here then we need more bytes to find the end,
		// unless we're already at the end with an unclosed quote.
		if atEOF {
			return len(data), data, nil
		}
		return 0, nil, nil

	case startsDateFormatVerb(data[0]):
		rep := data[0]
		for i := 1; i < len(data); i++ {
			if data[i] != rep {
				return i, data[:i], nil
			}
		}
		if atEOF {
			return len(data), data, nil
		}
		// We need more data to decide if we've found the end
		return 0, nil, nil

	default:
		for i := 1; i < len(data); i++ {
			if data[i] == esc || startsDateFormatVerb(data[i]) {
				return i, data[:i], nil
			}
		}
		// We might not actually be at the end of a literal sequence,
		// but that doesn't matter since we'll concat them back together
		// anyway.
		return len(data), data, nil
	}
}

func startsDateFormatVerb(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
}

func parseTimestamp(ts string) (time.Time, error) {
	t, err := parseStrictRFC3339(ts)
	if err != nil {
		switch err := err.(type) {
		case *time.ParseError:
			// If err is s time.ParseError then its string representation is not
			// appropriate since it relies on details of Go's strange date format
			// representation, which a caller of our functions is not expected
			// to be familiar with.
			//
			// Therefore we do some light transformation to get a more suitable
			// error that should make more sense to our callers. These are
			// still not awesome error messages, but at least they refer to
			// the timestamp portions by name rather than by Go's example
			// values.
			if err.LayoutElem == "" && err.ValueElem == "" && err.Message != "" {
				// For some reason err.Message is populated with a ": " prefix
				// by the time package.
				return time.Time{}, fmt.Errorf("not a valid RFC3339 timestamp%s", err.Message)
			}
			var what string
			switch err.LayoutElem {
			case "2006":
				what = "year"
			case "01":
				what = "month"
			case "02":
				what = "day of month"
			case "15":
				what = "hour"
			case "04":
				what = "minute"
			case "05":
				what = "second"
			case "Z07:00":
				what = "UTC offset"
			case "T":
				return time.Time{}, fmt.Errorf("not a valid RFC3339 timestamp: missing required time introducer 'T'")
			case ":", "-":
				if err.ValueElem == "" {
					return time.Time{}, fmt.Errorf("not a valid RFC3339 timestamp: end of string where %q is expected", err.LayoutElem)
				} else {
					return time.Time{}, fmt.Errorf("not a valid RFC3339 timestamp: found %q where %q is expected", err.ValueElem, err.LayoutElem)
				}
			default:
				// Should never get here, because RFC3339 includes only the
				// above portions.
				what = "timestamp segment"
			}
			if err.ValueElem == "" {
				return time.Time{}, fmt.Errorf("not a valid RFC3339 timestamp: end of string before %s", what)
			} else {
				switch {
				case what == "hour" && strings.Contains(err.ValueElem, ":"):
					return time.Time{}, fmt.Errorf("not a valid RFC3339 timestamp: hour must be between 0 and 23 inclusive")
				case what == "hour" && len(err.ValueElem) != 2:
					return time.Time{}, fmt.Errorf("not a valid RFC3339 timestamp: hour must have exactly two digits")
				case what == "minute" && len(err.ValueElem) != 2:
					return time.Time{}, fmt.Errorf("not a valid RFC3339 timestamp: minute must have exactly two digits")
				default:
					return time.Time{}, fmt.Errorf("not a valid RFC3339 timestamp: cannot use %q as %s", err.ValueElem, what)
				}
			}
		}
		return time.Time{}, err
	}
	return t, nil
}

// TimeAdd adds a duration to a timestamp, returning a new timestamp.
//
// In the HCL language, timestamps are conventionally represented as
// strings using RFC 3339 "Date and Time format" syntax. Timeadd requires
// the timestamp argument to be a string conforming to this syntax.
//
// `duration` is a string representation of a time difference, consisting of
// sequences of number and unit pairs, like `"1.5h"` or `1h30m`. The accepted
// units are `ns`, `us` (or `µs`), `"ms"`, `"s"`, `"m"`, and `"h"`. The first
// number may be negative to indicate a negative duration, like `"-2h5m"`.
//
// The result is a string, also in RFC 3339 format, representing the result
// of adding the given direction to the given timestamp.
func TimeAdd(timestamp cty.Value, duration cty.Value) (cty.Value, error) {
	return TimeAddFunc.Call([]cty.Value{timestamp, duration})
}
