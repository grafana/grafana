//go:build appengine

package websocket

func stringToBytes(s string) []byte {
	return []byte(s)
}
