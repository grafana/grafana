package syntax

import (
	"strings"
)

type Store struct {
	Syntax Syntax
}

func NewStore() *Store {
	return &Store{
		Syntax: CsvqSyntax,
	}
}

func (s Store) Search(keys []string) []Expression {
	exprs := s.searchSyntax(keys, s.Syntax)
	list := make([]string, 0, len(exprs))
	for _, e := range exprs {
		list = append(list, e.Label)
	}
	return exprs
}

func (s Store) searchSyntax(keys []string, syntax Syntax) []Expression {
	if len(keys) < 1 {
		return syntax
	}

	list := make([]Expression, 0, len(syntax))
	for _, exp := range syntax {
		if e := s.search(keys, exp); 0 < len(e.Grammar) || 0 < len(e.Description.Template) {
			list = append(list, e)
		} else if 0 < len(exp.Children) {
			if c := s.searchSyntax(keys, exp.Children); c != nil {
				list = append(list, c...)
			}
		}
	}

	return list
}

func (s Store) search(keys []string, exp Expression) Expression {
	if strings.EqualFold(strings.Join(keys, " "), exp.Label) || s.contains(keys, exp.Label, "") {
		return exp
	}

	defs := make([]Definition, 0, len(exp.Grammar))
	for _, g := range exp.Grammar {
		if s.contains(keys, exp.Label, g.Name.String()) {
			defs = append(defs, g)
		}
	}

	if len(defs) < 1 {
		exp.Description.Template = ""
	}

	exp.Grammar = defs
	return exp
}

func (s Store) contains(keys []string, content string, name string) bool {
	content = strings.ToUpper(content)
	name = strings.ToUpper(name)
	for _, key := range keys {
		if !strings.Contains(content, strings.ToUpper(key)) && !strings.Contains(name, strings.ToUpper(key)) {
			return false
		}
	}
	return true
}
