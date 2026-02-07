package query

import (
	"context"
	"strings"

	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"
)

type VariableMap struct {
	*SyncMap
}

func NewVariableMap() VariableMap {
	return VariableMap{
		NewSyncMap(),
	}
}

func (m VariableMap) IsEmpty() bool {
	return m.SyncMap == nil
}

func (m VariableMap) Store(name string, val value.Primary) {
	m.store(name, val)
}

func (m VariableMap) LoadDirect(name string) (interface{}, bool) {
	return m.load(strings.ToUpper(name))
}

func (m VariableMap) Load(name string) (value.Primary, bool) {
	if v, ok := m.load(name); ok {
		return v.(value.Primary), true
	}
	return nil, false
}

func (m VariableMap) Delete(name string) {
	m.delete(name)
}

func (m VariableMap) Exists(name string) bool {
	return m.exists(name)
}

func (m VariableMap) Add(variable parser.Variable, val value.Primary) error {
	if m.Exists(variable.Name) {
		return NewVariableRedeclaredError(variable)
	}
	m.Store(variable.Name, val)
	return nil
}

func (m VariableMap) Set(variable parser.Variable, val value.Primary) bool {
	if !m.Exists(variable.Name) {
		return false
	}
	m.Store(variable.Name, val)
	return true
}

func (m VariableMap) Get(variable parser.Variable) (value.Primary, bool) {
	if v, ok := m.Load(variable.Name); ok {
		return v, ok
	}
	return nil, false
}

func (m VariableMap) Dispose(variable parser.Variable) bool {
	if !m.Exists(variable.Name) {
		return false
	}
	m.Delete(variable.Name)
	return true
}

func (m VariableMap) Declare(ctx context.Context, scope *ReferenceScope, declaration parser.VariableDeclaration) error {
	for _, assignment := range declaration.Assignments {
		var val value.Primary
		var err error
		if assignment.Value == nil {
			val = value.NewNull()
		} else {
			val, err = Evaluate(ctx, scope, assignment.Value)
			if err != nil {
				return err
			}
		}
		err = m.Add(assignment.Variable, val)
		if err != nil {
			return err
		}
	}
	return nil
}
