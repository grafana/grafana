package assertions

import (
	"fmt"
	"time"
)

// ShouldHappenBefore receives exactly 2 time.Time arguments and asserts that the first happens before the second.
func ShouldHappenBefore(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}
	actualTime, firstOk := actual.(time.Time)
	expectedTime, secondOk := expected[0].(time.Time)

	if !firstOk || !secondOk {
		return shouldUseTimes
	}

	if !actualTime.Before(expectedTime) {
		return fmt.Sprintf(shouldHaveHappenedBefore, actualTime, expectedTime, actualTime.Sub(expectedTime))
	}

	return success
}

// ShouldHappenOnOrBefore receives exactly 2 time.Time arguments and asserts that the first happens on or before the second.
func ShouldHappenOnOrBefore(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}
	actualTime, firstOk := actual.(time.Time)
	expectedTime, secondOk := expected[0].(time.Time)

	if !firstOk || !secondOk {
		return shouldUseTimes
	}

	if actualTime.Equal(expectedTime) {
		return success
	}
	return ShouldHappenBefore(actualTime, expectedTime)
}

// ShouldHappenAfter receives exactly 2 time.Time arguments and asserts that the first happens after the second.
func ShouldHappenAfter(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}
	actualTime, firstOk := actual.(time.Time)
	expectedTime, secondOk := expected[0].(time.Time)

	if !firstOk || !secondOk {
		return shouldUseTimes
	}
	if !actualTime.After(expectedTime) {
		return fmt.Sprintf(shouldHaveHappenedAfter, actualTime, expectedTime, expectedTime.Sub(actualTime))
	}
	return success
}

// ShouldHappenOnOrAfter receives exactly 2 time.Time arguments and asserts that the first happens on or after the second.
func ShouldHappenOnOrAfter(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}
	actualTime, firstOk := actual.(time.Time)
	expectedTime, secondOk := expected[0].(time.Time)

	if !firstOk || !secondOk {
		return shouldUseTimes
	}
	if actualTime.Equal(expectedTime) {
		return success
	}
	return ShouldHappenAfter(actualTime, expectedTime)
}

// ShouldHappenBetween receives exactly 3 time.Time arguments and asserts that the first happens between (not on) the second and third.
func ShouldHappenBetween(actual interface{}, expected ...interface{}) string {
	if fail := need(2, expected); fail != success {
		return fail
	}
	actualTime, firstOk := actual.(time.Time)
	min, secondOk := expected[0].(time.Time)
	max, thirdOk := expected[1].(time.Time)

	if !firstOk || !secondOk || !thirdOk {
		return shouldUseTimes
	}

	if !actualTime.After(min) {
		return fmt.Sprintf(shouldHaveHappenedBetween, actualTime, min, max, min.Sub(actualTime))
	}
	if !actualTime.Before(max) {
		return fmt.Sprintf(shouldHaveHappenedBetween, actualTime, min, max, actualTime.Sub(max))
	}
	return success
}

// ShouldHappenOnOrBetween receives exactly 3 time.Time arguments and asserts that the first happens between or on the second and third.
func ShouldHappenOnOrBetween(actual interface{}, expected ...interface{}) string {
	if fail := need(2, expected); fail != success {
		return fail
	}
	actualTime, firstOk := actual.(time.Time)
	min, secondOk := expected[0].(time.Time)
	max, thirdOk := expected[1].(time.Time)

	if !firstOk || !secondOk || !thirdOk {
		return shouldUseTimes
	}
	if actualTime.Equal(min) || actualTime.Equal(max) {
		return success
	}
	return ShouldHappenBetween(actualTime, min, max)
}

// ShouldNotHappenOnOrBetween receives exactly 3 time.Time arguments and asserts that the first
// does NOT happen between or on the second or third.
func ShouldNotHappenOnOrBetween(actual interface{}, expected ...interface{}) string {
	if fail := need(2, expected); fail != success {
		return fail
	}
	actualTime, firstOk := actual.(time.Time)
	min, secondOk := expected[0].(time.Time)
	max, thirdOk := expected[1].(time.Time)

	if !firstOk || !secondOk || !thirdOk {
		return shouldUseTimes
	}
	if actualTime.Equal(min) || actualTime.Equal(max) {
		return fmt.Sprintf(shouldNotHaveHappenedOnOrBetween, actualTime, min, max)
	}
	if actualTime.After(min) && actualTime.Before(max) {
		return fmt.Sprintf(shouldNotHaveHappenedOnOrBetween, actualTime, min, max)
	}
	return success
}

// ShouldHappenWithin receives a time.Time, a time.Duration, and a time.Time (3 arguments)
// and asserts that the first time.Time happens within or on the duration specified relative to
// the other time.Time.
func ShouldHappenWithin(actual interface{}, expected ...interface{}) string {
	if fail := need(2, expected); fail != success {
		return fail
	}
	actualTime, firstOk := actual.(time.Time)
	tolerance, secondOk := expected[0].(time.Duration)
	threshold, thirdOk := expected[1].(time.Time)

	if !firstOk || !secondOk || !thirdOk {
		return shouldUseDurationAndTime
	}

	min := threshold.Add(-tolerance)
	max := threshold.Add(tolerance)
	return ShouldHappenOnOrBetween(actualTime, min, max)
}

// ShouldNotHappenWithin receives a time.Time, a time.Duration, and a time.Time (3 arguments)
// and asserts that the first time.Time does NOT happen within or on the duration specified relative to
// the other time.Time.
func ShouldNotHappenWithin(actual interface{}, expected ...interface{}) string {
	if fail := need(2, expected); fail != success {
		return fail
	}
	actualTime, firstOk := actual.(time.Time)
	tolerance, secondOk := expected[0].(time.Duration)
	threshold, thirdOk := expected[1].(time.Time)

	if !firstOk || !secondOk || !thirdOk {
		return shouldUseDurationAndTime
	}

	min := threshold.Add(-tolerance)
	max := threshold.Add(tolerance)
	return ShouldNotHappenOnOrBetween(actualTime, min, max)
}

// ShouldBeChronological receives a []time.Time slice and asserts that they are
// in chronological order starting with the first time.Time as the earliest.
func ShouldBeChronological(actual interface{}, expected ...interface{}) string {
	if fail := need(0, expected); fail != success {
		return fail
	}

	times, ok := actual.([]time.Time)
	if !ok {
		return shouldUseTimeSlice
	}

	var previous time.Time
	for i, current := range times {
		if i > 0 && current.Before(previous) {
			return fmt.Sprintf(shouldHaveBeenChronological,
				i, i-1, previous.String(), i, current.String())
		}
		previous = current
	}
	return ""
}

// ShouldNotBeChronological receives a []time.Time slice and asserts that they are
// NOT in chronological order.
func ShouldNotBeChronological(actual interface{}, expected ...interface{}) string {
	if fail := need(0, expected); fail != success {
		return fail
	}
	if _, ok := actual.([]time.Time); !ok {
		return shouldUseTimeSlice
	}
	result := ShouldBeChronological(actual, expected...)
	if result != "" {
		return ""
	}
	return shouldNotHaveBeenchronological
}
