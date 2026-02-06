//go:build codecgen || generated
// +build codecgen generated

package codec

// this file is here, to set the codecgen variable to true
// when the build tag codecgen is set.
//
// this allows us do specific things e.g. skip missing fields tests,
// when running in codecgen mode.

func init() {
	codecgen = true
}
