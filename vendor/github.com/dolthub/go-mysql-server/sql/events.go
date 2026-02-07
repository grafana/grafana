// Copyright 2023 Dolthub, Inc.
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

package sql

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gopkg.in/src-d/go-errors.v1"
)

const EventDateSpaceTimeFormat = "2006-01-02 15:04:05"

// EventScheduler is an interface used for notifying the EventSchedulerStatus
// for querying any events related statements. This allows plan Nodes to communicate
// to the EventSchedulerStatus.
type EventScheduler interface {
	// AddEvent is called when there is an event created at runtime.
	AddEvent(ctx *Context, edb EventDatabase, event EventDefinition)
	// UpdateEvent is called when there is an event altered at runtime.
	UpdateEvent(ctx *Context, edb EventDatabase, orgEventName string, event EventDefinition)
	// RemoveEvent is called when there is an event dropped at runtime. This function
	// removes the given event if it exists in the enabled events list of the EventSchedulerStatus.
	RemoveEvent(dbName, eventName string)
	// RemoveSchemaEvents is called when there is a database dropped at runtime. This function
	// removes all events of given database that exist in the enabled events list of the EventSchedulerStatus.
	RemoveSchemaEvents(dbName string)
}

// EventDefinition describes a scheduled event.
type EventDefinition struct {
	// The time at which the event was created.
	CreatedAt time.Time
	// The time at which the event was last altered.
	LastAltered time.Time
	// The time at which the event was last executed.
	LastExecuted time.Time
	ExecuteAt    time.Time
	Starts       time.Time // STARTS is always defined when EVERY is defined.
	Ends         time.Time

	// The name of this event. Event names in a database are unique.
	Name string
	// The SQL statements to be executed when this event is executed.
	EventBody string
	// The timezone offset the event was created or last altered at.
	TimezoneOffset string
	// The enabled or disabled status of this event.
	Status string
	// The user or account who created this scheduled event.
	Definer string
	// The SQL_MODE in effect when this event was created.
	SqlMode string

	/* Fields parsed from the CREATE EVENT statement */
	Comment              string
	ExecuteEvery         string
	OnCompletionPreserve bool
	HasExecuteAt         bool
	HasEnds              bool
}

// ConvertTimesFromUTCToTz returns a new EventDefinition with all its time values converted
// from UTC TZ to the given TZ. This function should only be used when needing to display
// data that includes the time values in string format for such as SHOW EVENTS or
// SHOW CREATE EVENT statements.
func (e *EventDefinition) ConvertTimesFromUTCToTz(tz string) *EventDefinition {
	ne := *e
	if ne.HasExecuteAt {
		t, ok := ConvertTimeZone(e.ExecuteAt, "+00:00", tz)
		if ok {
			ne.ExecuteAt = t
		}
	} else {
		t, ok := ConvertTimeZone(e.Starts, "+00:00", tz)
		if ok {
			ne.Starts = t
		}
		if ne.HasEnds {
			t, ok = ConvertTimeZone(e.Ends, "+00:00", tz)
			if ok {
				ne.Ends = t
			}
		}
	}

	t, ok := ConvertTimeZone(e.CreatedAt, "+00:00", tz)
	if ok {
		ne.CreatedAt = t
	}
	t, ok = ConvertTimeZone(e.LastAltered, "+00:00", tz)
	if ok {
		ne.LastAltered = t
	}
	t, ok = ConvertTimeZone(e.LastExecuted, "+00:00", tz)
	if ok {
		ne.LastExecuted = t
	}
	return &ne
}

// GetNextExecutionTime returns the next execution time for the event, which depends on AT
// or EVERY field of EventDefinition. It also returns whether the event is expired.
func (e *EventDefinition) GetNextExecutionTime(curTime time.Time) (time.Time, bool, error) {
	if e.HasExecuteAt {
		return e.ExecuteAt, e.ExecuteAt.Sub(curTime).Seconds() <= -1, nil
	} else {
		timeDur, err := getTimeDurationFromEveryInterval(e.ExecuteEvery)
		if err != nil {
			return time.Time{}, true, err
		}
		// check for last executed, if not set, get the next time by incrementing the start time by interval
		// use 'last executed' time if the event was executed before; otherwise, use 'starts' time
		startTime := e.Starts
		if !e.LastExecuted.IsZero() && e.LastExecuted.Sub(e.Starts).Seconds() > 0 {
			startTime = e.LastExecuted
		}

		// if startTime > curTime, then event hasn't executed yet, so execute at startTime
		if startTime.Sub(curTime).Seconds() > 0 {
			return startTime, false, nil
		}
		// if endTime is defined and endTime < curTime, then event is ended
		if e.HasEnds && e.Ends.Sub(curTime).Seconds() < 0 {
			return time.Time{}, true, nil
		}

		diffToNext := (int64(curTime.Sub(startTime).Seconds()/timeDur.Seconds()) + 1) * int64(timeDur.Seconds())
		nextTime := startTime.Add(time.Duration(diffToNext) * time.Second)
		// sanity check
		for nextTime.Sub(curTime).Seconds() < 0 {
			nextTime = nextTime.Add(timeDur)
		}
		// if the next execution time is past the endTime, then the event is expired.
		if e.HasEnds && e.Ends.Sub(nextTime).Seconds() < 0 {
			return time.Time{}, true, nil
		}
		return nextTime, false, nil
	}
}

// CreateEventStatement returns a CREATE EVENT statement for this event.
func (e *EventDefinition) CreateEventStatement() string {
	stmt := "CREATE"
	if e.Definer != "" {
		stmt = fmt.Sprintf("%s DEFINER = %s", stmt, e.Definer)
	}
	stmt = fmt.Sprintf("%s EVENT `%s`", stmt, e.Name)

	if e.HasExecuteAt {
		stmt = fmt.Sprintf("%s ON SCHEDULE AT '%s'", stmt, e.ExecuteAt.Format(EventDateSpaceTimeFormat))
	} else {
		// STARTS should be NOT null regardless of user definition
		stmt = fmt.Sprintf("%s ON SCHEDULE EVERY %s STARTS '%s'", stmt, e.ExecuteEvery, e.Starts.Format(EventDateSpaceTimeFormat))
		if e.HasEnds {
			stmt = fmt.Sprintf("%s ENDS '%s'", stmt, e.Ends.Format(EventDateSpaceTimeFormat))
		}
	}

	if e.OnCompletionPreserve {
		stmt = fmt.Sprintf("%s ON COMPLETION PRESERVE", stmt)
	} else {
		stmt = fmt.Sprintf("%s ON COMPLETION NOT PRESERVE", stmt)
	}

	stmt = fmt.Sprintf("%s %s", stmt, e.Status)

	if e.Comment != "" {
		stmt = fmt.Sprintf("%s COMMENT '%s'", stmt, e.Comment)
	}

	return fmt.Sprintf("%s DO %s", stmt, e.EventBody)
}

// getTimeDurationFromEveryInterval returns time.Duration converting the given EVERY interval.
func getTimeDurationFromEveryInterval(every string) (time.Duration, error) {
	everyInterval, err := EventOnScheduleEveryIntervalFromString(every)
	if err != nil {
		return 0, err
	}
	hours := everyInterval.Years*8766 + everyInterval.Months*730 + everyInterval.Days*24 + everyInterval.Hours
	timeDur := time.Duration(hours)*time.Hour + time.Duration(everyInterval.Minutes)*time.Minute + time.Duration(everyInterval.Seconds)*time.Second

	return timeDur, nil
}

// EventStatus represents an event status that is defined for an event.
type EventStatus byte

const (
	EventStatus_Enable EventStatus = iota
	EventStatus_Disable
	EventStatus_DisableOnSlave
)

// String returns the original SQL representation.
func (e EventStatus) String() string {
	switch e {
	case EventStatus_Enable:
		return "ENABLE"
	case EventStatus_Disable:
		return "DISABLE"
	case EventStatus_DisableOnSlave:
		return "DISABLE ON SLAVE"
	default:
		panic(fmt.Errorf("invalid event status value `%d`", byte(e)))
	}
}

// EventStatusFromString returns EventStatus based on the given string value.
// This function is used in Dolt to get EventStatus value for the EventDefinition.
func EventStatusFromString(status string) (EventStatus, error) {
	switch strings.ToLower(status) {
	case "enable":
		return EventStatus_Enable, nil
	case "disable":
		return EventStatus_Disable, nil
	case "disable on slave":
		return EventStatus_DisableOnSlave, nil
	default:
		// use disable as default to be safe
		return EventStatus_Disable, fmt.Errorf("invalid event status value: `%s`", status)
	}
}

// EventOnScheduleEveryInterval is used to store ON SCHEDULE EVERY clause's interval definition.
// It is equivalent of expression.TimeDelta without microseconds field.
type EventOnScheduleEveryInterval struct {
	Years   int64
	Months  int64
	Days    int64
	Hours   int64
	Minutes int64
	Seconds int64
}

func NewEveryInterval(y, mo, d, h, mi, s int64) *EventOnScheduleEveryInterval {
	return &EventOnScheduleEveryInterval{
		Years:   y,
		Months:  mo,
		Days:    d,
		Hours:   h,
		Minutes: mi,
		Seconds: s,
	}
}

// GetIntervalValAndField returns ON SCHEDULE EVERY clause's interval value and field type in string format
// (e.g. returns "'1:2'" and "MONTH_DAY" for 1 month and 2 day or returns "4" and "HOUR" for 4 hour intervals).
func (e *EventOnScheduleEveryInterval) GetIntervalValAndField() (string, string) {
	if e == nil {
		return "", ""
	}

	var val, field []string
	if e.Years != 0 {
		val = append(val, fmt.Sprintf("%v", e.Years))
		field = append(field, "YEAR")
	}
	if e.Months != 0 {
		val = append(val, fmt.Sprintf("%v", e.Months))
		field = append(field, "MONTH")
	}
	if e.Days != 0 {
		val = append(val, fmt.Sprintf("%v", e.Days))
		field = append(field, "DAY")
	}
	if e.Hours != 0 {
		val = append(val, fmt.Sprintf("%v", e.Hours))
		field = append(field, "HOUR")
	}
	if e.Minutes != 0 {
		val = append(val, fmt.Sprintf("%v", e.Minutes))
		field = append(field, "MINUTE")
	}
	if e.Seconds != 0 {
		val = append(val, fmt.Sprintf("%v", e.Seconds))
		field = append(field, "SECOND")
	}

	if len(val) == 0 {
		return "", ""
	} else if len(val) == 1 {
		return val[0], field[0]
	}

	return fmt.Sprintf("'%s'", strings.Join(val, ":")), strings.Join(field, "_")
}

// EventOnScheduleEveryIntervalFromString returns *EventOnScheduleEveryInterval parsing given interval string
// such as `2 DAY` or `'1:2' MONTH_DAY`. This function is used in Dolt to construct EventOnScheduleEveryInterval value
// for the EventDefinition.
func EventOnScheduleEveryIntervalFromString(every string) (*EventOnScheduleEveryInterval, error) {
	errCannotParseEveryInterval := fmt.Errorf("cannot parse ON SCHEDULE EVERY interval: `%s`", every)
	strs := strings.Split(every, " ")
	if len(strs) != 2 {
		return nil, errCannotParseEveryInterval
	}
	intervalVal := strs[0]
	intervalField := strs[1]

	intervalVal = strings.TrimSuffix(strings.TrimPrefix(intervalVal, "'"), "'")
	iVals := strings.Split(intervalVal, ":")
	iFields := strings.Split(intervalField, "_")

	if len(iVals) != len(iFields) {
		return nil, errCannotParseEveryInterval
	}

	var interval = &EventOnScheduleEveryInterval{}
	for i, val := range iVals {
		n, err := strconv.ParseInt(val, 10, 64)
		if err != nil {
			return nil, errCannotParseEveryInterval
		}
		switch iFields[i] {
		case "YEAR":
			interval.Years = n
		case "MONTH":
			interval.Months = n
		case "DAY":
			interval.Days = n
		case "HOUR":
			interval.Hours = n
		case "MINUTE":
			interval.Minutes = n
		case "SECOND":
			interval.Seconds = n
		default:
			return nil, errCannotParseEveryInterval
		}
	}

	return interval, nil
}

// -------------------------
//  Events datetime parsing
// -------------------------

var ErrIncorrectValue = errors.NewKind("Incorrect %s value: '%s'")
var dateRegex = regexp.MustCompile(`(?m)^(\d{1,4})-(\d{1,2})-(\d{1,2})(.*)$`)
var timeRegex = regexp.MustCompile(`(?m)^([ T])?(\d{1,2})?(:)?(\d{1,2})?(:)?(\d{1,2})?(\.)?(\d{1,6})?(.*)$`)
var tzRegex = regexp.MustCompile(`(?m)^([+\-])(\d{2}):(\d{2})$`)

// GetTimeValueFromStringInput returns time.Time in system timezone (SYSTEM = time.Now().Location()).
// evaluating valid MySQL datetime and timestamp formats.
func GetTimeValueFromStringInput(field, t string) (time.Time, error) {
	// TODO: the time value should be in session timezone rather than system timezone.
	sessTz := SystemTimezoneOffset()

	// For MySQL datetime format, it accepts any valid date format
	// and tries parsing time part first and timezone part if time part is valid.
	// Otherwise, any invalid time or timezone part is truncated and gives warning.
	// TODO: It seems like we should be able to reuse the timestamp parsing logic from Datetime.Convert.
	//       Do we need to reimplement this here?
	dt := strings.Split(t, "-")
	if len(dt) > 1 {
		var year, month, day, hour, minute, second int
		var timePart, tzPart string
		var ok bool
		var inputTz = sessTz
		// FIRST try to get date part
		year, month, day, timePart, ok = getDatePart(t)
		if !ok {
			return time.Time{}, ErrIncorrectValue.New(field, t)
		}
		// Then time part
		if timePart != "" {
			hour, minute, second, tzPart, ok = getTimePart(timePart)
			if !ok {
				return time.Time{}, ErrIncorrectValue.New(field, t)
			}
		}
		// Then timezone part
		if tzPart != "" {
			if tzPart[0] != '+' && tzPart[0] != '-' {
				// TODO: warning: Truncated incorrect datetime value: '...'
			} else {
				inputTz, ok = getTimezonePart(tzPart)
				if !ok {
					return time.Time{}, ErrIncorrectValue.New(field, t)
				}
			}
		}

		datetimeVal := fmt.Sprintf("%4d-%02d-%02d %02d:%02d:%02d", year, month, day, hour, minute, second)
		tVal, err := time.Parse(EventDateSpaceTimeFormat, datetimeVal)
		if err != nil {
			return time.Time{}, ErrInvalidTimeZone.New(sessTz)
		}

		// convert the time value to the session timezone for display and storage
		tVal, ok = ConvertTimeZone(tVal, inputTz, sessTz)
		if !ok {
			return time.Time{}, ErrInvalidTimeZone.New(sessTz)
		}
		return tVal, nil
	} else {
		// TODO: support timestamp input parsing (e.g. 2023526...)
		return time.Time{}, fmt.Errorf("timestamp input parsing not supported yet")
	}
}

func getDatePart(s string) (int, int, int, string, bool) {
	matches := dateRegex.FindStringSubmatch(s)
	if matches == nil || len(matches) != 5 {
		return 0, 0, 0, "", false
	}

	year, ok := validateYear(getInt(matches[1]))
	return year, getInt(matches[2]), getInt(matches[3]), matches[4], ok
}

func getTimePart(t string) (int, int, int, string, bool) {
	var hour, minute, second int
	matches := timeRegex.FindStringSubmatch(t)
	if matches == nil || len(matches) != 10 {
		return 0, 0, 0, "", false
	}
	hour = getInt(matches[2])
	if matches[3] == "" {
		return hour, minute, second, "", true
	} else if matches[3] != ":" {
		return 0, 0, 0, "", false
	}
	minute = getInt(matches[4])
	if matches[5] == "" {
		return hour, minute, second, "", true
	} else if matches[5] != ":" {
		return 0, 0, 0, "", false
	}
	second = getInt(matches[6])
	// microsecond with dot in front of it is not needed for now
	//if matches[7] != "." {
	//	return 0, 0, 0, "", false
	//}
	//microsecond := matches[8]
	return hour, minute, second, matches[9], true
}

func getTimezonePart(tz string) (string, bool) {
	matches := tzRegex.FindStringSubmatch(tz)
	if len(matches) == 4 {
		symbol := matches[1]
		hours := matches[2]
		mins := matches[3]
		return fmt.Sprintf("%s%s:%s", symbol, hours, mins), true
	} else {
		return "", false
	}
}

func getInt(s string) int {
	i, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return i
}

func validateYear(i int) (int, bool) {
	if i >= 0 && i <= 69 {
		return i + 2000, true
	} else if i >= 70 && i <= 99 {
		return i + 1900, true
	} else if i >= 1901 && i < 2155 {
		return i, true
	}
	return 0, false
}
