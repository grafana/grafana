package duration

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// Duration holds all the smaller units that make up the duration
type Duration struct {
	Years    float64
	Months   float64
	Weeks    float64
	Days     float64
	Hours    float64
	Minutes  float64
	Seconds  float64
	Negative bool
}

const (
	parsingPeriod = iota
	parsingTime

	hoursPerDay   = 24
	hoursPerWeek  = hoursPerDay * 7
	hoursPerMonth = hoursPerYear / 12
	hoursPerYear  = hoursPerDay * 365

	nsPerSecond = 1000000000
	nsPerMinute = nsPerSecond * 60
	nsPerHour   = nsPerMinute * 60
	nsPerDay    = nsPerHour * hoursPerDay
	nsPerWeek   = nsPerHour * hoursPerWeek
	nsPerMonth  = nsPerHour * hoursPerMonth
	nsPerYear   = nsPerHour * hoursPerYear
)

var (
	// ErrUnexpectedInput is returned when an input in the duration string does not match expectations
	ErrUnexpectedInput = errors.New("unexpected input")
)

// Parse attempts to parse the given duration string into a *Duration,
// if parsing fails an error is returned instead.
func Parse(d string) (*Duration, error) {
	state := parsingPeriod
	duration := &Duration{}
	num := ""
	var err error

	switch {
	case strings.HasPrefix(d, "P"): // standard duration
	case strings.HasPrefix(d, "-P"): // negative duration
		duration.Negative = true
		d = strings.TrimPrefix(d, "-") // remove the negative sign
	default:
		return nil, ErrUnexpectedInput
	}

	for _, char := range d {
		switch char {
		case 'P':
			if state != parsingPeriod {
				return nil, ErrUnexpectedInput
			}
		case 'T':
			state = parsingTime
		case 'Y':
			if state != parsingPeriod {
				return nil, ErrUnexpectedInput
			}

			duration.Years, err = strconv.ParseFloat(num, 64)
			if err != nil {
				return nil, err
			}
			num = ""
		case 'M':
			if state == parsingPeriod {
				duration.Months, err = strconv.ParseFloat(num, 64)
				if err != nil {
					return nil, err
				}
				num = ""
			} else if state == parsingTime {
				duration.Minutes, err = strconv.ParseFloat(num, 64)
				if err != nil {
					return nil, err
				}
				num = ""
			}
		case 'W':
			if state != parsingPeriod {
				return nil, ErrUnexpectedInput
			}

			duration.Weeks, err = strconv.ParseFloat(num, 64)
			if err != nil {
				return nil, err
			}
			num = ""
		case 'D':
			if state != parsingPeriod {
				return nil, ErrUnexpectedInput
			}

			duration.Days, err = strconv.ParseFloat(num, 64)
			if err != nil {
				return nil, err
			}
			num = ""
		case 'H':
			if state != parsingTime {
				return nil, ErrUnexpectedInput
			}

			duration.Hours, err = strconv.ParseFloat(num, 64)
			if err != nil {
				return nil, err
			}
			num = ""
		case 'S':
			if state != parsingTime {
				return nil, ErrUnexpectedInput
			}

			duration.Seconds, err = strconv.ParseFloat(num, 64)
			if err != nil {
				return nil, err
			}
			num = ""
		default:
			if unicode.IsNumber(char) || char == '.' {
				num += string(char)
				continue
			}

			return nil, ErrUnexpectedInput
		}
	}

	return duration, nil
}

// FromTimeDuration converts the given time.Duration into duration.Duration.
// Note that for *Duration's with period values of a month or year that the duration becomes a bit fuzzy
// since obviously those things vary month to month and year to year.
func FromTimeDuration(d time.Duration) *Duration {
	duration := &Duration{}
	if d == 0 {
		return duration
	}

	if d < 0 {
		d = -d
		duration.Negative = true
	}

	if d.Hours() >= hoursPerYear {
		duration.Years = math.Floor(d.Hours() / hoursPerYear)
		d -= time.Duration(duration.Years) * nsPerYear
	}
	if d.Hours() >= hoursPerMonth {
		duration.Months = math.Floor(d.Hours() / hoursPerMonth)
		d -= time.Duration(duration.Months) * nsPerMonth
	}
	if d.Hours() >= hoursPerWeek {
		duration.Weeks = math.Floor(d.Hours() / hoursPerWeek)
		d -= time.Duration(duration.Weeks) * nsPerWeek
	}
	if d.Hours() >= hoursPerDay {
		duration.Days = math.Floor(d.Hours() / hoursPerDay)
		d -= time.Duration(duration.Days) * nsPerDay
	}
	if d.Hours() >= 1 {
		duration.Hours = math.Floor(d.Hours())
		d -= time.Duration(duration.Hours) * nsPerHour
	}
	if d.Minutes() >= 1 {
		duration.Minutes = math.Floor(d.Minutes())
		d -= time.Duration(duration.Minutes) * nsPerMinute
	}
	duration.Seconds = d.Seconds()

	return duration
}

// Format formats the given time.Duration into an ISO 8601 duration string (e.g., P1DT6H5M),
// negative durations are prefixed with a minus sign, for a zero duration "PT0S" is returned.
// Note that for *Duration's with period values of a month or year that the duration becomes a bit fuzzy
// since obviously those things vary month to month and year to year.
func Format(d time.Duration) string {
	return FromTimeDuration(d).String()
}

// ToTimeDuration converts the *Duration to the standard library's time.Duration.
// Note that for *Duration's with period values of a month or year that the duration becomes a bit fuzzy
// since obviously those things vary month to month and year to year.
func (duration *Duration) ToTimeDuration() time.Duration {
	var timeDuration time.Duration

	// zero checks are here to avoid unnecessary math operations, on a duration such as `PT5M`
	if duration.Years != 0 {
		timeDuration += time.Duration(math.Round(duration.Years * nsPerYear))
	}
	if duration.Months != 0 {
		timeDuration += time.Duration(math.Round(duration.Months * nsPerMonth))
	}
	if duration.Weeks != 0 {
		timeDuration += time.Duration(math.Round(duration.Weeks * nsPerWeek))
	}
	if duration.Days != 0 {
		timeDuration += time.Duration(math.Round(duration.Days * nsPerDay))
	}
	if duration.Hours != 0 {
		timeDuration += time.Duration(math.Round(duration.Hours * nsPerHour))
	}
	if duration.Minutes != 0 {
		timeDuration += time.Duration(math.Round(duration.Minutes * nsPerMinute))
	}
	if duration.Seconds != 0 {
		timeDuration += time.Duration(math.Round(duration.Seconds * nsPerSecond))
	}
	if duration.Negative {
		timeDuration = -timeDuration
	}

	return timeDuration
}

// String returns the ISO8601 duration string for the *Duration
func (duration *Duration) String() string {
	d := "P"
	hasTime := false

	appendD := func(designator string, value float64, isTime bool) {
		if !hasTime && isTime {
			d += "T"
			hasTime = true
		}

		d += strconv.FormatFloat(value, 'f', -1, 64) + designator
	}

	if duration.Years != 0 {
		appendD("Y", duration.Years, false)
	}

	if duration.Months != 0 {
		appendD("M", duration.Months, false)
	}

	if duration.Weeks != 0 {
		appendD("W", duration.Weeks, false)
	}

	if duration.Days != 0 {
		appendD("D", duration.Days, false)
	}

	if duration.Hours != 0 {
		appendD("H", duration.Hours, true)
	}

	if duration.Minutes != 0 {
		appendD("M", duration.Minutes, true)
	}

	if duration.Seconds != 0 {
		appendD("S", duration.Seconds, true)
	}

	// if the duration is zero, return "PT0S"
	if d == "P" {
		d += "T0S"
	}

	if duration.Negative {
		return "-" + d
	}

	return d
}

// MarshalJSON satisfies the Marshaler interface by return a valid JSON string representation of the duration
func (duration Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(duration.String())
}

// UnmarshalJSON satisfies the Unmarshaler interface by return a valid JSON string representation of the duration
func (duration *Duration) UnmarshalJSON(source []byte) error {
	durationString := ""
	err := json.Unmarshal(source, &durationString)
	if err != nil {
		return err
	}

	parsed, err := Parse(durationString)
	if err != nil {
		return fmt.Errorf("failed to parse duration: %w", err)
	}

	*duration = *parsed
	return nil
}
