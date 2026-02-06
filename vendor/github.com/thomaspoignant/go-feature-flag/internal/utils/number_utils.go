package utils

// IsIntegral returns true if the float is an integer.
func IsIntegral(val float64) bool {
	return val == float64(int64(val))
}
