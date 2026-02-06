package query

import (
	"sync"

	"github.com/mithrandie/csvq/lib/value"
)

type Cell []value.Primary

func NewCell(val value.Primary) Cell {
	return []value.Primary{val}
}

func NewGroupCell(values []value.Primary) Cell {
	return values
}

type RecordSet []Record

func (r RecordSet) Copy() RecordSet {
	records := make(RecordSet, len(r))
	for i, v := range r {
		records[i] = v.Copy()
	}
	return records
}

func (r RecordSet) Merge(r2 RecordSet) RecordSet {
	var recordSet = make(RecordSet, len(r)+len(r2))
	leftLen := len(r)
	for i := range r {
		recordSet[i] = r[i]
	}
	for i := range r2 {
		recordSet[i+leftLen] = r2[i]
	}
	return recordSet
}

type Record []Cell

func NewRecordWithId(internalId int, values []value.Primary) Record {
	record := make(Record, len(values)+1)

	record[0] = NewCell(value.NewInteger(int64(internalId)))

	for i, v := range values {
		record[i+1] = NewCell(v)
	}

	return record
}

func NewRecord(values []value.Primary) Record {
	record := make(Record, len(values))

	for i, v := range values {
		if v == nil {
			record[i] = []value.Primary{}
		} else {
			record[i] = NewCell(v)
		}
	}

	return record
}

func NewEmptyRecord(len int) Record {
	record := make(Record, len, len+2)
	for i := 0; i < len; i++ {
		record[i] = NewCell(value.NewNull())
	}

	return record
}

func (r Record) GroupLen() int {
	return len(r[0])
}

func (r Record) Copy() Record {
	record := make(Record, len(r))
	for i := range r {
		record[i] = r[i]
	}
	return record
}

func (r Record) Merge(r2 Record, pool *sync.Pool) Record {
	var record Record
	if pool != nil {
		record = pool.Get().(Record)
	} else {
		record = make(Record, len(r)+len(r2))
	}
	leftLen := len(r)
	for i := range r {
		record[i] = r[i]
	}
	for i := range r2 {
		record[i+leftLen] = r2[i]
	}
	return record
}

func MergeRecordSetList(list []RecordSet) RecordSet {
	var records RecordSet
	if len(list) == 2 && len(list[1]) == 0 {
		records = list[0]
	} else {
		recordLen := 0
		for _, v := range list {
			recordLen += len(v)
		}
		records = make(RecordSet, recordLen)
		idx := 0
		for _, rset := range list {
			for _, r := range rset {
				records[idx] = r
				idx++
			}
		}
	}
	return records
}
