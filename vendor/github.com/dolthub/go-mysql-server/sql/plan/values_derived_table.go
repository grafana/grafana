package plan

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type ValueDerivedTable struct {
	cols sql.ColSet

	*Values
	name    string
	columns []string
	sch     sql.Schema
	id      sql.TableId
}

var _ sql.Node = (*ValueDerivedTable)(nil)
var _ sql.CollationCoercible = (*ValueDerivedTable)(nil)
var _ TableIdNode = (*ValueDerivedTable)(nil)

func NewValueDerivedTable(values *Values, name string) *ValueDerivedTable {
	var s sql.Schema
	if values.Resolved() && len(values.ExpressionTuples) != 0 {
		s = getSchema(values.ExpressionTuples)
	}
	return &ValueDerivedTable{Values: values, name: name, sch: s}
}

// WithId implements sql.TableIdNode
func (v *ValueDerivedTable) WithId(id sql.TableId) TableIdNode {
	ret := *v
	ret.id = id
	return &ret
}

// Id implements sql.TableIdNode
func (v *ValueDerivedTable) Id() sql.TableId {
	return v.id
}

// WithColumns implements sql.TableIdNode
func (v *ValueDerivedTable) WithColumns(set sql.ColSet) TableIdNode {
	ret := *v
	ret.cols = set
	return &ret
}

// Columns implements sql.TableIdNode
func (v *ValueDerivedTable) Columns() sql.ColSet {
	return v.cols
}

// Name implements sql.Nameable
func (v *ValueDerivedTable) Name() string {
	return v.name
}

// Schema implements the Node interface.
func (v *ValueDerivedTable) Schema() sql.Schema {
	if len(v.ExpressionTuples) == 0 {
		return nil
	}

	schema := make(sql.Schema, len(v.sch))
	for i, col := range v.sch {
		c := *col
		c.Source = v.name
		if len(v.columns) > 0 {
			c.Name = v.columns[i]
		} else {
			c.Name = fmt.Sprintf("column_%d", i)
		}
		schema[i] = &c
	}

	return schema
}

// WithChildren implements the Node interface.
func (v *ValueDerivedTable) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(v, len(children), 0)
	}

	return v, nil
}

// WithExpressions implements the Expressioner interface.
func (v *ValueDerivedTable) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	newValues, err := v.Values.WithExpressions(exprs...)
	if err != nil {
		return nil, err
	}

	nv := *v
	nv.Values = newValues.(*Values)
	if nv.Values.Resolved() && len(nv.Values.ExpressionTuples) != 0 {
		nv.sch = getSchema(nv.Values.ExpressionTuples)
	}
	return &nv, nil
}

func (v *ValueDerivedTable) String() string {
	children := make([]string, len(v.ExpressionTuples))
	for i, tuple := range v.ExpressionTuples {
		var sb strings.Builder
		sb.WriteString("Row(\n")
		for j, e := range tuple {
			if j > 0 {
				sb.WriteString(",")
			}
			sb.WriteString(e.String())
		}
		sb.WriteRune(')')
		children[i] = sb.String()
	}

	tp := sql.NewTreePrinter()
	_ = tp.WriteNode("Values() as %s", v.name)
	_ = tp.WriteChildren(children...)

	return tp.String()
}

func (v *ValueDerivedTable) DebugString() string {
	children := make([]string, len(v.ExpressionTuples))
	for i, tuple := range v.ExpressionTuples {
		var sb strings.Builder
		sb.WriteString("Row(\n")
		for j, e := range tuple {
			if j > 0 {
				sb.WriteString(",")
			}
			sb.WriteString(sql.DebugString(e))
		}
		sb.WriteRune(')')
		children[i] = sb.String()
	}

	tp := sql.NewTreePrinter()
	_ = tp.WriteNode("Values() as %s", v.name)
	_ = tp.WriteChildren(children...)

	return tp.String()
}

func (v ValueDerivedTable) WithColumNames(columns []string) *ValueDerivedTable {
	v.columns = columns
	return &v
}

// getSchema returns schema created with most permissive types by examining all rows.
func getSchema(rows [][]sql.Expression) sql.Schema {
	s := make(sql.Schema, len(rows[0]))

	for _, exprs := range rows {
		for i, val := range exprs {
			if s[i] == nil {
				var name string
				if n, ok := val.(sql.Nameable); ok {
					name = n.Name()
				} else {
					name = val.String()
				}

				s[i] = &sql.Column{Name: name, Type: val.Type(), Nullable: val.IsNullable()}
			} else {
				s[i].Type = getMostPermissiveType(s[i], val)
				if !s[i].Nullable {
					s[i].Nullable = val.IsNullable()
				}
			}
		}
	}

	return s
}

// getMostPermissiveType returns the most permissive type given the current type and the expression type.
// The ordering is "other types < uint < int < decimal (float should be interpreted as decimal) < string"
func getMostPermissiveType(s *sql.Column, e sql.Expression) sql.Type {
	if types.IsText(s.Type) {
		return s.Type
	} else if types.IsText(e.Type()) {
		return e.Type()
	}

	if st, ok := s.Type.(sql.DecimalType); ok {
		et, eok := e.Type().(sql.DecimalType)
		if !eok {
			return s.Type
		}
		// if both are decimal types, get the bigger decimaltype
		frac := st.Scale()
		whole := st.Precision() - frac
		if ep := et.Precision() - et.Scale(); ep > whole {
			whole = ep
		}
		if et.Scale() > frac {
			frac = et.Scale()
		}
		return types.MustCreateDecimalType(whole+frac, frac)
	} else if types.IsDecimal(e.Type()) {
		return e.Type()
	}

	// TODO: float type should be interpreted as decimal type
	if types.IsFloat(s.Type) {
		return s.Type
	} else if types.IsFloat(e.Type()) {
		return types.Float64
	}

	if types.IsSigned(s.Type) {
		return s.Type
	} else if types.IsSigned(e.Type()) {
		return types.Int64
	}

	if types.IsUnsigned(s.Type) {
		return s.Type
	} else if types.IsUnsigned(e.Type()) {
		return types.Uint64
	}

	return s.Type
}
