// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"fmt"
)

// InnerJoin sets inner join
func (b *Builder) InnerJoin(joinTable, joinCond interface{}) *Builder {
	return b.Join("INNER", joinTable, joinCond)
}

// LeftJoin sets left join SQL
func (b *Builder) LeftJoin(joinTable, joinCond interface{}) *Builder {
	return b.Join("LEFT", joinTable, joinCond)
}

// RightJoin sets right join SQL
func (b *Builder) RightJoin(joinTable, joinCond interface{}) *Builder {
	return b.Join("RIGHT", joinTable, joinCond)
}

// CrossJoin sets cross join SQL
func (b *Builder) CrossJoin(joinTable, joinCond interface{}) *Builder {
	return b.Join("CROSS", joinTable, joinCond)
}

// FullJoin sets full join SQL
func (b *Builder) FullJoin(joinTable, joinCond interface{}) *Builder {
	return b.Join("FULL", joinTable, joinCond)
}

// Join sets join table and conditions
func (b *Builder) Join(joinType string, joinTable, joinCond interface{}) *Builder {
	switch joinCond.(type) {
	case Cond:
		b.joins = append(b.joins, join{joinType, joinTable, joinCond.(Cond)})
	case string:
		b.joins = append(b.joins, join{joinType, joinTable, Expr(joinCond.(string))})
	}

	return b
}

type joins []join

func (joins joins) WriteTo(w Writer) error {
	for _, v := range joins {
		var joinTable = v.joinTable
		var alias string
		if aliased, ok := v.joinTable.(*Aliased); ok {
			joinTable = aliased.table
			alias = aliased.alias + " "
		}

		switch tbl := joinTable.(type) {
		case *Builder:
			if _, err := fmt.Fprintf(w, " %s JOIN (", v.joinType); err != nil {
				return err
			}
			if err := tbl.WriteTo(w); err != nil {
				return err
			}
			if _, err := fmt.Fprintf(w, ") %s", alias); err != nil {
				return err
			}
		case string:
			if _, err := fmt.Fprintf(w, " %s JOIN %s %s", v.joinType, tbl, alias); err != nil {
				return err
			}
		}
		if _, err := fmt.Fprintf(w, "ON "); err != nil {
			return err
		}

		if err := v.joinCond.WriteTo(w); err != nil {
			return err
		}
	}

	return nil
}
