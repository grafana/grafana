// +build !go1.3

package quotedprintable

import "bytes"

var ch = make(chan *bytes.Buffer, 32)

func getBuffer() *bytes.Buffer {
	select {
	case buf := <-ch:
		return buf
	default:
	}
	return new(bytes.Buffer)
}

func putBuffer(buf *bytes.Buffer) {
	buf.Reset()
	select {
	case ch <- buf:
	default:
	}
}
