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

type pktPubAck struct {
	ID uint16
}

func (p *pktPubAck) Parse(flag byte, contents []byte) (*pktPubAck, error) {
	if flag != 0 {
		return nil, wrapError(ErrInvalidPacket, "parsing PUBACK")
	}
	if len(contents) < 2 {
		return nil, wrapError(ErrInvalidPacketLength, "parsing PUBACK")
	}
	_, p.ID = unpackUint16(contents)
	return p, nil
}

func (p *pktPubAck) Pack() []byte {
	return pack(
		packetPubAck.b(),
		packUint16(p.ID),
	)
}
