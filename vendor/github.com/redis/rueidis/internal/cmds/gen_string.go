// Code generated DO NOT EDIT

package cmds

import (
	"strconv"
	"time"
)

type Append Incomplete

func (b Builder) Append() (c Append) {
	c = Append{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "APPEND")
	return c
}

func (c Append) Key(key string) AppendKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (AppendKey)(c)
}

type AppendKey Incomplete

func (c AppendKey) Value(value string) AppendValue {
	c.cs.s = append(c.cs.s, value)
	return (AppendValue)(c)
}

type AppendValue Incomplete

func (c AppendValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Decr Incomplete

func (b Builder) Decr() (c Decr) {
	c = Decr{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "DECR")
	return c
}

func (c Decr) Key(key string) DecrKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (DecrKey)(c)
}

type DecrKey Incomplete

func (c DecrKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Decrby Incomplete

func (b Builder) Decrby() (c Decrby) {
	c = Decrby{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "DECRBY")
	return c
}

func (c Decrby) Key(key string) DecrbyKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (DecrbyKey)(c)
}

type DecrbyDecrement Incomplete

func (c DecrbyDecrement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type DecrbyKey Incomplete

func (c DecrbyKey) Decrement(decrement int64) DecrbyDecrement {
	c.cs.s = append(c.cs.s, strconv.FormatInt(decrement, 10))
	return (DecrbyDecrement)(c)
}

type Get Incomplete

func (b Builder) Get() (c Get) {
	c = Get{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GET")
	return c
}

func (c Get) Key(key string) GetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GetKey)(c)
}

type GetKey Incomplete

func (c GetKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GetKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Getdel Incomplete

func (b Builder) Getdel() (c Getdel) {
	c = Getdel{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GETDEL")
	return c
}

func (c Getdel) Key(key string) GetdelKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GetdelKey)(c)
}

type GetdelKey Incomplete

func (c GetdelKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Getex Incomplete

func (b Builder) Getex() (c Getex) {
	c = Getex{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GETEX")
	return c
}

func (c Getex) Key(key string) GetexKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GetexKey)(c)
}

type GetexExpirationExSecTyped Incomplete

func (c GetexExpirationExSecTyped) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GetexExpirationExSeconds Incomplete

func (c GetexExpirationExSeconds) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GetexExpirationExatTimestamp Incomplete

func (c GetexExpirationExatTimestamp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GetexExpirationExatTimestampTyped Incomplete

func (c GetexExpirationExatTimestampTyped) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GetexExpirationPersist Incomplete

func (c GetexExpirationPersist) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GetexExpirationPxMilliseconds Incomplete

func (c GetexExpirationPxMilliseconds) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GetexExpirationPxMsTyped Incomplete

func (c GetexExpirationPxMsTyped) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GetexExpirationPxatMillisecondsTimestamp Incomplete

func (c GetexExpirationPxatMillisecondsTimestamp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GetexExpirationPxatMsTimestampTyped Incomplete

func (c GetexExpirationPxatMsTimestampTyped) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GetexKey Incomplete

func (c GetexKey) ExSeconds(seconds int64) GetexExpirationExSeconds {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(seconds, 10))
	return (GetexExpirationExSeconds)(c)
}

func (c GetexKey) PxMilliseconds(milliseconds int64) GetexExpirationPxMilliseconds {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(milliseconds, 10))
	return (GetexExpirationPxMilliseconds)(c)
}

func (c GetexKey) ExatTimestamp(timestamp int64) GetexExpirationExatTimestamp {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp, 10))
	return (GetexExpirationExatTimestamp)(c)
}

func (c GetexKey) PxatMillisecondsTimestamp(millisecondsTimestamp int64) GetexExpirationPxatMillisecondsTimestamp {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(millisecondsTimestamp, 10))
	return (GetexExpirationPxatMillisecondsTimestamp)(c)
}

func (c GetexKey) Persist() GetexExpirationPersist {
	c.cs.s = append(c.cs.s, "PERSIST")
	return (GetexExpirationPersist)(c)
}

func (c GetexKey) Ex(duration time.Duration) GetexExpirationExSecTyped {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(int64(duration/time.Second), 10))
	return (GetexExpirationExSecTyped)(c)
}

func (c GetexKey) Px(duration time.Duration) GetexExpirationPxMsTyped {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(int64(duration/time.Millisecond), 10))
	return (GetexExpirationPxMsTyped)(c)
}

func (c GetexKey) Exat(timestamp time.Time) GetexExpirationExatTimestampTyped {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp.Unix(), 10))
	return (GetexExpirationExatTimestampTyped)(c)
}

func (c GetexKey) Pxat(timestamp time.Time) GetexExpirationPxatMsTimestampTyped {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(timestamp.UnixMilli(), 10))
	return (GetexExpirationPxatMsTimestampTyped)(c)
}

func (c GetexKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Getrange Incomplete

func (b Builder) Getrange() (c Getrange) {
	c = Getrange{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GETRANGE")
	return c
}

func (c Getrange) Key(key string) GetrangeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GetrangeKey)(c)
}

type GetrangeEnd Incomplete

func (c GetrangeEnd) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GetrangeEnd) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GetrangeKey Incomplete

func (c GetrangeKey) Start(start int64) GetrangeStart {
	c.cs.s = append(c.cs.s, strconv.FormatInt(start, 10))
	return (GetrangeStart)(c)
}

type GetrangeStart Incomplete

func (c GetrangeStart) End(end int64) GetrangeEnd {
	c.cs.s = append(c.cs.s, strconv.FormatInt(end, 10))
	return (GetrangeEnd)(c)
}

type Getset Incomplete

func (b Builder) Getset() (c Getset) {
	c = Getset{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GETSET")
	return c
}

func (c Getset) Key(key string) GetsetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GetsetKey)(c)
}

type GetsetKey Incomplete

func (c GetsetKey) Value(value string) GetsetValue {
	c.cs.s = append(c.cs.s, value)
	return (GetsetValue)(c)
}

type GetsetValue Incomplete

func (c GetsetValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Incr Incomplete

func (b Builder) Incr() (c Incr) {
	c = Incr{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "INCR")
	return c
}

func (c Incr) Key(key string) IncrKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (IncrKey)(c)
}

type IncrKey Incomplete

func (c IncrKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Incrby Incomplete

func (b Builder) Incrby() (c Incrby) {
	c = Incrby{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "INCRBY")
	return c
}

func (c Incrby) Key(key string) IncrbyKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (IncrbyKey)(c)
}

type IncrbyIncrement Incomplete

func (c IncrbyIncrement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type IncrbyKey Incomplete

func (c IncrbyKey) Increment(increment int64) IncrbyIncrement {
	c.cs.s = append(c.cs.s, strconv.FormatInt(increment, 10))
	return (IncrbyIncrement)(c)
}

type Incrbyfloat Incomplete

func (b Builder) Incrbyfloat() (c Incrbyfloat) {
	c = Incrbyfloat{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "INCRBYFLOAT")
	return c
}

func (c Incrbyfloat) Key(key string) IncrbyfloatKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (IncrbyfloatKey)(c)
}

type IncrbyfloatIncrement Incomplete

func (c IncrbyfloatIncrement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type IncrbyfloatKey Incomplete

func (c IncrbyfloatKey) Increment(increment float64) IncrbyfloatIncrement {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(increment, 'f', -1, 64))
	return (IncrbyfloatIncrement)(c)
}

type Lcs Incomplete

func (b Builder) Lcs() (c Lcs) {
	c = Lcs{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "LCS")
	return c
}

func (c Lcs) Key1(key1 string) LcsKey1 {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key1)
	} else {
		c.ks = check(c.ks, slot(key1))
	}
	c.cs.s = append(c.cs.s, key1)
	return (LcsKey1)(c)
}

type LcsIdx Incomplete

func (c LcsIdx) Minmatchlen(len int64) LcsMinmatchlen {
	c.cs.s = append(c.cs.s, "MINMATCHLEN", strconv.FormatInt(len, 10))
	return (LcsMinmatchlen)(c)
}

func (c LcsIdx) Withmatchlen() LcsWithmatchlen {
	c.cs.s = append(c.cs.s, "WITHMATCHLEN")
	return (LcsWithmatchlen)(c)
}

func (c LcsIdx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LcsKey1 Incomplete

func (c LcsKey1) Key2(key2 string) LcsKey2 {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key2)
	} else {
		c.ks = check(c.ks, slot(key2))
	}
	c.cs.s = append(c.cs.s, key2)
	return (LcsKey2)(c)
}

type LcsKey2 Incomplete

func (c LcsKey2) Len() LcsLen {
	c.cs.s = append(c.cs.s, "LEN")
	return (LcsLen)(c)
}

func (c LcsKey2) Idx() LcsIdx {
	c.cs.s = append(c.cs.s, "IDX")
	return (LcsIdx)(c)
}

func (c LcsKey2) Minmatchlen(len int64) LcsMinmatchlen {
	c.cs.s = append(c.cs.s, "MINMATCHLEN", strconv.FormatInt(len, 10))
	return (LcsMinmatchlen)(c)
}

func (c LcsKey2) Withmatchlen() LcsWithmatchlen {
	c.cs.s = append(c.cs.s, "WITHMATCHLEN")
	return (LcsWithmatchlen)(c)
}

func (c LcsKey2) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LcsLen Incomplete

func (c LcsLen) Idx() LcsIdx {
	c.cs.s = append(c.cs.s, "IDX")
	return (LcsIdx)(c)
}

func (c LcsLen) Minmatchlen(len int64) LcsMinmatchlen {
	c.cs.s = append(c.cs.s, "MINMATCHLEN", strconv.FormatInt(len, 10))
	return (LcsMinmatchlen)(c)
}

func (c LcsLen) Withmatchlen() LcsWithmatchlen {
	c.cs.s = append(c.cs.s, "WITHMATCHLEN")
	return (LcsWithmatchlen)(c)
}

func (c LcsLen) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LcsMinmatchlen Incomplete

func (c LcsMinmatchlen) Withmatchlen() LcsWithmatchlen {
	c.cs.s = append(c.cs.s, "WITHMATCHLEN")
	return (LcsWithmatchlen)(c)
}

func (c LcsMinmatchlen) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LcsWithmatchlen Incomplete

func (c LcsWithmatchlen) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Mget Incomplete

func (b Builder) Mget() (c Mget) {
	c = Mget{cs: get(), ks: b.ks, cf: int16(mtGetTag)}
	c.cs.s = append(c.cs.s, "MGET")
	return c
}

func (c Mget) Key(key ...string) MgetKey {
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
	return (MgetKey)(c)
}

type MgetKey Incomplete

func (c MgetKey) Key(key ...string) MgetKey {
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

func (c MgetKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c MgetKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Mset Incomplete

func (b Builder) Mset() (c Mset) {
	c = Mset{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "MSET")
	return c
}

func (c Mset) KeyValue() MsetKeyValue {
	return (MsetKeyValue)(c)
}

type MsetKeyValue Incomplete

func (c MsetKeyValue) KeyValue(key string, value string) MsetKeyValue {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key, value)
	return c
}

func (c MsetKeyValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Msetnx Incomplete

func (b Builder) Msetnx() (c Msetnx) {
	c = Msetnx{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "MSETNX")
	return c
}

func (c Msetnx) KeyValue() MsetnxKeyValue {
	return (MsetnxKeyValue)(c)
}

type MsetnxKeyValue Incomplete

func (c MsetnxKeyValue) KeyValue(key string, value string) MsetnxKeyValue {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key, value)
	return c
}

func (c MsetnxKeyValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Psetex Incomplete

func (b Builder) Psetex() (c Psetex) {
	c = Psetex{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "PSETEX")
	return c
}

func (c Psetex) Key(key string) PsetexKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (PsetexKey)(c)
}

type PsetexKey Incomplete

func (c PsetexKey) Milliseconds(milliseconds int64) PsetexMilliseconds {
	c.cs.s = append(c.cs.s, strconv.FormatInt(milliseconds, 10))
	return (PsetexMilliseconds)(c)
}

type PsetexMilliseconds Incomplete

func (c PsetexMilliseconds) Value(value string) PsetexValue {
	c.cs.s = append(c.cs.s, value)
	return (PsetexValue)(c)
}

type PsetexValue Incomplete

func (c PsetexValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Set Incomplete

func (b Builder) Set() (c Set) {
	c = Set{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SET")
	return c
}

func (c Set) Key(key string) SetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SetKey)(c)
}

type SetConditionIfeq Incomplete

func (c SetConditionIfeq) Get() SetGet {
	c.cs.s = append(c.cs.s, "GET")
	return (SetGet)(c)
}

func (c SetConditionIfeq) ExSeconds(seconds int64) SetExpirationExSeconds {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(seconds, 10))
	return (SetExpirationExSeconds)(c)
}

func (c SetConditionIfeq) PxMilliseconds(milliseconds int64) SetExpirationPxMilliseconds {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(milliseconds, 10))
	return (SetExpirationPxMilliseconds)(c)
}

func (c SetConditionIfeq) ExatTimestamp(timestamp int64) SetExpirationExatTimestamp {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp, 10))
	return (SetExpirationExatTimestamp)(c)
}

func (c SetConditionIfeq) PxatMillisecondsTimestamp(millisecondsTimestamp int64) SetExpirationPxatMillisecondsTimestamp {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(millisecondsTimestamp, 10))
	return (SetExpirationPxatMillisecondsTimestamp)(c)
}

func (c SetConditionIfeq) Keepttl() SetExpirationKeepttl {
	c.cs.s = append(c.cs.s, "KEEPTTL")
	return (SetExpirationKeepttl)(c)
}

func (c SetConditionIfeq) Ex(duration time.Duration) SetExpirationExSecTyped {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(int64(duration/time.Second), 10))
	return (SetExpirationExSecTyped)(c)
}

func (c SetConditionIfeq) Px(duration time.Duration) SetExpirationPxMsTyped {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(int64(duration/time.Millisecond), 10))
	return (SetExpirationPxMsTyped)(c)
}

func (c SetConditionIfeq) Exat(timestamp time.Time) SetExpirationExatTimestampTyped {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp.Unix(), 10))
	return (SetExpirationExatTimestampTyped)(c)
}

func (c SetConditionIfeq) Pxat(timestamp time.Time) SetExpirationPxatMsTimestampTyped {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(timestamp.UnixMilli(), 10))
	return (SetExpirationPxatMsTimestampTyped)(c)
}

func (c SetConditionIfeq) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetConditionNx Incomplete

func (c SetConditionNx) Get() SetGet {
	c.cs.s = append(c.cs.s, "GET")
	return (SetGet)(c)
}

func (c SetConditionNx) ExSeconds(seconds int64) SetExpirationExSeconds {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(seconds, 10))
	return (SetExpirationExSeconds)(c)
}

func (c SetConditionNx) PxMilliseconds(milliseconds int64) SetExpirationPxMilliseconds {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(milliseconds, 10))
	return (SetExpirationPxMilliseconds)(c)
}

func (c SetConditionNx) ExatTimestamp(timestamp int64) SetExpirationExatTimestamp {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp, 10))
	return (SetExpirationExatTimestamp)(c)
}

func (c SetConditionNx) PxatMillisecondsTimestamp(millisecondsTimestamp int64) SetExpirationPxatMillisecondsTimestamp {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(millisecondsTimestamp, 10))
	return (SetExpirationPxatMillisecondsTimestamp)(c)
}

func (c SetConditionNx) Keepttl() SetExpirationKeepttl {
	c.cs.s = append(c.cs.s, "KEEPTTL")
	return (SetExpirationKeepttl)(c)
}

func (c SetConditionNx) Ex(duration time.Duration) SetExpirationExSecTyped {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(int64(duration/time.Second), 10))
	return (SetExpirationExSecTyped)(c)
}

func (c SetConditionNx) Px(duration time.Duration) SetExpirationPxMsTyped {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(int64(duration/time.Millisecond), 10))
	return (SetExpirationPxMsTyped)(c)
}

func (c SetConditionNx) Exat(timestamp time.Time) SetExpirationExatTimestampTyped {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp.Unix(), 10))
	return (SetExpirationExatTimestampTyped)(c)
}

func (c SetConditionNx) Pxat(timestamp time.Time) SetExpirationPxatMsTimestampTyped {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(timestamp.UnixMilli(), 10))
	return (SetExpirationPxatMsTimestampTyped)(c)
}

func (c SetConditionNx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetConditionXx Incomplete

func (c SetConditionXx) Get() SetGet {
	c.cs.s = append(c.cs.s, "GET")
	return (SetGet)(c)
}

func (c SetConditionXx) ExSeconds(seconds int64) SetExpirationExSeconds {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(seconds, 10))
	return (SetExpirationExSeconds)(c)
}

func (c SetConditionXx) PxMilliseconds(milliseconds int64) SetExpirationPxMilliseconds {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(milliseconds, 10))
	return (SetExpirationPxMilliseconds)(c)
}

func (c SetConditionXx) ExatTimestamp(timestamp int64) SetExpirationExatTimestamp {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp, 10))
	return (SetExpirationExatTimestamp)(c)
}

func (c SetConditionXx) PxatMillisecondsTimestamp(millisecondsTimestamp int64) SetExpirationPxatMillisecondsTimestamp {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(millisecondsTimestamp, 10))
	return (SetExpirationPxatMillisecondsTimestamp)(c)
}

func (c SetConditionXx) Keepttl() SetExpirationKeepttl {
	c.cs.s = append(c.cs.s, "KEEPTTL")
	return (SetExpirationKeepttl)(c)
}

func (c SetConditionXx) Ex(duration time.Duration) SetExpirationExSecTyped {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(int64(duration/time.Second), 10))
	return (SetExpirationExSecTyped)(c)
}

func (c SetConditionXx) Px(duration time.Duration) SetExpirationPxMsTyped {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(int64(duration/time.Millisecond), 10))
	return (SetExpirationPxMsTyped)(c)
}

func (c SetConditionXx) Exat(timestamp time.Time) SetExpirationExatTimestampTyped {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp.Unix(), 10))
	return (SetExpirationExatTimestampTyped)(c)
}

func (c SetConditionXx) Pxat(timestamp time.Time) SetExpirationPxatMsTimestampTyped {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(timestamp.UnixMilli(), 10))
	return (SetExpirationPxatMsTimestampTyped)(c)
}

func (c SetConditionXx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetExpirationExSecTyped Incomplete

func (c SetExpirationExSecTyped) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetExpirationExSeconds Incomplete

func (c SetExpirationExSeconds) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetExpirationExatTimestamp Incomplete

func (c SetExpirationExatTimestamp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetExpirationExatTimestampTyped Incomplete

func (c SetExpirationExatTimestampTyped) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetExpirationKeepttl Incomplete

func (c SetExpirationKeepttl) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetExpirationPxMilliseconds Incomplete

func (c SetExpirationPxMilliseconds) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetExpirationPxMsTyped Incomplete

func (c SetExpirationPxMsTyped) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetExpirationPxatMillisecondsTimestamp Incomplete

func (c SetExpirationPxatMillisecondsTimestamp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetExpirationPxatMsTimestampTyped Incomplete

func (c SetExpirationPxatMsTimestampTyped) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetGet Incomplete

func (c SetGet) ExSeconds(seconds int64) SetExpirationExSeconds {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(seconds, 10))
	return (SetExpirationExSeconds)(c)
}

func (c SetGet) PxMilliseconds(milliseconds int64) SetExpirationPxMilliseconds {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(milliseconds, 10))
	return (SetExpirationPxMilliseconds)(c)
}

func (c SetGet) ExatTimestamp(timestamp int64) SetExpirationExatTimestamp {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp, 10))
	return (SetExpirationExatTimestamp)(c)
}

func (c SetGet) PxatMillisecondsTimestamp(millisecondsTimestamp int64) SetExpirationPxatMillisecondsTimestamp {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(millisecondsTimestamp, 10))
	return (SetExpirationPxatMillisecondsTimestamp)(c)
}

func (c SetGet) Keepttl() SetExpirationKeepttl {
	c.cs.s = append(c.cs.s, "KEEPTTL")
	return (SetExpirationKeepttl)(c)
}

func (c SetGet) Ex(duration time.Duration) SetExpirationExSecTyped {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(int64(duration/time.Second), 10))
	return (SetExpirationExSecTyped)(c)
}

func (c SetGet) Px(duration time.Duration) SetExpirationPxMsTyped {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(int64(duration/time.Millisecond), 10))
	return (SetExpirationPxMsTyped)(c)
}

func (c SetGet) Exat(timestamp time.Time) SetExpirationExatTimestampTyped {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp.Unix(), 10))
	return (SetExpirationExatTimestampTyped)(c)
}

func (c SetGet) Pxat(timestamp time.Time) SetExpirationPxatMsTimestampTyped {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(timestamp.UnixMilli(), 10))
	return (SetExpirationPxatMsTimestampTyped)(c)
}

func (c SetGet) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SetKey Incomplete

func (c SetKey) Value(value string) SetValue {
	c.cs.s = append(c.cs.s, value)
	return (SetValue)(c)
}

type SetValue Incomplete

func (c SetValue) Nx() SetConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (SetConditionNx)(c)
}

func (c SetValue) Xx() SetConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (SetConditionXx)(c)
}

func (c SetValue) Ifeq(ifeq string) SetConditionIfeq {
	c.cs.s = append(c.cs.s, ifeq)
	return (SetConditionIfeq)(c)
}

func (c SetValue) Get() SetGet {
	c.cs.s = append(c.cs.s, "GET")
	return (SetGet)(c)
}

func (c SetValue) ExSeconds(seconds int64) SetExpirationExSeconds {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(seconds, 10))
	return (SetExpirationExSeconds)(c)
}

func (c SetValue) PxMilliseconds(milliseconds int64) SetExpirationPxMilliseconds {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(milliseconds, 10))
	return (SetExpirationPxMilliseconds)(c)
}

func (c SetValue) ExatTimestamp(timestamp int64) SetExpirationExatTimestamp {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp, 10))
	return (SetExpirationExatTimestamp)(c)
}

func (c SetValue) PxatMillisecondsTimestamp(millisecondsTimestamp int64) SetExpirationPxatMillisecondsTimestamp {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(millisecondsTimestamp, 10))
	return (SetExpirationPxatMillisecondsTimestamp)(c)
}

func (c SetValue) Keepttl() SetExpirationKeepttl {
	c.cs.s = append(c.cs.s, "KEEPTTL")
	return (SetExpirationKeepttl)(c)
}

func (c SetValue) Ex(duration time.Duration) SetExpirationExSecTyped {
	c.cs.s = append(c.cs.s, "EX", strconv.FormatInt(int64(duration/time.Second), 10))
	return (SetExpirationExSecTyped)(c)
}

func (c SetValue) Px(duration time.Duration) SetExpirationPxMsTyped {
	c.cs.s = append(c.cs.s, "PX", strconv.FormatInt(int64(duration/time.Millisecond), 10))
	return (SetExpirationPxMsTyped)(c)
}

func (c SetValue) Exat(timestamp time.Time) SetExpirationExatTimestampTyped {
	c.cs.s = append(c.cs.s, "EXAT", strconv.FormatInt(timestamp.Unix(), 10))
	return (SetExpirationExatTimestampTyped)(c)
}

func (c SetValue) Pxat(timestamp time.Time) SetExpirationPxatMsTimestampTyped {
	c.cs.s = append(c.cs.s, "PXAT", strconv.FormatInt(timestamp.UnixMilli(), 10))
	return (SetExpirationPxatMsTimestampTyped)(c)
}

func (c SetValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Setex Incomplete

func (b Builder) Setex() (c Setex) {
	c = Setex{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SETEX")
	return c
}

func (c Setex) Key(key string) SetexKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SetexKey)(c)
}

type SetexKey Incomplete

func (c SetexKey) Seconds(seconds int64) SetexSeconds {
	c.cs.s = append(c.cs.s, strconv.FormatInt(seconds, 10))
	return (SetexSeconds)(c)
}

type SetexSeconds Incomplete

func (c SetexSeconds) Value(value string) SetexValue {
	c.cs.s = append(c.cs.s, value)
	return (SetexValue)(c)
}

type SetexValue Incomplete

func (c SetexValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Setnx Incomplete

func (b Builder) Setnx() (c Setnx) {
	c = Setnx{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SETNX")
	return c
}

func (c Setnx) Key(key string) SetnxKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SetnxKey)(c)
}

type SetnxKey Incomplete

func (c SetnxKey) Value(value string) SetnxValue {
	c.cs.s = append(c.cs.s, value)
	return (SetnxValue)(c)
}

type SetnxValue Incomplete

func (c SetnxValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Setrange Incomplete

func (b Builder) Setrange() (c Setrange) {
	c = Setrange{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SETRANGE")
	return c
}

func (c Setrange) Key(key string) SetrangeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SetrangeKey)(c)
}

type SetrangeKey Incomplete

func (c SetrangeKey) Offset(offset int64) SetrangeOffset {
	c.cs.s = append(c.cs.s, strconv.FormatInt(offset, 10))
	return (SetrangeOffset)(c)
}

type SetrangeOffset Incomplete

func (c SetrangeOffset) Value(value string) SetrangeValue {
	c.cs.s = append(c.cs.s, value)
	return (SetrangeValue)(c)
}

type SetrangeValue Incomplete

func (c SetrangeValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Strlen Incomplete

func (b Builder) Strlen() (c Strlen) {
	c = Strlen{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "STRLEN")
	return c
}

func (c Strlen) Key(key string) StrlenKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (StrlenKey)(c)
}

type StrlenKey Incomplete

func (c StrlenKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c StrlenKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
