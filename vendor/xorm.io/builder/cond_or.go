// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import "fmt"

type condOr []Cond

var _ Cond = condOr{}

// Or sets OR conditions
func Or(conds ...Cond) Cond {
	result := make(condOr, 0, len(conds))
	for _, cond := range conds {
		if cond == nil || !cond.IsValid() {
			continue
		}
		result = append(result, cond)
	}
	return result
}

// WriteTo implments Cond
func (o condOr) WriteTo(w Writer) error {
	for i, cond := range o {
		var needQuote bool
		switch cond.(type) {
		case condAnd, *Expression:
			needQuote = true
		case Eq:
			needQuote = (len(cond.(Eq)) > 1)
		case Neq:
			needQuote = (len(cond.(Neq)) > 1)
		}

		if needQuote {
			fmt.Fprint(w, "(")
		}

		err := cond.WriteTo(w)
		if err != nil {
			return err
		}

		if needQuote {
			fmt.Fprint(w, ")")
		}

		if i != len(o)-1 {
			fmt.Fprint(w, " OR ")
		}
	}

	return nil
}

func (o condOr) And(conds ...Cond) Cond {
	return And(o, And(conds...))
}

func (o condOr) Or(conds ...Cond) Cond {
	return Or(o, Or(conds...))
}

func (o condOr) IsValid() bool {
	return len(o) > 0
}
