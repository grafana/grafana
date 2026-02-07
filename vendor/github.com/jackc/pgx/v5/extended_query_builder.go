package pgx

import (
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

// ExtendedQueryBuilder is used to choose the parameter formats, to format the parameters and to choose the result
// formats for an extended query.
type ExtendedQueryBuilder struct {
	ParamValues     [][]byte
	paramValueBytes []byte
	ParamFormats    []int16
	ResultFormats   []int16
}

// Build sets ParamValues, ParamFormats, and ResultFormats for use with *PgConn.ExecParams or *PgConn.ExecPrepared. If
// sd is nil then QueryExecModeExec behavior will be used.
func (eqb *ExtendedQueryBuilder) Build(m *pgtype.Map, sd *pgconn.StatementDescription, args []any) error {
	eqb.reset()

	if sd == nil {
		for i := range args {
			err := eqb.appendParam(m, 0, pgtype.TextFormatCode, args[i])
			if err != nil {
				err = fmt.Errorf("failed to encode args[%d]: %w", i, err)
				return err
			}
		}
		return nil
	}

	if len(sd.ParamOIDs) != len(args) {
		return fmt.Errorf("mismatched param and argument count")
	}

	for i := range args {
		err := eqb.appendParam(m, sd.ParamOIDs[i], -1, args[i])
		if err != nil {
			err = fmt.Errorf("failed to encode args[%d]: %w", i, err)
			return err
		}
	}

	for i := range sd.Fields {
		eqb.appendResultFormat(m.FormatCodeForOID(sd.Fields[i].DataTypeOID))
	}

	return nil
}

// appendParam appends a parameter to the query. format may be -1 to automatically choose the format. If arg is nil it
// must be an untyped nil.
func (eqb *ExtendedQueryBuilder) appendParam(m *pgtype.Map, oid uint32, format int16, arg any) error {
	if format == -1 {
		preferredFormat := eqb.chooseParameterFormatCode(m, oid, arg)
		preferredErr := eqb.appendParam(m, oid, preferredFormat, arg)
		if preferredErr == nil {
			return nil
		}

		var otherFormat int16
		if preferredFormat == TextFormatCode {
			otherFormat = BinaryFormatCode
		} else {
			otherFormat = TextFormatCode
		}

		otherErr := eqb.appendParam(m, oid, otherFormat, arg)
		if otherErr == nil {
			return nil
		}

		return preferredErr // return the error from the preferred format
	}

	v, err := eqb.encodeExtendedParamValue(m, oid, format, arg)
	if err != nil {
		return err
	}

	eqb.ParamFormats = append(eqb.ParamFormats, format)
	eqb.ParamValues = append(eqb.ParamValues, v)

	return nil
}

// appendResultFormat appends a result format to the query.
func (eqb *ExtendedQueryBuilder) appendResultFormat(format int16) {
	eqb.ResultFormats = append(eqb.ResultFormats, format)
}

// reset readies eqb to build another query.
func (eqb *ExtendedQueryBuilder) reset() {
	eqb.ParamValues = eqb.ParamValues[0:0]
	eqb.paramValueBytes = eqb.paramValueBytes[0:0]
	eqb.ParamFormats = eqb.ParamFormats[0:0]
	eqb.ResultFormats = eqb.ResultFormats[0:0]

	if cap(eqb.ParamValues) > 64 {
		eqb.ParamValues = make([][]byte, 0, 64)
	}

	if cap(eqb.paramValueBytes) > 256 {
		eqb.paramValueBytes = make([]byte, 0, 256)
	}

	if cap(eqb.ParamFormats) > 64 {
		eqb.ParamFormats = make([]int16, 0, 64)
	}
	if cap(eqb.ResultFormats) > 64 {
		eqb.ResultFormats = make([]int16, 0, 64)
	}
}

func (eqb *ExtendedQueryBuilder) encodeExtendedParamValue(m *pgtype.Map, oid uint32, formatCode int16, arg any) ([]byte, error) {
	if eqb.paramValueBytes == nil {
		eqb.paramValueBytes = make([]byte, 0, 128)
	}

	pos := len(eqb.paramValueBytes)

	buf, err := m.Encode(oid, formatCode, arg, eqb.paramValueBytes)
	if err != nil {
		return nil, err
	}
	if buf == nil {
		return nil, nil
	}
	eqb.paramValueBytes = buf
	return eqb.paramValueBytes[pos:], nil
}

// chooseParameterFormatCode determines the correct format code for an
// argument to a prepared statement. It defaults to TextFormatCode if no
// determination can be made.
func (eqb *ExtendedQueryBuilder) chooseParameterFormatCode(m *pgtype.Map, oid uint32, arg any) int16 {
	switch arg.(type) {
	case string, *string:
		return TextFormatCode
	}

	return m.FormatCodeForOID(oid)
}
