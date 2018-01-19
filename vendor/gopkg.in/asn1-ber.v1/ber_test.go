package ber

import (
	"bytes"
	"math"

	"io"
	"testing"
)

func TestEncodeDecodeInteger(t *testing.T) {
	for _, v := range []int64{0, 10, 128, 1024, math.MaxInt64, -1, -100, -128, -1024, math.MinInt64} {
		enc := encodeInteger(v)
		dec, err := parseInt64(enc)
		if err != nil {
			t.Fatalf("Error decoding %d : %s", v, err)
		}
		if v != dec {
			t.Error("TestEncodeDecodeInteger failed for %d (got %d)", v, dec)
		}

	}
}

func TestBoolean(t *testing.T) {
	var value bool = true

	packet := NewBoolean(ClassUniversal, TypePrimitive, TagBoolean, value, "first Packet, True")

	newBoolean, ok := packet.Value.(bool)
	if !ok || newBoolean != value {
		t.Error("error during creating packet")
	}

	encodedPacket := packet.Bytes()

	newPacket := DecodePacket(encodedPacket)

	newBoolean, ok = newPacket.Value.(bool)
	if !ok || newBoolean != value {
		t.Error("error during decoding packet")
	}

}

func TestInteger(t *testing.T) {
	var value int64 = 10

	packet := NewInteger(ClassUniversal, TypePrimitive, TagInteger, value, "Integer, 10")

	{
		newInteger, ok := packet.Value.(int64)
		if !ok || newInteger != value {
			t.Error("error creating packet")
		}
	}

	encodedPacket := packet.Bytes()

	newPacket := DecodePacket(encodedPacket)

	{
		newInteger, ok := newPacket.Value.(int64)
		if !ok || int64(newInteger) != value {
			t.Error("error decoding packet")
		}
	}
}

func TestString(t *testing.T) {
	var value string = "Hic sunt dracones"

	packet := NewString(ClassUniversal, TypePrimitive, TagOctetString, value, "String")

	newValue, ok := packet.Value.(string)
	if !ok || newValue != value {
		t.Error("error during creating packet")
	}

	encodedPacket := packet.Bytes()

	newPacket := DecodePacket(encodedPacket)

	newValue, ok = newPacket.Value.(string)
	if !ok || newValue != value {
		t.Error("error during decoding packet")
	}

}

func TestSequenceAndAppendChild(t *testing.T) {

	values := []string{
		"HIC SVNT LEONES",
		"Iñtërnâtiônàlizætiøn",
		"Terra Incognita",
	}

	sequence := NewSequence("a sequence")
	for _, s := range values {
		sequence.AppendChild(NewString(ClassUniversal, TypePrimitive, TagOctetString, s, "String"))
	}

	if len(sequence.Children) != len(values) {
		t.Errorf("wrong length for children array should be %d, got %d", len(values), len(sequence.Children))
	}

	encodedSequence := sequence.Bytes()

	decodedSequence := DecodePacket(encodedSequence)
	if len(decodedSequence.Children) != len(values) {
		t.Errorf("wrong length for children array should be %d => %d", len(values), len(decodedSequence.Children))
	}

	for i, s := range values {
		if decodedSequence.Children[i].Value.(string) != s {
			t.Errorf("expected %d to be %q, got %q", i, s, decodedSequence.Children[i].Value.(string))
		}
	}
}

func TestReadPacket(t *testing.T) {
	packet := NewString(ClassUniversal, TypePrimitive, TagOctetString, "Ad impossibilia nemo tenetur", "string")
	var buffer io.ReadWriter
	buffer = new(bytes.Buffer)

	buffer.Write(packet.Bytes())

	newPacket, err := ReadPacket(buffer)
	if err != nil {
		t.Error("error during ReadPacket", err)
	}
	newPacket.ByteValue = nil
	if !bytes.Equal(newPacket.ByteValue, packet.ByteValue) {
		t.Error("packets should be the same")
	}
}

func TestBinaryInteger(t *testing.T) {
	// data src : http://luca.ntop.org/Teaching/Appunti/asn1.html 5.7
	var data = []struct {
		v int64
		e []byte
	}{
		{v: 0, e: []byte{0x02, 0x01, 0x00}},
		{v: 127, e: []byte{0x02, 0x01, 0x7F}},
		{v: 128, e: []byte{0x02, 0x02, 0x00, 0x80}},
		{v: 256, e: []byte{0x02, 0x02, 0x01, 0x00}},
		{v: -128, e: []byte{0x02, 0x01, 0x80}},
		{v: -129, e: []byte{0x02, 0x02, 0xFF, 0x7F}},
		{v: math.MaxInt64, e: []byte{0x02, 0x08, 0x7F, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}},
		{v: math.MinInt64, e: []byte{0x02, 0x08, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}},
	}

	for _, d := range data {
		if b := NewInteger(ClassUniversal, TypePrimitive, TagInteger, int64(d.v), "").Bytes(); !bytes.Equal(d.e, b) {
			t.Errorf("Wrong binary generated for %d : got % X, expected % X", d.v, b, d.e)
		}
	}
}

func TestBinaryOctetString(t *testing.T) {
	// data src : http://luca.ntop.org/Teaching/Appunti/asn1.html 5.10

	if !bytes.Equal([]byte{0x04, 0x08, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef}, NewString(ClassUniversal, TypePrimitive, TagOctetString, "\x01\x23\x45\x67\x89\xab\xcd\xef", "").Bytes()) {
		t.Error("wrong binary generated")
	}
}
