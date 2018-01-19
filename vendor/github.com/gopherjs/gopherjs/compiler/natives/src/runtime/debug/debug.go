// +build js

package debug

func setGCPercent(int32) int32 {
	// Not implemented. Return initial setting.
	return 100
}

func setMaxStack(bytes int) int {
	// Not implemented. Return initial setting.
	// The initial setting is 1 GB on 64-bit systems, 250 MB on 32-bit systems.
	return 250000000
}
