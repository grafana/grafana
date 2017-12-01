// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

type optype byte

const (
	condType   optype = iota // only conditions
	selectType               // select
	insertType               // insert
	updateType               // update
	deleteType               // delete
)

type join struct {
	joinType  string
	joinTable string
	joinCond  Cond
}

// Builder describes a SQL statement
type Builder struct {
	optype
	tableName string
	cond      Cond
	selects   []string
	joins     []join
	inserts   Eq
	updates   []Eq
}

// Select creates a select Builder
func Select(cols ...string) *Builder {
	builder := &Builder{cond: NewCond()}
	return builder.Select(cols...)
}

// Insert creates an insert Builder
func Insert(eq Eq) *Builder {
	builder := &Builder{cond: NewCond()}
	return builder.Insert(eq)
}

// Update creates an update Builder
func Update(updates ...Eq) *Builder {
	builder := &Builder{cond: NewCond()}
	return builder.Update(updates...)
}

// Delete creates a delete Builder
func Delete(conds ...Cond) *Builder {
	builder := &Builder{cond: NewCond()}
	return builder.Delete(conds...)
}

// Where sets where SQL
func (b *Builder) Where(cond Cond) *Builder {
	b.cond = b.cond.And(cond)
	return b
}

// From sets the table name
func (b *Builder) From(tableName string) *Builder {
	b.tableName = tableName
	return b
}

// Into sets insert table name
func (b *Builder) Into(tableName string) *Builder {
	b.tableName = tableName
	return b
}

// Join sets join table and contions
func (b *Builder) Join(joinType, joinTable string, joinCond interface{}) *Builder {
	switch joinCond.(type) {
	case Cond:
		b.joins = append(b.joins, join{joinType, joinTable, joinCond.(Cond)})
	case string:
		b.joins = append(b.joins, join{joinType, joinTable, Expr(joinCond.(string))})
	}

	return b
}

// InnerJoin sets inner join
func (b *Builder) InnerJoin(joinTable string, joinCond interface{}) *Builder {
	return b.Join("INNER", joinTable, joinCond)
}

// LeftJoin sets left join SQL
func (b *Builder) LeftJoin(joinTable string, joinCond interface{}) *Builder {
	return b.Join("LEFT", joinTable, joinCond)
}

// RightJoin sets right join SQL
func (b *Builder) RightJoin(joinTable string, joinCond interface{}) *Builder {
	return b.Join("RIGHT", joinTable, joinCond)
}

// CrossJoin sets cross join SQL
func (b *Builder) CrossJoin(joinTable string, joinCond interface{}) *Builder {
	return b.Join("CROSS", joinTable, joinCond)
}

// FullJoin sets full join SQL
func (b *Builder) FullJoin(joinTable string, joinCond interface{}) *Builder {
	return b.Join("FULL", joinTable, joinCond)
}

// Select sets select SQL
func (b *Builder) Select(cols ...string) *Builder {
	b.selects = cols
	b.optype = selectType
	return b
}

// And sets AND condition
func (b *Builder) And(cond Cond) *Builder {
	b.cond = And(b.cond, cond)
	return b
}

// Or sets OR condition
func (b *Builder) Or(cond Cond) *Builder {
	b.cond = Or(b.cond, cond)
	return b
}

// Insert sets insert SQL
func (b *Builder) Insert(eq Eq) *Builder {
	b.inserts = eq
	b.optype = insertType
	return b
}

// Update sets update SQL
func (b *Builder) Update(updates ...Eq) *Builder {
	b.updates = updates
	b.optype = updateType
	return b
}

// Delete sets delete SQL
func (b *Builder) Delete(conds ...Cond) *Builder {
	b.cond = b.cond.And(conds...)
	b.optype = deleteType
	return b
}

// WriteTo implements Writer interface
func (b *Builder) WriteTo(w Writer) error {
	switch b.optype {
	case condType:
		return b.cond.WriteTo(w)
	case selectType:
		return b.selectWriteTo(w)
	case insertType:
		return b.insertWriteTo(w)
	case updateType:
		return b.updateWriteTo(w)
	case deleteType:
		return b.deleteWriteTo(w)
	}

	return ErrNotSupportType
}

// ToSQL convert a builder to SQL and args
func (b *Builder) ToSQL() (string, []interface{}, error) {
	w := NewWriter()
	if err := b.WriteTo(w); err != nil {
		return "", nil, err
	}

	return w.writer.String(), w.args, nil
}

// ToSQL convert a builder or condtions to SQL and args
func ToSQL(cond interface{}) (string, []interface{}, error) {
	switch cond.(type) {
	case Cond:
		return condToSQL(cond.(Cond))
	case *Builder:
		return cond.(*Builder).ToSQL()
	}
	return "", nil, ErrNotSupportType
}
