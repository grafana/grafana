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
	"fmt"
)

// ConnectionReturnCode represents return code of connect request.
type ConnectionReturnCode byte

// Connection acceptance/rejection code.
const (
	ConnectionAccepted          ConnectionReturnCode = 0
	UnacceptableProtocolVersion ConnectionReturnCode = 1
	IdentifierRejected          ConnectionReturnCode = 2
	ServerUnavailable           ConnectionReturnCode = 3
	BadUserNameOrPassword       ConnectionReturnCode = 4
	NotAuthorized               ConnectionReturnCode = 5
)

func (c ConnectionReturnCode) String() string {
	switch c {
	case ConnectionAccepted:
		return "connection accepted"
	case UnacceptableProtocolVersion:
		return "connection refused, unacceptable protocol version"
	case IdentifierRejected:
		return "connection refused, identifier rejected"
	case ServerUnavailable:
		return "connection refused, Server unavailable"
	case BadUserNameOrPassword:
		return "connection refused, bad user name or password"
	case NotAuthorized:
		return "connection refused, not authorized"
	}
	return fmt.Sprintf("unknown ConnectionReturnCode %x", int(c))
}

type pktConnAck struct {
	SessionPresent bool
	Code           ConnectionReturnCode
}

func (p *pktConnAck) Parse(flag byte, contents []byte) (*pktConnAck, error) {
	if flag != 0 {
		return nil, wrapError(ErrInvalidPacket, "parsing CONNACK")
	}
	if len(contents) != 2 {
		return nil, wrapError(ErrInvalidPacketLength, "parsing CONNACK")
	}
	return &pktConnAck{
		SessionPresent: (contents[0]&0x01 != 0),
		Code:           ConnectionReturnCode(contents[1]),
	}, nil
}
