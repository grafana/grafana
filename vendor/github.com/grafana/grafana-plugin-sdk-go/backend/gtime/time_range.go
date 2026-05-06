package gtime

import (
	"strconv"
	"time"

	"github.com/jszwedko/go-datemath"
)

type TimeRange struct {
	// From the raw start time in time range.
	From string

	// To the raw end time in time range.
	To string

	// Now the current time. Should normally only change in tests.
	Now time.Time
}

// NewTimeRange creates a new TimeRange of From and To.
func NewTimeRange(from, to string) TimeRange {
	return TimeRange{
		From: from,
		To:   to,
		Now:  time.Now(),
	}
}

// GetFromAsMsEpoch parses start of time range and returns result in milliseconds epoch or the Unix epoch 0 equivalent if it fails.
func (tr TimeRange) GetFromAsMsEpoch() int64 {
	return tr.MustGetFrom().UnixNano() / int64(time.Millisecond)
}

// GetFromAsSecondsEpoch parses start of time range and returns result in seconds epoch or the Unix epoch 0 equivalent if it fails.
func (tr TimeRange) GetFromAsSecondsEpoch() int64 {
	return tr.GetFromAsMsEpoch() / 1000
}

// GetFromAsTimeUTC parses start of time range and returns result as time.Time in UTC timezone or the Unix epoch 0 equivalent if it fails.
func (tr TimeRange) GetFromAsTimeUTC() time.Time {
	return tr.MustGetFrom().UTC()
}

// GetToAsMsEpoch parses end of time range and returns result in milliseconds epoch or the Unix epoch 0 equivalent if it fails.
func (tr TimeRange) GetToAsMsEpoch() int64 {
	return tr.MustGetTo().UnixNano() / int64(time.Millisecond)
}

// GetToAsSecondsEpoch parses end of time range and returns result in seconds epoch or the Unix epoch 0 equivalent if it fails.
func (tr TimeRange) GetToAsSecondsEpoch() int64 {
	return tr.GetToAsMsEpoch() / 1000
}

// GetToAsTimeUTC parses end of time range and returns result as time.Time in UTC timezone or the Unix epoch 0 equivalent if it fails.
func (tr TimeRange) GetToAsTimeUTC() time.Time {
	return tr.MustGetTo().UTC()
}

// MustGetFrom parses start of time range and returns result as time.Time or the Unix epoch 0 equivalent if it fails.
func (tr TimeRange) MustGetFrom() time.Time {
	res, err := tr.ParseFrom()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

// MustGetTo parses end of time range and returns result as time.Time or the Unix epoch 0 equivalent if it fails.
func (tr TimeRange) MustGetTo() time.Time {
	res, err := tr.ParseTo()
	if err != nil {
		return time.Unix(0, 0)
	}
	return res
}

// ParseFrom parses start of time range with optional TimeRangeOption's and returns equivalent or an error.
func (tr TimeRange) ParseFrom(options ...TimeRangeOption) (time.Time, error) {
	options = append(options, WithNow(tr.Now))

	pt := newParsableTime(tr.From, options...)
	return pt.parse()
}

// ParseTo parses end of time range with optional TimeRangeOption's and returns time.Time or an error.
func (tr TimeRange) ParseTo(options ...TimeRangeOption) (time.Time, error) {
	options = append(options, WithRoundUp(), WithNow(tr.Now))

	pt := newParsableTime(tr.To, options...)
	return pt.parse()
}

// WithWeekstart time range option to set given weekday as the start of the week.
func WithWeekstart(weekday time.Weekday) TimeRangeOption {
	return func(timeRange parsableTime) parsableTime {
		timeRange.weekstart = &weekday
		return timeRange
	}
}

// WithLocation time range option uses the given location loc as the timezone of the time range if unspecified.
func WithLocation(loc *time.Location) TimeRangeOption {
	return func(timeRange parsableTime) parsableTime {
		timeRange.location = loc
		return timeRange
	}
}

// WithLocation time range option to set the start month of fiscal year.
func WithFiscalStartMonth(month time.Month) TimeRangeOption {
	return func(timeRange parsableTime) parsableTime {
		timeRange.fiscalStartMonth = &month
		return timeRange
	}
}

// WithNow time range option to set the current time as t.
func WithNow(t time.Time) TimeRangeOption {
	return func(timeRange parsableTime) parsableTime {
		timeRange.now = t
		return timeRange
	}
}

// WithRoundUp time range option to set the rounding of time to the end of the period instead of the beginning.
func WithRoundUp() TimeRangeOption {
	return func(timeRange parsableTime) parsableTime {
		timeRange.roundUp = true
		return timeRange
	}
}

type parsableTime struct {
	time             string
	now              time.Time
	location         *time.Location
	weekstart        *time.Weekday
	fiscalStartMonth *time.Month
	roundUp          bool
}

// TimeRangeOption option for how to parse time ranges.
type TimeRangeOption func(timeRange parsableTime) parsableTime

func newParsableTime(t string, options ...TimeRangeOption) parsableTime {
	p := parsableTime{
		time: t,
		now:  time.Now(),
	}

	for _, opt := range options {
		p = opt(p)
	}

	return p
}

func (t parsableTime) parse() (time.Time, error) {
	// Milliseconds since Unix epoch.
	if val, err := strconv.ParseInt(t.time, 10, 64); err == nil {
		return time.UnixMilli(val), nil
	}

	// Duration relative to current time.
	if diff, err := ParseDuration(t.time); err == nil {
		return t.now.Add(-diff), nil
	}

	// Advanced time string, mimics the frontend's datemath library.
	return datemath.ParseAndEvaluate(t.time, t.datemathOptions()...)
}

func (t parsableTime) datemathOptions() []func(*datemath.Options) {
	options := []func(*datemath.Options){
		datemath.WithNow(t.now),
		datemath.WithRoundUp(t.roundUp),
	}
	if t.location != nil {
		options = append(options, datemath.WithLocation(t.location))
	}
	if t.weekstart != nil {
		options = append(options, datemath.WithStartOfWeek(*t.weekstart))
	}
	if t.fiscalStartMonth != nil {
		loc := time.UTC
		if t.location != nil {
			loc = t.location
		}
		options = append(options, datemath.WithStartOfFiscalYear(
			// Year doesn't matter, and Grafana only supports setting the
			// month that the fiscal year starts in.
			time.Date(0, *t.fiscalStartMonth, 1, 0, 0, 0, 0, loc),
		))
	}
	return options
}
