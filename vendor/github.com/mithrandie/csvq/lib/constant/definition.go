package constant

import (
	"math"
)

var Definition = map[string]map[string]interface{}{
	"MATH": {
		"E":       math.E,
		"PI":      math.Pi,
		"PHI":     math.Phi,
		"SQRT2":   math.Sqrt2,
		"SQRTE":   math.SqrtE,
		"SQRTPI":  math.SqrtPi,
		"SQRTPHI": math.SqrtPhi,
		"LN2":     math.Ln2,
		"LOG2E":   math.Log2E,
		"LN10":    math.Ln10,
		"LOG10E":  math.Log10E,
	},
	"FLOAT": {
		"MAX":              math.MaxFloat64,
		"SMALLEST_NONZERO": math.SmallestNonzeroFloat64,
	},
	"INTEGER": {
		"MAX": int64(math.MaxInt64),
		"MIN": int64(math.MinInt64),
	},
}
