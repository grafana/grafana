package ndr

import (
	"encoding/binary"
	"fmt"
)

/*
Serialization Version 1
https://msdn.microsoft.com/en-us/library/cc243563.aspx

Common Header - https://msdn.microsoft.com/en-us/library/cc243890.aspx
8 bytes in total:
- First byte - Version: Must equal 1
- Second byte -  1st 4 bits: Endianess (0=Big; 1=Little); 2nd 4 bits: Character Encoding (0=ASCII; 1=EBCDIC)
- 3rd - Floating point representation (This does not seem to be the case in examples for Microsoft test sources)
- 4th - Common Header Length: Must equal 8
- 5th - 8th - Filler: MUST be set to 0xcccccccc on marshaling, and SHOULD be ignored during unmarshaling.

Private Header - https://msdn.microsoft.com/en-us/library/cc243919.aspx
8 bytes in total:
- First 4 bytes - Indicates the length of a serialized top-level type in the octet stream. It MUST include the padding length and exclude the header itself.
- Second 4 bytes - Filler: MUST be set to 0 (zero) during marshaling, and SHOULD be ignored during unmarshaling.
*/

const (
	protocolVersion   uint8  = 1
	commonHeaderBytes uint16 = 8
	bigEndian                = 0
	littleEndian             = 1
	ascii             uint8  = 0
	ebcdic            uint8  = 1
	ieee              uint8  = 0
	vax               uint8  = 1
	cray              uint8  = 2
	ibm               uint8  = 3
)

// CommonHeader implements the NDR common header: https://msdn.microsoft.com/en-us/library/cc243889.aspx
type CommonHeader struct {
	Version             uint8
	Endianness          binary.ByteOrder
	CharacterEncoding   uint8
	FloatRepresentation uint8
	HeaderLength        uint16
	Filler              []byte
}

// PrivateHeader implements the NDR private header: https://msdn.microsoft.com/en-us/library/cc243919.aspx
type PrivateHeader struct {
	ObjectBufferLength uint32
	Filler             []byte
}

func (dec *Decoder) readCommonHeader() error {
	// Version
	vb, err := dec.r.ReadByte()
	if err != nil {
		return Malformed{EText: "could not read first byte of common header for version"}
	}
	dec.ch.Version = uint8(vb)
	if dec.ch.Version != protocolVersion {
		return Malformed{EText: fmt.Sprintf("byte stream does not indicate a RPC Type serialization of version %v", protocolVersion)}
	}
	// Read Endianness & Character Encoding
	eb, err := dec.r.ReadByte()
	if err != nil {
		return Malformed{EText: "could not read second byte of common header for endianness"}
	}
	endian := int(eb >> 4 & 0xF)
	if endian != 0 && endian != 1 {
		return Malformed{EText: "common header does not indicate a valid endianness"}
	}
	dec.ch.CharacterEncoding = uint8(vb & 0xF)
	if dec.ch.CharacterEncoding != 0 && dec.ch.CharacterEncoding != 1 {
		return Malformed{EText: "common header does not indicate a valid character encoding"}
	}
	switch endian {
	case littleEndian:
		dec.ch.Endianness = binary.LittleEndian
	case bigEndian:
		dec.ch.Endianness = binary.BigEndian
	}
	// Common header length
	lb, err := dec.readBytes(2)
	if err != nil {
		return Malformed{EText: fmt.Sprintf("could not read common header length: %v", err)}
	}
	dec.ch.HeaderLength = dec.ch.Endianness.Uint16(lb)
	if dec.ch.HeaderLength != commonHeaderBytes {
		return Malformed{EText: "common header does not indicate a valid length"}
	}
	// Filler bytes
	dec.ch.Filler, err = dec.readBytes(4)
	if err != nil {
		return Malformed{EText: fmt.Sprintf("could not read common header filler: %v", err)}
	}
	return nil
}

func (dec *Decoder) readPrivateHeader() error {
	// The next 8 bytes after the common header comprise the RPC type marshalling private header for constructed types.
	err := binary.Read(dec.r, dec.ch.Endianness, &dec.ph.ObjectBufferLength)
	if err != nil {
		return Malformed{EText: "could not read private header object buffer length"}
	}
	if dec.ph.ObjectBufferLength%8 != 0 {
		return Malformed{EText: "object buffer length not a multiple of 8"}
	}
	// Filler bytes
	dec.ph.Filler, err = dec.readBytes(4)
	if err != nil {
		return Malformed{EText: fmt.Sprintf("could not read private header filler: %v", err)}
	}
	return nil
}
