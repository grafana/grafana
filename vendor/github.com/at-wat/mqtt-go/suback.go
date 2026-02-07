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

type pktSubAck struct {
	ID    uint16
	Codes []subscribeFlag
}

func (p *pktSubAck) Parse(flag byte, contents []byte) (*pktSubAck, error) {
	if flag != 0 {
		return nil, wrapError(ErrInvalidPacket, "parsing SUBSCK")
	}
	p.ID = uint16(contents[0])<<8 | uint16(contents[1])
	for _, c := range contents[2:] {
		p.Codes = append(p.Codes, subscribeFlag(c))
	}
	return p, nil
}
