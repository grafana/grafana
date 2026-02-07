// Code generated DO NOT EDIT

package cmds

import "strconv"

type Blmove Incomplete

func (b Builder) Blmove() (c Blmove) {
	c = Blmove{cs: get(), ks: b.ks, cf: int16(blockTag)}
	c.cs.s = append(c.cs.s, "BLMOVE")
	return c
}

func (c Blmove) Source(source string) BlmoveSource {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(source)
	} else {
		c.ks = check(c.ks, slot(source))
	}
	c.cs.s = append(c.cs.s, source)
	return (BlmoveSource)(c)
}

type BlmoveDestination Incomplete

func (c BlmoveDestination) Left() BlmoveWherefromLeft {
	c.cs.s = append(c.cs.s, "LEFT")
	return (BlmoveWherefromLeft)(c)
}

func (c BlmoveDestination) Right() BlmoveWherefromRight {
	c.cs.s = append(c.cs.s, "RIGHT")
	return (BlmoveWherefromRight)(c)
}

type BlmoveSource Incomplete

func (c BlmoveSource) Destination(destination string) BlmoveDestination {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, destination)
	return (BlmoveDestination)(c)
}

type BlmoveTimeout Incomplete

func (c BlmoveTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BlmoveWherefromLeft Incomplete

func (c BlmoveWherefromLeft) Left() BlmoveWheretoLeft {
	c.cs.s = append(c.cs.s, "LEFT")
	return (BlmoveWheretoLeft)(c)
}

func (c BlmoveWherefromLeft) Right() BlmoveWheretoRight {
	c.cs.s = append(c.cs.s, "RIGHT")
	return (BlmoveWheretoRight)(c)
}

type BlmoveWherefromRight Incomplete

func (c BlmoveWherefromRight) Left() BlmoveWheretoLeft {
	c.cs.s = append(c.cs.s, "LEFT")
	return (BlmoveWheretoLeft)(c)
}

func (c BlmoveWherefromRight) Right() BlmoveWheretoRight {
	c.cs.s = append(c.cs.s, "RIGHT")
	return (BlmoveWheretoRight)(c)
}

type BlmoveWheretoLeft Incomplete

func (c BlmoveWheretoLeft) Timeout(timeout float64) BlmoveTimeout {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(timeout, 'f', -1, 64))
	return (BlmoveTimeout)(c)
}

type BlmoveWheretoRight Incomplete

func (c BlmoveWheretoRight) Timeout(timeout float64) BlmoveTimeout {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(timeout, 'f', -1, 64))
	return (BlmoveTimeout)(c)
}

type Blmpop Incomplete

func (b Builder) Blmpop() (c Blmpop) {
	c = Blmpop{cs: get(), ks: b.ks, cf: int16(blockTag)}
	c.cs.s = append(c.cs.s, "BLMPOP")
	return c
}

func (c Blmpop) Timeout(timeout float64) BlmpopTimeout {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(timeout, 'f', -1, 64))
	return (BlmpopTimeout)(c)
}

type BlmpopCount Incomplete

func (c BlmpopCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BlmpopKey Incomplete

func (c BlmpopKey) Key(key ...string) BlmpopKey {
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

func (c BlmpopKey) Left() BlmpopWhereLeft {
	c.cs.s = append(c.cs.s, "LEFT")
	return (BlmpopWhereLeft)(c)
}

func (c BlmpopKey) Right() BlmpopWhereRight {
	c.cs.s = append(c.cs.s, "RIGHT")
	return (BlmpopWhereRight)(c)
}

type BlmpopNumkeys Incomplete

func (c BlmpopNumkeys) Key(key ...string) BlmpopKey {
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
	return (BlmpopKey)(c)
}

type BlmpopTimeout Incomplete

func (c BlmpopTimeout) Numkeys(numkeys int64) BlmpopNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (BlmpopNumkeys)(c)
}

type BlmpopWhereLeft Incomplete

func (c BlmpopWhereLeft) Count(count int64) BlmpopCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (BlmpopCount)(c)
}

func (c BlmpopWhereLeft) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BlmpopWhereRight Incomplete

func (c BlmpopWhereRight) Count(count int64) BlmpopCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (BlmpopCount)(c)
}

func (c BlmpopWhereRight) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Blpop Incomplete

func (b Builder) Blpop() (c Blpop) {
	c = Blpop{cs: get(), ks: b.ks, cf: int16(blockTag)}
	c.cs.s = append(c.cs.s, "BLPOP")
	return c
}

func (c Blpop) Key(key ...string) BlpopKey {
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
	return (BlpopKey)(c)
}

type BlpopKey Incomplete

func (c BlpopKey) Key(key ...string) BlpopKey {
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

func (c BlpopKey) Timeout(timeout float64) BlpopTimeout {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(timeout, 'f', -1, 64))
	return (BlpopTimeout)(c)
}

type BlpopTimeout Incomplete

func (c BlpopTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Brpop Incomplete

func (b Builder) Brpop() (c Brpop) {
	c = Brpop{cs: get(), ks: b.ks, cf: int16(blockTag)}
	c.cs.s = append(c.cs.s, "BRPOP")
	return c
}

func (c Brpop) Key(key ...string) BrpopKey {
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
	return (BrpopKey)(c)
}

type BrpopKey Incomplete

func (c BrpopKey) Key(key ...string) BrpopKey {
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

func (c BrpopKey) Timeout(timeout float64) BrpopTimeout {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(timeout, 'f', -1, 64))
	return (BrpopTimeout)(c)
}

type BrpopTimeout Incomplete

func (c BrpopTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Brpoplpush Incomplete

func (b Builder) Brpoplpush() (c Brpoplpush) {
	c = Brpoplpush{cs: get(), ks: b.ks, cf: int16(blockTag)}
	c.cs.s = append(c.cs.s, "BRPOPLPUSH")
	return c
}

func (c Brpoplpush) Source(source string) BrpoplpushSource {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(source)
	} else {
		c.ks = check(c.ks, slot(source))
	}
	c.cs.s = append(c.cs.s, source)
	return (BrpoplpushSource)(c)
}

type BrpoplpushDestination Incomplete

func (c BrpoplpushDestination) Timeout(timeout float64) BrpoplpushTimeout {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(timeout, 'f', -1, 64))
	return (BrpoplpushTimeout)(c)
}

type BrpoplpushSource Incomplete

func (c BrpoplpushSource) Destination(destination string) BrpoplpushDestination {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, destination)
	return (BrpoplpushDestination)(c)
}

type BrpoplpushTimeout Incomplete

func (c BrpoplpushTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Lindex Incomplete

func (b Builder) Lindex() (c Lindex) {
	c = Lindex{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "LINDEX")
	return c
}

func (c Lindex) Key(key string) LindexKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LindexKey)(c)
}

type LindexIndex Incomplete

func (c LindexIndex) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c LindexIndex) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LindexKey Incomplete

func (c LindexKey) Index(index int64) LindexIndex {
	c.cs.s = append(c.cs.s, strconv.FormatInt(index, 10))
	return (LindexIndex)(c)
}

type Linsert Incomplete

func (b Builder) Linsert() (c Linsert) {
	c = Linsert{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "LINSERT")
	return c
}

func (c Linsert) Key(key string) LinsertKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LinsertKey)(c)
}

type LinsertElement Incomplete

func (c LinsertElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LinsertKey Incomplete

func (c LinsertKey) Before() LinsertWhereBefore {
	c.cs.s = append(c.cs.s, "BEFORE")
	return (LinsertWhereBefore)(c)
}

func (c LinsertKey) After() LinsertWhereAfter {
	c.cs.s = append(c.cs.s, "AFTER")
	return (LinsertWhereAfter)(c)
}

type LinsertPivot Incomplete

func (c LinsertPivot) Element(element string) LinsertElement {
	c.cs.s = append(c.cs.s, element)
	return (LinsertElement)(c)
}

type LinsertWhereAfter Incomplete

func (c LinsertWhereAfter) Pivot(pivot string) LinsertPivot {
	c.cs.s = append(c.cs.s, pivot)
	return (LinsertPivot)(c)
}

type LinsertWhereBefore Incomplete

func (c LinsertWhereBefore) Pivot(pivot string) LinsertPivot {
	c.cs.s = append(c.cs.s, pivot)
	return (LinsertPivot)(c)
}

type Llen Incomplete

func (b Builder) Llen() (c Llen) {
	c = Llen{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "LLEN")
	return c
}

func (c Llen) Key(key string) LlenKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LlenKey)(c)
}

type LlenKey Incomplete

func (c LlenKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c LlenKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Lmove Incomplete

func (b Builder) Lmove() (c Lmove) {
	c = Lmove{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "LMOVE")
	return c
}

func (c Lmove) Source(source string) LmoveSource {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(source)
	} else {
		c.ks = check(c.ks, slot(source))
	}
	c.cs.s = append(c.cs.s, source)
	return (LmoveSource)(c)
}

type LmoveDestination Incomplete

func (c LmoveDestination) Left() LmoveWherefromLeft {
	c.cs.s = append(c.cs.s, "LEFT")
	return (LmoveWherefromLeft)(c)
}

func (c LmoveDestination) Right() LmoveWherefromRight {
	c.cs.s = append(c.cs.s, "RIGHT")
	return (LmoveWherefromRight)(c)
}

type LmoveSource Incomplete

func (c LmoveSource) Destination(destination string) LmoveDestination {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, destination)
	return (LmoveDestination)(c)
}

type LmoveWherefromLeft Incomplete

func (c LmoveWherefromLeft) Left() LmoveWheretoLeft {
	c.cs.s = append(c.cs.s, "LEFT")
	return (LmoveWheretoLeft)(c)
}

func (c LmoveWherefromLeft) Right() LmoveWheretoRight {
	c.cs.s = append(c.cs.s, "RIGHT")
	return (LmoveWheretoRight)(c)
}

type LmoveWherefromRight Incomplete

func (c LmoveWherefromRight) Left() LmoveWheretoLeft {
	c.cs.s = append(c.cs.s, "LEFT")
	return (LmoveWheretoLeft)(c)
}

func (c LmoveWherefromRight) Right() LmoveWheretoRight {
	c.cs.s = append(c.cs.s, "RIGHT")
	return (LmoveWheretoRight)(c)
}

type LmoveWheretoLeft Incomplete

func (c LmoveWheretoLeft) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LmoveWheretoRight Incomplete

func (c LmoveWheretoRight) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Lmpop Incomplete

func (b Builder) Lmpop() (c Lmpop) {
	c = Lmpop{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "LMPOP")
	return c
}

func (c Lmpop) Numkeys(numkeys int64) LmpopNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (LmpopNumkeys)(c)
}

type LmpopCount Incomplete

func (c LmpopCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LmpopKey Incomplete

func (c LmpopKey) Key(key ...string) LmpopKey {
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

func (c LmpopKey) Left() LmpopWhereLeft {
	c.cs.s = append(c.cs.s, "LEFT")
	return (LmpopWhereLeft)(c)
}

func (c LmpopKey) Right() LmpopWhereRight {
	c.cs.s = append(c.cs.s, "RIGHT")
	return (LmpopWhereRight)(c)
}

type LmpopNumkeys Incomplete

func (c LmpopNumkeys) Key(key ...string) LmpopKey {
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
	return (LmpopKey)(c)
}

type LmpopWhereLeft Incomplete

func (c LmpopWhereLeft) Count(count int64) LmpopCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (LmpopCount)(c)
}

func (c LmpopWhereLeft) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LmpopWhereRight Incomplete

func (c LmpopWhereRight) Count(count int64) LmpopCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(count, 10))
	return (LmpopCount)(c)
}

func (c LmpopWhereRight) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Lpop Incomplete

func (b Builder) Lpop() (c Lpop) {
	c = Lpop{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "LPOP")
	return c
}

func (c Lpop) Key(key string) LpopKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LpopKey)(c)
}

type LpopCount Incomplete

func (c LpopCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LpopKey Incomplete

func (c LpopKey) Count(count int64) LpopCount {
	c.cs.s = append(c.cs.s, strconv.FormatInt(count, 10))
	return (LpopCount)(c)
}

func (c LpopKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Lpos Incomplete

func (b Builder) Lpos() (c Lpos) {
	c = Lpos{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "LPOS")
	return c
}

func (c Lpos) Key(key string) LposKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LposKey)(c)
}

type LposCount Incomplete

func (c LposCount) Maxlen(len int64) LposMaxlen {
	c.cs.s = append(c.cs.s, "MAXLEN", strconv.FormatInt(len, 10))
	return (LposMaxlen)(c)
}

func (c LposCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c LposCount) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LposElement Incomplete

func (c LposElement) Rank(rank int64) LposRank {
	c.cs.s = append(c.cs.s, "RANK", strconv.FormatInt(rank, 10))
	return (LposRank)(c)
}

func (c LposElement) Count(numMatches int64) LposCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(numMatches, 10))
	return (LposCount)(c)
}

func (c LposElement) Maxlen(len int64) LposMaxlen {
	c.cs.s = append(c.cs.s, "MAXLEN", strconv.FormatInt(len, 10))
	return (LposMaxlen)(c)
}

func (c LposElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c LposElement) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LposKey Incomplete

func (c LposKey) Element(element string) LposElement {
	c.cs.s = append(c.cs.s, element)
	return (LposElement)(c)
}

type LposMaxlen Incomplete

func (c LposMaxlen) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c LposMaxlen) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LposRank Incomplete

func (c LposRank) Count(numMatches int64) LposCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(numMatches, 10))
	return (LposCount)(c)
}

func (c LposRank) Maxlen(len int64) LposMaxlen {
	c.cs.s = append(c.cs.s, "MAXLEN", strconv.FormatInt(len, 10))
	return (LposMaxlen)(c)
}

func (c LposRank) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c LposRank) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Lpush Incomplete

func (b Builder) Lpush() (c Lpush) {
	c = Lpush{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "LPUSH")
	return c
}

func (c Lpush) Key(key string) LpushKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LpushKey)(c)
}

type LpushElement Incomplete

func (c LpushElement) Element(element ...string) LpushElement {
	c.cs.s = append(c.cs.s, element...)
	return c
}

func (c LpushElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LpushKey Incomplete

func (c LpushKey) Element(element ...string) LpushElement {
	c.cs.s = append(c.cs.s, element...)
	return (LpushElement)(c)
}

type Lpushx Incomplete

func (b Builder) Lpushx() (c Lpushx) {
	c = Lpushx{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "LPUSHX")
	return c
}

func (c Lpushx) Key(key string) LpushxKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LpushxKey)(c)
}

type LpushxElement Incomplete

func (c LpushxElement) Element(element ...string) LpushxElement {
	c.cs.s = append(c.cs.s, element...)
	return c
}

func (c LpushxElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LpushxKey Incomplete

func (c LpushxKey) Element(element ...string) LpushxElement {
	c.cs.s = append(c.cs.s, element...)
	return (LpushxElement)(c)
}

type Lrange Incomplete

func (b Builder) Lrange() (c Lrange) {
	c = Lrange{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "LRANGE")
	return c
}

func (c Lrange) Key(key string) LrangeKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LrangeKey)(c)
}

type LrangeKey Incomplete

func (c LrangeKey) Start(start int64) LrangeStart {
	c.cs.s = append(c.cs.s, strconv.FormatInt(start, 10))
	return (LrangeStart)(c)
}

type LrangeStart Incomplete

func (c LrangeStart) Stop(stop int64) LrangeStop {
	c.cs.s = append(c.cs.s, strconv.FormatInt(stop, 10))
	return (LrangeStop)(c)
}

type LrangeStop Incomplete

func (c LrangeStop) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c LrangeStop) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Lrem Incomplete

func (b Builder) Lrem() (c Lrem) {
	c = Lrem{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "LREM")
	return c
}

func (c Lrem) Key(key string) LremKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LremKey)(c)
}

type LremCount Incomplete

func (c LremCount) Element(element string) LremElement {
	c.cs.s = append(c.cs.s, element)
	return (LremElement)(c)
}

type LremElement Incomplete

func (c LremElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LremKey Incomplete

func (c LremKey) Count(count int64) LremCount {
	c.cs.s = append(c.cs.s, strconv.FormatInt(count, 10))
	return (LremCount)(c)
}

type Lset Incomplete

func (b Builder) Lset() (c Lset) {
	c = Lset{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "LSET")
	return c
}

func (c Lset) Key(key string) LsetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LsetKey)(c)
}

type LsetElement Incomplete

func (c LsetElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type LsetIndex Incomplete

func (c LsetIndex) Element(element string) LsetElement {
	c.cs.s = append(c.cs.s, element)
	return (LsetElement)(c)
}

type LsetKey Incomplete

func (c LsetKey) Index(index int64) LsetIndex {
	c.cs.s = append(c.cs.s, strconv.FormatInt(index, 10))
	return (LsetIndex)(c)
}

type Ltrim Incomplete

func (b Builder) Ltrim() (c Ltrim) {
	c = Ltrim{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "LTRIM")
	return c
}

func (c Ltrim) Key(key string) LtrimKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (LtrimKey)(c)
}

type LtrimKey Incomplete

func (c LtrimKey) Start(start int64) LtrimStart {
	c.cs.s = append(c.cs.s, strconv.FormatInt(start, 10))
	return (LtrimStart)(c)
}

type LtrimStart Incomplete

func (c LtrimStart) Stop(stop int64) LtrimStop {
	c.cs.s = append(c.cs.s, strconv.FormatInt(stop, 10))
	return (LtrimStop)(c)
}

type LtrimStop Incomplete

func (c LtrimStop) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Rpop Incomplete

func (b Builder) Rpop() (c Rpop) {
	c = Rpop{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RPOP")
	return c
}

func (c Rpop) Key(key string) RpopKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (RpopKey)(c)
}

type RpopCount Incomplete

func (c RpopCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RpopKey Incomplete

func (c RpopKey) Count(count int64) RpopCount {
	c.cs.s = append(c.cs.s, strconv.FormatInt(count, 10))
	return (RpopCount)(c)
}

func (c RpopKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Rpoplpush Incomplete

func (b Builder) Rpoplpush() (c Rpoplpush) {
	c = Rpoplpush{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RPOPLPUSH")
	return c
}

func (c Rpoplpush) Source(source string) RpoplpushSource {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(source)
	} else {
		c.ks = check(c.ks, slot(source))
	}
	c.cs.s = append(c.cs.s, source)
	return (RpoplpushSource)(c)
}

type RpoplpushDestination Incomplete

func (c RpoplpushDestination) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RpoplpushSource Incomplete

func (c RpoplpushSource) Destination(destination string) RpoplpushDestination {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destination)
	} else {
		c.ks = check(c.ks, slot(destination))
	}
	c.cs.s = append(c.cs.s, destination)
	return (RpoplpushDestination)(c)
}

type Rpush Incomplete

func (b Builder) Rpush() (c Rpush) {
	c = Rpush{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RPUSH")
	return c
}

func (c Rpush) Key(key string) RpushKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (RpushKey)(c)
}

type RpushElement Incomplete

func (c RpushElement) Element(element ...string) RpushElement {
	c.cs.s = append(c.cs.s, element...)
	return c
}

func (c RpushElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RpushKey Incomplete

func (c RpushKey) Element(element ...string) RpushElement {
	c.cs.s = append(c.cs.s, element...)
	return (RpushElement)(c)
}

type Rpushx Incomplete

func (b Builder) Rpushx() (c Rpushx) {
	c = Rpushx{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RPUSHX")
	return c
}

func (c Rpushx) Key(key string) RpushxKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (RpushxKey)(c)
}

type RpushxElement Incomplete

func (c RpushxElement) Element(element ...string) RpushxElement {
	c.cs.s = append(c.cs.s, element...)
	return c
}

func (c RpushxElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RpushxKey Incomplete

func (c RpushxKey) Element(element ...string) RpushxElement {
	c.cs.s = append(c.cs.s, element...)
	return (RpushxElement)(c)
}
