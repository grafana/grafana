//go:build go1.16 && !go1.20
// +build go1.16,!go1.20

package pprof

import "runtime"

type MutexProfileScaler struct {
	f func(cnt int64, ns float64) (int64, float64)
}

func ScaleMutexProfile(scaler MutexProfileScaler, cnt int64, ns float64) (int64, float64) {
	return scaler.f(cnt, ns)
}

var ScalerMutexProfile = MutexProfileScaler{func(cnt int64, ns float64) (int64, float64) {
	period := runtime.SetMutexProfileFraction(-1)
	return cnt * int64(period), ns * float64(period)
}}

var ScalerBlockProfile = MutexProfileScaler{func(cnt int64, ns float64) (int64, float64) {
	// Do nothing.
	// The current way of block profile sampling makes it
	// hard to compute the unsampled number. The legacy block
	// profile parse doesn't attempt to scale or unsample.
	return cnt, ns
}}
