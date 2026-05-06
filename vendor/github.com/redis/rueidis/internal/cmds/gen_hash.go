// Code generated DO NOT EDIT

package cmds

import "strconv"

type Hdel Incomplete

func (b Builder) Hdel() (c Hdel) {
	c = Hdel{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HDEL")
	return c
}

func (c Hdel) Key(key string) HdelKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HdelKey)(c)
}

type HdelField Incomplete

func (c HdelField) Field(field ...string) HdelField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HdelField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HdelKey Incomplete

func (c HdelKey) Field(field ...string) HdelField {
	c.cs.s = append(c.cs.s, field...)
	return (HdelField)(c)
}

type Hexists Incomplete

func (b Builder) Hexists() (c Hexists) {
	c = Hexists{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "HEXISTS")
	return c
}

func (c Hexists) Key(key string) HexistsKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HexistsKey)(c)
}

type HexistsField Incomplete

func (c HexistsField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c HexistsField) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HexistsKey Incomplete

func (c HexistsKey) Field(field string) HexistsField {
	c.cs.s = append(c.cs.s, field)
	return (HexistsField)(c)
}

type Hexpire Incomplete

func (b Builder) Hexpire() (c Hexpire) {
	c = Hexpire{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HEXPIRE")
	return c
}

func (c Hexpire) Key(key string) HexpireKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HexpireKey)(c)
}

type HexpireConditionGt Incomplete

func (c HexpireConditionGt) Fields() HexpireFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpireFields)(c)
}

type HexpireConditionLt Incomplete

func (c HexpireConditionLt) Fields() HexpireFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpireFields)(c)
}

type HexpireConditionNx Incomplete

func (c HexpireConditionNx) Fields() HexpireFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpireFields)(c)
}

type HexpireConditionXx Incomplete

func (c HexpireConditionXx) Fields() HexpireFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpireFields)(c)
}

type HexpireField Incomplete

func (c HexpireField) Field(field ...string) HexpireField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HexpireField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HexpireFields Incomplete

func (c HexpireFields) Numfields(numfields int64) HexpireNumfields {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numfields, 10))
	return (HexpireNumfields)(c)
}

type HexpireKey Incomplete

func (c HexpireKey) Seconds(seconds int64) HexpireSeconds {
	c.cs.s = append(c.cs.s, strconv.FormatInt(seconds, 10))
	return (HexpireSeconds)(c)
}

type HexpireNumfields Incomplete

func (c HexpireNumfields) Field(field ...string) HexpireField {
	c.cs.s = append(c.cs.s, field...)
	return (HexpireField)(c)
}

type HexpireSeconds Incomplete

func (c HexpireSeconds) Nx() HexpireConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (HexpireConditionNx)(c)
}

func (c HexpireSeconds) Xx() HexpireConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (HexpireConditionXx)(c)
}

func (c HexpireSeconds) Gt() HexpireConditionGt {
	c.cs.s = append(c.cs.s, "GT")
	return (HexpireConditionGt)(c)
}

func (c HexpireSeconds) Lt() HexpireConditionLt {
	c.cs.s = append(c.cs.s, "LT")
	return (HexpireConditionLt)(c)
}

func (c HexpireSeconds) Fields() HexpireFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpireFields)(c)
}

type Hexpireat Incomplete

func (b Builder) Hexpireat() (c Hexpireat) {
	c = Hexpireat{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HEXPIREAT")
	return c
}

func (c Hexpireat) Key(key string) HexpireatKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HexpireatKey)(c)
}

type HexpireatConditionGt Incomplete

func (c HexpireatConditionGt) Fields() HexpireatFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpireatFields)(c)
}

type HexpireatConditionLt Incomplete

func (c HexpireatConditionLt) Fields() HexpireatFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpireatFields)(c)
}

type HexpireatConditionNx Incomplete

func (c HexpireatConditionNx) Fields() HexpireatFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpireatFields)(c)
}

type HexpireatConditionXx Incomplete

func (c HexpireatConditionXx) Fields() HexpireatFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpireatFields)(c)
}

type HexpireatField Incomplete

func (c HexpireatField) Field(field ...string) HexpireatField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HexpireatField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HexpireatFields Incomplete

func (c HexpireatFields) Numfields(numfields int64) HexpireatNumfields {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numfields, 10))
	return (HexpireatNumfields)(c)
}

type HexpireatKey Incomplete

func (c HexpireatKey) UnixTimeSeconds(unixTimeSeconds int64) HexpireatUnixTimeSeconds {
	c.cs.s = append(c.cs.s, strconv.FormatInt(unixTimeSeconds, 10))
	return (HexpireatUnixTimeSeconds)(c)
}

type HexpireatNumfields Incomplete

func (c HexpireatNumfields) Field(field ...string) HexpireatField {
	c.cs.s = append(c.cs.s, field...)
	return (HexpireatField)(c)
}

type HexpireatUnixTimeSeconds Incomplete

func (c HexpireatUnixTimeSeconds) Nx() HexpireatConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (HexpireatConditionNx)(c)
}

func (c HexpireatUnixTimeSeconds) Xx() HexpireatConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (HexpireatConditionXx)(c)
}

func (c HexpireatUnixTimeSeconds) Gt() HexpireatConditionGt {
	c.cs.s = append(c.cs.s, "GT")
	return (HexpireatConditionGt)(c)
}

func (c HexpireatUnixTimeSeconds) Lt() HexpireatConditionLt {
	c.cs.s = append(c.cs.s, "LT")
	return (HexpireatConditionLt)(c)
}

func (c HexpireatUnixTimeSeconds) Fields() HexpireatFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpireatFields)(c)
}

type Hexpiretime Incomplete

func (b Builder) Hexpiretime() (c Hexpiretime) {
	c = Hexpiretime{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HEXPIRETIME")
	return c
}

func (c Hexpiretime) Key(key string) HexpiretimeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HexpiretimeKey)(c)
}

type HexpiretimeField Incomplete

func (c HexpiretimeField) Field(field ...string) HexpiretimeField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HexpiretimeField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HexpiretimeFields Incomplete

func (c HexpiretimeFields) Numfields(numfields int64) HexpiretimeNumfields {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numfields, 10))
	return (HexpiretimeNumfields)(c)
}

type HexpiretimeKey Incomplete

func (c HexpiretimeKey) Fields() HexpiretimeFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HexpiretimeFields)(c)
}

type HexpiretimeNumfields Incomplete

func (c HexpiretimeNumfields) Field(field ...string) HexpiretimeField {
	c.cs.s = append(c.cs.s, field...)
	return (HexpiretimeField)(c)
}

type Hget Incomplete

func (b Builder) Hget() (c Hget) {
	c = Hget{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "HGET")
	return c
}

func (c Hget) Key(key string) HgetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HgetKey)(c)
}

type HgetField Incomplete

func (c HgetField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c HgetField) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HgetKey Incomplete

func (c HgetKey) Field(field string) HgetField {
	c.cs.s = append(c.cs.s, field)
	return (HgetField)(c)
}

type Hgetall Incomplete

func (b Builder) Hgetall() (c Hgetall) {
	c = Hgetall{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "HGETALL")
	return c
}

func (c Hgetall) Key(key string) HgetallKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HgetallKey)(c)
}

type HgetallKey Incomplete

func (c HgetallKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c HgetallKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Hincrby Incomplete

func (b Builder) Hincrby() (c Hincrby) {
	c = Hincrby{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HINCRBY")
	return c
}

func (c Hincrby) Key(key string) HincrbyKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HincrbyKey)(c)
}

type HincrbyField Incomplete

func (c HincrbyField) Increment(increment int64) HincrbyIncrement {
	c.cs.s = append(c.cs.s, strconv.FormatInt(increment, 10))
	return (HincrbyIncrement)(c)
}

type HincrbyIncrement Incomplete

func (c HincrbyIncrement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HincrbyKey Incomplete

func (c HincrbyKey) Field(field string) HincrbyField {
	c.cs.s = append(c.cs.s, field)
	return (HincrbyField)(c)
}

type Hincrbyfloat Incomplete

func (b Builder) Hincrbyfloat() (c Hincrbyfloat) {
	c = Hincrbyfloat{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HINCRBYFLOAT")
	return c
}

func (c Hincrbyfloat) Key(key string) HincrbyfloatKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HincrbyfloatKey)(c)
}

type HincrbyfloatField Incomplete

func (c HincrbyfloatField) Increment(increment float64) HincrbyfloatIncrement {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(increment, 'f', -1, 64))
	return (HincrbyfloatIncrement)(c)
}

type HincrbyfloatIncrement Incomplete

func (c HincrbyfloatIncrement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HincrbyfloatKey Incomplete

func (c HincrbyfloatKey) Field(field string) HincrbyfloatField {
	c.cs.s = append(c.cs.s, field)
	return (HincrbyfloatField)(c)
}

type Hkeys Incomplete

func (b Builder) Hkeys() (c Hkeys) {
	c = Hkeys{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "HKEYS")
	return c
}

func (c Hkeys) Key(key string) HkeysKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HkeysKey)(c)
}

type HkeysKey Incomplete

func (c HkeysKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c HkeysKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Hlen Incomplete

func (b Builder) Hlen() (c Hlen) {
	c = Hlen{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "HLEN")
	return c
}

func (c Hlen) Key(key string) HlenKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HlenKey)(c)
}

type HlenKey Incomplete

func (c HlenKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c HlenKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Hmget Incomplete

func (b Builder) Hmget() (c Hmget) {
	c = Hmget{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "HMGET")
	return c
}

func (c Hmget) Key(key string) HmgetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HmgetKey)(c)
}

type HmgetField Incomplete

func (c HmgetField) Field(field ...string) HmgetField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HmgetField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c HmgetField) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HmgetKey Incomplete

func (c HmgetKey) Field(field ...string) HmgetField {
	c.cs.s = append(c.cs.s, field...)
	return (HmgetField)(c)
}

type Hmset Incomplete

func (b Builder) Hmset() (c Hmset) {
	c = Hmset{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HMSET")
	return c
}

func (c Hmset) Key(key string) HmsetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HmsetKey)(c)
}

type HmsetFieldValue Incomplete

func (c HmsetFieldValue) FieldValue(field string, value string) HmsetFieldValue {
	c.cs.s = append(c.cs.s, field, value)
	return c
}

func (c HmsetFieldValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HmsetKey Incomplete

func (c HmsetKey) FieldValue() HmsetFieldValue {
	return (HmsetFieldValue)(c)
}

type Hpersist Incomplete

func (b Builder) Hpersist() (c Hpersist) {
	c = Hpersist{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HPERSIST")
	return c
}

func (c Hpersist) Key(key string) HpersistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HpersistKey)(c)
}

type HpersistField Incomplete

func (c HpersistField) Field(field ...string) HpersistField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HpersistField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HpersistFields Incomplete

func (c HpersistFields) Numfields(numfields int64) HpersistNumfields {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numfields, 10))
	return (HpersistNumfields)(c)
}

type HpersistKey Incomplete

func (c HpersistKey) Fields() HpersistFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpersistFields)(c)
}

type HpersistNumfields Incomplete

func (c HpersistNumfields) Field(field ...string) HpersistField {
	c.cs.s = append(c.cs.s, field...)
	return (HpersistField)(c)
}

type Hpexpire Incomplete

func (b Builder) Hpexpire() (c Hpexpire) {
	c = Hpexpire{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HPEXPIRE")
	return c
}

func (c Hpexpire) Key(key string) HpexpireKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HpexpireKey)(c)
}

type HpexpireConditionGt Incomplete

func (c HpexpireConditionGt) Fields() HpexpireFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpireFields)(c)
}

type HpexpireConditionLt Incomplete

func (c HpexpireConditionLt) Fields() HpexpireFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpireFields)(c)
}

type HpexpireConditionNx Incomplete

func (c HpexpireConditionNx) Fields() HpexpireFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpireFields)(c)
}

type HpexpireConditionXx Incomplete

func (c HpexpireConditionXx) Fields() HpexpireFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpireFields)(c)
}

type HpexpireField Incomplete

func (c HpexpireField) Field(field ...string) HpexpireField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HpexpireField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HpexpireFields Incomplete

func (c HpexpireFields) Numfields(numfields int64) HpexpireNumfields {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numfields, 10))
	return (HpexpireNumfields)(c)
}

type HpexpireKey Incomplete

func (c HpexpireKey) Milliseconds(milliseconds int64) HpexpireMilliseconds {
	c.cs.s = append(c.cs.s, strconv.FormatInt(milliseconds, 10))
	return (HpexpireMilliseconds)(c)
}

type HpexpireMilliseconds Incomplete

func (c HpexpireMilliseconds) Nx() HpexpireConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (HpexpireConditionNx)(c)
}

func (c HpexpireMilliseconds) Xx() HpexpireConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (HpexpireConditionXx)(c)
}

func (c HpexpireMilliseconds) Gt() HpexpireConditionGt {
	c.cs.s = append(c.cs.s, "GT")
	return (HpexpireConditionGt)(c)
}

func (c HpexpireMilliseconds) Lt() HpexpireConditionLt {
	c.cs.s = append(c.cs.s, "LT")
	return (HpexpireConditionLt)(c)
}

func (c HpexpireMilliseconds) Fields() HpexpireFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpireFields)(c)
}

type HpexpireNumfields Incomplete

func (c HpexpireNumfields) Field(field ...string) HpexpireField {
	c.cs.s = append(c.cs.s, field...)
	return (HpexpireField)(c)
}

type Hpexpireat Incomplete

func (b Builder) Hpexpireat() (c Hpexpireat) {
	c = Hpexpireat{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HPEXPIREAT")
	return c
}

func (c Hpexpireat) Key(key string) HpexpireatKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HpexpireatKey)(c)
}

type HpexpireatConditionGt Incomplete

func (c HpexpireatConditionGt) Fields() HpexpireatFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpireatFields)(c)
}

type HpexpireatConditionLt Incomplete

func (c HpexpireatConditionLt) Fields() HpexpireatFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpireatFields)(c)
}

type HpexpireatConditionNx Incomplete

func (c HpexpireatConditionNx) Fields() HpexpireatFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpireatFields)(c)
}

type HpexpireatConditionXx Incomplete

func (c HpexpireatConditionXx) Fields() HpexpireatFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpireatFields)(c)
}

type HpexpireatField Incomplete

func (c HpexpireatField) Field(field ...string) HpexpireatField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HpexpireatField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HpexpireatFields Incomplete

func (c HpexpireatFields) Numfields(numfields int64) HpexpireatNumfields {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numfields, 10))
	return (HpexpireatNumfields)(c)
}

type HpexpireatKey Incomplete

func (c HpexpireatKey) UnixTimeMilliseconds(unixTimeMilliseconds int64) HpexpireatUnixTimeMilliseconds {
	c.cs.s = append(c.cs.s, strconv.FormatInt(unixTimeMilliseconds, 10))
	return (HpexpireatUnixTimeMilliseconds)(c)
}

type HpexpireatNumfields Incomplete

func (c HpexpireatNumfields) Field(field ...string) HpexpireatField {
	c.cs.s = append(c.cs.s, field...)
	return (HpexpireatField)(c)
}

type HpexpireatUnixTimeMilliseconds Incomplete

func (c HpexpireatUnixTimeMilliseconds) Nx() HpexpireatConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (HpexpireatConditionNx)(c)
}

func (c HpexpireatUnixTimeMilliseconds) Xx() HpexpireatConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (HpexpireatConditionXx)(c)
}

func (c HpexpireatUnixTimeMilliseconds) Gt() HpexpireatConditionGt {
	c.cs.s = append(c.cs.s, "GT")
	return (HpexpireatConditionGt)(c)
}

func (c HpexpireatUnixTimeMilliseconds) Lt() HpexpireatConditionLt {
	c.cs.s = append(c.cs.s, "LT")
	return (HpexpireatConditionLt)(c)
}

func (c HpexpireatUnixTimeMilliseconds) Fields() HpexpireatFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpireatFields)(c)
}

type Hpexpiretime Incomplete

func (b Builder) Hpexpiretime() (c Hpexpiretime) {
	c = Hpexpiretime{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HPEXPIRETIME")
	return c
}

func (c Hpexpiretime) Key(key string) HpexpiretimeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HpexpiretimeKey)(c)
}

type HpexpiretimeField Incomplete

func (c HpexpiretimeField) Field(field ...string) HpexpiretimeField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HpexpiretimeField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HpexpiretimeFields Incomplete

func (c HpexpiretimeFields) Numfields(numfields int64) HpexpiretimeNumfields {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numfields, 10))
	return (HpexpiretimeNumfields)(c)
}

type HpexpiretimeKey Incomplete

func (c HpexpiretimeKey) Fields() HpexpiretimeFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpexpiretimeFields)(c)
}

type HpexpiretimeNumfields Incomplete

func (c HpexpiretimeNumfields) Field(field ...string) HpexpiretimeField {
	c.cs.s = append(c.cs.s, field...)
	return (HpexpiretimeField)(c)
}

type Hpttl Incomplete

func (b Builder) Hpttl() (c Hpttl) {
	c = Hpttl{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HPTTL")
	return c
}

func (c Hpttl) Key(key string) HpttlKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HpttlKey)(c)
}

type HpttlField Incomplete

func (c HpttlField) Field(field ...string) HpttlField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HpttlField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HpttlFields Incomplete

func (c HpttlFields) Numfields(numfields int64) HpttlNumfields {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numfields, 10))
	return (HpttlNumfields)(c)
}

type HpttlKey Incomplete

func (c HpttlKey) Fields() HpttlFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HpttlFields)(c)
}

type HpttlNumfields Incomplete

func (c HpttlNumfields) Field(field ...string) HpttlField {
	c.cs.s = append(c.cs.s, field...)
	return (HpttlField)(c)
}

type Hrandfield Incomplete

func (b Builder) Hrandfield() (c Hrandfield) {
	c = Hrandfield{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "HRANDFIELD")
	return c
}

func (c Hrandfield) Key(key string) HrandfieldKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HrandfieldKey)(c)
}

type HrandfieldKey Incomplete

func (c HrandfieldKey) Count(count int64) HrandfieldOptionsCount {
	c.cs.s = append(c.cs.s, strconv.FormatInt(count, 10))
	return (HrandfieldOptionsCount)(c)
}

func (c HrandfieldKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HrandfieldOptionsCount Incomplete

func (c HrandfieldOptionsCount) Withvalues() HrandfieldOptionsWithvalues {
	c.cs.s = append(c.cs.s, "WITHVALUES")
	return (HrandfieldOptionsWithvalues)(c)
}

func (c HrandfieldOptionsCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HrandfieldOptionsWithvalues Incomplete

func (c HrandfieldOptionsWithvalues) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Hscan Incomplete

func (b Builder) Hscan() (c Hscan) {
	c = Hscan{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "HSCAN")
	return c
}

func (c Hscan) Key(key string) HscanKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HscanKey)(c)
}

type HscanCount Incomplete

func (c HscanCount) Novalues() HscanNovalues {
	c.cs.s = append(c.cs.s, "NOVALUES")
	return (HscanNovalues)(c)
}

func (c HscanCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HscanCursor Incomplete

func (c HscanCursor) Match(pattern string) HscanMatch {
	c.cs.s = append(c.cs.s, "MATCH", pattern)
	return (HscanMatch)(c)
}

func (c HscanCursor) Count(count int64) HscanCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (HscanCount)(c)
}

func (c HscanCursor) Novalues() HscanNovalues {
	c.cs.s = append(c.cs.s, "NOVALUES")
	return (HscanNovalues)(c)
}

func (c HscanCursor) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HscanKey Incomplete

func (c HscanKey) Cursor(cursor uint64) HscanCursor {
	c.cs.s = append(c.cs.s, strconv.FormatUint(cursor, 10))
	return (HscanCursor)(c)
}

type HscanMatch Incomplete

func (c HscanMatch) Count(count int64) HscanCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (HscanCount)(c)
}

func (c HscanMatch) Novalues() HscanNovalues {
	c.cs.s = append(c.cs.s, "NOVALUES")
	return (HscanNovalues)(c)
}

func (c HscanMatch) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HscanNovalues Incomplete

func (c HscanNovalues) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Hset Incomplete

func (b Builder) Hset() (c Hset) {
	c = Hset{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HSET")
	return c
}

func (c Hset) Key(key string) HsetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HsetKey)(c)
}

type HsetFieldValue Incomplete

func (c HsetFieldValue) FieldValue(field string, value string) HsetFieldValue {
	c.cs.s = append(c.cs.s, field, value)
	return c
}

func (c HsetFieldValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HsetKey Incomplete

func (c HsetKey) FieldValue() HsetFieldValue {
	return (HsetFieldValue)(c)
}

type Hsetnx Incomplete

func (b Builder) Hsetnx() (c Hsetnx) {
	c = Hsetnx{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HSETNX")
	return c
}

func (c Hsetnx) Key(key string) HsetnxKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HsetnxKey)(c)
}

type HsetnxField Incomplete

func (c HsetnxField) Value(value string) HsetnxValue {
	c.cs.s = append(c.cs.s, value)
	return (HsetnxValue)(c)
}

type HsetnxKey Incomplete

func (c HsetnxKey) Field(field string) HsetnxField {
	c.cs.s = append(c.cs.s, field)
	return (HsetnxField)(c)
}

type HsetnxValue Incomplete

func (c HsetnxValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Hstrlen Incomplete

func (b Builder) Hstrlen() (c Hstrlen) {
	c = Hstrlen{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "HSTRLEN")
	return c
}

func (c Hstrlen) Key(key string) HstrlenKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HstrlenKey)(c)
}

type HstrlenField Incomplete

func (c HstrlenField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c HstrlenField) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HstrlenKey Incomplete

func (c HstrlenKey) Field(field string) HstrlenField {
	c.cs.s = append(c.cs.s, field)
	return (HstrlenField)(c)
}

type Httl Incomplete

func (b Builder) Httl() (c Httl) {
	c = Httl{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HTTL")
	return c
}

func (c Httl) Key(key string) HttlKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HttlKey)(c)
}

type HttlField Incomplete

func (c HttlField) Field(field ...string) HttlField {
	c.cs.s = append(c.cs.s, field...)
	return c
}

func (c HttlField) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HttlFields Incomplete

func (c HttlFields) Numfields(numfields int64) HttlNumfields {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numfields, 10))
	return (HttlNumfields)(c)
}

type HttlKey Incomplete

func (c HttlKey) Fields() HttlFields {
	c.cs.s = append(c.cs.s, "FIELDS")
	return (HttlFields)(c)
}

type HttlNumfields Incomplete

func (c HttlNumfields) Field(field ...string) HttlField {
	c.cs.s = append(c.cs.s, field...)
	return (HttlField)(c)
}

type Hvals Incomplete

func (b Builder) Hvals() (c Hvals) {
	c = Hvals{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "HVALS")
	return c
}

func (c Hvals) Key(key string) HvalsKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (HvalsKey)(c)
}

type HvalsKey Incomplete

func (c HvalsKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c HvalsKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
