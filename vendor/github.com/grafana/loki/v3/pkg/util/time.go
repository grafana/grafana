package util

import (
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/dskit/httpgrpc"
	"github.com/prometheus/common/model"

	utilsMath "github.com/grafana/loki/v3/pkg/util/math"
)

const (
	nanosecondsInMillisecond = int64(time.Millisecond / time.Nanosecond)
)

func TimeToMillis(t time.Time) int64 {
	return t.UnixNano() / nanosecondsInMillisecond
}

// TimeFromMillis is a helper to turn milliseconds -> time.Time
func TimeFromMillis(ms int64) time.Time {
	return time.Unix(0, ms*nanosecondsInMillisecond)
}

// FormatTimeMillis returns a human readable version of the input time (in milliseconds).
func FormatTimeMillis(ms int64) string {
	return TimeFromMillis(ms).String()
}

// FormatTimeModel returns a human readable version of the input time.
func FormatTimeModel(t model.Time) string {
	return TimeFromMillis(int64(t)).String()
}

// ParseTime parses the string into an int64, milliseconds since epoch.
func ParseTime(s string) (int64, error) {
	if t, err := strconv.ParseFloat(s, 64); err == nil {
		s, ns := math.Modf(t)
		ns = math.Round(ns*1000) / 1000
		tm := time.Unix(int64(s), int64(ns*float64(time.Second)))
		return TimeToMillis(tm), nil
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return TimeToMillis(t), nil
	}
	return 0, httpgrpc.Errorf(http.StatusBadRequest, "cannot parse %q to a valid timestamp", s)
}

// DurationWithJitter returns random duration from "input - input*variance" to "input + input*variance" interval.
func DurationWithJitter(input time.Duration, variancePerc float64) time.Duration {
	// No duration? No jitter.
	if input == 0 {
		return 0
	}

	variance := int64(float64(input) * variancePerc)
	jitter := rand.Int63n(variance*2) - variance

	return input + time.Duration(jitter)
}

// DurationWithPositiveJitter returns random duration from "input" to "input + input*variance" interval.
func DurationWithPositiveJitter(input time.Duration, variancePerc float64) time.Duration {
	// No duration? No jitter.
	if input == 0 {
		return 0
	}

	variance := int64(float64(input) * variancePerc)
	jitter := rand.Int63n(variance)

	return input + time.Duration(jitter)
}

// NewDisableableTicker essentially wraps NewTicker but allows the ticker to be disabled by passing
// zero duration as the interval. Returns a function for stopping the ticker, and the ticker channel.
func NewDisableableTicker(interval time.Duration) (func(), <-chan time.Time) {
	if interval == 0 {
		return func() {}, nil
	}

	tick := time.NewTicker(interval)
	return func() { tick.Stop() }, tick.C
}

const SplitGap = time.Millisecond

// ForInterval splits the given start and end time into given interval.
// The start and end time in splits would be aligned to the interval
// except for the start time of first split and end time of last split which would be kept same as original start/end
// When endTimeInclusive is true, it would keep a gap of 1ms between the splits.
func ForInterval(interval time.Duration, start, end time.Time, endTimeInclusive bool, callback func(start, end time.Time)) {
	if interval <= 0 {
		callback(start, end)
		return
	}

	ogStart := start
	startNs := start.UnixNano()
	start = time.Unix(0, startNs-startNs%interval.Nanoseconds())
	firstInterval := true

	for start := start; start.Before(end); start = start.Add(interval) {
		newEnd := start.Add(interval)
		if !newEnd.Before(end) {
			newEnd = end
		} else if endTimeInclusive {
			newEnd = newEnd.Add(-SplitGap)
		}
		if firstInterval {
			callback(ogStart, newEnd)
			firstInterval = false
			continue
		}
		callback(start, newEnd)
	}
}

// GetFactorOfTime returns the percentage of time that the span `from` to `through`
// accounts for inside the range `minTime` to `maxTime`.
// It also returns the leading and trailing time that is not accounted for.
// Note that `from`, `through`, `minTime` and `maxTime` should have the same scale (e.g. milliseconds).
//
//	MinTime  From              Through  MaxTime
//	┌────────┬─────────────────┬────────┐
//	│        *                 *        │
//	└────────┴─────────────────┴────────┘
//	▲   A    |        C        |   B    ▲
//	└───────────────────────────────────┘
//	        T = MinTime - MaxTime
//
// We get the percentage of time that fits into C
// factor = C = (T - (A + B)) / T = (chunkTime - (leadingTime + trailingTime)) / chunkTime
func GetFactorOfTime(from, through int64, minTime, maxTime int64) (factor float64) {
	if from > maxTime || through < minTime {
		return 0
	}

	if minTime == maxTime {
		// This function is most often used for chunk overlaps
		// a chunk maxTime == minTime when it has only 1 entry
		// return factor 1 to count that chunk's entry
		return 1
	}

	totalTime := maxTime - minTime
	leadingTime := utilsMath.Max64(0, from-minTime)
	trailingTime := utilsMath.Max64(0, maxTime-through)
	factor = float64(totalTime-(leadingTime+trailingTime)) / float64(totalTime)

	return factor
}
