package jsonassert

import (
	"math"
	"strconv"
)

// This is *probably* good enough. Can change this to be even smaller if necessary
const minDiff = 0.000001

func (a *Asserter) checkNumber(path string, act, exp float64) {
	if t, ok := a.Printer.(tt); ok {
		t.Helper()
	}
	diff := math.Abs(act - exp)
	if diff > minDiff {
		a.Printer.Errorf("expected number at '%s' to be '%.7f' but was '%.7f'", path, exp, act)
	}
}

func extractNumber(n string) (float64, error) {
	return strconv.ParseFloat(n, 64)
}
