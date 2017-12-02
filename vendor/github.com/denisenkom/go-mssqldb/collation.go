package mssql

import (
	"encoding/binary"
	"io"
)

// http://msdn.microsoft.com/en-us/library/dd340437.aspx

type collation struct {
	lcidAndFlags uint32
	sortId       uint8
}

func (c collation) getLcid() uint32 {
	return c.lcidAndFlags & 0x000fffff
}

func (c collation) getFlags() uint32 {
	return (c.lcidAndFlags & 0x0ff00000) >> 20
}

func (c collation) getVersion() uint32 {
	return (c.lcidAndFlags & 0xf0000000) >> 28
}

func readCollation(r *tdsBuffer) (res collation) {
	res.lcidAndFlags = r.uint32()
	res.sortId = r.byte()
	return
}

func writeCollation(w io.Writer, col collation) (err error) {
	if err = binary.Write(w, binary.LittleEndian, col.lcidAndFlags); err != nil {
		return
	}
	err = binary.Write(w, binary.LittleEndian, col.sortId)
	return
}
