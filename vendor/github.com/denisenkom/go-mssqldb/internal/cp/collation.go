package cp

// http://msdn.microsoft.com/en-us/library/dd340437.aspx

type Collation struct {
	LcidAndFlags uint32
	SortId       uint8
}

func (c Collation) getLcid() uint32 {
	return c.LcidAndFlags & 0x000fffff
}

func (c Collation) getFlags() uint32 {
	return (c.LcidAndFlags & 0x0ff00000) >> 20
}

func (c Collation) getVersion() uint32 {
	return (c.LcidAndFlags & 0xf0000000) >> 28
}
