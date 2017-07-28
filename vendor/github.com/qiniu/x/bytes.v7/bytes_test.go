package bytes

import (
	"io"
	"testing"
)

// ---------------------------------------------------

func TestBuffer(t *testing.T) {

	b := NewBuffer()
	n, err := b.WriteStringAt("Hello", 4)
	if n != 5 || err != nil {
		t.Fatal("WriteStringAt failed:", n, err)
	}
	if b.Len() != 9 {
		t.Fatal("Buffer.Len invalid (9 is required):", b.Len())
	}

	buf := make([]byte, 10)
	n, err = b.ReadAt(buf, 50)
	if n != 0 || err != io.EOF {
		t.Fatal("ReadAt failed:", n, err)
	}

	n, err = b.ReadAt(buf, 6)
	if n != 3 || err != io.EOF || string(buf[:n]) != "llo" {
		t.Fatal("ReadAt failed:", n, err, string(buf[:n]))
	}

	n, err = b.WriteAt([]byte("Hi h"), 1)
	if n != 4 || err != nil {
		t.Fatal("WriteAt failed:", n, err)
	}
	if b.Len() != 9 {
		t.Fatal("Buffer.Len invalid (9 is required):", b.Len())
	}

	n, err = b.ReadAt(buf, 0)
	if n != 9 || err != io.EOF || string(buf[:n]) != "\x00Hi hello" {
		t.Fatal("ReadAt failed:", n, err)
	}

	n, err = b.WriteStringAt("LO world!", 7)
	if n != 9 || err != nil {
		t.Fatal("WriteStringAt failed:", n, err)
	}
	if b.Len() != 16 {
		t.Fatal("Buffer.Len invalid (16 is required):", b.Len())
	}

	buf = make([]byte, 17)
	n, err = b.ReadAt(buf, 0)
	if n != 16 || err != io.EOF || string(buf[:n]) != "\x00Hi helLO world!" {
		t.Fatal("ReadAt failed:", n, err, string(buf[:n]))
	}
}

// ---------------------------------------------------
