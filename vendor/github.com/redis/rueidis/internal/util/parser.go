package util

import (
	"math"
	"strconv"
)

func ToFloat64(s string) (float64, error) {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil && s == "-nan" {
		return math.NaN(), nil
	}
	return v, err
}

func ToFloat32(s string) (float32, error) {
	v, err := strconv.ParseFloat(s, 32)
	if err != nil && s == "-nan" {
		return float32(math.NaN()), nil
	}
	return float32(v), err
}
