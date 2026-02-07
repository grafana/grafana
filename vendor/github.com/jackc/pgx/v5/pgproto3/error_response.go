package pgproto3

import (
	"bytes"
	"encoding/json"
	"strconv"
)

type ErrorResponse struct {
	Severity            string
	SeverityUnlocalized string // only in 9.6 and greater
	Code                string
	Message             string
	Detail              string
	Hint                string
	Position            int32
	InternalPosition    int32
	InternalQuery       string
	Where               string
	SchemaName          string
	TableName           string
	ColumnName          string
	DataTypeName        string
	ConstraintName      string
	File                string
	Line                int32
	Routine             string

	UnknownFields map[byte]string
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*ErrorResponse) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *ErrorResponse) Decode(src []byte) error {
	*dst = ErrorResponse{}

	buf := bytes.NewBuffer(src)

	for {
		k, err := buf.ReadByte()
		if err != nil {
			return err
		}
		if k == 0 {
			break
		}

		vb, err := buf.ReadBytes(0)
		if err != nil {
			return err
		}
		v := string(vb[:len(vb)-1])

		switch k {
		case 'S':
			dst.Severity = v
		case 'V':
			dst.SeverityUnlocalized = v
		case 'C':
			dst.Code = v
		case 'M':
			dst.Message = v
		case 'D':
			dst.Detail = v
		case 'H':
			dst.Hint = v
		case 'P':
			s := v
			n, _ := strconv.ParseInt(s, 10, 32)
			dst.Position = int32(n)
		case 'p':
			s := v
			n, _ := strconv.ParseInt(s, 10, 32)
			dst.InternalPosition = int32(n)
		case 'q':
			dst.InternalQuery = v
		case 'W':
			dst.Where = v
		case 's':
			dst.SchemaName = v
		case 't':
			dst.TableName = v
		case 'c':
			dst.ColumnName = v
		case 'd':
			dst.DataTypeName = v
		case 'n':
			dst.ConstraintName = v
		case 'F':
			dst.File = v
		case 'L':
			s := v
			n, _ := strconv.ParseInt(s, 10, 32)
			dst.Line = int32(n)
		case 'R':
			dst.Routine = v

		default:
			if dst.UnknownFields == nil {
				dst.UnknownFields = make(map[byte]string)
			}
			dst.UnknownFields[k] = v
		}
	}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *ErrorResponse) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'E')
	dst = src.appendFields(dst)
	return finishMessage(dst, sp)
}

func (src *ErrorResponse) appendFields(dst []byte) []byte {
	if src.Severity != "" {
		dst = append(dst, 'S')
		dst = append(dst, src.Severity...)
		dst = append(dst, 0)
	}
	if src.SeverityUnlocalized != "" {
		dst = append(dst, 'V')
		dst = append(dst, src.SeverityUnlocalized...)
		dst = append(dst, 0)
	}
	if src.Code != "" {
		dst = append(dst, 'C')
		dst = append(dst, src.Code...)
		dst = append(dst, 0)
	}
	if src.Message != "" {
		dst = append(dst, 'M')
		dst = append(dst, src.Message...)
		dst = append(dst, 0)
	}
	if src.Detail != "" {
		dst = append(dst, 'D')
		dst = append(dst, src.Detail...)
		dst = append(dst, 0)
	}
	if src.Hint != "" {
		dst = append(dst, 'H')
		dst = append(dst, src.Hint...)
		dst = append(dst, 0)
	}
	if src.Position != 0 {
		dst = append(dst, 'P')
		dst = append(dst, strconv.Itoa(int(src.Position))...)
		dst = append(dst, 0)
	}
	if src.InternalPosition != 0 {
		dst = append(dst, 'p')
		dst = append(dst, strconv.Itoa(int(src.InternalPosition))...)
		dst = append(dst, 0)
	}
	if src.InternalQuery != "" {
		dst = append(dst, 'q')
		dst = append(dst, src.InternalQuery...)
		dst = append(dst, 0)
	}
	if src.Where != "" {
		dst = append(dst, 'W')
		dst = append(dst, src.Where...)
		dst = append(dst, 0)
	}
	if src.SchemaName != "" {
		dst = append(dst, 's')
		dst = append(dst, src.SchemaName...)
		dst = append(dst, 0)
	}
	if src.TableName != "" {
		dst = append(dst, 't')
		dst = append(dst, src.TableName...)
		dst = append(dst, 0)
	}
	if src.ColumnName != "" {
		dst = append(dst, 'c')
		dst = append(dst, src.ColumnName...)
		dst = append(dst, 0)
	}
	if src.DataTypeName != "" {
		dst = append(dst, 'd')
		dst = append(dst, src.DataTypeName...)
		dst = append(dst, 0)
	}
	if src.ConstraintName != "" {
		dst = append(dst, 'n')
		dst = append(dst, src.ConstraintName...)
		dst = append(dst, 0)
	}
	if src.File != "" {
		dst = append(dst, 'F')
		dst = append(dst, src.File...)
		dst = append(dst, 0)
	}
	if src.Line != 0 {
		dst = append(dst, 'L')
		dst = append(dst, strconv.Itoa(int(src.Line))...)
		dst = append(dst, 0)
	}
	if src.Routine != "" {
		dst = append(dst, 'R')
		dst = append(dst, src.Routine...)
		dst = append(dst, 0)
	}

	for k, v := range src.UnknownFields {
		dst = append(dst, k)
		dst = append(dst, v...)
		dst = append(dst, 0)
	}

	dst = append(dst, 0)

	return dst
}

// MarshalJSON implements encoding/json.Marshaler.
func (src ErrorResponse) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type                string
		Severity            string
		SeverityUnlocalized string // only in 9.6 and greater
		Code                string
		Message             string
		Detail              string
		Hint                string
		Position            int32
		InternalPosition    int32
		InternalQuery       string
		Where               string
		SchemaName          string
		TableName           string
		ColumnName          string
		DataTypeName        string
		ConstraintName      string
		File                string
		Line                int32
		Routine             string

		UnknownFields map[byte]string
	}{
		Type:                "ErrorResponse",
		Severity:            src.Severity,
		SeverityUnlocalized: src.SeverityUnlocalized,
		Code:                src.Code,
		Message:             src.Message,
		Detail:              src.Detail,
		Hint:                src.Hint,
		Position:            src.Position,
		InternalPosition:    src.InternalPosition,
		InternalQuery:       src.InternalQuery,
		Where:               src.Where,
		SchemaName:          src.SchemaName,
		TableName:           src.TableName,
		ColumnName:          src.ColumnName,
		DataTypeName:        src.DataTypeName,
		ConstraintName:      src.ConstraintName,
		File:                src.File,
		Line:                src.Line,
		Routine:             src.Routine,
		UnknownFields:       src.UnknownFields,
	})
}

// UnmarshalJSON implements encoding/json.Unmarshaler.
func (dst *ErrorResponse) UnmarshalJSON(data []byte) error {
	// Ignore null, like in the main JSON package.
	if string(data) == "null" {
		return nil
	}

	var msg struct {
		Type                string
		Severity            string
		SeverityUnlocalized string // only in 9.6 and greater
		Code                string
		Message             string
		Detail              string
		Hint                string
		Position            int32
		InternalPosition    int32
		InternalQuery       string
		Where               string
		SchemaName          string
		TableName           string
		ColumnName          string
		DataTypeName        string
		ConstraintName      string
		File                string
		Line                int32
		Routine             string

		UnknownFields map[byte]string
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return err
	}

	dst.Severity = msg.Severity
	dst.SeverityUnlocalized = msg.SeverityUnlocalized
	dst.Code = msg.Code
	dst.Message = msg.Message
	dst.Detail = msg.Detail
	dst.Hint = msg.Hint
	dst.Position = msg.Position
	dst.InternalPosition = msg.InternalPosition
	dst.InternalQuery = msg.InternalQuery
	dst.Where = msg.Where
	dst.SchemaName = msg.SchemaName
	dst.TableName = msg.TableName
	dst.ColumnName = msg.ColumnName
	dst.DataTypeName = msg.DataTypeName
	dst.ConstraintName = msg.ConstraintName
	dst.File = msg.File
	dst.Line = msg.Line
	dst.Routine = msg.Routine

	dst.UnknownFields = msg.UnknownFields

	return nil
}
