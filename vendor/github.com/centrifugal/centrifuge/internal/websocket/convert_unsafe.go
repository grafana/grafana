//go:build !appengine

package websocket

import "unsafe"

// StringToBytes converts string to byte slice.
func stringToBytes(s string) []byte {
	return unsafe.Slice(unsafe.StringData(s), len(s)) //nolint:gosec // Audited.
}
