package pgproto3

import (
	"encoding/binary"
	"errors"
	"math"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type FunctionCall struct {
	Function         uint32
	ArgFormatCodes   []uint16
	Arguments        [][]byte
	ResultFormatCode uint16
}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*FunctionCall) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *FunctionCall) Decode(src []byte) error {
	*dst = FunctionCall{}
	rp := 0
	// Specifies the object ID of the function to call.
	dst.Function = binary.BigEndian.Uint32(src[rp:])
	rp += 4
	// The number of argument format codes that follow (denoted C below).
	// This can be zero to indicate that there are no arguments or that the arguments all use the default format (text);
	// or one, in which case the specified format code is applied to all arguments;
	// or it can equal the actual number of arguments.
	nArgumentCodes := int(binary.BigEndian.Uint16(src[rp:]))
	rp += 2
	argumentCodes := make([]uint16, nArgumentCodes)
	for i := range nArgumentCodes {
		// The argument format codes. Each must presently be zero (text) or one (binary).
		ac := binary.BigEndian.Uint16(src[rp:])
		if ac != 0 && ac != 1 {
			return &invalidMessageFormatErr{messageType: "FunctionCall"}
		}
		argumentCodes[i] = ac
		rp += 2
	}
	dst.ArgFormatCodes = argumentCodes

	// Specifies the number of arguments being supplied to the function.
	nArguments := int(binary.BigEndian.Uint16(src[rp:]))
	rp += 2
	arguments := make([][]byte, nArguments)
	for i := range nArguments {
		// The length of the argument value, in bytes (this count does not include itself). Can be zero.
		// As a special case, -1 indicates a NULL argument value. No value bytes follow in the NULL case.
		argumentLength := int(binary.BigEndian.Uint32(src[rp:]))
		rp += 4
		if argumentLength == -1 {
			arguments[i] = nil
		} else {
			// The value of the argument, in the format indicated by the associated format code. n is the above length.
			argumentValue := src[rp : rp+argumentLength]
			rp += argumentLength
			arguments[i] = argumentValue
		}
	}
	dst.Arguments = arguments
	// The format code for the function result. Must presently be zero (text) or one (binary).
	resultFormatCode := binary.BigEndian.Uint16(src[rp:])
	if resultFormatCode != 0 && resultFormatCode != 1 {
		return &invalidMessageFormatErr{messageType: "FunctionCall"}
	}
	dst.ResultFormatCode = resultFormatCode
	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *FunctionCall) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'F')
	dst = pgio.AppendUint32(dst, src.Function)

	if len(src.ArgFormatCodes) > math.MaxUint16 {
		return nil, errors.New("too many arg format codes")
	}
	dst = pgio.AppendUint16(dst, uint16(len(src.ArgFormatCodes)))
	for _, argFormatCode := range src.ArgFormatCodes {
		dst = pgio.AppendUint16(dst, argFormatCode)
	}

	if len(src.Arguments) > math.MaxUint16 {
		return nil, errors.New("too many arguments")
	}
	dst = pgio.AppendUint16(dst, uint16(len(src.Arguments)))
	for _, argument := range src.Arguments {
		if argument == nil {
			dst = pgio.AppendInt32(dst, -1)
		} else {
			dst = pgio.AppendInt32(dst, int32(len(argument)))
			dst = append(dst, argument...)
		}
	}
	dst = pgio.AppendUint16(dst, src.ResultFormatCode)
	return finishMessage(dst, sp)
}
