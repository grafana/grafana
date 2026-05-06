package query

import (
	"strings"

	"github.com/mithrandie/csvq/lib/parser"
)

type AliasMap map[string]string

func (m AliasMap) Add(alias parser.Identifier, path string) error {
	uname := strings.ToUpper(alias.Literal)
	if _, ok := m[uname]; ok {
		return NewDuplicateTableNameError(alias)
	}
	m[uname] = strings.ToUpper(path)
	return nil
}

func (m AliasMap) Get(alias parser.Identifier) (string, error) {
	uname := strings.ToUpper(alias.Literal)
	if fpath, ok := m[uname]; ok {
		return fpath, nil
	}
	return "", NewTableNotLoadedError(alias)
}

func (m AliasMap) Clear() {
	for k := range m {
		delete(m, k)
	}
}
