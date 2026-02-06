// Code generated DO NOT EDIT

package cmds

import "strconv"

type TopkAdd Incomplete

func (b Builder) TopkAdd() (c TopkAdd) {
	c = TopkAdd{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TOPK.ADD")
	return c
}

func (c TopkAdd) Key(key string) TopkAddKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TopkAddKey)(c)
}

type TopkAddItems Incomplete

func (c TopkAddItems) Items(items ...string) TopkAddItems {
	c.cs.s = append(c.cs.s, items...)
	return c
}

func (c TopkAddItems) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TopkAddKey Incomplete

func (c TopkAddKey) Items(items ...string) TopkAddItems {
	c.cs.s = append(c.cs.s, items...)
	return (TopkAddItems)(c)
}

type TopkCount Incomplete

func (b Builder) TopkCount() (c TopkCount) {
	c = TopkCount{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TOPK.COUNT")
	return c
}

func (c TopkCount) Key(key string) TopkCountKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TopkCountKey)(c)
}

type TopkCountItem Incomplete

func (c TopkCountItem) Item(item ...string) TopkCountItem {
	c.cs.s = append(c.cs.s, item...)
	return c
}

func (c TopkCountItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TopkCountKey Incomplete

func (c TopkCountKey) Item(item ...string) TopkCountItem {
	c.cs.s = append(c.cs.s, item...)
	return (TopkCountItem)(c)
}

type TopkIncrby Incomplete

func (b Builder) TopkIncrby() (c TopkIncrby) {
	c = TopkIncrby{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TOPK.INCRBY")
	return c
}

func (c TopkIncrby) Key(key string) TopkIncrbyKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TopkIncrbyKey)(c)
}

type TopkIncrbyItemsIncrement Incomplete

func (c TopkIncrbyItemsIncrement) Item(item string) TopkIncrbyItemsItem {
	c.cs.s = append(c.cs.s, item)
	return (TopkIncrbyItemsItem)(c)
}

func (c TopkIncrbyItemsIncrement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TopkIncrbyItemsItem Incomplete

func (c TopkIncrbyItemsItem) Increment(increment int64) TopkIncrbyItemsIncrement {
	c.cs.s = append(c.cs.s, strconv.FormatInt(increment, 10))
	return (TopkIncrbyItemsIncrement)(c)
}

type TopkIncrbyKey Incomplete

func (c TopkIncrbyKey) Item(item string) TopkIncrbyItemsItem {
	c.cs.s = append(c.cs.s, item)
	return (TopkIncrbyItemsItem)(c)
}

type TopkInfo Incomplete

func (b Builder) TopkInfo() (c TopkInfo) {
	c = TopkInfo{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "TOPK.INFO")
	return c
}

func (c TopkInfo) Key(key string) TopkInfoKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TopkInfoKey)(c)
}

type TopkInfoKey Incomplete

func (c TopkInfoKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c TopkInfoKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TopkList Incomplete

func (b Builder) TopkList() (c TopkList) {
	c = TopkList{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "TOPK.LIST")
	return c
}

func (c TopkList) Key(key string) TopkListKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TopkListKey)(c)
}

type TopkListKey Incomplete

func (c TopkListKey) Withcount() TopkListWithcount {
	c.cs.s = append(c.cs.s, "WITHCOUNT")
	return (TopkListWithcount)(c)
}

func (c TopkListKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c TopkListKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TopkListWithcount Incomplete

func (c TopkListWithcount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c TopkListWithcount) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TopkQuery Incomplete

func (b Builder) TopkQuery() (c TopkQuery) {
	c = TopkQuery{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "TOPK.QUERY")
	return c
}

func (c TopkQuery) Key(key string) TopkQueryKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TopkQueryKey)(c)
}

type TopkQueryItem Incomplete

func (c TopkQueryItem) Item(item ...string) TopkQueryItem {
	c.cs.s = append(c.cs.s, item...)
	return c
}

func (c TopkQueryItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c TopkQueryItem) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TopkQueryKey Incomplete

func (c TopkQueryKey) Item(item ...string) TopkQueryItem {
	c.cs.s = append(c.cs.s, item...)
	return (TopkQueryItem)(c)
}

type TopkReserve Incomplete

func (b Builder) TopkReserve() (c TopkReserve) {
	c = TopkReserve{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TOPK.RESERVE")
	return c
}

func (c TopkReserve) Key(key string) TopkReserveKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TopkReserveKey)(c)
}

type TopkReserveKey Incomplete

func (c TopkReserveKey) Topk(topk int64) TopkReserveTopk {
	c.cs.s = append(c.cs.s, strconv.FormatInt(topk, 10))
	return (TopkReserveTopk)(c)
}

type TopkReserveParamsDecay Incomplete

func (c TopkReserveParamsDecay) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TopkReserveParamsDepth Incomplete

func (c TopkReserveParamsDepth) Decay(decay float64) TopkReserveParamsDecay {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(decay, 'f', -1, 64))
	return (TopkReserveParamsDecay)(c)
}

type TopkReserveParamsWidth Incomplete

func (c TopkReserveParamsWidth) Depth(depth int64) TopkReserveParamsDepth {
	c.cs.s = append(c.cs.s, strconv.FormatInt(depth, 10))
	return (TopkReserveParamsDepth)(c)
}

type TopkReserveTopk Incomplete

func (c TopkReserveTopk) Width(width int64) TopkReserveParamsWidth {
	c.cs.s = append(c.cs.s, strconv.FormatInt(width, 10))
	return (TopkReserveParamsWidth)(c)
}

func (c TopkReserveTopk) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
