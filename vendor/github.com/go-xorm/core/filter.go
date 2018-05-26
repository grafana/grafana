package core

import (
	"fmt"
	"strings"
)

// Filter is an interface to filter SQL
type Filter interface {
	Do(sql string, dialect Dialect, table *Table) string
}

// QuoteFilter filter SQL replace ` to database's own quote character
type QuoteFilter struct {
}

func (s *QuoteFilter) Do(sql string, dialect Dialect, table *Table) string {
	return strings.Replace(sql, "`", dialect.QuoteStr(), -1)
}

// IdFilter filter SQL replace (id) to primary key column name
type IdFilter struct {
}

type Quoter struct {
	dialect Dialect
}

func NewQuoter(dialect Dialect) *Quoter {
	return &Quoter{dialect}
}

func (q *Quoter) Quote(content string) string {
	return q.dialect.QuoteStr() + content + q.dialect.QuoteStr()
}

func (i *IdFilter) Do(sql string, dialect Dialect, table *Table) string {
	quoter := NewQuoter(dialect)
	if table != nil && len(table.PrimaryKeys) == 1 {
		sql = strings.Replace(sql, " `(id)` ", " "+quoter.Quote(table.PrimaryKeys[0])+" ", -1)
		sql = strings.Replace(sql, " "+quoter.Quote("(id)")+" ", " "+quoter.Quote(table.PrimaryKeys[0])+" ", -1)
		return strings.Replace(sql, " (id) ", " "+quoter.Quote(table.PrimaryKeys[0])+" ", -1)
	}
	return sql
}

// SeqFilter filter SQL replace ?, ? ... to $1, $2 ...
type SeqFilter struct {
	Prefix string
	Start  int
}

func (s *SeqFilter) Do(sql string, dialect Dialect, table *Table) string {
	segs := strings.Split(sql, "?")
	size := len(segs)
	res := ""
	for i, c := range segs {
		if i < size-1 {
			res += c + fmt.Sprintf("%s%v", s.Prefix, i+s.Start)
		}
	}
	res += segs[size-1]
	return res
}
