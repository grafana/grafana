// Code generated DO NOT EDIT

package cmds

import "strconv"

type Bitcount Incomplete

func (b Builder) Bitcount() (c Bitcount) {
	c = Bitcount{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "BITCOUNT")
	return c
}

func (c Bitcount) Key(key string) BitcountKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BitcountKey)(c)
}

type BitcountIndexEnd Incomplete

func (c BitcountIndexEnd) Byte() BitcountIndexIndexUnitByte {
	c.cs.s = append(c.cs.s, "BYTE")
	return (BitcountIndexIndexUnitByte)(c)
}

func (c BitcountIndexEnd) Bit() BitcountIndexIndexUnitBit {
	c.cs.s = append(c.cs.s, "BIT")
	return (BitcountIndexIndexUnitBit)(c)
}

func (c BitcountIndexEnd) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitcountIndexEnd) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitcountIndexIndexUnitBit Incomplete

func (c BitcountIndexIndexUnitBit) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitcountIndexIndexUnitBit) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitcountIndexIndexUnitByte Incomplete

func (c BitcountIndexIndexUnitByte) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitcountIndexIndexUnitByte) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitcountIndexStart Incomplete

func (c BitcountIndexStart) End(end int64) BitcountIndexEnd {
	c.cs.s = append(c.cs.s, strconv.FormatInt(end, 10))
	return (BitcountIndexEnd)(c)
}

type BitcountKey Incomplete

func (c BitcountKey) Start(start int64) BitcountIndexStart {
	c.cs.s = append(c.cs.s, strconv.FormatInt(start, 10))
	return (BitcountIndexStart)(c)
}

func (c BitcountKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitcountKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Bitfield Incomplete

func (b Builder) Bitfield() (c Bitfield) {
	c = Bitfield{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "BITFIELD")
	return c
}

func (c Bitfield) Key(key string) BitfieldKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BitfieldKey)(c)
}

type BitfieldKey Incomplete

func (c BitfieldKey) Get(encoding string, offset int64) BitfieldOperationGet {
	c.cs.s = append(c.cs.s, "GET", encoding, strconv.FormatInt(offset, 10))
	return (BitfieldOperationGet)(c)
}

func (c BitfieldKey) OverflowWrap() BitfieldOperationWriteOverflowWrap {
	c.cs.s = append(c.cs.s, "OVERFLOW", "WRAP")
	return (BitfieldOperationWriteOverflowWrap)(c)
}

func (c BitfieldKey) OverflowSat() BitfieldOperationWriteOverflowSat {
	c.cs.s = append(c.cs.s, "OVERFLOW", "SAT")
	return (BitfieldOperationWriteOverflowSat)(c)
}

func (c BitfieldKey) OverflowFail() BitfieldOperationWriteOverflowFail {
	c.cs.s = append(c.cs.s, "OVERFLOW", "FAIL")
	return (BitfieldOperationWriteOverflowFail)(c)
}

func (c BitfieldKey) Set(encoding string, offset int64, value int64) BitfieldOperationWriteSetSet {
	c.cs.s = append(c.cs.s, "SET", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(value, 10))
	return (BitfieldOperationWriteSetSet)(c)
}

func (c BitfieldKey) Incrby(encoding string, offset int64, increment int64) BitfieldOperationWriteSetIncrby {
	c.cs.s = append(c.cs.s, "INCRBY", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(increment, 10))
	return (BitfieldOperationWriteSetIncrby)(c)
}

func (c BitfieldKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitfieldOperationGet Incomplete

func (c BitfieldOperationGet) OverflowWrap() BitfieldOperationWriteOverflowWrap {
	c.cs.s = append(c.cs.s, "OVERFLOW", "WRAP")
	return (BitfieldOperationWriteOverflowWrap)(c)
}

func (c BitfieldOperationGet) OverflowSat() BitfieldOperationWriteOverflowSat {
	c.cs.s = append(c.cs.s, "OVERFLOW", "SAT")
	return (BitfieldOperationWriteOverflowSat)(c)
}

func (c BitfieldOperationGet) OverflowFail() BitfieldOperationWriteOverflowFail {
	c.cs.s = append(c.cs.s, "OVERFLOW", "FAIL")
	return (BitfieldOperationWriteOverflowFail)(c)
}

func (c BitfieldOperationGet) Set(encoding string, offset int64, value int64) BitfieldOperationWriteSetSet {
	c.cs.s = append(c.cs.s, "SET", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(value, 10))
	return (BitfieldOperationWriteSetSet)(c)
}

func (c BitfieldOperationGet) Incrby(encoding string, offset int64, increment int64) BitfieldOperationWriteSetIncrby {
	c.cs.s = append(c.cs.s, "INCRBY", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(increment, 10))
	return (BitfieldOperationWriteSetIncrby)(c)
}

func (c BitfieldOperationGet) Get(encoding string, offset int64) BitfieldOperationGet {
	c.cs.s = append(c.cs.s, "GET", encoding, strconv.FormatInt(offset, 10))
	return c
}

func (c BitfieldOperationGet) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitfieldOperationWriteOverflowFail Incomplete

func (c BitfieldOperationWriteOverflowFail) Set(encoding string, offset int64, value int64) BitfieldOperationWriteSetSet {
	c.cs.s = append(c.cs.s, "SET", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(value, 10))
	return (BitfieldOperationWriteSetSet)(c)
}

func (c BitfieldOperationWriteOverflowFail) Incrby(encoding string, offset int64, increment int64) BitfieldOperationWriteSetIncrby {
	c.cs.s = append(c.cs.s, "INCRBY", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(increment, 10))
	return (BitfieldOperationWriteSetIncrby)(c)
}

type BitfieldOperationWriteOverflowSat Incomplete

func (c BitfieldOperationWriteOverflowSat) Set(encoding string, offset int64, value int64) BitfieldOperationWriteSetSet {
	c.cs.s = append(c.cs.s, "SET", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(value, 10))
	return (BitfieldOperationWriteSetSet)(c)
}

func (c BitfieldOperationWriteOverflowSat) Incrby(encoding string, offset int64, increment int64) BitfieldOperationWriteSetIncrby {
	c.cs.s = append(c.cs.s, "INCRBY", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(increment, 10))
	return (BitfieldOperationWriteSetIncrby)(c)
}

type BitfieldOperationWriteOverflowWrap Incomplete

func (c BitfieldOperationWriteOverflowWrap) Set(encoding string, offset int64, value int64) BitfieldOperationWriteSetSet {
	c.cs.s = append(c.cs.s, "SET", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(value, 10))
	return (BitfieldOperationWriteSetSet)(c)
}

func (c BitfieldOperationWriteOverflowWrap) Incrby(encoding string, offset int64, increment int64) BitfieldOperationWriteSetIncrby {
	c.cs.s = append(c.cs.s, "INCRBY", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(increment, 10))
	return (BitfieldOperationWriteSetIncrby)(c)
}

type BitfieldOperationWriteSetIncrby Incomplete

func (c BitfieldOperationWriteSetIncrby) Get(encoding string, offset int64) BitfieldOperationGet {
	c.cs.s = append(c.cs.s, "GET", encoding, strconv.FormatInt(offset, 10))
	return (BitfieldOperationGet)(c)
}

func (c BitfieldOperationWriteSetIncrby) OverflowWrap() BitfieldOperationWriteOverflowWrap {
	c.cs.s = append(c.cs.s, "OVERFLOW", "WRAP")
	return (BitfieldOperationWriteOverflowWrap)(c)
}

func (c BitfieldOperationWriteSetIncrby) OverflowSat() BitfieldOperationWriteOverflowSat {
	c.cs.s = append(c.cs.s, "OVERFLOW", "SAT")
	return (BitfieldOperationWriteOverflowSat)(c)
}

func (c BitfieldOperationWriteSetIncrby) OverflowFail() BitfieldOperationWriteOverflowFail {
	c.cs.s = append(c.cs.s, "OVERFLOW", "FAIL")
	return (BitfieldOperationWriteOverflowFail)(c)
}

func (c BitfieldOperationWriteSetIncrby) Set(encoding string, offset int64, value int64) BitfieldOperationWriteSetSet {
	c.cs.s = append(c.cs.s, "SET", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(value, 10))
	return (BitfieldOperationWriteSetSet)(c)
}

func (c BitfieldOperationWriteSetIncrby) Incrby(encoding string, offset int64, increment int64) BitfieldOperationWriteSetIncrby {
	c.cs.s = append(c.cs.s, "INCRBY", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(increment, 10))
	return c
}

func (c BitfieldOperationWriteSetIncrby) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitfieldOperationWriteSetSet Incomplete

func (c BitfieldOperationWriteSetSet) Incrby(encoding string, offset int64, increment int64) BitfieldOperationWriteSetIncrby {
	c.cs.s = append(c.cs.s, "INCRBY", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(increment, 10))
	return (BitfieldOperationWriteSetIncrby)(c)
}

func (c BitfieldOperationWriteSetSet) Get(encoding string, offset int64) BitfieldOperationGet {
	c.cs.s = append(c.cs.s, "GET", encoding, strconv.FormatInt(offset, 10))
	return (BitfieldOperationGet)(c)
}

func (c BitfieldOperationWriteSetSet) OverflowWrap() BitfieldOperationWriteOverflowWrap {
	c.cs.s = append(c.cs.s, "OVERFLOW", "WRAP")
	return (BitfieldOperationWriteOverflowWrap)(c)
}

func (c BitfieldOperationWriteSetSet) OverflowSat() BitfieldOperationWriteOverflowSat {
	c.cs.s = append(c.cs.s, "OVERFLOW", "SAT")
	return (BitfieldOperationWriteOverflowSat)(c)
}

func (c BitfieldOperationWriteSetSet) OverflowFail() BitfieldOperationWriteOverflowFail {
	c.cs.s = append(c.cs.s, "OVERFLOW", "FAIL")
	return (BitfieldOperationWriteOverflowFail)(c)
}

func (c BitfieldOperationWriteSetSet) Set(encoding string, offset int64, value int64) BitfieldOperationWriteSetSet {
	c.cs.s = append(c.cs.s, "SET", encoding, strconv.FormatInt(offset, 10), strconv.FormatInt(value, 10))
	return c
}

func (c BitfieldOperationWriteSetSet) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitfieldRo Incomplete

func (b Builder) BitfieldRo() (c BitfieldRo) {
	c = BitfieldRo{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "BITFIELD_RO")
	return c
}

func (c BitfieldRo) Key(key string) BitfieldRoKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BitfieldRoKey)(c)
}

type BitfieldRoGet Incomplete

func (c BitfieldRoGet) Get(encoding string, offset int64) BitfieldRoGet {
	c.cs.s = append(c.cs.s, "GET", encoding, strconv.FormatInt(offset, 10))
	return c
}

func (c BitfieldRoGet) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitfieldRoGet) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitfieldRoKey Incomplete

func (c BitfieldRoKey) Get() BitfieldRoGet {
	return (BitfieldRoGet)(c)
}

func (c BitfieldRoKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitfieldRoKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Bitop Incomplete

func (b Builder) Bitop() (c Bitop) {
	c = Bitop{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "BITOP")
	return c
}

func (c Bitop) And() BitopOperationAnd {
	c.cs.s = append(c.cs.s, "AND")
	return (BitopOperationAnd)(c)
}

func (c Bitop) Or() BitopOperationOr {
	c.cs.s = append(c.cs.s, "OR")
	return (BitopOperationOr)(c)
}

func (c Bitop) Xor() BitopOperationXor {
	c.cs.s = append(c.cs.s, "XOR")
	return (BitopOperationXor)(c)
}

func (c Bitop) Not() BitopOperationNot {
	c.cs.s = append(c.cs.s, "NOT")
	return (BitopOperationNot)(c)
}

type BitopDestkey Incomplete

func (c BitopDestkey) Key(key ...string) BitopKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return (BitopKey)(c)
}

type BitopKey Incomplete

func (c BitopKey) Key(key ...string) BitopKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c BitopKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitopOperationAnd Incomplete

func (c BitopOperationAnd) Destkey(destkey string) BitopDestkey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destkey)
	} else {
		c.ks = check(c.ks, slot(destkey))
	}
	c.cs.s = append(c.cs.s, destkey)
	return (BitopDestkey)(c)
}

type BitopOperationNot Incomplete

func (c BitopOperationNot) Destkey(destkey string) BitopDestkey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destkey)
	} else {
		c.ks = check(c.ks, slot(destkey))
	}
	c.cs.s = append(c.cs.s, destkey)
	return (BitopDestkey)(c)
}

type BitopOperationOr Incomplete

func (c BitopOperationOr) Destkey(destkey string) BitopDestkey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destkey)
	} else {
		c.ks = check(c.ks, slot(destkey))
	}
	c.cs.s = append(c.cs.s, destkey)
	return (BitopDestkey)(c)
}

type BitopOperationXor Incomplete

func (c BitopOperationXor) Destkey(destkey string) BitopDestkey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destkey)
	} else {
		c.ks = check(c.ks, slot(destkey))
	}
	c.cs.s = append(c.cs.s, destkey)
	return (BitopDestkey)(c)
}

type Bitpos Incomplete

func (b Builder) Bitpos() (c Bitpos) {
	c = Bitpos{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "BITPOS")
	return c
}

func (c Bitpos) Key(key string) BitposKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BitposKey)(c)
}

type BitposBit Incomplete

func (c BitposBit) Start(start int64) BitposIndexStart {
	c.cs.s = append(c.cs.s, strconv.FormatInt(start, 10))
	return (BitposIndexStart)(c)
}

func (c BitposBit) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitposBit) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitposIndexEndIndexEnd Incomplete

func (c BitposIndexEndIndexEnd) Byte() BitposIndexEndIndexIndexUnitByte {
	c.cs.s = append(c.cs.s, "BYTE")
	return (BitposIndexEndIndexIndexUnitByte)(c)
}

func (c BitposIndexEndIndexEnd) Bit() BitposIndexEndIndexIndexUnitBit {
	c.cs.s = append(c.cs.s, "BIT")
	return (BitposIndexEndIndexIndexUnitBit)(c)
}

func (c BitposIndexEndIndexEnd) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitposIndexEndIndexEnd) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitposIndexEndIndexIndexUnitBit Incomplete

func (c BitposIndexEndIndexIndexUnitBit) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitposIndexEndIndexIndexUnitBit) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitposIndexEndIndexIndexUnitByte Incomplete

func (c BitposIndexEndIndexIndexUnitByte) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitposIndexEndIndexIndexUnitByte) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitposIndexStart Incomplete

func (c BitposIndexStart) End(end int64) BitposIndexEndIndexEnd {
	c.cs.s = append(c.cs.s, strconv.FormatInt(end, 10))
	return (BitposIndexEndIndexEnd)(c)
}

func (c BitposIndexStart) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BitposIndexStart) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BitposKey Incomplete

func (c BitposKey) Bit(bit int64) BitposBit {
	c.cs.s = append(c.cs.s, strconv.FormatInt(bit, 10))
	return (BitposBit)(c)
}

type Getbit Incomplete

func (b Builder) Getbit() (c Getbit) {
	c = Getbit{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GETBIT")
	return c
}

func (c Getbit) Key(key string) GetbitKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GetbitKey)(c)
}

type GetbitKey Incomplete

func (c GetbitKey) Offset(offset int64) GetbitOffset {
	c.cs.s = append(c.cs.s, strconv.FormatInt(offset, 10))
	return (GetbitOffset)(c)
}

type GetbitOffset Incomplete

func (c GetbitOffset) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GetbitOffset) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Setbit Incomplete

func (b Builder) Setbit() (c Setbit) {
	c = Setbit{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SETBIT")
	return c
}

func (c Setbit) Key(key string) SetbitKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SetbitKey)(c)
}

type SetbitKey Incomplete

func (c SetbitKey) Offset(offset int64) SetbitOffset {
	c.cs.s = append(c.cs.s, strconv.FormatInt(offset, 10))
	return (SetbitOffset)(c)
}

type SetbitOffset Incomplete

func (c SetbitOffset) Value(value int64) SetbitValue {
	c.cs.s = append(c.cs.s, strconv.FormatInt(value, 10))
	return (SetbitValue)(c)
}

type SetbitValue Incomplete

func (c SetbitValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
