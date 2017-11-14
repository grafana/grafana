// +build gofuzz

package gocql

import "bytes"

func Fuzz(data []byte) int {
	var bw bytes.Buffer

	r := bytes.NewReader(data)

	head, err := readHeader(r, make([]byte, 9))
	if err != nil {
		return 0
	}

	framer := newFramer(r, &bw, nil, byte(head.version))
	err = framer.readFrame(&head)
	if err != nil {
		return 0
	}

	frame, err := framer.parseFrame()
	if err != nil {
		return 0
	}

	if frame != nil {
		return 1
	}

	return 2
}
