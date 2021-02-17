// +build appengine

package internal

func String(b []byte) string {
	return string(b)
}

func Bytes(s string) []byte {
	return []byte(s)
}
