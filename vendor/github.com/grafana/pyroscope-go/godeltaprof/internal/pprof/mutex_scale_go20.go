//go:build go1.20
// +build go1.20

package pprof

type MutexProfileScaler struct {
}

// ScaleMutexProfile is a no-op for go1.20+.
// https://github.com/golang/go/commit/30b1af00ff142a3f1a5e2a0f32cf04a649bd5e65
func ScaleMutexProfile(_ MutexProfileScaler, cnt int64, ns float64) (int64, float64) {
	return cnt, ns
}

var ScalerMutexProfile = MutexProfileScaler{}

var ScalerBlockProfile = MutexProfileScaler{}
