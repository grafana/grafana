package gofakeit

import (
	"strconv"
	"time"
)

// Date will generate a random time.Time struct
func Date() time.Time {
	return time.Date(Year(), time.Month(Number(0, 12)), Day(), Hour(), Minute(), Second(), NanoSecond(), time.UTC)
}

// DateRange will generate a random time.Time struct between a start and end date
func DateRange(start, end time.Time) time.Time {
	return time.Unix(0, int64(Number(int(start.UnixNano()), int(end.UnixNano())))).UTC()
}

// Month will generate a random month string
func Month() string {
	return time.Month(Number(1, 12)).String()
}

// Day will generate a random day between 1 - 31
func Day() int {
	return Number(1, 31)
}

// WeekDay will generate a random weekday string (Monday-Sunday)
func WeekDay() string {
	return time.Weekday(Number(0, 6)).String()
}

// Year will generate a random year between 1900 - current year
func Year() int {
	return Number(1900, time.Now().Year())
}

// Hour will generate a random hour - in military time
func Hour() int {
	return Number(0, 23)
}

// Minute will generate a random minute
func Minute() int {
	return Number(0, 59)
}

// Second will generate a random second
func Second() int {
	return Number(0, 59)
}

// NanoSecond will generate a random nano second
func NanoSecond() int {
	return Number(0, 999999999)
}

// TimeZone will select a random timezone string
func TimeZone() string {
	return getRandValue([]string{"timezone", "text"})
}

// TimeZoneFull will select a random full timezone string
func TimeZoneFull() string {
	return getRandValue([]string{"timezone", "full"})
}

// TimeZoneAbv will select a random timezone abbreviation string
func TimeZoneAbv() string {
	return getRandValue([]string{"timezone", "abr"})
}

// TimeZoneOffset will select a random timezone offset
func TimeZoneOffset() float32 {
	value, _ := strconv.ParseFloat(getRandValue([]string{"timezone", "offset"}), 32)
	return float32(value)
}
