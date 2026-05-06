package traceql

import "math"

func sumOverTime() func(curr float64, n float64) (res float64) {
	var comp float64 // Kahan compensation
	return func(sum, inc float64) (res float64) {
		if math.IsNaN(sum) {
			return inc
		}
		y := inc - comp
		sum, c := kahanSumInc(y, sum, 0) // Compensation is applied on every step, hence we pass 0 to reset it
		comp = c
		return sum
	}
}

func minOverTime() func(curr float64, n float64) (res float64) {
	return func(curr, n float64) (res float64) {
		if math.IsNaN(curr) || n < curr {
			return n
		}
		return curr
	}
}

func maxOverTime() func(curr float64, n float64) (res float64) {
	return func(curr, n float64) (res float64) {
		if math.IsNaN(curr) || n > curr {
			return n
		}
		return curr
	}
}
