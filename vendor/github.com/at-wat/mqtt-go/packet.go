// Copyright 2019 The mqtt-go authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package mqtt

import (
	"errors"
	"fmt"
)

// ErrInvalidRune means that the string has a rune not allowed in MQTT.
var ErrInvalidRune = errors.New("invalid rune in UTF-8 string")

// ErrInvalidPacket means that an invalid message is arrived from the broker.
var ErrInvalidPacket = errors.New("invalid packet")

// ErrInvalidPacketLength means that an invalid length of the message is arrived.
var ErrInvalidPacketLength = errors.New("invalid packet length")

type packetType byte

const (
	packetConnect     packetType = 0x10
	packetConnAck     packetType = 0x20
	packetPublish     packetType = 0x30
	packetPubAck      packetType = 0x40
	packetPubRec      packetType = 0x50
	packetPubRel      packetType = 0x60
	packetPubComp     packetType = 0x70
	packetSubscribe   packetType = 0x80
	packetSubAck      packetType = 0x90
	packetUnsubscribe packetType = 0xA0
	packetUnsubAck    packetType = 0xB0
	packetPingReq     packetType = 0xC0
	packetPingResp    packetType = 0xD0
	packetDisconnect  packetType = 0xE0
	packetFromClient  packetType = 0x02
)

func (t packetType) b() byte {
	return byte(t)
}

var packetTypeString = map[packetType]string{
	packetConnect:     "CONNECT",
	packetConnAck:     "CONNACK",
	packetPublish:     "PUBLISH",
	packetPubAck:      "PUBACK",
	packetPubRec:      "PUBREC",
	packetPubRel:      "PUBREL",
	packetPubComp:     "PUBCOMP",
	packetSubscribe:   "SUBSCRIBE",
	packetSubAck:      "SUBACK",
	packetUnsubscribe: "UNSUBSCRIBE",
	packetUnsubAck:    "UNSUBACK",
	packetPingReq:     "PINGREQ",
	packetPingResp:    "PINGRESP",
	packetDisconnect:  "DISCONNECT",
}

func (t packetType) String() string {
	if s, ok := packetTypeString[t]; ok {
		return s
	}
	return fmt.Sprintf("Unknown packet type %x", int(t))
}

func pack(packetType byte, contents ...[]byte) []byte {
	pkt := []byte{packetType}
	var n int
	for _, c := range contents {
		n += len(c)
	}
	pkt = append(pkt, remainingLength(n)...)
	for _, c := range contents {
		pkt = append(pkt, c...)
	}
	return pkt
}

func remainingLength(n int) []byte {
	switch {
	case n <= 0x7F:
		return []byte{byte(n)}
	case n <= 0x3FFF:
		return []byte{
			byte(n) | 0x80,
			byte(n>>7) & 0x7F,
		}
	case n <= 0x1FFFFF:
		return []byte{
			byte(n) | 0x80,
			byte(n>>7) | 0x80,
			byte(n>>14) & 0x7F,
		}
	case n <= 0xFFFFFFF:
		return []byte{
			byte(n) | 0x80,
			byte(n>>7) | 0x80,
			byte(n>>14) | 0x80,
			byte(n>>21) & 0x7F,
		}
	}
	panic("remaining length overflow")
}

func appendString(b []byte, s string) []byte {
	return appendBytes(b, []byte(s))
}

func appendBytes(b, s []byte) []byte {
	n := len(s)
	if n > 0xFFFF {
		panic("string length overflow")
	}
	b = appendUint16(b, uint16(n))
	return append(b, s...)
}

func appendUint16(b []byte, v uint16) []byte {
	return append(b,
		byte(v>>8),
		byte(v),
	)
}

func packString(s string) []byte {
	return packBytes([]byte(s))
}

func packBytes(s []byte) []byte {
	ret := make([]byte, 0, len(s)+2)
	return appendBytes(ret, s)
}

func packUint16(v uint16) []byte {
	ret := make([]byte, 0, 2)
	return appendUint16(ret, v)
}

func unpackUint16(b []byte) (int, uint16) {
	return 2, uint16(b[0])<<8 | uint16(b[1])
}

func unpackString(b []byte) (int, string, error) {
	if len(b) < 2 {
		return 0, "", wrapError(ErrInvalidPacketLength, "unpacking string length")
	}
	nHeader, n := unpackUint16(b)
	if int(n)+nHeader > len(b) {
		return 0, "", wrapError(ErrInvalidPacketLength, "unpacking string contents")
	}

	// Validate UTF-8 runes according to MQTT-1.5.3-1 and MQTT-1.5.3-2.
	rs := []rune(string(b[nHeader : int(n)+nHeader]))
	for _, r := range rs {
		if r == 0x0000 || (0xD800 <= r && r <= 0xDFFF) {
			return 0, "", wrapErrorf(ErrInvalidRune, "unpacked string contains 0x%x", int(r))
		}
	}
	return int(n) + nHeader, string(rs), nil
}

const packetBufferCap = 256
