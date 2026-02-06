package mssql

import (
	"encoding/binary"

	"github.com/microsoft/go-mssqldb/msdsn"
)

type procId struct {
	id   uint16
	name string
}

// parameter flags
const (
	fByRevValue   = 1
	fDefaultValue = 2
	fEncrypted    = 8
)

type param struct {
	Name       string
	Flags      uint8
	ti         typeInfo
	buffer     []byte
	tiOriginal typeInfo
	cipherInfo []byte
}

// Most of these are not used, but are left here for reference.
var (
	//	sp_Cursor          = procId{1, ""}
	//	sp_CursorOpen      = procId{2, ""}
	//	sp_CursorPrepare   = procId{3, ""}
	//	sp_CursorExecute   = procId{4, ""}
	//	sp_CursorPrepExec  = procId{5, ""}
	//	sp_CursorUnprepare = procId{6, ""}
	//	sp_CursorFetch     = procId{7, ""}
	//	sp_CursorOption    = procId{8, ""}
	//	sp_CursorClose     = procId{9, ""}
	sp_ExecuteSql = procId{10, ""}

// sp_Prepare         = procId{11, ""}
// sp_PrepExec        = procId{13, ""}
// sp_PrepExecRpc     = procId{14, ""}
// sp_Unprepare       = procId{15, ""}
)

// http://msdn.microsoft.com/en-us/library/dd357576.aspx
func sendRpc(buf *tdsBuffer, headers []headerStruct, proc procId, flags uint16, params []param, resetSession bool, encoding msdsn.EncodeParameters) (err error) {
	buf.BeginPacket(packRPCRequest, resetSession)
	writeAllHeaders(buf, headers)
	if len(proc.name) == 0 {
		var idswitch uint16 = 0xffff
		err = binary.Write(buf, binary.LittleEndian, &idswitch)
		if err != nil {
			return
		}
		err = binary.Write(buf, binary.LittleEndian, &proc.id)
		if err != nil {
			return
		}
	} else {
		err = writeUsVarChar(buf, proc.name)
		if err != nil {
			return
		}
	}
	err = binary.Write(buf, binary.LittleEndian, &flags)
	if err != nil {
		return
	}
	for _, param := range params {
		if err = writeBVarChar(buf, param.Name); err != nil {
			return
		}
		if err = binary.Write(buf, binary.LittleEndian, param.Flags); err != nil {
			return
		}
		err = writeTypeInfo(buf, &param.ti, (param.Flags&fByRevValue) != 0, encoding)
		if err != nil {
			return
		}
		err = param.ti.Writer(buf, param.ti, param.buffer, encoding)
		if err != nil {
			return
		}
		if (param.Flags & fEncrypted) == fEncrypted {
			err = writeTypeInfo(buf, &param.tiOriginal, false, encoding)
			if err != nil {
				return
			}
			if _, err = buf.Write(param.cipherInfo); err != nil {
				return
			}
		}
	}
	return buf.FinishPacket()
}
