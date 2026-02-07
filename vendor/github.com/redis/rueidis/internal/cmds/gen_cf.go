// Code generated DO NOT EDIT

package cmds

import "strconv"

type CfAdd Incomplete

func (b Builder) CfAdd() (c CfAdd) {
	c = CfAdd{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CF.ADD")
	return c
}

func (c CfAdd) Key(key string) CfAddKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfAddKey)(c)
}

type CfAddItem Incomplete

func (c CfAddItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfAddKey Incomplete

func (c CfAddKey) Item(item string) CfAddItem {
	c.cs.s = append(c.cs.s, item)
	return (CfAddItem)(c)
}

type CfAddnx Incomplete

func (b Builder) CfAddnx() (c CfAddnx) {
	c = CfAddnx{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CF.ADDNX")
	return c
}

func (c CfAddnx) Key(key string) CfAddnxKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfAddnxKey)(c)
}

type CfAddnxItem Incomplete

func (c CfAddnxItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfAddnxKey Incomplete

func (c CfAddnxKey) Item(item string) CfAddnxItem {
	c.cs.s = append(c.cs.s, item)
	return (CfAddnxItem)(c)
}

type CfCount Incomplete

func (b Builder) CfCount() (c CfCount) {
	c = CfCount{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "CF.COUNT")
	return c
}

func (c CfCount) Key(key string) CfCountKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfCountKey)(c)
}

type CfCountItem Incomplete

func (c CfCountItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c CfCountItem) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfCountKey Incomplete

func (c CfCountKey) Item(item string) CfCountItem {
	c.cs.s = append(c.cs.s, item)
	return (CfCountItem)(c)
}

type CfDel Incomplete

func (b Builder) CfDel() (c CfDel) {
	c = CfDel{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CF.DEL")
	return c
}

func (c CfDel) Key(key string) CfDelKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfDelKey)(c)
}

type CfDelItem Incomplete

func (c CfDelItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfDelKey Incomplete

func (c CfDelKey) Item(item string) CfDelItem {
	c.cs.s = append(c.cs.s, item)
	return (CfDelItem)(c)
}

type CfExists Incomplete

func (b Builder) CfExists() (c CfExists) {
	c = CfExists{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "CF.EXISTS")
	return c
}

func (c CfExists) Key(key string) CfExistsKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfExistsKey)(c)
}

type CfExistsItem Incomplete

func (c CfExistsItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c CfExistsItem) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfExistsKey Incomplete

func (c CfExistsKey) Item(item string) CfExistsItem {
	c.cs.s = append(c.cs.s, item)
	return (CfExistsItem)(c)
}

type CfInfo Incomplete

func (b Builder) CfInfo() (c CfInfo) {
	c = CfInfo{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "CF.INFO")
	return c
}

func (c CfInfo) Key(key string) CfInfoKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfInfoKey)(c)
}

type CfInfoKey Incomplete

func (c CfInfoKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c CfInfoKey) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfInsert Incomplete

func (b Builder) CfInsert() (c CfInsert) {
	c = CfInsert{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CF.INSERT")
	return c
}

func (c CfInsert) Key(key string) CfInsertKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfInsertKey)(c)
}

type CfInsertCapacity Incomplete

func (c CfInsertCapacity) Nocreate() CfInsertNocreate {
	c.cs.s = append(c.cs.s, "NOCREATE")
	return (CfInsertNocreate)(c)
}

func (c CfInsertCapacity) Items() CfInsertItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (CfInsertItems)(c)
}

type CfInsertItem Incomplete

func (c CfInsertItem) Item(item ...string) CfInsertItem {
	c.cs.s = append(c.cs.s, item...)
	return c
}

func (c CfInsertItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfInsertItems Incomplete

func (c CfInsertItems) Item(item ...string) CfInsertItem {
	c.cs.s = append(c.cs.s, item...)
	return (CfInsertItem)(c)
}

type CfInsertKey Incomplete

func (c CfInsertKey) Capacity(capacity int64) CfInsertCapacity {
	c.cs.s = append(c.cs.s, "CAPACITY", strconv.FormatInt(capacity, 10))
	return (CfInsertCapacity)(c)
}

func (c CfInsertKey) Nocreate() CfInsertNocreate {
	c.cs.s = append(c.cs.s, "NOCREATE")
	return (CfInsertNocreate)(c)
}

func (c CfInsertKey) Items() CfInsertItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (CfInsertItems)(c)
}

type CfInsertNocreate Incomplete

func (c CfInsertNocreate) Items() CfInsertItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (CfInsertItems)(c)
}

type CfInsertnx Incomplete

func (b Builder) CfInsertnx() (c CfInsertnx) {
	c = CfInsertnx{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CF.INSERTNX")
	return c
}

func (c CfInsertnx) Key(key string) CfInsertnxKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfInsertnxKey)(c)
}

type CfInsertnxCapacity Incomplete

func (c CfInsertnxCapacity) Nocreate() CfInsertnxNocreate {
	c.cs.s = append(c.cs.s, "NOCREATE")
	return (CfInsertnxNocreate)(c)
}

func (c CfInsertnxCapacity) Items() CfInsertnxItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (CfInsertnxItems)(c)
}

type CfInsertnxItem Incomplete

func (c CfInsertnxItem) Item(item ...string) CfInsertnxItem {
	c.cs.s = append(c.cs.s, item...)
	return c
}

func (c CfInsertnxItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfInsertnxItems Incomplete

func (c CfInsertnxItems) Item(item ...string) CfInsertnxItem {
	c.cs.s = append(c.cs.s, item...)
	return (CfInsertnxItem)(c)
}

type CfInsertnxKey Incomplete

func (c CfInsertnxKey) Capacity(capacity int64) CfInsertnxCapacity {
	c.cs.s = append(c.cs.s, "CAPACITY", strconv.FormatInt(capacity, 10))
	return (CfInsertnxCapacity)(c)
}

func (c CfInsertnxKey) Nocreate() CfInsertnxNocreate {
	c.cs.s = append(c.cs.s, "NOCREATE")
	return (CfInsertnxNocreate)(c)
}

func (c CfInsertnxKey) Items() CfInsertnxItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (CfInsertnxItems)(c)
}

type CfInsertnxNocreate Incomplete

func (c CfInsertnxNocreate) Items() CfInsertnxItems {
	c.cs.s = append(c.cs.s, "ITEMS")
	return (CfInsertnxItems)(c)
}

type CfLoadchunk Incomplete

func (b Builder) CfLoadchunk() (c CfLoadchunk) {
	c = CfLoadchunk{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CF.LOADCHUNK")
	return c
}

func (c CfLoadchunk) Key(key string) CfLoadchunkKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfLoadchunkKey)(c)
}

type CfLoadchunkData Incomplete

func (c CfLoadchunkData) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfLoadchunkIterator Incomplete

func (c CfLoadchunkIterator) Data(data string) CfLoadchunkData {
	c.cs.s = append(c.cs.s, data)
	return (CfLoadchunkData)(c)
}

type CfLoadchunkKey Incomplete

func (c CfLoadchunkKey) Iterator(iterator int64) CfLoadchunkIterator {
	c.cs.s = append(c.cs.s, strconv.FormatInt(iterator, 10))
	return (CfLoadchunkIterator)(c)
}

type CfMexists Incomplete

func (b Builder) CfMexists() (c CfMexists) {
	c = CfMexists{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CF.MEXISTS")
	return c
}

func (c CfMexists) Key(key string) CfMexistsKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfMexistsKey)(c)
}

type CfMexistsItem Incomplete

func (c CfMexistsItem) Item(item ...string) CfMexistsItem {
	c.cs.s = append(c.cs.s, item...)
	return c
}

func (c CfMexistsItem) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfMexistsKey Incomplete

func (c CfMexistsKey) Item(item ...string) CfMexistsItem {
	c.cs.s = append(c.cs.s, item...)
	return (CfMexistsItem)(c)
}

type CfReserve Incomplete

func (b Builder) CfReserve() (c CfReserve) {
	c = CfReserve{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CF.RESERVE")
	return c
}

func (c CfReserve) Key(key string) CfReserveKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfReserveKey)(c)
}

type CfReserveBucketsize Incomplete

func (c CfReserveBucketsize) Maxiterations(maxiterations int64) CfReserveMaxiterations {
	c.cs.s = append(c.cs.s, "MAXITERATIONS", strconv.FormatInt(maxiterations, 10))
	return (CfReserveMaxiterations)(c)
}

func (c CfReserveBucketsize) Expansion(expansion int64) CfReserveExpansion {
	c.cs.s = append(c.cs.s, "EXPANSION", strconv.FormatInt(expansion, 10))
	return (CfReserveExpansion)(c)
}

func (c CfReserveBucketsize) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfReserveCapacity Incomplete

func (c CfReserveCapacity) Bucketsize(bucketsize int64) CfReserveBucketsize {
	c.cs.s = append(c.cs.s, "BUCKETSIZE", strconv.FormatInt(bucketsize, 10))
	return (CfReserveBucketsize)(c)
}

func (c CfReserveCapacity) Maxiterations(maxiterations int64) CfReserveMaxiterations {
	c.cs.s = append(c.cs.s, "MAXITERATIONS", strconv.FormatInt(maxiterations, 10))
	return (CfReserveMaxiterations)(c)
}

func (c CfReserveCapacity) Expansion(expansion int64) CfReserveExpansion {
	c.cs.s = append(c.cs.s, "EXPANSION", strconv.FormatInt(expansion, 10))
	return (CfReserveExpansion)(c)
}

func (c CfReserveCapacity) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfReserveExpansion Incomplete

func (c CfReserveExpansion) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfReserveKey Incomplete

func (c CfReserveKey) Capacity(capacity int64) CfReserveCapacity {
	c.cs.s = append(c.cs.s, strconv.FormatInt(capacity, 10))
	return (CfReserveCapacity)(c)
}

type CfReserveMaxiterations Incomplete

func (c CfReserveMaxiterations) Expansion(expansion int64) CfReserveExpansion {
	c.cs.s = append(c.cs.s, "EXPANSION", strconv.FormatInt(expansion, 10))
	return (CfReserveExpansion)(c)
}

func (c CfReserveMaxiterations) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfScandump Incomplete

func (b Builder) CfScandump() (c CfScandump) {
	c = CfScandump{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "CF.SCANDUMP")
	return c
}

func (c CfScandump) Key(key string) CfScandumpKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (CfScandumpKey)(c)
}

type CfScandumpIterator Incomplete

func (c CfScandumpIterator) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type CfScandumpKey Incomplete

func (c CfScandumpKey) Iterator(iterator int64) CfScandumpIterator {
	c.cs.s = append(c.cs.s, strconv.FormatInt(iterator, 10))
	return (CfScandumpIterator)(c)
}
