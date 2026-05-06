package query

import (
	"strings"

	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"
)

type PreparedStatementMap struct {
	*SyncMap
}

func NewPreparedStatementMap() PreparedStatementMap {
	return PreparedStatementMap{
		NewSyncMap(),
	}
}

func (m PreparedStatementMap) Store(name string, statement *PreparedStatement) {
	m.store(strings.ToUpper(name), statement)
}

func (m PreparedStatementMap) LoadDirect(name string) (interface{}, bool) {
	return m.load(strings.ToUpper(name))
}

func (m PreparedStatementMap) Load(name string) (*PreparedStatement, bool) {
	if v, ok := m.load(strings.ToUpper(name)); ok {
		return v.(*PreparedStatement), true
	}
	return nil, false
}

func (m PreparedStatementMap) Delete(name string) {
	m.delete(strings.ToUpper(name))
}

func (m PreparedStatementMap) Exists(name string) bool {
	return m.exists(strings.ToUpper(name))
}

func (m PreparedStatementMap) Prepare(flags *option.Flags, expr parser.StatementPreparation) error {
	stmt, err := NewPreparedStatement(flags, expr)
	if err != nil {
		return err
	}

	if m.Exists(expr.Name.Literal) {
		return NewDuplicateStatementNameError(expr.Name)
	}
	m.Store(expr.Name.Literal, stmt)
	return nil
}

func (m PreparedStatementMap) Get(name parser.Identifier) (*PreparedStatement, error) {
	if stmt, ok := m.Load(name.Literal); ok {
		return stmt, nil
	}
	return nil, NewStatementNotExistError(name)
}

func (m PreparedStatementMap) Dispose(expr parser.DisposeStatement) error {
	if !m.Exists(expr.Name.Literal) {
		return NewStatementNotExistError(expr.Name)
	}
	m.Delete(expr.Name.Literal)
	return nil
}

type PreparedStatement struct {
	Name            string
	StatementString string
	Statements      []parser.Statement
	HolderNumber    int
}

func NewPreparedStatement(flags *option.Flags, expr parser.StatementPreparation) (*PreparedStatement, error) {
	statements, holderNum, err := parser.Parse(expr.Statement.Raw(), expr.Name.Literal, true, flags.AnsiQuotes)
	if err != nil {
		return nil, NewPreparedStatementSyntaxError(err.(*parser.SyntaxError))
	}

	return &PreparedStatement{
		Name:            expr.Name.Literal,
		StatementString: expr.Statement.Raw(),
		Statements:      statements,
		HolderNumber:    holderNum,
	}, nil
}

type ReplaceValues struct {
	Values []parser.QueryExpression
	Names  map[string]int
}

func NewReplaceValues(replace []parser.ReplaceValue) *ReplaceValues {
	values := make([]parser.QueryExpression, 0, len(replace))
	names := make(map[string]int, len(replace))

	for i := range replace {
		if 0 < len(replace[i].Name.Literal) {
			names[replace[i].Name.Literal] = i
		}
		values = append(values, replace[i].Value)
	}

	return &ReplaceValues{
		Values: values,
		Names:  names,
	}
}
