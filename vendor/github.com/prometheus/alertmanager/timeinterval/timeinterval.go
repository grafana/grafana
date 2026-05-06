// Copyright 2020 Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package timeinterval

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v2"
)

// Intervener determines whether a given time and active route time interval should mute outgoing notifications.
// It implements the TimeMuter interface.
type Intervener struct {
	intervals map[string][]TimeInterval
}

func (i *Intervener) Mutes(names []string, now time.Time) (bool, error) {
	for _, name := range names {
		interval, ok := i.intervals[name]
		if !ok {
			return false, fmt.Errorf("time interval %s doesn't exist in config", name)
		}

		for _, ti := range interval {
			if ti.ContainsTime(now.UTC()) {
				return true, nil
			}
		}
	}

	return false, nil
}

func NewIntervener(ti map[string][]TimeInterval) *Intervener {
	return &Intervener{
		intervals: ti,
	}
}

// TimeInterval describes intervals of time. ContainsTime will tell you if a golang time is contained
// within the interval.
type TimeInterval struct {
	Times       []TimeRange       `yaml:"times,omitempty" json:"times,omitempty"`
	Weekdays    []WeekdayRange    `yaml:"weekdays,flow,omitempty" json:"weekdays,omitempty"`
	DaysOfMonth []DayOfMonthRange `yaml:"days_of_month,flow,omitempty" json:"days_of_month,omitempty"`
	Months      []MonthRange      `yaml:"months,flow,omitempty" json:"months,omitempty"`
	Years       []YearRange       `yaml:"years,flow,omitempty" json:"years,omitempty"`
	Location    *Location         `yaml:"location,flow,omitempty" json:"location,omitempty"`
}

// TimeRange represents a range of minutes within a 1440 minute day, exclusive of the End minute. A day consists of 1440 minutes.
// For example, 4:00PM to End of the day would Begin at 1020 and End at 1440.
type TimeRange struct {
	StartMinute int
	EndMinute   int
}

// InclusiveRange is used to hold the Beginning and End values of many time interval components.
type InclusiveRange struct {
	Begin int
	End   int
}

// A WeekdayRange is an inclusive range between [0, 6] where 0 = Sunday.
type WeekdayRange struct {
	InclusiveRange
}

// A DayOfMonthRange is an inclusive range that may have negative Beginning/End values that represent distance from the End of the month Beginning at -1.
type DayOfMonthRange struct {
	InclusiveRange
}

// A MonthRange is an inclusive range between [1, 12] where 1 = January.
type MonthRange struct {
	InclusiveRange
}

// A YearRange is a positive inclusive range.
type YearRange struct {
	InclusiveRange
}

// A Location is a container for a time.Location, used for custom unmarshalling/validation logic.
type Location struct {
	*time.Location
}

type yamlTimeRange struct {
	StartTime string `yaml:"start_time" json:"start_time"`
	EndTime   string `yaml:"end_time" json:"end_time"`
}

// A range with a Beginning and End that can be represented as strings.
type stringableRange interface {
	setBegin(int)
	setEnd(int)
	// Try to map a member of the range into an integer.
	memberFromString(string) (int, error)
}

func (ir *InclusiveRange) setBegin(n int) {
	ir.Begin = n
}

func (ir *InclusiveRange) setEnd(n int) {
	ir.End = n
}

func (ir *InclusiveRange) memberFromString(in string) (out int, err error) {
	out, err = strconv.Atoi(in)
	if err != nil {
		return -1, err
	}
	return out, nil
}

func (r *WeekdayRange) memberFromString(in string) (out int, err error) {
	out, ok := daysOfWeek[in]
	if !ok {
		return -1, fmt.Errorf("%s is not a valid weekday", in)
	}
	return out, nil
}

func (r *MonthRange) memberFromString(in string) (out int, err error) {
	out, ok := months[in]
	if !ok {
		out, err = strconv.Atoi(in)
		if err != nil {
			return -1, fmt.Errorf("%s is not a valid month", in)
		}
	}
	return out, nil
}

var daysOfWeek = map[string]int{
	"sunday":    0,
	"monday":    1,
	"tuesday":   2,
	"wednesday": 3,
	"thursday":  4,
	"friday":    5,
	"saturday":  6,
}

var daysOfWeekInv = map[int]string{
	0: "sunday",
	1: "monday",
	2: "tuesday",
	3: "wednesday",
	4: "thursday",
	5: "friday",
	6: "saturday",
}

var months = map[string]int{
	"january":   1,
	"february":  2,
	"march":     3,
	"april":     4,
	"may":       5,
	"june":      6,
	"july":      7,
	"august":    8,
	"september": 9,
	"october":   10,
	"november":  11,
	"december":  12,
}

var monthsInv = map[int]string{
	1:  "january",
	2:  "february",
	3:  "march",
	4:  "april",
	5:  "may",
	6:  "june",
	7:  "july",
	8:  "august",
	9:  "september",
	10: "october",
	11: "november",
	12: "december",
}

// UnmarshalYAML implements the Unmarshaller interface for Location.
func (tz *Location) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var str string
	if err := unmarshal(&str); err != nil {
		return err
	}

	loc, err := time.LoadLocation(str)
	if err != nil {
		if runtime.GOOS == "windows" {
			if zoneinfo := os.Getenv("ZONEINFO"); zoneinfo != "" {
				return fmt.Errorf("%w (ZONEINFO=%q)", err, zoneinfo)
			}
			return fmt.Errorf("%w (on Windows platforms, you may have to pass the time zone database using the ZONEINFO environment variable, see https://pkg.go.dev/time#LoadLocation for details)", err)
		}
		return err
	}

	*tz = Location{loc}
	return nil
}

// UnmarshalJSON implements the json.Unmarshaler interface for Location.
// It delegates to the YAML unmarshaller as it can parse JSON and has validation logic.
func (tz *Location) UnmarshalJSON(in []byte) error {
	return yaml.Unmarshal(in, tz)
}

// UnmarshalYAML implements the Unmarshaller interface for WeekdayRange.
func (r *WeekdayRange) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var str string
	if err := unmarshal(&str); err != nil {
		return err
	}
	if err := stringableRangeFromString(str, r); err != nil {
		return err
	}
	if r.Begin > r.End {
		return errors.New("start day cannot be before end day")
	}
	if r.Begin < 0 || r.Begin > 6 {
		return fmt.Errorf("%s is not a valid day of the week: out of range", str)
	}
	if r.End < 0 || r.End > 6 {
		return fmt.Errorf("%s is not a valid day of the week: out of range", str)
	}
	return nil
}

// UnmarshalJSON implements the json.Unmarshaler interface for WeekdayRange.
// It delegates to the YAML unmarshaller as it can parse JSON and has validation logic.
func (r *WeekdayRange) UnmarshalJSON(in []byte) error {
	return yaml.Unmarshal(in, r)
}

// UnmarshalYAML implements the Unmarshaller interface for DayOfMonthRange.
func (r *DayOfMonthRange) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var str string
	if err := unmarshal(&str); err != nil {
		return err
	}
	if err := stringableRangeFromString(str, r); err != nil {
		return err
	}
	// Check beginning <= end accounting for negatives day of month indices as well.
	// Months != 31 days can't be addressed here and are clamped, but at least we can catch blatant errors.
	if r.Begin == 0 || r.Begin < -31 || r.Begin > 31 {
		return fmt.Errorf("%d is not a valid day of the month: out of range", r.Begin)
	}
	if r.End == 0 || r.End < -31 || r.End > 31 {
		return fmt.Errorf("%d is not a valid day of the month: out of range", r.End)
	}
	// Restricting here prevents errors where begin > end in longer months but not shorter months.
	if r.Begin < 0 && r.End > 0 {
		return fmt.Errorf("end day must be negative if start day is negative")
	}
	// Check begin <= end. We can't know this for sure when using negative indices
	// but we can prevent cases where its always invalid (using 28 day minimum length).
	checkBegin := r.Begin
	checkEnd := r.End
	if r.Begin < 0 {
		checkBegin = 28 + r.Begin
	}
	if r.End < 0 {
		checkEnd = 28 + r.End
	}
	if checkBegin > checkEnd {
		return fmt.Errorf("end day %d is always before start day %d", r.End, r.Begin)
	}
	return nil
}

// UnmarshalJSON implements the json.Unmarshaler interface for DayOfMonthRange.
// It delegates to the YAML unmarshaller as it can parse JSON and has validation logic.
func (r *DayOfMonthRange) UnmarshalJSON(in []byte) error {
	return yaml.Unmarshal(in, r)
}

// UnmarshalYAML implements the Unmarshaller interface for MonthRange.
func (r *MonthRange) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var str string
	if err := unmarshal(&str); err != nil {
		return err
	}
	if err := stringableRangeFromString(str, r); err != nil {
		return err
	}
	if r.Begin > r.End {
		begin := monthsInv[r.Begin]
		end := monthsInv[r.End]
		return fmt.Errorf("end month %s is before start month %s", end, begin)
	}
	return nil
}

// UnmarshalJSON implements the json.Unmarshaler interface for MonthRange.
// It delegates to the YAML unmarshaller as it can parse JSON and has validation logic.
func (r *MonthRange) UnmarshalJSON(in []byte) error {
	return yaml.Unmarshal(in, r)
}

// UnmarshalYAML implements the Unmarshaller interface for YearRange.
func (r *YearRange) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var str string
	if err := unmarshal(&str); err != nil {
		return err
	}
	if err := stringableRangeFromString(str, r); err != nil {
		return err
	}
	if r.Begin > r.End {
		return fmt.Errorf("end year %d is before start year %d", r.End, r.Begin)
	}
	return nil
}

// UnmarshalJSON implements the json.Unmarshaler interface for YearRange.
// It delegates to the YAML unmarshaller as it can parse JSON and has validation logic.
func (r *YearRange) UnmarshalJSON(in []byte) error {
	return yaml.Unmarshal(in, r)
}

// UnmarshalYAML implements the Unmarshaller interface for TimeRanges.
func (tr *TimeRange) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var y yamlTimeRange
	if err := unmarshal(&y); err != nil {
		return err
	}
	if y.EndTime == "" || y.StartTime == "" {
		return errors.New("both start and end times must be provided")
	}
	start, err := parseTime(y.StartTime)
	if err != nil {
		return err
	}
	end, err := parseTime(y.EndTime)
	if err != nil {
		return err
	}
	if start >= end {
		return errors.New("start time cannot be equal or greater than end time")
	}
	tr.StartMinute, tr.EndMinute = start, end
	return nil
}

// UnmarshalJSON implements the json.Unmarshaler interface for Timerange.
// It delegates to the YAML unmarshaller as it can parse JSON and has validation logic.
func (tr *TimeRange) UnmarshalJSON(in []byte) error {
	return yaml.Unmarshal(in, tr)
}

// MarshalYAML implements the yaml.Marshaler interface for WeekdayRange.
func (r WeekdayRange) MarshalYAML() (interface{}, error) {
	bytes, err := r.MarshalText()
	return string(bytes), err
}

// MarshalText implements the econding.TextMarshaler interface for WeekdayRange.
// It converts the range into a colon-separated string, or a single weekday if possible.
// E.g. "monday:friday" or "saturday".
func (r WeekdayRange) MarshalText() ([]byte, error) {
	beginStr, ok := daysOfWeekInv[r.Begin]
	if !ok {
		return nil, fmt.Errorf("unable to convert %d into weekday string", r.Begin)
	}
	if r.Begin == r.End {
		return []byte(beginStr), nil
	}
	endStr, ok := daysOfWeekInv[r.End]
	if !ok {
		return nil, fmt.Errorf("unable to convert %d into weekday string", r.End)
	}
	rangeStr := fmt.Sprintf("%s:%s", beginStr, endStr)
	return []byte(rangeStr), nil
}

// MarshalYAML implements the yaml.Marshaler interface for TimeRange.
func (tr TimeRange) MarshalYAML() (out interface{}, err error) {
	startHr := tr.StartMinute / 60
	endHr := tr.EndMinute / 60
	startMin := tr.StartMinute % 60
	endMin := tr.EndMinute % 60

	startStr := fmt.Sprintf("%02d:%02d", startHr, startMin)
	endStr := fmt.Sprintf("%02d:%02d", endHr, endMin)

	yTr := yamlTimeRange{startStr, endStr}
	return interface{}(yTr), err
}

// MarshalJSON implements the json.Marshaler interface for TimeRange.
func (tr TimeRange) MarshalJSON() (out []byte, err error) {
	startHr := tr.StartMinute / 60
	endHr := tr.EndMinute / 60
	startMin := tr.StartMinute % 60
	endMin := tr.EndMinute % 60

	startStr := fmt.Sprintf("%02d:%02d", startHr, startMin)
	endStr := fmt.Sprintf("%02d:%02d", endHr, endMin)

	yTr := yamlTimeRange{startStr, endStr}
	return json.Marshal(yTr)
}

// MarshalText implements the econding.TextMarshaler interface for Location.
// It marshals a Location back into a string that represents a time.Location.
func (tz Location) MarshalText() ([]byte, error) {
	if tz.Location == nil {
		return nil, fmt.Errorf("unable to convert nil location into string")
	}
	return []byte(tz.Location.String()), nil
}

// MarshalYAML implements the yaml.Marshaler interface for Location.
func (tz Location) MarshalYAML() (interface{}, error) {
	bytes, err := tz.MarshalText()
	return string(bytes), err
}

// MarshalJSON implements the json.Marshaler interface for Location.
func (tz Location) MarshalJSON() (out []byte, err error) {
	return json.Marshal(tz.String())
}

// MarshalText implements the encoding.TextMarshaler interface for InclusiveRange.
// It converts the struct into a colon-separated string, or a single element if
// appropriate. E.g. "monday:friday" or "monday".
func (ir InclusiveRange) MarshalText() ([]byte, error) {
	if ir.Begin == ir.End {
		return []byte(strconv.Itoa(ir.Begin)), nil
	}
	out := fmt.Sprintf("%d:%d", ir.Begin, ir.End)
	return []byte(out), nil
}

// MarshalYAML implements the yaml.Marshaler interface for InclusiveRange.
func (ir InclusiveRange) MarshalYAML() (interface{}, error) {
	bytes, err := ir.MarshalText()
	return string(bytes), err
}

var (
	validTime   = "^((([01][0-9])|(2[0-3])):[0-5][0-9])$|(^24:00$)"
	validTimeRE = regexp.MustCompile(validTime)
)

// Given a time, determines the number of days in the month that time occurs in.
func daysInMonth(t time.Time) int {
	monthStart := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
	monthEnd := monthStart.AddDate(0, 1, 0)
	diff := monthEnd.Sub(monthStart)
	return int(diff.Hours() / 24)
}

func clamp(n, min, max int) int {
	if n <= min {
		return min
	}
	if n >= max {
		return max
	}
	return n
}

// ContainsTime returns true if the TimeInterval contains the given time, otherwise returns false.
func (tp TimeInterval) ContainsTime(t time.Time) bool {
	if tp.Location != nil {
		t = t.In(tp.Location.Location)
	}
	if tp.Times != nil {
		in := false
		for _, validMinutes := range tp.Times {
			if (t.Hour()*60+t.Minute()) >= validMinutes.StartMinute && (t.Hour()*60+t.Minute()) < validMinutes.EndMinute {
				in = true
				break
			}
		}
		if !in {
			return false
		}
	}
	if tp.DaysOfMonth != nil {
		in := false
		for _, validDates := range tp.DaysOfMonth {
			var begin, end int
			daysInMonth := daysInMonth(t)
			if validDates.Begin < 0 {
				begin = daysInMonth + validDates.Begin + 1
			} else {
				begin = validDates.Begin
			}
			if validDates.End < 0 {
				end = daysInMonth + validDates.End + 1
			} else {
				end = validDates.End
			}
			// Skip clamping if the beginning date is after the end of the month.
			if begin > daysInMonth {
				continue
			}
			// Clamp to the boundaries of the month to prevent crossing into other months.
			begin = clamp(begin, -1*daysInMonth, daysInMonth)
			end = clamp(end, -1*daysInMonth, daysInMonth)
			if t.Day() >= begin && t.Day() <= end {
				in = true
				break
			}
		}
		if !in {
			return false
		}
	}
	if tp.Months != nil {
		in := false
		for _, validMonths := range tp.Months {
			if t.Month() >= time.Month(validMonths.Begin) && t.Month() <= time.Month(validMonths.End) {
				in = true
				break
			}
		}
		if !in {
			return false
		}
	}
	if tp.Weekdays != nil {
		in := false
		for _, validDays := range tp.Weekdays {
			if t.Weekday() >= time.Weekday(validDays.Begin) && t.Weekday() <= time.Weekday(validDays.End) {
				in = true
				break
			}
		}
		if !in {
			return false
		}
	}
	if tp.Years != nil {
		in := false
		for _, validYears := range tp.Years {
			if t.Year() >= validYears.Begin && t.Year() <= validYears.End {
				in = true
				break
			}
		}
		if !in {
			return false
		}
	}
	return true
}

// Converts a string of the form "HH:MM" into the number of minutes elapsed in the day.
func parseTime(in string) (mins int, err error) {
	if !validTimeRE.MatchString(in) {
		return 0, fmt.Errorf("couldn't parse timestamp %s, invalid format", in)
	}
	timestampComponents := strings.Split(in, ":")
	if len(timestampComponents) != 2 {
		return 0, fmt.Errorf("invalid timestamp format: %s", in)
	}
	timeStampHours, err := strconv.Atoi(timestampComponents[0])
	if err != nil {
		return 0, err
	}
	timeStampMinutes, err := strconv.Atoi(timestampComponents[1])
	if err != nil {
		return 0, err
	}
	if timeStampHours < 0 || timeStampHours > 24 || timeStampMinutes < 0 || timeStampMinutes > 60 {
		return 0, fmt.Errorf("timestamp %s out of range", in)
	}
	// Timestamps are stored as minutes elapsed in the day, so multiply hours by 60.
	mins = timeStampHours*60 + timeStampMinutes
	return mins, nil
}

// Converts a range that can be represented as strings (e.g. monday:wednesday) into an equivalent integer-represented range.
func stringableRangeFromString(in string, r stringableRange) (err error) {
	in = strings.ToLower(in)
	if strings.ContainsRune(in, ':') {
		components := strings.Split(in, ":")
		if len(components) != 2 {
			return fmt.Errorf("couldn't parse range %s, invalid format", in)
		}
		start, err := r.memberFromString(components[0])
		if err != nil {
			return err
		}
		End, err := r.memberFromString(components[1])
		if err != nil {
			return err
		}
		r.setBegin(start)
		r.setEnd(End)
		return nil
	}
	val, err := r.memberFromString(in)
	if err != nil {
		return err
	}
	r.setBegin(val)
	r.setEnd(val)
	return nil
}
