package pgproto3

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type Bind struct {
	DestinationPortal    string
	PreparedStatement    string
	ParameterFormatCodes []int16
	Parameters           [][]byte
	ResultFormatCodes    []int16
}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*Bind) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *Bind) Decode(src []byte) error {
	*dst = Bind{}

	idx := bytes.IndexByte(src, 0)
	if idx < 0 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	dst.DestinationPortal = string(src[:idx])
	rp := idx + 1

	idx = bytes.IndexByte(src[rp:], 0)
	if idx < 0 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	dst.PreparedStatement = string(src[rp : rp+idx])
	rp += idx + 1

	if len(src[rp:]) < 2 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	parameterFormatCodeCount := int(binary.BigEndian.Uint16(src[rp:]))
	rp += 2

	if parameterFormatCodeCount > 0 {
		dst.ParameterFormatCodes = make([]int16, parameterFormatCodeCount)

		if len(src[rp:]) < len(dst.ParameterFormatCodes)*2 {
			return &invalidMessageFormatErr{messageType: "Bind"}
		}
		for i := range parameterFormatCodeCount {
			dst.ParameterFormatCodes[i] = int16(binary.BigEndian.Uint16(src[rp:]))
			rp += 2
		}
	}

	if len(src[rp:]) < 2 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	parameterCount := int(binary.BigEndian.Uint16(src[rp:]))
	rp += 2

	if parameterCount > 0 {
		dst.Parameters = make([][]byte, parameterCount)

		for i := range parameterCount {
			if len(src[rp:]) < 4 {
				return &invalidMessageFormatErr{messageType: "Bind"}
			}

			msgSize := int(int32(binary.BigEndian.Uint32(src[rp:])))
			rp += 4

			// null
			if msgSize == -1 {
				continue
			}

			if len(src[rp:]) < msgSize {
				return &invalidMessageFormatErr{messageType: "Bind"}
			}

			dst.Parameters[i] = src[rp : rp+msgSize]
			rp += msgSize
		}
	}

	if len(src[rp:]) < 2 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	resultFormatCodeCount := int(binary.BigEndian.Uint16(src[rp:]))
	rp += 2

	dst.ResultFormatCodes = make([]int16, resultFormatCodeCount)
	if len(src[rp:]) < len(dst.ResultFormatCodes)*2 {
		return &invalidMessageFormatErr{messageType: "Bind"}
	}
	for i := range resultFormatCodeCount {
		dst.ResultFormatCodes[i] = int16(binary.BigEndian.Uint16(src[rp:]))
		rp += 2
	}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *Bind) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'B')

	dst = append(dst, src.DestinationPortal...)
	dst = append(dst, 0)
	dst = append(dst, src.PreparedStatement...)
	dst = append(dst, 0)

	if len(src.ParameterFormatCodes) > math.MaxUint16 {
		return nil, errors.New("too many parameter format codes")
	}
	dst = pgio.AppendUint16(dst, uint16(len(src.ParameterFormatCodes)))
	for _, fc := range src.ParameterFormatCodes {
		dst = pgio.AppendInt16(dst, fc)
	}

	if len(src.Parameters) > math.MaxUint16 {
		return nil, errors.New("too many parameters")
	}
	dst = pgio.AppendUint16(dst, uint16(len(src.Parameters)))
	for _, p := range src.Parameters {
		if p == nil {
			dst = pgio.AppendInt32(dst, -1)
			continue
		}

		dst = pgio.AppendInt32(dst, int32(len(p)))
		dst = append(dst, p...)
	}

	if len(src.ResultFormatCodes) > math.MaxUint16 {
		return nil, errors.New("too many result format codes")
	}
	dst = pgio.AppendUint16(dst, uint16(len(src.ResultFormatCodes)))
	for _, fc := range src.ResultFormatCodes {
		dst = pgio.AppendInt16(dst, fc)
	}

	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (src Bind) MarshalJSON() ([]byte, error) {
	formattedParameters := make([]map[string]string, len(src.Parameters))
	for i, p := range src.Parameters {
		if p == nil {
			continue
		}

		textFormat := true
		if len(src.ParameterFormatCodes) == 1 {
			textFormat = src.ParameterFormatCodes[0] == 0
		} else if len(src.ParameterFormatCodes) > 1 {
			textFormat = src.ParameterFormatCodes[i] == 0
		}

		if textFormat {
			formattedParameters[i] = map[string]string{"text": string(p)}
		} else {
			formattedParameters[i] = map[string]string{"binary": hex.EncodeToString(p)}
		}
	}

	return json.Marshal(struct {
		Type                 string
		DestinationPortal    string
		PreparedStatement    string
		ParameterFormatCodes []int16
		Parameters           []map[string]string
		ResultFormatCodes    []int16
	}{
		Type:                 "Bind",
		DestinationPortal:    src.DestinationPortal,
		PreparedStatement:    src.PreparedStatement,
		ParameterFormatCodes: src.ParameterFormatCodes,
		Parameters:           formattedParameters,
		ResultFormatCodes:    src.ResultFormatCodes,
	})
}

// UnmarshalJSON implements encoding/json.Unmarshaler.
func (dst *Bind) UnmarshalJSON(data []byte) error {
	// Ignore null, like in the main JSON package.
	if string(data) == "null" {
		return nil
	}

	var msg struct {
		DestinationPortal    string
		PreparedStatement    string
		ParameterFormatCodes []int16
		Parameters           []map[string]string
		ResultFormatCodes    []int16
	}
	err := json.Unmarshal(data, &msg)
	if err != nil {
		return err
	}
	dst.DestinationPortal = msg.DestinationPortal
	dst.PreparedStatement = msg.PreparedStatement
	dst.ParameterFormatCodes = msg.ParameterFormatCodes
	dst.Parameters = make([][]byte, len(msg.Parameters))
	dst.ResultFormatCodes = msg.ResultFormatCodes
	for n, parameter := range msg.Parameters {
		dst.Parameters[n], err = getValueFromJSON(parameter)
		if err != nil {
			return fmt.Errorf("cannot get param %d: %w", n, err)
		}
	}
	return nil
}
