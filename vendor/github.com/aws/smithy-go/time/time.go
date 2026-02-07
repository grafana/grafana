package time

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"time"
)

const (
	// dateTimeFormat is a IMF-fixdate formatted RFC3339 section 5.6
	dateTimeFormatInput    = "2006-01-02T15:04:05.999999999Z"
	dateTimeFormatInputNoZ = "2006-01-02T15:04:05.999999999"
	dateTimeFormatOutput   = "2006-01-02T15:04:05.999Z"

	// httpDateFormat is a date time defined by RFC 7231#section-7.1.1.1
	// IMF-fixdate with no UTC offset.
	httpDateFormat = "Mon, 02 Jan 2006 15:04:05 GMT"
	// Additional formats needed for compatibility.
	httpDateFormatSingleDigitDay             = "Mon, _2 Jan 2006 15:04:05 GMT"
	httpDateFormatSingleDigitDayTwoDigitYear = "Mon, _2 Jan 06 15:04:05 GMT"
)

var millisecondFloat = big.NewFloat(1e3)

// FormatDateTime formats value as a date-time, (RFC3339 section 5.6)
//
// Example: 1985-04-12T23:20:50.52Z
func FormatDateTime(value time.Time) string {
	return value.UTC().Format(dateTimeFormatOutput)
}

// ParseDateTime parses a string as a date-time, (RFC3339 section 5.6)
//
// Example: 1985-04-12T23:20:50.52Z
func ParseDateTime(value string) (time.Time, error) {
	return tryParse(value,
		dateTimeFormatInput,
		dateTimeFormatInputNoZ,
		time.RFC3339Nano,
		time.RFC3339,
	)
}

// FormatHTTPDate formats value as a http-date, (RFC 7231#section-7.1.1.1 IMF-fixdate)
//
// Example: Tue, 29 Apr 2014 18:30:38 GMT
func FormatHTTPDate(value time.Time) string {
	return value.UTC().Format(httpDateFormat)
}

// ParseHTTPDate parses a string as a http-date, (RFC 7231#section-7.1.1.1 IMF-fixdate)
//
// Example: Tue, 29 Apr 2014 18:30:38 GMT
func ParseHTTPDate(value string) (time.Time, error) {
	return tryParse(value,
		httpDateFormat,
		httpDateFormatSingleDigitDay,
		httpDateFormatSingleDigitDayTwoDigitYear,
		time.RFC850,
		time.ANSIC,
	)
}

// FormatEpochSeconds returns value as a Unix time in seconds with with decimal precision
//
// Example: 1515531081.123
func FormatEpochSeconds(value time.Time) float64 {
	ms := value.UnixNano() / int64(time.Millisecond)
	return float64(ms) / 1e3
}

// ParseEpochSeconds returns value as a Unix time in seconds with with decimal precision
//
// Example: 1515531081.123
func ParseEpochSeconds(value float64) time.Time {
	f := big.NewFloat(value)
	f = f.Mul(f, millisecondFloat)
	i, _ := f.Int64()
	// Offset to `UTC` because time.Unix returns the time value based on system
	// local setting.
	return time.Unix(0, i*1e6).UTC()
}

func tryParse(v string, formats ...string) (time.Time, error) {
	var errs parseErrors
	for _, f := range formats {
		t, err := time.Parse(f, v)
		if err != nil {
			errs = append(errs, parseError{
				Format: f,
				Err:    err,
			})
			continue
		}
		return t, nil
	}

	return time.Time{}, fmt.Errorf("unable to parse time string, %w", errs)
}

type parseErrors []parseError

func (es parseErrors) Error() string {
	var s strings.Builder
	for _, e := range es {
		fmt.Fprintf(&s, "\n * %q: %v", e.Format, e.Err)
	}

	return "parse errors:" + s.String()
}

type parseError struct {
	Format string
	Err    error
}

// SleepWithContext will wait for the timer duration to expire, or until the context
// is canceled. Whichever happens first. If the context is canceled the
// Context's error will be returned.
func SleepWithContext(ctx context.Context, dur time.Duration) error {
	t := time.NewTimer(dur)
	defer t.Stop()

	select {
	case <-t.C:
		break
	case <-ctx.Done():
		return ctx.Err()
	}

	return nil
}
