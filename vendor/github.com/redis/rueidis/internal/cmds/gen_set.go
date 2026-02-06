// Code generated DO NOT EDIT

package cmds

import "strconv"

type Sadd Incomplete

func (b Builder) Sadd() (c Sadd) {
	c = Sadd{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SADD")
	return c
}

func (c Sadd) Key(key string) SaddKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SaddKey)(c)
}

type SaddKey Incomplete

func (c SaddKey) Member(member ...string) SaddMember {
	c.cs.s = append(c.cs.s, member...)
	return (SaddMember)(c)
}

type SaddMember Incomplete

func (c SaddMember) Member(member ...string) SaddMember {
	c.cs.s = append(c.cs.s, member...)
	return c
}

func (c SaddMember) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Scard Incomplete

func (b Builder) Scard() (c Scard) {
	c = Scard{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SCARD")
	return c
}

func (c Scard) Key(key string) ScardKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (ScardKey)(c)
}

type ScardKey Incomplete

func (c ScardKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c ScardKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Sdiff Incomplete

func (b Builder) Sdiff() (c Sdiff) {
	c = Sdiff{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SDIFF")
	return c
}

func (c Sdiff) Key(key ...string) SdiffKey {
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
	return (SdiffKey)(c)
}

type SdiffKey Incomplete

func (c SdiffKey) Key(key ...string) SdiffKey {
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

func (c SdiffKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Sdiffstore Incomplete

func (b Builder) Sdiffstore() (c Sdiffstore) {
	c = Sdiffstore{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SDIFFSTORE")
	return c
}

func (c Sdiffstore) Destination(destination string) SdiffstoreDestination {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, destination)
	return (SdiffstoreDestination)(c)
}

type SdiffstoreDestination Incomplete

func (c SdiffstoreDestination) Key(key ...string) SdiffstoreKey {
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
	return (SdiffstoreKey)(c)
}

type SdiffstoreKey Incomplete

func (c SdiffstoreKey) Key(key ...string) SdiffstoreKey {
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

func (c SdiffstoreKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Sinter Incomplete

func (b Builder) Sinter() (c Sinter) {
	c = Sinter{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SINTER")
	return c
}

func (c Sinter) Key(key ...string) SinterKey {
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
	return (SinterKey)(c)
}

type SinterKey Incomplete

func (c SinterKey) Key(key ...string) SinterKey {
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

func (c SinterKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Sintercard Incomplete

func (b Builder) Sintercard() (c Sintercard) {
	c = Sintercard{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SINTERCARD")
	return c
}

func (c Sintercard) Numkeys(numkeys int64) SintercardNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (SintercardNumkeys)(c)
}

type SintercardKey Incomplete

func (c SintercardKey) Key(key ...string) SintercardKey {
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

func (c SintercardKey) Limit(limit int64) SintercardLimit {
	c.cs.s = append(c.cs.s, "LIMIT", strconv.FormatInt(limit, 10))
	return (SintercardLimit)(c)
}

func (c SintercardKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SintercardLimit Incomplete

func (c SintercardLimit) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SintercardNumkeys Incomplete

func (c SintercardNumkeys) Key(key ...string) SintercardKey {
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
	return (SintercardKey)(c)
}

type Sinterstore Incomplete

func (b Builder) Sinterstore() (c Sinterstore) {
	c = Sinterstore{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SINTERSTORE")
	return c
}

func (c Sinterstore) Destination(destination string) SinterstoreDestination {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, destination)
	return (SinterstoreDestination)(c)
}

type SinterstoreDestination Incomplete

func (c SinterstoreDestination) Key(key ...string) SinterstoreKey {
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
	return (SinterstoreKey)(c)
}

type SinterstoreKey Incomplete

func (c SinterstoreKey) Key(key ...string) SinterstoreKey {
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

func (c SinterstoreKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Sismember Incomplete

func (b Builder) Sismember() (c Sismember) {
	c = Sismember{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SISMEMBER")
	return c
}

func (c Sismember) Key(key string) SismemberKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SismemberKey)(c)
}

type SismemberKey Incomplete

func (c SismemberKey) Member(member string) SismemberMember {
	c.cs.s = append(c.cs.s, member)
	return (SismemberMember)(c)
}

type SismemberMember Incomplete

func (c SismemberMember) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c SismemberMember) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Smembers Incomplete

func (b Builder) Smembers() (c Smembers) {
	c = Smembers{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SMEMBERS")
	return c
}

func (c Smembers) Key(key string) SmembersKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SmembersKey)(c)
}

type SmembersKey Incomplete

func (c SmembersKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c SmembersKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Smismember Incomplete

func (b Builder) Smismember() (c Smismember) {
	c = Smismember{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SMISMEMBER")
	return c
}

func (c Smismember) Key(key string) SmismemberKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SmismemberKey)(c)
}

type SmismemberKey Incomplete

func (c SmismemberKey) Member(member ...string) SmismemberMember {
	c.cs.s = append(c.cs.s, member...)
	return (SmismemberMember)(c)
}

type SmismemberMember Incomplete

func (c SmismemberMember) Member(member ...string) SmismemberMember {
	c.cs.s = append(c.cs.s, member...)
	return c
}

func (c SmismemberMember) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c SmismemberMember) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Smove Incomplete

func (b Builder) Smove() (c Smove) {
	c = Smove{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SMOVE")
	return c
}

func (c Smove) Source(source string) SmoveSource {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(source)
	} else {
		c.ks = check(c.ks, slot(source))
	}
	c.cs.s = append(c.cs.s, source)
	return (SmoveSource)(c)
}

type SmoveDestination Incomplete

func (c SmoveDestination) Member(member string) SmoveMember {
	c.cs.s = append(c.cs.s, member)
	return (SmoveMember)(c)
}

type SmoveMember Incomplete

func (c SmoveMember) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SmoveSource Incomplete

func (c SmoveSource) Destination(destination string) SmoveDestination {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, destination)
	return (SmoveDestination)(c)
}

type Spop Incomplete

func (b Builder) Spop() (c Spop) {
	c = Spop{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SPOP")
	return c
}

func (c Spop) Key(key string) SpopKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SpopKey)(c)
}

type SpopCount Incomplete

func (c SpopCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SpopKey Incomplete

func (c SpopKey) Count(count int64) SpopCount {
	c.cs.s = append(c.cs.s, strconv.FormatInt(count, 10))
	return (SpopCount)(c)
}

func (c SpopKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Srandmember Incomplete

func (b Builder) Srandmember() (c Srandmember) {
	c = Srandmember{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SRANDMEMBER")
	return c
}

func (c Srandmember) Key(key string) SrandmemberKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SrandmemberKey)(c)
}

type SrandmemberCount Incomplete

func (c SrandmemberCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SrandmemberKey Incomplete

func (c SrandmemberKey) Count(count int64) SrandmemberCount {
	c.cs.s = append(c.cs.s, strconv.FormatInt(count, 10))
	return (SrandmemberCount)(c)
}

func (c SrandmemberKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Srem Incomplete

func (b Builder) Srem() (c Srem) {
	c = Srem{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SREM")
	return c
}

func (c Srem) Key(key string) SremKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SremKey)(c)
}

type SremKey Incomplete

func (c SremKey) Member(member ...string) SremMember {
	c.cs.s = append(c.cs.s, member...)
	return (SremMember)(c)
}

type SremMember Incomplete

func (c SremMember) Member(member ...string) SremMember {
	c.cs.s = append(c.cs.s, member...)
	return c
}

func (c SremMember) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Sscan Incomplete

func (b Builder) Sscan() (c Sscan) {
	c = Sscan{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SSCAN")
	return c
}

func (c Sscan) Key(key string) SscanKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (SscanKey)(c)
}

type SscanCount Incomplete

func (c SscanCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SscanCursor Incomplete

func (c SscanCursor) Match(pattern string) SscanMatch {
	c.cs.s = append(c.cs.s, "MATCH", pattern)
	return (SscanMatch)(c)
}

func (c SscanCursor) Count(count int64) SscanCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (SscanCount)(c)
}

func (c SscanCursor) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SscanKey Incomplete

func (c SscanKey) Cursor(cursor uint64) SscanCursor {
	c.cs.s = append(c.cs.s, strconv.FormatUint(cursor, 10))
	return (SscanCursor)(c)
}

type SscanMatch Incomplete

func (c SscanMatch) Count(count int64) SscanCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (SscanCount)(c)
}

func (c SscanMatch) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Sunion Incomplete

func (b Builder) Sunion() (c Sunion) {
	c = Sunion{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "SUNION")
	return c
}

func (c Sunion) Key(key ...string) SunionKey {
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
	return (SunionKey)(c)
}

type SunionKey Incomplete

func (c SunionKey) Key(key ...string) SunionKey {
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

func (c SunionKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Sunionstore Incomplete

func (b Builder) Sunionstore() (c Sunionstore) {
	c = Sunionstore{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SUNIONSTORE")
	return c
}

func (c Sunionstore) Destination(destination string) SunionstoreDestination {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, destination)
	return (SunionstoreDestination)(c)
}

type SunionstoreDestination Incomplete

func (c SunionstoreDestination) Key(key ...string) SunionstoreKey {
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
	return (SunionstoreKey)(c)
}

type SunionstoreKey Incomplete

func (c SunionstoreKey) Key(key ...string) SunionstoreKey {
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

func (c SunionstoreKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
