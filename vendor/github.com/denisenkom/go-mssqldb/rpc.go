package mssql

import (
	"encoding/binary"
)

type ProcId struct {
	id   uint16
	name string
}

// parameter flags
const (
	fByRevValue   = 1
	fDefaultValue = 2
)

type Param struct {
	Name   string
	Flags  uint8
	ti     typeInfo
	buffer []byte
}

func MakeProcId(name string) (res ProcId) {
	res.name = name
	if len(name) == 0 {
		panic("Proc name shouln't be empty")
	}
	if len(name) >= 0xffff {
		panic("Invalid length of procedure name, should be less than 0xffff")
	}
	return res
}

const (
	fWithRecomp    = 1
	fNoMetaData    = 2
	fReuseMetaData = 4
)

var (
	Sp_Cursor          = ProcId{1, ""}
	Sp_CursorOpen      = ProcId{2, ""}
	Sp_CursorPrepare   = ProcId{3, ""}
	Sp_CursorExecute   = ProcId{4, ""}
	Sp_CursorPrepExec  = ProcId{5, ""}
	Sp_CursorUnprepare = ProcId{6, ""}
	Sp_CursorFetch     = ProcId{7, ""}
	Sp_CursorOption    = ProcId{8, ""}
	Sp_CursorClose     = ProcId{9, ""}
	Sp_ExecuteSql      = ProcId{10, ""}
	Sp_Prepare         = ProcId{11, ""}
	Sp_PrepExec        = ProcId{13, ""}
	Sp_PrepExecRpc     = ProcId{14, ""}
	Sp_Unprepare       = ProcId{15, ""}
)

// http://msdn.microsoft.com/en-us/library/dd357576.aspx
func sendRpc(buf *tdsBuffer, headers []headerStruct, proc ProcId, flags uint16, params []Param) (err error) {
	buf.BeginPacket(packRPCRequest)
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
