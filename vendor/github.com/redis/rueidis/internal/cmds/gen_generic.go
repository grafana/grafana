// Code generated DO NOT EDIT

package cmds

import "strconv"

type Copy Incomplete

func (b Builder) Copy() (c Copy) {
	c = Copy{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "COPY")
	return c
}

func (c Copy) Source(source string) CopySource {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(source)
	} else {
		c.ks = check(c.ks, slot(source))
	}
	c.cs.s = append(c.cs.s, source)
	return (CopySource)(c)
}

type CopyDb Incomplete

func (c CopyDb) Replace() CopyReplace {
	c.cs.s = append(c.cs.s, "REPLACE")
	return (CopyReplace)(c)
}

func (c CopyDb) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CopyDestination Incomplete

func (c CopyDestination) Db(destinationDb int64) CopyDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(destinationDb, 10))
	return (CopyDb)(c)
}

func (c CopyDestination) Replace() CopyReplace {
	c.cs.s = append(c.cs.s, "REPLACE")
	return (CopyReplace)(c)
}

func (c CopyDestination) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CopyReplace Incomplete

func (c CopyReplace) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CopySource Incomplete

func (c CopySource) Destination(destination string) CopyDestination {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, destination)
	return (CopyDestination)(c)
}

type Del Incomplete

func (b Builder) Del() (c Del) {
	c = Del{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "DEL")
	return c
}

func (c Del) Key(key ...string) DelKey {
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
	return (DelKey)(c)
}

type DelKey Incomplete

func (c DelKey) Key(key ...string) DelKey {
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

func (c DelKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Dump Incomplete

func (b Builder) Dump() (c Dump) {
	c = Dump{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "DUMP")
	return c
}

func (c Dump) Key(key string) DumpKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (DumpKey)(c)
}

type DumpKey Incomplete

func (c DumpKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Exists Incomplete

func (b Builder) Exists() (c Exists) {
	c = Exists{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "EXISTS")
	return c
}

func (c Exists) Key(key ...string) ExistsKey {
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
	return (ExistsKey)(c)
}

type ExistsKey Incomplete

func (c ExistsKey) Key(key ...string) ExistsKey {
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

func (c ExistsKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Expire Incomplete

func (b Builder) Expire() (c Expire) {
	c = Expire{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "EXPIRE")
	return c
}

func (c Expire) Key(key string) ExpireKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (ExpireKey)(c)
}

type ExpireConditionGt Incomplete

func (c ExpireConditionGt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ExpireConditionLt Incomplete

func (c ExpireConditionLt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ExpireConditionNx Incomplete

func (c ExpireConditionNx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ExpireConditionXx Incomplete

func (c ExpireConditionXx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ExpireKey Incomplete

func (c ExpireKey) Seconds(seconds int64) ExpireSeconds {
	c.cs.s = append(c.cs.s, strconv.FormatInt(seconds, 10))
	return (ExpireSeconds)(c)
}

type ExpireSeconds Incomplete

func (c ExpireSeconds) Nx() ExpireConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (ExpireConditionNx)(c)
}

func (c ExpireSeconds) Xx() ExpireConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (ExpireConditionXx)(c)
}

func (c ExpireSeconds) Gt() ExpireConditionGt {
	c.cs.s = append(c.cs.s, "GT")
	return (ExpireConditionGt)(c)
}

func (c ExpireSeconds) Lt() ExpireConditionLt {
	c.cs.s = append(c.cs.s, "LT")
	return (ExpireConditionLt)(c)
}

func (c ExpireSeconds) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Expireat Incomplete

func (b Builder) Expireat() (c Expireat) {
	c = Expireat{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "EXPIREAT")
	return c
}

func (c Expireat) Key(key string) ExpireatKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (ExpireatKey)(c)
}

type ExpireatConditionGt Incomplete

func (c ExpireatConditionGt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ExpireatConditionLt Incomplete

func (c ExpireatConditionLt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ExpireatConditionNx Incomplete

func (c ExpireatConditionNx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ExpireatConditionXx Incomplete

func (c ExpireatConditionXx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ExpireatKey Incomplete

func (c ExpireatKey) Timestamp(timestamp int64) ExpireatTimestamp {
	c.cs.s = append(c.cs.s, strconv.FormatInt(timestamp, 10))
	return (ExpireatTimestamp)(c)
}

type ExpireatTimestamp Incomplete

func (c ExpireatTimestamp) Nx() ExpireatConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (ExpireatConditionNx)(c)
}

func (c ExpireatTimestamp) Xx() ExpireatConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (ExpireatConditionXx)(c)
}

func (c ExpireatTimestamp) Gt() ExpireatConditionGt {
	c.cs.s = append(c.cs.s, "GT")
	return (ExpireatConditionGt)(c)
}

func (c ExpireatTimestamp) Lt() ExpireatConditionLt {
	c.cs.s = append(c.cs.s, "LT")
	return (ExpireatConditionLt)(c)
}

func (c ExpireatTimestamp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Expiretime Incomplete

func (b Builder) Expiretime() (c Expiretime) {
	c = Expiretime{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "EXPIRETIME")
	return c
}

func (c Expiretime) Key(key string) ExpiretimeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (ExpiretimeKey)(c)
}

type ExpiretimeKey Incomplete

func (c ExpiretimeKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c ExpiretimeKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Keys Incomplete

func (b Builder) Keys() (c Keys) {
	c = Keys{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "KEYS")
	return c
}

func (c Keys) Pattern(pattern string) KeysPattern {
	c.cs.s = append(c.cs.s, pattern)
	return (KeysPattern)(c)
}

type KeysPattern Incomplete

func (c KeysPattern) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Migrate Incomplete

func (b Builder) Migrate() (c Migrate) {
	c = Migrate{cs: get(), ks: b.ks, cf: int16(blockTag)}
	c.cs.s = append(c.cs.s, "MIGRATE")
	return c
}

func (c Migrate) Host(host string) MigrateHost {
	c.cs.s = append(c.cs.s, host)
	return (MigrateHost)(c)
}

type MigrateAuthAuth Incomplete

func (c MigrateAuthAuth) Auth2(username string, password string) MigrateAuthAuth2 {
	c.cs.s = append(c.cs.s, "AUTH2", username, password)
	return (MigrateAuthAuth2)(c)
}

func (c MigrateAuthAuth) Keys(key ...string) MigrateKeys {
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
	c.cs.s = append(c.cs.s, "KEYS")
	c.cs.s = append(c.cs.s, key...)
	return (MigrateKeys)(c)
}

func (c MigrateAuthAuth) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type MigrateAuthAuth2 Incomplete

func (c MigrateAuthAuth2) Keys(key ...string) MigrateKeys {
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
	c.cs.s = append(c.cs.s, "KEYS")
	c.cs.s = append(c.cs.s, key...)
	return (MigrateKeys)(c)
}

func (c MigrateAuthAuth2) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type MigrateCopy Incomplete

func (c MigrateCopy) Replace() MigrateReplace {
	c.cs.s = append(c.cs.s, "REPLACE")
	return (MigrateReplace)(c)
}

func (c MigrateCopy) Auth(password string) MigrateAuthAuth {
	c.cs.s = append(c.cs.s, "AUTH", password)
	return (MigrateAuthAuth)(c)
}

func (c MigrateCopy) Auth2(username string, password string) MigrateAuthAuth2 {
	c.cs.s = append(c.cs.s, "AUTH2", username, password)
	return (MigrateAuthAuth2)(c)
}

func (c MigrateCopy) Keys(key ...string) MigrateKeys {
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
	c.cs.s = append(c.cs.s, "KEYS")
	c.cs.s = append(c.cs.s, key...)
	return (MigrateKeys)(c)
}

func (c MigrateCopy) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type MigrateDestinationDb Incomplete

func (c MigrateDestinationDb) Timeout(timeout int64) MigrateTimeout {
	c.cs.s = append(c.cs.s, strconv.FormatInt(timeout, 10))
	return (MigrateTimeout)(c)
}

type MigrateHost Incomplete

func (c MigrateHost) Port(port int64) MigratePort {
	c.cs.s = append(c.cs.s, strconv.FormatInt(port, 10))
	return (MigratePort)(c)
}

type MigrateKey Incomplete

func (c MigrateKey) DestinationDb(destinationDb int64) MigrateDestinationDb {
	c.cs.s = append(c.cs.s, strconv.FormatInt(destinationDb, 10))
	return (MigrateDestinationDb)(c)
}

type MigrateKeys Incomplete

func (c MigrateKeys) Keys(key ...string) MigrateKeys {
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
	c.cs.s = append(c.cs.s, "KEYS")
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c MigrateKeys) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type MigratePort Incomplete

func (c MigratePort) Key(key string) MigrateKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (MigrateKey)(c)
}

type MigrateReplace Incomplete

func (c MigrateReplace) Auth(password string) MigrateAuthAuth {
	c.cs.s = append(c.cs.s, "AUTH", password)
	return (MigrateAuthAuth)(c)
}

func (c MigrateReplace) Auth2(username string, password string) MigrateAuthAuth2 {
	c.cs.s = append(c.cs.s, "AUTH2", username, password)
	return (MigrateAuthAuth2)(c)
}

func (c MigrateReplace) Keys(key ...string) MigrateKeys {
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
	c.cs.s = append(c.cs.s, "KEYS")
	c.cs.s = append(c.cs.s, key...)
	return (MigrateKeys)(c)
}

func (c MigrateReplace) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type MigrateTimeout Incomplete

func (c MigrateTimeout) Copy() MigrateCopy {
	c.cs.s = append(c.cs.s, "COPY")
	return (MigrateCopy)(c)
}

func (c MigrateTimeout) Replace() MigrateReplace {
	c.cs.s = append(c.cs.s, "REPLACE")
	return (MigrateReplace)(c)
}

func (c MigrateTimeout) Auth(password string) MigrateAuthAuth {
	c.cs.s = append(c.cs.s, "AUTH", password)
	return (MigrateAuthAuth)(c)
}

func (c MigrateTimeout) Auth2(username string, password string) MigrateAuthAuth2 {
	c.cs.s = append(c.cs.s, "AUTH2", username, password)
	return (MigrateAuthAuth2)(c)
}

func (c MigrateTimeout) Keys(key ...string) MigrateKeys {
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
	c.cs.s = append(c.cs.s, "KEYS")
	c.cs.s = append(c.cs.s, key...)
	return (MigrateKeys)(c)
}

func (c MigrateTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Move Incomplete

func (b Builder) Move() (c Move) {
	c = Move{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "MOVE")
	return c
}

func (c Move) Key(key string) MoveKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (MoveKey)(c)
}

type MoveDb Incomplete

func (c MoveDb) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type MoveKey Incomplete

func (c MoveKey) Db(db int64) MoveDb {
	c.cs.s = append(c.cs.s, strconv.FormatInt(db, 10))
	return (MoveDb)(c)
}

type ObjectEncoding Incomplete

func (b Builder) ObjectEncoding() (c ObjectEncoding) {
	c = ObjectEncoding{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "OBJECT", "ENCODING")
	return c
}

func (c ObjectEncoding) Key(key string) ObjectEncodingKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (ObjectEncodingKey)(c)
}

type ObjectEncodingKey Incomplete

func (c ObjectEncodingKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ObjectFreq Incomplete

func (b Builder) ObjectFreq() (c ObjectFreq) {
	c = ObjectFreq{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "OBJECT", "FREQ")
	return c
}

func (c ObjectFreq) Key(key string) ObjectFreqKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (ObjectFreqKey)(c)
}

type ObjectFreqKey Incomplete

func (c ObjectFreqKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ObjectHelp Incomplete

func (b Builder) ObjectHelp() (c ObjectHelp) {
	c = ObjectHelp{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "OBJECT", "HELP")
	return c
}

func (c ObjectHelp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ObjectIdletime Incomplete

func (b Builder) ObjectIdletime() (c ObjectIdletime) {
	c = ObjectIdletime{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "OBJECT", "IDLETIME")
	return c
}

func (c ObjectIdletime) Key(key string) ObjectIdletimeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (ObjectIdletimeKey)(c)
}

type ObjectIdletimeKey Incomplete

func (c ObjectIdletimeKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ObjectRefcount Incomplete

func (b Builder) ObjectRefcount() (c ObjectRefcount) {
	c = ObjectRefcount{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "OBJECT", "REFCOUNT")
	return c
}

func (c ObjectRefcount) Key(key string) ObjectRefcountKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (ObjectRefcountKey)(c)
}

type ObjectRefcountKey Incomplete

func (c ObjectRefcountKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Persist Incomplete

func (b Builder) Persist() (c Persist) {
	c = Persist{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "PERSIST")
	return c
}

func (c Persist) Key(key string) PersistKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (PersistKey)(c)
}

type PersistKey Incomplete

func (c PersistKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Pexpire Incomplete

func (b Builder) Pexpire() (c Pexpire) {
	c = Pexpire{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "PEXPIRE")
	return c
}

func (c Pexpire) Key(key string) PexpireKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (PexpireKey)(c)
}

type PexpireConditionGt Incomplete

func (c PexpireConditionGt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PexpireConditionLt Incomplete

func (c PexpireConditionLt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PexpireConditionNx Incomplete

func (c PexpireConditionNx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PexpireConditionXx Incomplete

func (c PexpireConditionXx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PexpireKey Incomplete

func (c PexpireKey) Milliseconds(milliseconds int64) PexpireMilliseconds {
	c.cs.s = append(c.cs.s, strconv.FormatInt(milliseconds, 10))
	return (PexpireMilliseconds)(c)
}

type PexpireMilliseconds Incomplete

func (c PexpireMilliseconds) Nx() PexpireConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (PexpireConditionNx)(c)
}

func (c PexpireMilliseconds) Xx() PexpireConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (PexpireConditionXx)(c)
}

func (c PexpireMilliseconds) Gt() PexpireConditionGt {
	c.cs.s = append(c.cs.s, "GT")
	return (PexpireConditionGt)(c)
}

func (c PexpireMilliseconds) Lt() PexpireConditionLt {
	c.cs.s = append(c.cs.s, "LT")
	return (PexpireConditionLt)(c)
}

func (c PexpireMilliseconds) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Pexpireat Incomplete

func (b Builder) Pexpireat() (c Pexpireat) {
	c = Pexpireat{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "PEXPIREAT")
	return c
}

func (c Pexpireat) Key(key string) PexpireatKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (PexpireatKey)(c)
}

type PexpireatConditionGt Incomplete

func (c PexpireatConditionGt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PexpireatConditionLt Incomplete

func (c PexpireatConditionLt) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PexpireatConditionNx Incomplete

func (c PexpireatConditionNx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PexpireatConditionXx Incomplete

func (c PexpireatConditionXx) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PexpireatKey Incomplete

func (c PexpireatKey) MillisecondsTimestamp(millisecondsTimestamp int64) PexpireatMillisecondsTimestamp {
	c.cs.s = append(c.cs.s, strconv.FormatInt(millisecondsTimestamp, 10))
	return (PexpireatMillisecondsTimestamp)(c)
}

type PexpireatMillisecondsTimestamp Incomplete

func (c PexpireatMillisecondsTimestamp) Nx() PexpireatConditionNx {
	c.cs.s = append(c.cs.s, "NX")
	return (PexpireatConditionNx)(c)
}

func (c PexpireatMillisecondsTimestamp) Xx() PexpireatConditionXx {
	c.cs.s = append(c.cs.s, "XX")
	return (PexpireatConditionXx)(c)
}

func (c PexpireatMillisecondsTimestamp) Gt() PexpireatConditionGt {
	c.cs.s = append(c.cs.s, "GT")
	return (PexpireatConditionGt)(c)
}

func (c PexpireatMillisecondsTimestamp) Lt() PexpireatConditionLt {
	c.cs.s = append(c.cs.s, "LT")
	return (PexpireatConditionLt)(c)
}

func (c PexpireatMillisecondsTimestamp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Pexpiretime Incomplete

func (b Builder) Pexpiretime() (c Pexpiretime) {
	c = Pexpiretime{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "PEXPIRETIME")
	return c
}

func (c Pexpiretime) Key(key string) PexpiretimeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (PexpiretimeKey)(c)
}

type PexpiretimeKey Incomplete

func (c PexpiretimeKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c PexpiretimeKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Pttl Incomplete

func (b Builder) Pttl() (c Pttl) {
	c = Pttl{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "PTTL")
	return c
}

func (c Pttl) Key(key string) PttlKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (PttlKey)(c)
}

type PttlKey Incomplete

func (c PttlKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c PttlKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Randomkey Incomplete

func (b Builder) Randomkey() (c Randomkey) {
	c = Randomkey{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "RANDOMKEY")
	return c
}

func (c Randomkey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Rename Incomplete

func (b Builder) Rename() (c Rename) {
	c = Rename{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RENAME")
	return c
}

func (c Rename) Key(key string) RenameKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (RenameKey)(c)
}

type RenameKey Incomplete

func (c RenameKey) Newkey(newkey string) RenameNewkey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(newkey)
	} else {
		c.ks = check(c.ks, slot(newkey))
	}
	c.cs.s = append(c.cs.s, newkey)
	return (RenameNewkey)(c)
}

type RenameNewkey Incomplete

func (c RenameNewkey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Renamenx Incomplete

func (b Builder) Renamenx() (c Renamenx) {
	c = Renamenx{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RENAMENX")
	return c
}

func (c Renamenx) Key(key string) RenamenxKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (RenamenxKey)(c)
}

type RenamenxKey Incomplete

func (c RenamenxKey) Newkey(newkey string) RenamenxNewkey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(newkey)
	} else {
		c.ks = check(c.ks, slot(newkey))
	}
	c.cs.s = append(c.cs.s, newkey)
	return (RenamenxNewkey)(c)
}

type RenamenxNewkey Incomplete

func (c RenamenxNewkey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Restore Incomplete

func (b Builder) Restore() (c Restore) {
	c = Restore{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RESTORE")
	return c
}

func (c Restore) Key(key string) RestoreKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (RestoreKey)(c)
}

type RestoreAbsttl Incomplete

func (c RestoreAbsttl) Idletime(seconds int64) RestoreIdletime {
	c.cs.s = append(c.cs.s, "IDLETIME", strconv.FormatInt(seconds, 10))
	return (RestoreIdletime)(c)
}

func (c RestoreAbsttl) Freq(frequency int64) RestoreFreq {
	c.cs.s = append(c.cs.s, "FREQ", strconv.FormatInt(frequency, 10))
	return (RestoreFreq)(c)
}

func (c RestoreAbsttl) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RestoreFreq Incomplete

func (c RestoreFreq) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RestoreIdletime Incomplete

func (c RestoreIdletime) Freq(frequency int64) RestoreFreq {
	c.cs.s = append(c.cs.s, "FREQ", strconv.FormatInt(frequency, 10))
	return (RestoreFreq)(c)
}

func (c RestoreIdletime) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RestoreKey Incomplete

func (c RestoreKey) Ttl(ttl int64) RestoreTtl {
	c.cs.s = append(c.cs.s, strconv.FormatInt(ttl, 10))
	return (RestoreTtl)(c)
}

type RestoreReplace Incomplete

func (c RestoreReplace) Absttl() RestoreAbsttl {
	c.cs.s = append(c.cs.s, "ABSTTL")
	return (RestoreAbsttl)(c)
}

func (c RestoreReplace) Idletime(seconds int64) RestoreIdletime {
	c.cs.s = append(c.cs.s, "IDLETIME", strconv.FormatInt(seconds, 10))
	return (RestoreIdletime)(c)
}

func (c RestoreReplace) Freq(frequency int64) RestoreFreq {
	c.cs.s = append(c.cs.s, "FREQ", strconv.FormatInt(frequency, 10))
	return (RestoreFreq)(c)
}

func (c RestoreReplace) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RestoreSerializedValue Incomplete

func (c RestoreSerializedValue) Replace() RestoreReplace {
	c.cs.s = append(c.cs.s, "REPLACE")
	return (RestoreReplace)(c)
}

func (c RestoreSerializedValue) Absttl() RestoreAbsttl {
	c.cs.s = append(c.cs.s, "ABSTTL")
	return (RestoreAbsttl)(c)
}

func (c RestoreSerializedValue) Idletime(seconds int64) RestoreIdletime {
	c.cs.s = append(c.cs.s, "IDLETIME", strconv.FormatInt(seconds, 10))
	return (RestoreIdletime)(c)
}

func (c RestoreSerializedValue) Freq(frequency int64) RestoreFreq {
	c.cs.s = append(c.cs.s, "FREQ", strconv.FormatInt(frequency, 10))
	return (RestoreFreq)(c)
}

func (c RestoreSerializedValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RestoreTtl Incomplete

func (c RestoreTtl) SerializedValue(serializedValue string) RestoreSerializedValue {
	c.cs.s = append(c.cs.s, serializedValue)
	return (RestoreSerializedValue)(c)
}

type Scan Incomplete

func (b Builder) Scan() (c Scan) {
	c = Scan{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SCAN")
	return c
}

func (c Scan) Cursor(cursor uint64) ScanCursor {
	c.cs.s = append(c.cs.s, strconv.FormatUint(cursor, 10))
	return (ScanCursor)(c)
}

type ScanCount Incomplete

func (c ScanCount) Type(typ string) ScanType {
	c.cs.s = append(c.cs.s, "TYPE", typ)
	return (ScanType)(c)
}

func (c ScanCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScanCursor Incomplete

func (c ScanCursor) Match(pattern string) ScanMatch {
	c.cs.s = append(c.cs.s, "MATCH", pattern)
	return (ScanMatch)(c)
}

func (c ScanCursor) Count(count int64) ScanCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (ScanCount)(c)
}

func (c ScanCursor) Type(typ string) ScanType {
	c.cs.s = append(c.cs.s, "TYPE", typ)
	return (ScanType)(c)
}

func (c ScanCursor) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScanMatch Incomplete

func (c ScanMatch) Count(count int64) ScanCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (ScanCount)(c)
}

func (c ScanMatch) Type(typ string) ScanType {
	c.cs.s = append(c.cs.s, "TYPE", typ)
	return (ScanType)(c)
}

func (c ScanMatch) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ScanType Incomplete

func (c ScanType) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Sort Incomplete

func (b Builder) Sort() (c Sort) {
	c = Sort{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SORT")
	return c
}

func (c Sort) Key(key string) SortKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SortKey)(c)
}

type SortBy Incomplete

func (c SortBy) Limit(offset int64, count int64) SortLimit {
	c.cs.s = append(c.cs.s, "LIMIT", strconv.FormatInt(offset, 10), strconv.FormatInt(count, 10))
	return (SortLimit)(c)
}

func (c SortBy) Get() SortGet {
	return (SortGet)(c)
}

func (c SortBy) Asc() SortOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (SortOrderAsc)(c)
}

func (c SortBy) Desc() SortOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (SortOrderDesc)(c)
}

func (c SortBy) Alpha() SortSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortSortingAlpha)(c)
}

func (c SortBy) Store(destination string) SortStore {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, "STORE", destination)
	return (SortStore)(c)
}

func (c SortBy) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortGet Incomplete

func (c SortGet) Get(pattern string) SortGet {
	c.cs.s = append(c.cs.s, "GET", pattern)
	return c
}

func (c SortGet) Asc() SortOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (SortOrderAsc)(c)
}

func (c SortGet) Desc() SortOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (SortOrderDesc)(c)
}

func (c SortGet) Alpha() SortSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortSortingAlpha)(c)
}

func (c SortGet) Store(destination string) SortStore {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, "STORE", destination)
	return (SortStore)(c)
}

func (c SortGet) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortKey Incomplete

func (c SortKey) By(pattern string) SortBy {
	c.cs.s = append(c.cs.s, "BY", pattern)
	return (SortBy)(c)
}

func (c SortKey) Limit(offset int64, count int64) SortLimit {
	c.cs.s = append(c.cs.s, "LIMIT", strconv.FormatInt(offset, 10), strconv.FormatInt(count, 10))
	return (SortLimit)(c)
}

func (c SortKey) Get() SortGet {
	return (SortGet)(c)
}

func (c SortKey) Asc() SortOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (SortOrderAsc)(c)
}

func (c SortKey) Desc() SortOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (SortOrderDesc)(c)
}

func (c SortKey) Alpha() SortSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortSortingAlpha)(c)
}

func (c SortKey) Store(destination string) SortStore {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, "STORE", destination)
	return (SortStore)(c)
}

func (c SortKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortLimit Incomplete

func (c SortLimit) Get() SortGet {
	return (SortGet)(c)
}

func (c SortLimit) Asc() SortOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (SortOrderAsc)(c)
}

func (c SortLimit) Desc() SortOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (SortOrderDesc)(c)
}

func (c SortLimit) Alpha() SortSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortSortingAlpha)(c)
}

func (c SortLimit) Store(destination string) SortStore {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, "STORE", destination)
	return (SortStore)(c)
}

func (c SortLimit) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortOrderAsc Incomplete

func (c SortOrderAsc) Alpha() SortSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortSortingAlpha)(c)
}

func (c SortOrderAsc) Store(destination string) SortStore {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, "STORE", destination)
	return (SortStore)(c)
}

func (c SortOrderAsc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortOrderDesc Incomplete

func (c SortOrderDesc) Alpha() SortSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortSortingAlpha)(c)
}

func (c SortOrderDesc) Store(destination string) SortStore {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, "STORE", destination)
	return (SortStore)(c)
}

func (c SortOrderDesc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortRo Incomplete

func (b Builder) SortRo() (c SortRo) {
	c = SortRo{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SORT_RO")
	return c
}

func (c SortRo) Key(key string) SortRoKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SortRoKey)(c)
}

type SortRoBy Incomplete

func (c SortRoBy) Limit(offset int64, count int64) SortRoLimit {
	c.cs.s = append(c.cs.s, "LIMIT", strconv.FormatInt(offset, 10), strconv.FormatInt(count, 10))
	return (SortRoLimit)(c)
}

func (c SortRoBy) Get() SortRoGet {
	return (SortRoGet)(c)
}

func (c SortRoBy) Asc() SortRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (SortRoOrderAsc)(c)
}

func (c SortRoBy) Desc() SortRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (SortRoOrderDesc)(c)
}

func (c SortRoBy) Alpha() SortRoSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortRoSortingAlpha)(c)
}

func (c SortRoBy) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c SortRoBy) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortRoGet Incomplete

func (c SortRoGet) Get(pattern string) SortRoGet {
	c.cs.s = append(c.cs.s, "GET", pattern)
	return c
}

func (c SortRoGet) Asc() SortRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (SortRoOrderAsc)(c)
}

func (c SortRoGet) Desc() SortRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (SortRoOrderDesc)(c)
}

func (c SortRoGet) Alpha() SortRoSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortRoSortingAlpha)(c)
}

func (c SortRoGet) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c SortRoGet) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortRoKey Incomplete

func (c SortRoKey) By(pattern string) SortRoBy {
	c.cs.s = append(c.cs.s, "BY", pattern)
	return (SortRoBy)(c)
}

func (c SortRoKey) Limit(offset int64, count int64) SortRoLimit {
	c.cs.s = append(c.cs.s, "LIMIT", strconv.FormatInt(offset, 10), strconv.FormatInt(count, 10))
	return (SortRoLimit)(c)
}

func (c SortRoKey) Get() SortRoGet {
	return (SortRoGet)(c)
}

func (c SortRoKey) Asc() SortRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (SortRoOrderAsc)(c)
}

func (c SortRoKey) Desc() SortRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (SortRoOrderDesc)(c)
}

func (c SortRoKey) Alpha() SortRoSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortRoSortingAlpha)(c)
}

func (c SortRoKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c SortRoKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortRoLimit Incomplete

func (c SortRoLimit) Get() SortRoGet {
	return (SortRoGet)(c)
}

func (c SortRoLimit) Asc() SortRoOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (SortRoOrderAsc)(c)
}

func (c SortRoLimit) Desc() SortRoOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (SortRoOrderDesc)(c)
}

func (c SortRoLimit) Alpha() SortRoSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortRoSortingAlpha)(c)
}

func (c SortRoLimit) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c SortRoLimit) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortRoOrderAsc Incomplete

func (c SortRoOrderAsc) Alpha() SortRoSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortRoSortingAlpha)(c)
}

func (c SortRoOrderAsc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c SortRoOrderAsc) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortRoOrderDesc Incomplete

func (c SortRoOrderDesc) Alpha() SortRoSortingAlpha {
	c.cs.s = append(c.cs.s, "ALPHA")
	return (SortRoSortingAlpha)(c)
}

func (c SortRoOrderDesc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c SortRoOrderDesc) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortRoSortingAlpha Incomplete

func (c SortRoSortingAlpha) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c SortRoSortingAlpha) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortSortingAlpha Incomplete

func (c SortSortingAlpha) Store(destination string) SortStore {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, "STORE", destination)
	return (SortStore)(c)
}

func (c SortSortingAlpha) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SortStore Incomplete

func (c SortStore) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Touch Incomplete

func (b Builder) Touch() (c Touch) {
	c = Touch{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "TOUCH")
	return c
}

func (c Touch) Key(key ...string) TouchKey {
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
	return (TouchKey)(c)
}

type TouchKey Incomplete

func (c TouchKey) Key(key ...string) TouchKey {
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

func (c TouchKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Ttl Incomplete

func (b Builder) Ttl() (c Ttl) {
	c = Ttl{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "TTL")
	return c
}

func (c Ttl) Key(key string) TtlKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TtlKey)(c)
}

type TtlKey Incomplete

func (c TtlKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c TtlKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Type Incomplete

func (b Builder) Type() (c Type) {
	c = Type{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "TYPE")
	return c
}

func (c Type) Key(key string) TypeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TypeKey)(c)
}

type TypeKey Incomplete

func (c TypeKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c TypeKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Unlink Incomplete

func (b Builder) Unlink() (c Unlink) {
	c = Unlink{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "UNLINK")
	return c
}

func (c Unlink) Key(key ...string) UnlinkKey {
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
	return (UnlinkKey)(c)
}

type UnlinkKey Incomplete

func (c UnlinkKey) Key(key ...string) UnlinkKey {
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

func (c UnlinkKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Wait Incomplete

func (b Builder) Wait() (c Wait) {
	c = Wait{cs: get(), ks: b.ks, cf: int16(blockTag)}
	c.cs.s = append(c.cs.s, "WAIT")
	return c
}

func (c Wait) Numreplicas(numreplicas int64) WaitNumreplicas {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numreplicas, 10))
	return (WaitNumreplicas)(c)
}

type WaitNumreplicas Incomplete

func (c WaitNumreplicas) Timeout(timeout int64) WaitTimeout {
	c.cs.s = append(c.cs.s, strconv.FormatInt(timeout, 10))
	return (WaitTimeout)(c)
}

type WaitTimeout Incomplete

func (c WaitTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Waitaof Incomplete

func (b Builder) Waitaof() (c Waitaof) {
	c = Waitaof{cs: get(), ks: b.ks, cf: int16(blockTag)}
	c.cs.s = append(c.cs.s, "WAITAOF")
	return c
}

func (c Waitaof) Numlocal(numlocal int64) WaitaofNumlocal {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numlocal, 10))
	return (WaitaofNumlocal)(c)
}

type WaitaofNumlocal Incomplete

func (c WaitaofNumlocal) Numreplicas(numreplicas int64) WaitaofNumreplicas {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numreplicas, 10))
	return (WaitaofNumreplicas)(c)
}

type WaitaofNumreplicas Incomplete

func (c WaitaofNumreplicas) Timeout(timeout int64) WaitaofTimeout {
	c.cs.s = append(c.cs.s, strconv.FormatInt(timeout, 10))
	return (WaitaofTimeout)(c)
}

type WaitaofTimeout Incomplete

func (c WaitaofTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
