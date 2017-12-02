package mssql

// Transaction Manager requests
// http://msdn.microsoft.com/en-us/library/dd339887.aspx

import (
	"encoding/binary"
)

const (
	tmGetDtcAddr    = 0
	tmPropagateXact = 1
	tmBeginXact     = 5
	tmPromoteXact   = 6
	tmCommitXact    = 7
	tmRollbackXact  = 8
	tmSaveXact      = 9
)

type isoLevel uint8

const (
	isolationUseCurrent     isoLevel = 0
	isolationReadUncommited          = 1
	isolationReadCommited            = 2
	isolationRepeatableRead          = 3
	isolationSerializable            = 4
	isolationSnapshot                = 5
)

func sendBeginXact(buf *tdsBuffer, headers []headerStruct, isolation isoLevel,
	name string) (err error) {
	buf.BeginPacket(packTransMgrReq)
	writeAllHeaders(buf, headers)
	var rqtype uint16 = tmBeginXact
	err = binary.Write(buf, binary.LittleEndian, &rqtype)
	if err != nil {
		return
	}
	err = binary.Write(buf, binary.LittleEndian, &isolation)
	if err != nil {
		return
	}
	err = writeBVarChar(buf, name)
	if err != nil {
		return
	}
	return buf.FinishPacket()
}

const (
	fBeginXact = 1
)

func sendCommitXact(buf *tdsBuffer, headers []headerStruct, name string, flags uint8, isolation uint8, newname string) error {
	buf.BeginPacket(packTransMgrReq)
	writeAllHeaders(buf, headers)
	var rqtype uint16 = tmCommitXact
	err := binary.Write(buf, binary.LittleEndian, &rqtype)
	if err != nil {
		return err
	}
	err = writeBVarChar(buf, name)
	if err != nil {
		return err
	}
	err = binary.Write(buf, binary.LittleEndian, &flags)
	if err != nil {
		return err
	}
	if flags&fBeginXact != 0 {
		err = binary.Write(buf, binary.LittleEndian, &isolation)
		if err != nil {
			return err
		}
		err = writeBVarChar(buf, name)
		if err != nil {
			return err
		}
	}
	return buf.FinishPacket()
}

func sendRollbackXact(buf *tdsBuffer, headers []headerStruct, name string, flags uint8, isolation uint8, newname string) error {
	buf.BeginPacket(packTransMgrReq)
	writeAllHeaders(buf, headers)
	var rqtype uint16 = tmRollbackXact
	err := binary.Write(buf, binary.LittleEndian, &rqtype)
	if err != nil {
		return err
	}
	err = writeBVarChar(buf, name)
	if err != nil {
		return err
	}
	err = binary.Write(buf, binary.LittleEndian, &flags)
	if err != nil {
		return err
	}
	if flags&fBeginXact != 0 {
		err = binary.Write(buf, binary.LittleEndian, &isolation)
		if err != nil {
			return err
		}
		err = writeBVarChar(buf, name)
		if err != nil {
			return err
		}
	}
	return buf.FinishPacket()
}
