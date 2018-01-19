package parser

import (
	"math"
	"strings"
	"time"
)

// parseTestFunctionDuration parses the duration in seconds as a float64
// from a line of go test output that looks something like this:
// --- PASS: TestOldSchool_PassesWithMessage (0.03 seconds)
func parseTestFunctionDuration(line string) float64 {
	line = strings.Replace(line, "(", "", 1)
	fields := strings.Split(line, " ")
	return parseDurationInSeconds(fields[3]+"s", 2)
}

func parseDurationInSeconds(raw string, precision int) float64 {
	elapsed, _ := time.ParseDuration(raw)
	return round(elapsed.Seconds(), precision)
}

// round returns the rounded version of x with precision.
//
// Special cases are:
//  round(±0) = ±0
//  round(±Inf) = ±Inf
//  round(NaN) = NaN
//
// Why, oh why doesn't the math package come with a round function?
// Inspiration: http://play.golang.org/p/ZmFfr07oHp
func round(x float64, precision int) float64 {
	var rounder float64
	pow := math.Pow(10, float64(precision))
	intermediate := x * pow

	if intermediate < 0.0 {
		intermediate -= 0.5
	} else {
		intermediate += 0.5
	}
	rounder = float64(int64(intermediate))

	return rounder / float64(pow)
}
