// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"fmt"
)

// Select creates a select Builder
func Select(cols ...string) *Builder {
	builder := &Builder{cond: NewCond()}
	return builder.Select(cols...)
}

func (b *Builder) selectWriteTo(w Writer) error {
	if len(b.from) <= 0 && !b.isNested {
		return ErrNoTableName
	}

	// perform limit before writing to writer when b.dialect between ORACLE and MSSQL
	// this avoid a duplicate writing problem in simple limit query
	if b.limitation != nil && (b.dialect == ORACLE || b.dialect == MSSQL) {
		return b.limitWriteTo(w)
	}

	if _, err := fmt.Fprint(w, "SELECT "); err != nil {
		return err
	}
	if len(b.selects) > 0 {
		for i, s := range b.selects {
			if _, err := fmt.Fprint(w, s); err != nil {
				return err
			}
			if i != len(b.selects)-1 {
				if _, err := fmt.Fprint(w, ","); err != nil {
					return err
				}
			}
		}
	} else {
		if _, err := fmt.Fprint(w, "*"); err != nil {
			return err
		}
	}

	if b.subQuery == nil {
		if _, err := fmt.Fprint(w, " FROM ", b.from); err != nil {
			return err
		}
	} else {
		if b.cond.IsValid() && len(b.from) <= 0 {
			return ErrUnnamedDerivedTable
		}
		if b.subQuery.dialect != "" && b.dialect != b.subQuery.dialect {
			return ErrInconsistentDialect
		}

		// dialect of sub-query will inherit from the main one (if not set up)
		if b.dialect != "" && b.subQuery.dialect == "" {
			b.subQuery.dialect = b.dialect
		}

		switch b.subQuery.optype {
		case selectType, setOpType:
			fmt.Fprint(w, " FROM (")
			if err := b.subQuery.WriteTo(w); err != nil {
				return err
			}

			if len(b.from) == 0 {
				fmt.Fprintf(w, ")")
			} else {
				fmt.Fprintf(w, ") %v", b.from)
			}
		default:
			return ErrUnexpectedSubQuery
		}
	}

	if err := b.joins.WriteTo(w); err != nil {
		return err
	}

	if b.cond.IsValid() {
		if _, err := fmt.Fprint(w, " WHERE "); err != nil {
			return err
		}

		if err := b.cond.WriteTo(w); err != nil {
			return err
		}
	}

	if len(b.groupBy) > 0 {
		if _, err := fmt.Fprint(w, " GROUP BY ", b.groupBy); err != nil {
			return err
		}
	}

	if b.having != nil {
		switch c := b.having.(type) {
		case string:
			if len(c) > 0 {
				if _, err := fmt.Fprint(w, " HAVING ", c); err != nil {
					return err
				}
			}
		case Cond:
			if c.IsValid() {
				if _, err := fmt.Fprint(w, " HAVING "); err != nil {
					return err
				}
				if err := c.WriteTo(w); err != nil {
					return err
				}
			}
		default:
			return fmt.Errorf("unknown having parameter: %#v", b.having)
		}
	}

	if b.orderBy != nil {
		switch c := b.orderBy.(type) {
		case string:
			if len(c) > 0 {
				if _, err := fmt.Fprint(w, " ORDER BY ", c); err != nil {
					return err
				}
			}
		case *Expression:
			if _, err := fmt.Fprint(w, " ORDER BY "); err != nil {
				return err
			}
			if err := c.WriteTo(w); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unknow orderby parameter: %#v", b.orderBy)
		}
	}

	if b.limitation != nil {
		if err := b.limitWriteTo(w); err != nil {
			return err
		}
	}

	return nil
}

// OrderBy orderBy SQL
func (b *Builder) OrderBy(orderBy interface{}) *Builder {
	b.orderBy = orderBy
	return b
}

// GroupBy groupby SQL
func (b *Builder) GroupBy(groupby string) *Builder {
	b.groupBy = groupby
	return b
}

// Having having SQL
func (b *Builder) Having(having interface{}) *Builder {
	b.having = having
	return b
}
