package moment

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// links
// http://en.wikipedia.org/wiki/ISO_week_date
// http://golang.org/src/pkg/time/format.go
// http://www.php.net/manual/en/class.datetime.php#datetime.constants.rfc822
// http://php.net/manual/en/function.date.php
// http://www.php.net/manual/en/datetime.formats.relative.php

// @todo are these constants needed if they are in the time package?
// There are a lot of extras here, and RFC822 doesn't match up. Why?
// Also, is timezone usage wrong? Double-check
const (
	ATOM    = "2006-01-02T15:04:05Z07:00"
	COOKIE  = "Monday, 02-Jan-06 15:04:05 MST"
	ISO8601 = "2006-01-02T15:04:05Z0700"
	RFC822  = "Mon, 02 Jan 06 15:04:05 Z0700"
	RFC850  = "Monday, 02-Jan-06 15:04:05 MST"
	RFC1036 = "Mon, 02 Jan 06 15:04:05 Z0700"
	RFC1123 = "Mon, 02 Jan 2006 15:04:05 Z0700"
	RFC2822 = "Mon, 02 Jan 2006 15:04:05 Z0700"
	RFC3339 = "2006-01-02T15:04:05Z07:00"
	RSS     = "Mon, 02 Jan 2006 15:04:05 Z0700"
	W3C     = "2006-01-02T15:04:05Z07:00"
)

var (
	regex_days    = "monday|mon|tuesday|tues|wednesday|wed|thursday|thurs|friday|fri|saturday|sat|sunday|sun"
	regex_period  = "second|minute|hour|day|week|month|year"
	regex_numbers = "one|two|three|four|five|six|seven|eight|nine|ten"
)

// regexp
var (
	compiled    = regexp.MustCompile(`\s{2,}`)
	relativeday = regexp.MustCompile(`(yesterday|today|tomorrow)`)
	//relative1      = regexp.MustCompile(`(first|last) day of (this|next|last|previous) (week|month|year)`)
	//relative2      = regexp.MustCompile(`(first|last) day of (` + "jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december" + `)(?:\s(\d{4,4}))?`)
	relative3 = regexp.MustCompile(`((?P<relperiod>this|next|last|previous) )?(` + regex_days + `)`)
	//relativeval    = regexp.MustCompile(`([0-9]+) (day|week|month|year)s? ago`)
	ago            = regexp.MustCompile(`([0-9]+) (` + regex_period + `)s? ago`)
	ordinal        = regexp.MustCompile("([0-9]+)(st|nd|rd|th)")
	written        = regexp.MustCompile(regex_numbers)
	relativediff   = regexp.MustCompile(`([\+\-])?([0-9]+),? ?(` + regex_period + `)s?`)
	relativetime   = regexp.MustCompile(`(?P<hour>\d\d?):(?P<minutes>\d\d?)(:(?P<seconds>\d\d?))?\s?(?P<meridiem>am|pm)?\s?(?P<zone>[a-z]{3,3})?|(?P<relativetime>noon|midnight)`)
	yearmonthday   = regexp.MustCompile(`(?P<year>\d{4})-(?P<month>\d{1,2})-(?P<day>\d{1,2})`)
	relativeperiod = regexp.MustCompile(`(?P<relperiod>this|next|last) (week|month|year)`)
	numberRegex    = regexp.MustCompile("([0-9]+)(?:<stdOrdinal>)")
)

// http://golang.org/src/pkg/time/format.go?s=12686:12728#L404

// Timezone implementation
// https://groups.google.com/forum/#!topic/golang-nuts/XEVN4QwTvHw
// http://en.wikipedia.org/wiki/Zone.tab

// Support ISO8601 Duration Parsing?
// http://en.wikipedia.org/wiki/ISO_8601

// Differences
// Months are NOT zero-index, MOmentJS they are
// Weeks are 0 indexed
//     -- Sunday being the last day of the week ISO-8601 - is that diff from Moment?
// From/FromNow Return a Diff object rather than strings

// Support for locale and languages with English as default

// Support for strftime
// https://github.com/benjaminoakes/moment-strftime
// Format: https://php.net/strftime

type Moment struct {
	time time.Time

	Parser
}

type Parser interface {
	Convert(string) string
}

func New() *Moment {
	m := &Moment{time.Now(), new(MomentParser)}

	return m
}

func NewMoment(t time.Time) *Moment {
	m := &Moment{t, new(MomentParser)}

	return m
}

func (m *Moment) GetTime() time.Time {
	return m.time
}

func (m *Moment) Now() *Moment {
	m.time = time.Now().In(m.GetTime().Location())

	return m
}

func (m *Moment) Moment(layout string, datetime string) *Moment {
	return m.MomentGo(m.Convert(layout), datetime)
}

func (m *Moment) MomentGo(layout string, datetime string) *Moment {
	time, _ := time.Parse(layout, datetime)

	m.time = time

	return m
}

// This method is nowhere near done - requires lots of work.
func (m *Moment) Strtotime(str string) *Moment {
	str = strings.ToLower(strings.TrimSpace(str))
	str = compiled.ReplaceAllString(str, " ")

	// Replace written numbers (i.e. nine, ten) with actual numbers (9, 10)
	str = written.ReplaceAllStringFunc(str, func(n string) string {
		switch n {
		case "one":
			return "1"
		case "two":
			return "2"
		case "three":
			return "3"
		case "four":
			return "4"
		case "five":
			return "5"
		case "six":
			return "6"
		case "seven":
			return "7"
		case "eight":
			return "8"
		case "nine":
			return "9"
		case "ten":
			return "10"
		}

		return ""
	})

	// Remove ordinal suffixes st, nd, rd, th
	str = ordinal.ReplaceAllString(str, "$1")

	// Replace n second|minute|hour... ago to -n second|minute|hour... to consolidate parsing
	str = ago.ReplaceAllString(str, "-$1 $2")

	// Look for relative +1day, +3 days 5 hours 15 minutes
	if match := relativediff.FindAllStringSubmatch(str, -1); match != nil {
		for i := range match {
			switch match[i][1] {
			case "-":
				number, _ := strconv.Atoi(match[i][2])
				m.Subtract(match[i][3], number)
			default:
				number, _ := strconv.Atoi(match[i][2])
				m.Add(match[i][3], number)
			}

			str = strings.Replace(str, match[i][0], "", 1)
		}
	}

	// Remove any words that aren't needed for consistency
	str = strings.Replace(str, " at ", " ", -1)
	str = strings.Replace(str, " on ", " ", -1)

	// Support for interchangeable previous/last
	str = strings.Replace(str, "previous", "last", -1)

	var dateDefaults = map[string]int{
		"year":  0,
		"month": 0,
		"day":   0,
	}

	dateMatches := dateDefaults
	if match := yearmonthday.FindStringSubmatch(str); match != nil {
		for i, name := range yearmonthday.SubexpNames() {
			if i == 0 {
				str = strings.Replace(str, match[i], "", 1)
				continue
			}

			if match[i] == "" {
				continue
			}

			if name == "year" || name == "month" || name == "day" {
				dateMatches[name], _ = strconv.Atoi(match[i])
			}

		}

		defer m.strtotimeSetDate(dateMatches)
		if str == "" {
			// Nothing left to parse
			return m
		}

		str = strings.TrimSpace(str)
	}

	// Try to parse out time from the string
	var timeDefaults = map[string]int{
		"hour":    0,
		"minutes": 0,
		"seconds": 0,
	}

	timeMatches := timeDefaults
	var zone string
	if match := relativetime.FindStringSubmatch(str); match != nil {
		for i, name := range relativetime.SubexpNames() {
			if i == 0 {
				str = strings.Replace(str, match[i], "", 1)
				continue
			}

			if match[i] == "" {
				continue
			}

			// Midnight is all zero's so nothing to do
			if name == "relativetime" && match[i] == "noon" {
				timeDefaults["hour"] = 12
			}

			if name == "zone" {
				zone = match[i]
			}

			if name == "meridiem" && match[i] == "pm" && timeMatches["hour"] < 12 {
				timeMatches["hour"] += 12
			}

			if name == "hour" || name == "minutes" || name == "seconds" {
				timeMatches[name], _ = strconv.Atoi(match[i])
			}
		}

		// Processing time is always last
		defer m.strtotimeSetTime(timeMatches, zone)

		if str == "" {
			// Nothing left to parse
			return m
		}

		str = strings.TrimSpace(str)
	}

	// m.StartOf("month", "January").GoTo(time.Sunday)

	if match := relativeperiod.FindStringSubmatch(str); match != nil {
		period := match[1]
		unit := match[2]

		str = strings.Replace(str, match[0], "", 1)

		switch period {
		case "next":
			if unit == "year" {
				m.AddYears(1)
			}
			if unit == "month" {
				m.AddMonths(1)
			}
			if unit == "week" {
				m.AddWeeks(1)
			}
		case "last":
			if unit == "year" {
				m.SubYears(1)
			}
			if unit == "month" {
				m.SubMonths(1)
			}
			if unit == "week" {
				m.SubWeeks(1)
			}
		}

		str = strings.TrimSpace(str)

		// first := regexp.MustCompile("(?P<relperiod>first|last)?")
	}

	/*

							   relativeday:        first day of
							   relativeperiod:     this, last, next
							   relativeperiodunit  week, month, year
							   day:                monday, tues, wednesday
							   month:              january, feb


							   YYYY-MM-DD (HH:MM:SS MST)?
							   MM-DD-YYYY (HH:MM:SS MST)
							   10 September 2015 (HH:MM:SS MST)?
							   September, 10 2015 (HH:MM:SS MST)?
							   September 10 2015 (HH:MM:SS M

		                           this year 2014
		                           next year 2015
		                           last year 2013

		                        this month April
		                        next month May
		                        last month Mar

		                        first day of April
		                        last day of April


							   DONE 3PM
							   DONE 3:00 PM
							   DONE 3:00:05 MST
							   3PM on January 5th
							   January 5th at 3:00PM
							   first saturday _of_ next month
							   first saturday _of_ next month _at_ 3:00PM
							   saturday of next week
							   saturday of last week
							        saturday next week
							        monday next week
							   saturday of this week
							   saturday at 3:00pm
							   saturday at 4:00PM
							   saturday at midn
							   first of january
							   last of january
				               january of next year
							   first day of january
							   last day of january
							   		      first day of February

						       DONE midnight
						       DONE noon
							   DONE 3 days ago
							   DONE ten days
							   DONE 9 weeks ago // Convert to -9 weeks
							   DONE -9 weeks

	*/

	if match := relativeday.FindStringSubmatch(str); match != nil && len(match) > 1 {
		day := match[1]

		str = strings.Replace(str, match[0], "", 1)

		switch day {
		case "today":
			m.Today()
		case "yesterday":
			m.Yesterday()
		case "tomorrow":
			m.Tomorrow()
		}
	}

	if match := relative3.FindStringSubmatch(str); match != nil {
		var when string
		for i, name := range relative3.SubexpNames() {
			if name == "relperiod" {
				when = match[i]
			}
		}
		weekDay := match[len(match)-1]

		str = strings.Replace(str, match[0], "", 1)

		wDay, err := ParseWeekDay(weekDay)
		if err == nil {
			switch when {
			case "last", "previous":
				m.GoBackTo(wDay, true)

			case "next":
				m.GoTo(wDay, true)

			case "", "this":
				m.GoTo(wDay, false)
			default:
				m.GoTo(wDay, false)
			}
		}
	}

	/*


	   yesterday 11:00
	   today 11:00
	   tomorrow 11:00
	   midnight
	   noon
	   DONE +n (second|day|week|month|year)s?
	   DONE -n (second|day|week|month|year)s?
	   next (monday|tuesday|wednesday|thursday|friday|saturday|sunday) 11:00
	   last (monday|tuesday|wednesday|thursday|friday|saturday|sunday) 11:00
	   next (month|year)
	   last (month|year)
	   first day of (january|february|march...|december) 2014
	   last day of (january|february|march...|december) 2014
	   first day of (this|next|last) (week|month|year)
	   last day of (this|next|last) (week|month|year)
	   first (monday|tuesday|wednesday) of July 2014
	   last (monday|tuesday|wednesday) of July 2014
	   n (day|week|month|year)s? ago
	   Monday|Tuesday|Wednesday|Thursday|Friday
	   Monday (last|this|next) week

	   DONE +1 week 2 days 3 hours 4 minutes 5 seconds
	*/

	return m
}

// @todo deal with timezone
func (m *Moment) strtotimeSetTime(time map[string]int, zone string) {
	m.SetHour(time["hour"]).SetMinute(time["minutes"]).SetSecond(time["seconds"])
}

func (m *Moment) strtotimeSetDate(date map[string]int) {
	m.SetYear(date["year"]).SetMonth(time.Month(date["month"])).SetDay(date["day"])
}

func (m Moment) Clone() *Moment {
	copy := New()
	copy.time = m.GetTime()

	return copy
}

/**
 * Getters
 *
 */
// https://groups.google.com/forum/#!topic/golang-nuts/pret7hjDc70
func (m *Moment) Millisecond() {

}

func (m *Moment) Second() int {
	return m.GetTime().Second()
}

func (m *Moment) Minute() int {
	return m.GetTime().Minute()
}

func (m *Moment) Hour() int {
	return m.GetTime().Hour()
}

// Day of month
func (m *Moment) Date() int {
	return m.DayOfMonth()
}

// Carbon convenience method
func (m *Moment) DayOfMonth() int {
	return m.GetTime().Day()
}

// Day of week (int or string)
func (m *Moment) Day() time.Weekday {
	return m.DayOfWeek()
}

// Carbon convenience method
func (m *Moment) DayOfWeek() time.Weekday {
	return m.GetTime().Weekday()
}

func (m *Moment) DayOfWeekISO() int {
	day := m.GetTime().Weekday()

	if day == time.Sunday {
		return 7
	}

	return int(day)
}

func (m *Moment) DayOfYear() int {
	return m.GetTime().YearDay()
}

// Day of Year with zero padding
func (m *Moment) dayOfYearZero() string {
	day := m.GetTime().YearDay()

	if day < 10 {
		return fmt.Sprintf("00%d", day)
	}

	if day < 100 {
		return fmt.Sprintf("0%d", day)
	}

	return fmt.Sprintf("%d", day)
}

// todo panic?
func (m *Moment) Weekday(index int) string {
	if index > 6 {
		panic("Weekday index must be between 0 and 6")
	}

	return time.Weekday(index).String()
}

func (m *Moment) Week() int {
	return 0
}

// Is this the week number where as ISOWeekYear is the number of weeks in the year?
// @see http://stackoverflow.com/questions/18478741/get-weeks-in-year
func (m *Moment) ISOWeek() int {
	_, week := m.GetTime().ISOWeek()

	return week
}

// @todo Consider language support
func (m *Moment) Month() time.Month {
	return m.GetTime().Month()
}

func (m *Moment) Quarter() (quarter int) {
	quarter = 4

	switch m.Month() {
	case time.January, time.February, time.March:
		quarter = 1
	case time.April, time.May, time.June:
		quarter = 2
	case time.July, time.August, time.September:
		quarter = 3
	}

	return
}

func (m *Moment) Year() int {
	return m.GetTime().Year()
}

// @see comments for ISOWeek
func (m *Moment) WeekYear() {

}

func (m *Moment) ISOWeekYear() {

}

/**
 * Manipulate
 *
 */
func (m *Moment) Add(key string, value int) *Moment {
	switch key {
	case "years", "year", "y":
		m.AddYears(value)
	case "months", "month", "M":
		m.AddMonths(value)
	case "weeks", "week", "w":
		m.AddWeeks(value)
	case "days", "day", "d":
		m.AddDays(value)
	case "hours", "hour", "h":
		m.AddHours(value)
	case "minutes", "minute", "m":
		m.AddMinutes(value)
	case "seconds", "second", "s":
		m.AddSeconds(value)
	case "milliseconds", "millisecond", "ms":

	}

	return m
}

// Carbon
func (m *Moment) AddSeconds(seconds int) *Moment {
	return m.addTime(time.Second * time.Duration(seconds))
}

// Carbon
func (m *Moment) AddMinutes(minutes int) *Moment {
	return m.addTime(time.Minute * time.Duration(minutes))
}

// Carbon
func (m *Moment) AddHours(hours int) *Moment {
	return m.addTime(time.Hour * time.Duration(hours))
}

// Carbon
func (m *Moment) AddDay() *Moment {
	return m.AddDays(1)
}

// Carbon
func (m *Moment) AddDays(days int) *Moment {
	m.time = m.GetTime().AddDate(0, 0, days)

	return m
}

// Carbon
func (m *Moment) AddWeeks(weeks int) *Moment {
	return m.AddDays(weeks * 7)
}

// Carbon
func (m *Moment) AddMonths(months int) *Moment {
	m.time = m.GetTime().AddDate(0, months, 0)

	return m
}

// Carbon
func (m *Moment) AddYears(years int) *Moment {
	m.time = m.GetTime().AddDate(years, 0, 0)

	return m
}

func (m *Moment) addTime(d time.Duration) *Moment {
	m.time = m.GetTime().Add(d)

	return m
}

func (m *Moment) Subtract(key string, value int) *Moment {
	switch key {
	case "years", "year", "y":
		m.SubYears(value)
	case "months", "month", "M":
		m.SubMonths(value)
	case "weeks", "week", "w":
		m.SubWeeks(value)
	case "days", "day", "d":
		m.SubDays(value)
	case "hours", "hour", "h":
		m.SubHours(value)
	case "minutes", "minute", "m":
		m.SubMinutes(value)
	case "seconds", "second", "s":
		m.SubSeconds(value)
	case "milliseconds", "millisecond", "ms":

	}

	return m
}

// Carbon
func (m *Moment) SubSeconds(seconds int) *Moment {
	return m.addTime(time.Second * time.Duration(seconds*-1))
}

// Carbon
func (m *Moment) SubMinutes(minutes int) *Moment {
	return m.addTime(time.Minute * time.Duration(minutes*-1))
}

// Carbon
func (m *Moment) SubHours(hours int) *Moment {
	return m.addTime(time.Hour * time.Duration(hours*-1))
}

// Carbon
func (m *Moment) SubDay() *Moment {
	return m.SubDays(1)
}

// Carbon
func (m *Moment) SubDays(days int) *Moment {
	return m.AddDays(days * -1)
}

func (m *Moment) SubWeeks(weeks int) *Moment {
	return m.SubDays(weeks * 7)
}

// Carbon
func (m *Moment) SubMonths(months int) *Moment {
	return m.AddMonths(months * -1)
}

// Carbon
func (m *Moment) SubYears(years int) *Moment {
	return m.AddYears(years * -1)
}

// Carbon
func (m *Moment) Today() *Moment {
	return m.Now()
}

// Carbon
func (m *Moment) Tomorrow() *Moment {
	return m.Today().AddDay()
}

// Carbon
func (m *Moment) Yesterday() *Moment {
	return m.Today().SubDay()
}

func (m *Moment) StartOf(key string) *Moment {
	switch key {
	case "year", "y":
		m.StartOfYear()
	case "month", "M":
		m.StartOfMonth()
	case "week", "w":
		m.StartOfWeek()
	case "day", "d":
		m.StartOfDay()
	case "hour", "h":
		if m.Minute() > 0 {
			m.SubMinutes(m.Minute())
		}

		if m.Second() > 0 {
			m.SubSeconds(m.Second())
		}
	case "minute", "m":
		if m.Second() > 0 {
			m.SubSeconds(m.Second())
		}
	case "second", "s":

	}

	return m
}

// Carbon
func (m *Moment) StartOfDay() *Moment {
	if m.Hour() > 0 {
		_, timeOffset := m.GetTime().Zone()
		m.SubHours(m.Hour())

		_, newTimeOffset := m.GetTime().Zone()
		diffOffset := timeOffset - newTimeOffset
		if diffOffset != 0 {
			// we need to adjust for time zone difference
			m.AddSeconds(diffOffset)
		}
	}

	return m.StartOf("hour")
}

// @todo ISO8601 Starts on Monday
func (m *Moment) StartOfWeek() *Moment {
	return m.GoBackTo(time.Monday, false).StartOfDay()
}

// Carbon
func (m *Moment) StartOfMonth() *Moment {
	return m.SetDay(1).StartOfDay()
}

// Carbon
func (m *Moment) StartOfYear() *Moment {
	return m.SetMonth(time.January).SetDay(1).StartOfDay()
}

// Carbon
func (m *Moment) EndOf(key string) *Moment {
	switch key {
	case "year", "y":
		m.EndOfYear()
	case "month", "M":
		m.EndOfMonth()
	case "week", "w":
		m.EndOfWeek()
	case "day", "d":
		m.EndOfDay()
	case "hour", "h":
		if m.Minute() < 59 {
			m.AddMinutes(59 - m.Minute())
		}
	case "minute", "m":
		if m.Second() < 59 {
			m.AddSeconds(59 - m.Second())
		}
	case "second", "s":

	}

	return m
}

// Carbon
func (m *Moment) EndOfDay() *Moment {
	if m.Hour() < 23 {
		_, timeOffset := m.GetTime().Zone()
		m.AddHours(23 - m.Hour())

		_, newTimeOffset := m.GetTime().Zone()
		diffOffset := newTimeOffset - timeOffset
		if diffOffset != 0 {
			// we need to adjust for time zone difference
			m.SubSeconds(diffOffset)
		}
	}

	return m.EndOf("hour")
}

// @todo ISO8601 Ends on Sunday
func (m *Moment) EndOfWeek() *Moment {
	return m.GoTo(time.Sunday, false).EndOfDay()
}

// Carbon
func (m *Moment) EndOfMonth() *Moment {
	return m.SetDay(m.DaysInMonth()).EndOfDay()
}

// Carbon
func (m *Moment) EndOfYear() *Moment {
	return m.GoToMonth(time.December, false).EndOfMonth()
}

// Custom
func (m *Moment) GoTo(day time.Weekday, next bool) *Moment {
	if m.Day() == day {
		if !next {
			return m
		} else {
			m.AddDay()
		}
	}

	var diff int
	if diff = int(day) - int(m.Day()); diff > 0 {
		return m.AddDays(diff)
	}

	return m.AddDays(7 + diff)
}

// Custom
func (m *Moment) GoBackTo(day time.Weekday, previous bool) *Moment {
	if m.Day() == day {
		if !previous {
			return m
		} else {
			m.SubDay()
		}
	}

	var diff int
	if diff = int(day) - int(m.Day()); diff > 0 {
		return m.SubDays(7 - diff)
	}

	return m.SubDays(diff * -1)
}

// Custom
func (m *Moment) GoToMonth(month time.Month, next bool) *Moment {
	if m.Month() == month {
		if !next {
			return m
		} else {
			m.AddMonths(1)
		}
	}

	var diff int
	if diff = int(month - m.Month()); diff > 0 {
		return m.AddMonths(diff)
	}

	return m.AddMonths(12 + diff)
}

// Custom
func (m *Moment) GoBackToMonth(month time.Month, previous bool) *Moment {
	if m.Month() == month {
		if !previous {
			return m
		} else {
			m.SubMonths(1)
		}
	}

	var diff int
	if diff = int(month) - int(m.Month()); diff > 0 {
		return m.SubMonths(12 - diff)
	}

	return m.SubMonths(diff * -1)
}

func (m *Moment) SetSecond(seconds int) *Moment {
	if seconds >= 0 && seconds <= 60 {
		return m.AddSeconds(seconds - m.Second())
	}

	return m
}

func (m *Moment) SetMinute(minute int) *Moment {
	if minute >= 0 && minute <= 60 {
		return m.AddMinutes(minute - m.Minute())
	}

	return m
}

func (m *Moment) SetHour(hour int) *Moment {
	if hour >= 0 && hour <= 23 {
		return m.AddHours(hour - m.Hour())
	}

	return m
}

// Custom
func (m *Moment) SetDay(day int) *Moment {
	if m.DayOfMonth() == day {
		return m
	}

	return m.AddDays(day - m.DayOfMonth())
}

// Custom
func (m *Moment) SetMonth(month time.Month) *Moment {
	if m.Month() > month {
		return m.GoBackToMonth(month, false)
	}

	return m.GoToMonth(month, false)
}

// Custom
func (m *Moment) SetYear(year int) *Moment {
	if m.Year() == year {
		return m
	}

	return m.AddYears(year - m.Year())
}

// UTC Mode. @see http://momentjs.com/docs/#/parsing/utc/
func (m *Moment) UTC() *Moment {
	return m
}

// http://momentjs.com/docs/#/manipulating/timezone-offset/
func (m *Moment) Zone() int {
	_, offset := m.GetTime().Zone()

	return (offset / 60) * -1
}

/**
 * Display
 *
 */
func (m *Moment) Format(layout string) string {
	format := m.Convert(layout)
	hasCustom := false

	formatted := m.GetTime().Format(format)

	if strings.Contains(formatted, "<std") {
		hasCustom = true
		formatted = strings.Replace(formatted, "<stdUnix>", fmt.Sprintf("%d", m.Unix()), -1)
		formatted = strings.Replace(formatted, "<stdWeekOfYear>", fmt.Sprintf("%d", m.ISOWeek()), -1)
		formatted = strings.Replace(formatted, "<stdDayOfWeek>", fmt.Sprintf("%d", m.DayOfWeek()), -1)
		formatted = strings.Replace(formatted, "<stdDayOfWeekISO>", fmt.Sprintf("%d", m.DayOfWeekISO()), -1)
		formatted = strings.Replace(formatted, "<stdDayOfYear>", fmt.Sprintf("%d", m.DayOfYear()), -1)
		formatted = strings.Replace(formatted, "<stdQuarter>", fmt.Sprintf("%d", m.Quarter()), -1)
		formatted = strings.Replace(formatted, "<stdDayOfYearZero>", m.dayOfYearZero(), -1)
		formatted = strings.Replace(formatted, "<stdHourNoZero>", fmt.Sprintf("%d", m.Hour()), -1)
	}

	// This has to happen after time.Format
	if hasCustom && strings.Contains(formatted, "<stdOrdinal>") {
		formatted = numberRegex.ReplaceAllStringFunc(formatted, func(n string) string {
			ordinal, _ := strconv.Atoi(strings.Replace(n, "<stdOrdinal>", "", 1))
			return m.ordinal(ordinal)
		})
	}

	return formatted
}

func (m *Moment) FormatGo(layout string) string {
	return m.GetTime().Format(layout)
}

// From Dmytro Shteflyuk @https://groups.google.com/forum/#!topic/golang-nuts/l8NhI74jl-4
func (m *Moment) ordinal(x int) string {
	suffix := "th"
	switch x % 10 {
	case 1:
		if x%100 != 11 {
			suffix = "st"
		}
	case 2:
		if x%100 != 12 {
			suffix = "nd"
		}
	case 3:
		if x%100 != 13 {
			suffix = "rd"
		}
	}

	return strconv.Itoa(x) + suffix
}

func (m *Moment) FromNow() Diff {
	now := new(Moment)
	now.Now()

	return m.From(now)
}

// Carbon
func (m *Moment) From(f *Moment) Diff {
	return m.GetDiff(f)
}

/**
 * Difference
 *
 */
func (m *Moment) Diff(t *Moment, unit string) int {
	diff := m.GetDiff(t)

	switch unit {
	case "years":
		return diff.InYears()
	case "months":
		return diff.InMonths()
	case "weeks":
		return diff.InWeeks()
	case "days":
		return diff.InDays()
	case "hours":
		return diff.InHours()
	case "minutes":
		return diff.InMinutes()
	case "seconds":
		return diff.InSeconds()
	}

	return 0
}

// Custom
func (m *Moment) GetDiff(t *Moment) Diff {
	duration := m.GetTime().Sub(t.GetTime())

	return Diff{duration}
}

/**
 * Display
 *
 */
func (m *Moment) ValueOf() int64 {
	return m.Unix() * 1000
}

func (m *Moment) Unix() int64 {
	return m.GetTime().Unix()
}

func (m *Moment) DaysInMonth() int {
	days := 31
	switch m.Month() {
	case time.April, time.June, time.September, time.November:
		days = 30
		break
	case time.February:
		days = 28
		if m.IsLeapYear() {
			days = 29
		}
		break
	}

	return days
}

// or ToSlice?
func (m *Moment) ToArray() []int {
	return []int{
		m.Year(),
		int(m.Month()),
		m.DayOfMonth(),
		m.Hour(),
		m.Minute(),
		m.Second(),
	}
}

/**
 * Query
 *
 */
func (m *Moment) IsBefore(t Moment) bool {
	return m.GetTime().Before(t.GetTime())
}

func (m *Moment) IsSame(t *Moment, layout string) bool {
	return m.Format(layout) == t.Format(layout)
}

func (m *Moment) IsAfter(t Moment) bool {
	return m.GetTime().After(t.GetTime())
}

// Carbon
func (m *Moment) IsToday() bool {
	today := m.Clone().Today()

	return m.Year() == today.Year() && m.Month() == today.Month() && m.Day() == today.Day()
}

// Carbon
func (m *Moment) IsTomorrow() bool {
	tomorrow := m.Clone().Tomorrow()

	return m.Year() == tomorrow.Year() && m.Month() == tomorrow.Month() && m.Day() == tomorrow.Day()
}

// Carbon
func (m *Moment) IsYesterday() bool {
	yesterday := m.Clone().Yesterday()

	return m.Year() == yesterday.Year() && m.Month() == yesterday.Month() && m.Day() == yesterday.Day()
}

// Carbon
func (m *Moment) IsWeekday() bool {
	return !m.IsWeekend()
}

// Carbon
func (m *Moment) IsWeekend() bool {
	return m.DayOfWeek() == time.Sunday || m.DayOfWeek() == time.Saturday
}

func (m *Moment) IsLeapYear() bool {
	year := m.Year()
	return year%4 == 0 && (year%100 != 0 || year%400 == 0)
}

// Custom
func (m *Moment) Range(start Moment, end Moment) bool {
	return m.IsAfter(start) && m.IsBefore(end)
}
