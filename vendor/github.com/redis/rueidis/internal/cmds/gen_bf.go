// Code generated DO NOT EDIT

package cmds

import "strconv"

type BfAdd Incomplete

func (b Builder) BfAdd() (c BfAdd) {
	c = BfAdd{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "BF.ADD")
	return c
}

func (c BfAdd) Key(key string) BfAddKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BfAddKey)(c)
}

type BfAddItem Incomplete

func (c BfAddItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfAddKey Incomplete

func (c BfAddKey) Item(item string) BfAddItem {
	c.cs.s = append(c.cs.s, item)
	return (BfAddItem)(c)
}

type BfCard Incomplete

func (b Builder) BfCard() (c BfCard) {
	c = BfCard{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "BF.CARD")
	return c
}

func (c BfCard) Key(key string) BfCardKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BfCardKey)(c)
}

type BfCardKey Incomplete

func (c BfCardKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfExists Incomplete

func (b Builder) BfExists() (c BfExists) {
	c = BfExists{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "BF.EXISTS")
	return c
}

func (c BfExists) Key(key string) BfExistsKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BfExistsKey)(c)
}

type BfExistsItem Incomplete

func (c BfExistsItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BfExistsItem) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfExistsKey Incomplete

func (c BfExistsKey) Item(item string) BfExistsItem {
	c.cs.s = append(c.cs.s, item)
	return (BfExistsItem)(c)
}

type BfInfo Incomplete

func (b Builder) BfInfo() (c BfInfo) {
	c = BfInfo{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "BF.INFO")
	return c
}

func (c BfInfo) Key(key string) BfInfoKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BfInfoKey)(c)
}

type BfInfoKey Incomplete

func (c BfInfoKey) Capacity() BfInfoSingleValueCapacity {
	c.cs.s = append(c.cs.s, "CAPACITY")
	return (BfInfoSingleValueCapacity)(c)
}

func (c BfInfoKey) Size() BfInfoSingleValueSize {
	c.cs.s = append(c.cs.s, "SIZE")
	return (BfInfoSingleValueSize)(c)
}

func (c BfInfoKey) Filters() BfInfoSingleValueFilters {
	c.cs.s = append(c.cs.s, "FILTERS")
	return (BfInfoSingleValueFilters)(c)
}

func (c BfInfoKey) Items() BfInfoSingleValueItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (BfInfoSingleValueItems)(c)
}

func (c BfInfoKey) Expansion() BfInfoSingleValueExpansion {
	c.cs.s = append(c.cs.s, "EXPANSION")
	return (BfInfoSingleValueExpansion)(c)
}

func (c BfInfoKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BfInfoKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfInfoSingleValueCapacity Incomplete

func (c BfInfoSingleValueCapacity) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BfInfoSingleValueCapacity) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfInfoSingleValueExpansion Incomplete

func (c BfInfoSingleValueExpansion) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BfInfoSingleValueExpansion) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfInfoSingleValueFilters Incomplete

func (c BfInfoSingleValueFilters) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BfInfoSingleValueFilters) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfInfoSingleValueItems Incomplete

func (c BfInfoSingleValueItems) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BfInfoSingleValueItems) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfInfoSingleValueSize Incomplete

func (c BfInfoSingleValueSize) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c BfInfoSingleValueSize) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfInsert Incomplete

func (b Builder) BfInsert() (c BfInsert) {
	c = BfInsert{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "BF.INSERT")
	return c
}

func (c BfInsert) Key(key string) BfInsertKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BfInsertKey)(c)
}

type BfInsertCapacity Incomplete

func (c BfInsertCapacity) Error(error float64) BfInsertError {
	c.cs.s = append(c.cs.s, "ERROR", strconv.FormatFloat(error, 'f', -1, 64))
	return (BfInsertError)(c)
}

func (c BfInsertCapacity) Expansion(expansion int64) BfInsertExpansion {
	c.cs.s = append(c.cs.s, "EXPANSION", strconv.FormatInt(expansion, 10))
	return (BfInsertExpansion)(c)
}

func (c BfInsertCapacity) Nocreate() BfInsertNocreate {
	c.cs.s = append(c.cs.s, "NOCREATE")
	return (BfInsertNocreate)(c)
}

func (c BfInsertCapacity) Nonscaling() BfInsertNonscaling {
	c.cs.s = append(c.cs.s, "NONSCALING")
	return (BfInsertNonscaling)(c)
}

func (c BfInsertCapacity) Items() BfInsertItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (BfInsertItems)(c)
}

type BfInsertError Incomplete

func (c BfInsertError) Expansion(expansion int64) BfInsertExpansion {
	c.cs.s = append(c.cs.s, "EXPANSION", strconv.FormatInt(expansion, 10))
	return (BfInsertExpansion)(c)
}

func (c BfInsertError) Nocreate() BfInsertNocreate {
	c.cs.s = append(c.cs.s, "NOCREATE")
	return (BfInsertNocreate)(c)
}

func (c BfInsertError) Nonscaling() BfInsertNonscaling {
	c.cs.s = append(c.cs.s, "NONSCALING")
	return (BfInsertNonscaling)(c)
}

func (c BfInsertError) Items() BfInsertItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (BfInsertItems)(c)
}

type BfInsertExpansion Incomplete

func (c BfInsertExpansion) Nocreate() BfInsertNocreate {
	c.cs.s = append(c.cs.s, "NOCREATE")
	return (BfInsertNocreate)(c)
}

func (c BfInsertExpansion) Nonscaling() BfInsertNonscaling {
	c.cs.s = append(c.cs.s, "NONSCALING")
	return (BfInsertNonscaling)(c)
}

func (c BfInsertExpansion) Items() BfInsertItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (BfInsertItems)(c)
}

type BfInsertItem Incomplete

func (c BfInsertItem) Item(item ...string) BfInsertItem {
	c.cs.s = append(c.cs.s, item...)
	return c
}

func (c BfInsertItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfInsertItems Incomplete

func (c BfInsertItems) Item(item ...string) BfInsertItem {
	c.cs.s = append(c.cs.s, item...)
	return (BfInsertItem)(c)
}

type BfInsertKey Incomplete

func (c BfInsertKey) Capacity(capacity int64) BfInsertCapacity {
	c.cs.s = append(c.cs.s, "CAPACITY", strconv.FormatInt(capacity, 10))
	return (BfInsertCapacity)(c)
}

func (c BfInsertKey) Error(error float64) BfInsertError {
	c.cs.s = append(c.cs.s, "ERROR", strconv.FormatFloat(error, 'f', -1, 64))
	return (BfInsertError)(c)
}

func (c BfInsertKey) Expansion(expansion int64) BfInsertExpansion {
	c.cs.s = append(c.cs.s, "EXPANSION", strconv.FormatInt(expansion, 10))
	return (BfInsertExpansion)(c)
}

func (c BfInsertKey) Nocreate() BfInsertNocreate {
	c.cs.s = append(c.cs.s, "NOCREATE")
	return (BfInsertNocreate)(c)
}

func (c BfInsertKey) Nonscaling() BfInsertNonscaling {
	c.cs.s = append(c.cs.s, "NONSCALING")
	return (BfInsertNonscaling)(c)
}

func (c BfInsertKey) Items() BfInsertItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (BfInsertItems)(c)
}

type BfInsertNocreate Incomplete

func (c BfInsertNocreate) Nonscaling() BfInsertNonscaling {
	c.cs.s = append(c.cs.s, "NONSCALING")
	return (BfInsertNonscaling)(c)
}

func (c BfInsertNocreate) Items() BfInsertItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (BfInsertItems)(c)
}

type BfInsertNonscaling Incomplete

func (c BfInsertNonscaling) Items() BfInsertItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (BfInsertItems)(c)
}

type BfLoadchunk Incomplete

func (b Builder) BfLoadchunk() (c BfLoadchunk) {
	c = BfLoadchunk{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "BF.LOADCHUNK")
	return c
}

func (c BfLoadchunk) Key(key string) BfLoadchunkKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BfLoadchunkKey)(c)
}

type BfLoadchunkData Incomplete

func (c BfLoadchunkData) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfLoadchunkIterator Incomplete

func (c BfLoadchunkIterator) Data(data string) BfLoadchunkData {
	c.cs.s = append(c.cs.s, data)
	return (BfLoadchunkData)(c)
}

type BfLoadchunkKey Incomplete

func (c BfLoadchunkKey) Iterator(iterator int64) BfLoadchunkIterator {
	c.cs.s = append(c.cs.s, strconv.FormatInt(iterator, 10))
	return (BfLoadchunkIterator)(c)
}

type BfMadd Incomplete

func (b Builder) BfMadd() (c BfMadd) {
	c = BfMadd{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "BF.MADD")
	return c
}

func (c BfMadd) Key(key string) BfMaddKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BfMaddKey)(c)
}

type BfMaddItem Incomplete

func (c BfMaddItem) Item(item ...string) BfMaddItem {
	c.cs.s = append(c.cs.s, item...)
	return c
}

func (c BfMaddItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfMaddKey Incomplete

func (c BfMaddKey) Item(item ...string) BfMaddItem {
	c.cs.s = append(c.cs.s, item...)
	return (BfMaddItem)(c)
}

type BfMexists Incomplete

func (b Builder) BfMexists() (c BfMexists) {
	c = BfMexists{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "BF.MEXISTS")
	return c
}

func (c BfMexists) Key(key string) BfMexistsKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BfMexistsKey)(c)
}

type BfMexistsItem Incomplete

func (c BfMexistsItem) Item(item ...string) BfMexistsItem {
	c.cs.s = append(c.cs.s, item...)
	return c
}

func (c BfMexistsItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfMexistsKey Incomplete

func (c BfMexistsKey) Item(item ...string) BfMexistsItem {
	c.cs.s = append(c.cs.s, item...)
	return (BfMexistsItem)(c)
}

type BfReserve Incomplete

func (b Builder) BfReserve() (c BfReserve) {
	c = BfReserve{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "BF.RESERVE")
	return c
}

func (c BfReserve) Key(key string) BfReserveKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BfReserveKey)(c)
}

type BfReserveCapacity Incomplete

func (c BfReserveCapacity) Expansion(expansion int64) BfReserveExpansion {
	c.cs.s = append(c.cs.s, "EXPANSION", strconv.FormatInt(expansion, 10))
	return (BfReserveExpansion)(c)
}

func (c BfReserveCapacity) Nonscaling() BfReserveNonscaling {
	c.cs.s = append(c.cs.s, "NONSCALING")
	return (BfReserveNonscaling)(c)
}

func (c BfReserveCapacity) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfReserveErrorRate Incomplete

func (c BfReserveErrorRate) Capacity(capacity int64) BfReserveCapacity {
	c.cs.s = append(c.cs.s, strconv.FormatInt(capacity, 10))
	return (BfReserveCapacity)(c)
}

type BfReserveExpansion Incomplete

func (c BfReserveExpansion) Nonscaling() BfReserveNonscaling {
	c.cs.s = append(c.cs.s, "NONSCALING")
	return (BfReserveNonscaling)(c)
}

func (c BfReserveExpansion) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfReserveKey Incomplete

func (c BfReserveKey) ErrorRate(errorRate float64) BfReserveErrorRate {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(errorRate, 'f', -1, 64))
	return (BfReserveErrorRate)(c)
}

type BfReserveNonscaling Incomplete

func (c BfReserveNonscaling) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfScandump Incomplete

func (b Builder) BfScandump() (c BfScandump) {
	c = BfScandump{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "BF.SCANDUMP")
	return c
}

func (c BfScandump) Key(key string) BfScandumpKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (BfScandumpKey)(c)
}

type BfScandumpIterator Incomplete

func (c BfScandumpIterator) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type BfScandumpKey Incomplete

func (c BfScandumpKey) Iterator(iterator int64) BfScandumpIterator {
	c.cs.s = append(c.cs.s, strconv.FormatInt(iterator, 10))
	return (BfScandumpIterator)(c)
}
