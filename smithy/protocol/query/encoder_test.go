package query

import (
	"bytes"
	"fmt"
	smithytesting "github.com/aws/smithy-go/testing"
	"testing"
)

func TestEncode(t *testing.T) {
	cases := map[string]struct {
		Encode func(*Encoder) error
		Expect []byte
	}{
		"object": {
			Encode: func(e *Encoder) error {
				e.Object().Key("foo").String("bar")
				return e.Encode()
			},
			Expect: []byte(`foo=bar`),
		},
		"nested object": {
			Encode: func(e *Encoder) error {
				e.Object().Key("foo").Object().Key("bar").String("baz")
				return e.Encode()
			},
			Expect: []byte(`foo.bar=baz`),
		},
		"list": {
			Encode: func(e *Encoder) error {
				list := e.Object().Key("list").Array("spam")
				list.Value().String("spam")
				list.Value().String("eggs")
				return e.Encode()
			},
			Expect: []byte(`list.spam.1=spam&list.spam.2=eggs`),
		},
		"flat list": {
			Encode: func(e *Encoder) error {
				list := e.Object().FlatKey("list").Array("spam")
				list.Value().String("spam")
				list.Value().String("eggs")
				return e.Encode()
			},
			Expect: []byte(`list.1=spam&list.2=eggs`),
		},
		"map": {
			Encode: func(e *Encoder) error {
				mapValue := e.Object().Key("map").Map("key", "value")
				mapValue.Key("bar").String("baz")
				mapValue.Key("foo").String("bin")
				return e.Encode()
			},
			Expect: []byte(`map.entry.1.key=bar&map.entry.1.value=baz&map.entry.2.key=foo&map.entry.2.value=bin`),
		},
		"flat map": {
			Encode: func(e *Encoder) error {
				mapValue := e.Object().FlatKey("map").Map("key", "value")
				mapValue.Key("bar").String("baz")
				mapValue.Key("foo").String("bin")
				return e.Encode()
			},
			Expect: []byte(`map.1.key=bar&map.1.value=baz&map.2.key=foo&map.2.value=bin`),
		},
	}

	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			var buff bytes.Buffer
			encoder := NewEncoder(&buff)
			if err := c.Encode(encoder); err != nil {
				t.Fatalf("failed to encode, %v", err)
			}
			smithytesting.AssertURLFormEqual(t, c.Expect, buff.Bytes())
		})
	}
}

// limitedWriter exists to isolate WriteString to ensure that any writer
// can actually be used
type limitedWriter struct {
	writer *bytes.Buffer
}

func (lw limitedWriter) Write(v []byte) (int, error) {
	return lw.writer.Write(v)
}

func TestEncodeHandlesBareIoWriter(t *testing.T) {
	buff := limitedWriter{writer: bytes.NewBuffer(nil)}
	encoder := NewEncoder(buff)
	encoder.Object().Key("foo").String("bar")
	if err := encoder.Encode(); err != nil {
		t.Fatal(err)
	}
	smithytesting.AssertURLFormEqual(t, []byte(`foo=bar`), buff.writer.Bytes())
}

// stringWriter exists to ensure that WriteString is called when
// available.
type stringWriter struct {
	writer *bytes.Buffer
}

func (w stringWriter) Write(v []byte) (int, error) {
	return 0, fmt.Errorf("the WriteString method should be used when available")
}

func (w stringWriter) WriteString(v string) (int, error) {
	return w.writer.WriteString(v)
}

func TestEncodeUsesWriteString(t *testing.T) {
	buff := stringWriter{writer: bytes.NewBuffer(nil)}
	encoder := NewEncoder(buff)
	encoder.Object().Key("foo").String("bar")
	if err := encoder.Encode(); err != nil {
		t.Fatal(err)
	}
	smithytesting.AssertURLFormEqual(t, []byte(`foo=bar`), buff.writer.Bytes())
}
