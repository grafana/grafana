// +build !goavro_debug

package goavro

// debug is a no-op for release builds, and the function call is optimized out
// by the compiler.
func debug(_ string, _ ...interface{}) {}
