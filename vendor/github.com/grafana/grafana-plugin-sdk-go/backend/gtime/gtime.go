package gtime

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var dateUnitPattern = regexp.MustCompile(`^(\d+)([dwMy])$`)

// ParseInterval parses an interval with support for all units that Grafana uses.
// An interval is relative to the current wall time.
func ParseInterval(inp string) (time.Duration, error) {
	dur, period, err := parse(inp)
	if err != nil {
		return 0, backend.DownstreamError(err)
	}
	if period == "" {
		return dur, nil
	}

	num := int(dur)

	// Use UTC to ensure that the interval is deterministic, and daylight saving
	// doesn't cause surprises
	now := time.Now().UTC()
	switch period {
	case "d":
		return now.AddDate(0, 0, num).Sub(now), nil
	case "w":
		return now.AddDate(0, 0, num*7).Sub(now), nil
	case "M":
		return now.AddDate(0, num, 0).Sub(now), nil
	case "y":
		return now.AddDate(num, 0, 0).Sub(now), nil
	}

	return 0, backend.DownstreamError(fmt.Errorf("invalid interval %q", inp))
}

// ParseDuration parses a duration with support for all units that Grafana uses.
// Durations are independent of wall time.
func ParseDuration(inp string) (time.Duration, error) {
	dur, period, err := parse(inp)
	if err != nil {
		return 0, backend.DownstreamError(err)
	}
	if period == "" {
		return dur, nil
	}

	// The average number of days in a year, using the Julian calendar
	const daysInAYear = 365.25
	const day = 24 * time.Hour
	const week = 7 * day
	const year = time.Duration(float64(day) * daysInAYear)
	const month = time.Duration(float64(year) / 12)

	switch period {
	case "d":
		return dur * day, nil
	case "w":
		return dur * week, nil
	case "M":
		return dur * month, nil
	case "y":
		return dur * year, nil
	}

	return 0, backend.DownstreamError(fmt.Errorf("invalid duration %q", inp))
}

func parse(inp string) (time.Duration, string, error) {
	if inp == "" {
		return 0, "", backend.DownstreamError(errors.New("empty input"))
	}

	// Fast path for simple duration formats (no date units)
	lastChar := inp[len(inp)-1]
	if lastChar != 'd' && lastChar != 'w' && lastChar != 'M' && lastChar != 'y' {
		dur, err := time.ParseDuration(inp)
		return dur, "", err
	}

	// Check if the rest is a number for date units
	numPart := inp[:len(inp)-1]
	isNum := true
	for _, c := range numPart {
		if c < '0' || c > '9' {
			isNum = false
			break
		}
	}
	if isNum {
		num, err := strconv.Atoi(numPart)
		if err != nil {
			return 0, "", err
		}
		return time.Duration(num), string(lastChar), nil
	}

	// Fallback to regex for complex cases
	result := dateUnitPattern.FindStringSubmatch(inp)
	if len(result) != 3 {
		dur, err := time.ParseDuration(inp)
		return dur, "", err
	}

	num, err := strconv.Atoi(result[1])
	if err != nil {
		return 0, "", err
	}

	return time.Duration(num), result[2], nil
}

// FormatInterval converts a duration into the units that Grafana uses
func FormatInterval(inter time.Duration) string {
	year := time.Hour * 24 * 365
	day := time.Hour * 24

	if inter >= year {
		return fmt.Sprintf("%dy", inter/year)
	}

	if inter >= day {
		return fmt.Sprintf("%dd", inter/day)
	}

	if inter >= time.Hour {
		return fmt.Sprintf("%dh", inter/time.Hour)
	}

	if inter >= time.Minute {
		return fmt.Sprintf("%dm", inter/time.Minute)
	}

	if inter >= time.Second {
		return fmt.Sprintf("%ds", inter/time.Second)
	}

	if inter >= time.Millisecond {
		return fmt.Sprintf("%dms", inter/time.Millisecond)
	}

	return "1ms"
}

// GetIntervalFrom returns the minimum interval.
// dsInterval is the string representation of data source min interval, if configured.
// queryInterval is the string representation of query interval (min interval), e.g. "10ms" or "10s".
// queryIntervalMS is a pre-calculated numeric representation of the query interval in milliseconds.
func GetIntervalFrom(dsInterval, queryInterval string, queryIntervalMS int64, defaultInterval time.Duration) (time.Duration, error) {
	// Apparently we are setting default value of queryInterval to 0s now
	interval := queryInterval
	if interval == "0s" {
		interval = ""
	}
	if interval == "" {
		if queryIntervalMS != 0 {
			return time.Duration(queryIntervalMS) * time.Millisecond, nil
		}
	}
	if interval == "" && dsInterval != "" {
		interval = dsInterval
	}
	if interval == "" {
		return defaultInterval, nil
	}

	parsedInterval, err := ParseIntervalStringToTimeDuration(interval)
	if err != nil {
		return time.Duration(0), err
	}

	return parsedInterval, nil
}

// ParseIntervalStringToTimeDuration converts a string representation of a expected (i.e. 1m30s) to time.Duration
// this method copied from grafana/grafana/pkg/tsdb/intervalv2.go
func ParseIntervalStringToTimeDuration(interval string) (time.Duration, error) {
	if len(interval) == 0 {
		return 0, backend.DownstreamError(fmt.Errorf("invalid interval"))
	}

	// extract the interval if it is inside brackets i.e. <10m>
	if interval[0] == '<' {
		interval = interval[1:]
	}
	if len(interval) > 0 && interval[len(interval)-1] == '>' {
		interval = interval[:len(interval)-1]
	}

	// Check if string contains only digits
	isPureNum := true
	for _, c := range interval {
		if c < '0' || c > '9' {
			isPureNum = false
			break
		}
	}

	// if it is number than return it immediately
	if isPureNum {
		num, err := strconv.ParseInt(interval, 10, 64)
		if err != nil {
			return 0, err
		}
		return time.Duration(num) * time.Second, nil
	}

	parsedInterval, err := ParseDuration(interval)
	if err != nil {
		return time.Duration(0), err
	}
	return parsedInterval, nil
}

// RoundInterval returns a predetermined, lower and rounder duration than the given
//
//nolint:gocyclo
func RoundInterval(interval time.Duration) time.Duration {
	switch {
	// 0.01s
	case interval <= 10*time.Millisecond:
		return time.Millisecond * 1 // 0.001s
	// 0.015s
	case interval <= 15*time.Millisecond:
		return time.Millisecond * 10 // 0.01s
	// 0.035s
	case interval <= 35*time.Millisecond:
		return time.Millisecond * 20 // 0.02s
	// 0.075s
	case interval <= 75*time.Millisecond:
		return time.Millisecond * 50 // 0.05s
	// 0.15s
	case interval <= 150*time.Millisecond:
		return time.Millisecond * 100 // 0.1s
	// 0.35s
	case interval <= 350*time.Millisecond:
		return time.Millisecond * 200 // 0.2s
	// 0.75s
	case interval <= 750*time.Millisecond:
		return time.Millisecond * 500 // 0.5s
	// 1.5s
	case interval <= 1500*time.Millisecond:
		return time.Millisecond * 1000 // 1s
	// 3.5s
	case interval <= 3500*time.Millisecond:
		return time.Millisecond * 2000 // 2s
	// 7.5s
	case interval <= 7500*time.Millisecond:
		return time.Millisecond * 5000 // 5s
	// 12.5s
	case interval <= 12500*time.Millisecond:
		return time.Millisecond * 10000 // 10s
	// 17.5s
	case interval <= 17500*time.Millisecond:
		return time.Millisecond * 15000 // 15s
	// 25s
	case interval <= 25000*time.Millisecond:
		return time.Millisecond * 20000 // 20s
	// 45s
	case interval <= 45000*time.Millisecond:
		return time.Millisecond * 30000 // 30s
	// 1.5m
	case interval <= 90000*time.Millisecond:
		return time.Millisecond * 60000 // 1m
	// 3.5m
	case interval <= 210000*time.Millisecond:
		return time.Millisecond * 120000 // 2m
	// 7.5m
	case interval <= 450000*time.Millisecond:
		return time.Millisecond * 300000 // 5m
	// 12.5m
	case interval <= 750000*time.Millisecond:
		return time.Millisecond * 600000 // 10m
	// 17.5m
	case interval <= 1050000*time.Millisecond:
		return time.Millisecond * 900000 // 15m
	// 25m
	case interval <= 1500000*time.Millisecond:
		return time.Millisecond * 1200000 // 20m
	// 45m
	case interval <= 2700000*time.Millisecond:
		return time.Millisecond * 1800000 // 30m
	// 1.5h
	case interval <= 5400000*time.Millisecond:
		return time.Millisecond * 3600000 // 1h
	// 2.5h
	case interval <= 9000000*time.Millisecond:
		return time.Millisecond * 7200000 // 2h
	// 4.5h
	case interval <= 16200000*time.Millisecond:
		return time.Millisecond * 10800000 // 3h
	// 9h
	case interval <= 32400000*time.Millisecond:
		return time.Millisecond * 21600000 // 6h
	// 24h
	case interval <= 86400000*time.Millisecond:
		return time.Millisecond * 43200000 // 12h
	// 48h
	case interval <= 172800000*time.Millisecond:
		return time.Millisecond * 86400000 // 24h
	// 1w
	case interval <= 604800000*time.Millisecond:
		return time.Millisecond * 86400000 // 24h
	// 3w
	case interval <= 1814400000*time.Millisecond:
		return time.Millisecond * 604800000 // 1w
	// 2y
	case interval < 3628800000*time.Millisecond:
		return time.Millisecond * 2592000000 // 30d
	default:
		return time.Millisecond * 31536000000 // 1y
	}
}
