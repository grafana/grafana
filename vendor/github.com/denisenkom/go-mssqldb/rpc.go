package mssql

import (
	"encoding/binary"
)

type procId struct {
	id   uint16
	name string
}

// parameter flags
const (
	fByRevValue   = 1
	fDefaultValue = 2
)

type param struct {
	Name   string
	Flags  uint8
	ti     typeInfo
	buffer []byte
}

const (
	fWithRecomp    = 1
	fNoMetaData    = 2
	fReuseMetaData = 4
)

var (
	sp_Cursor          = procId{1, ""}
	sp_CursorOpen      = procId{2, ""}
	sp_CursorPrepare   = procId{3, ""}
	sp_CursorExecute   = procId{4, ""}
	sp_CursorPrepExec  = procId{5, ""}
	sp_CursorUnprepare = procId{6, ""}
	sp_CursorFetch     = procId{7, ""}
	sp_CursorOption    = procId{8, ""}
	sp_CursorClose     = procId{9, ""}
	sp_ExecuteSql      = procId{10, ""}
	sp_Prepare         = procId{11, ""}
	sp_PrepExec        = procId{13, ""}
	sp_PrepExecRpc     = procId{14, ""}
	sp_Unprepare       = procId{15, ""}
)

// http://msdn.microsoft.com/en-us/library/dd357576.aspx
func sendRpc(buf *tdsBuffer, headers []headerStruct, proc procId, flags uint16, params []param, resetSession bool) (err error) {
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
		err = writeTypeInfo(buf, &param.ti)
		if err != nil {
			return
		}
		err = param.ti.Writer(buf, param.ti, param.buffer)
		if err != nil {
			return
		}
	}
	return buf.FinishPacket()
}
