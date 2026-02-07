// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import "fmt"

type condAnd []Cond

var _ Cond = condAnd{}

// And generates AND conditions
func And(conds ...Cond) Cond {
	result := make(condAnd, 0, len(conds))
	for _, cond := range conds {
		if cond == nil || !cond.IsValid() {
			continue
		}
		result = append(result, cond)
	}
	return result
}

func (and condAnd) WriteTo(w Writer) error {
	for i, cond := range and {
		_, isOr := cond.(condOr)
		_, isExpr := cond.(*Expression)
		wrap := isOr || isExpr
		if wrap {
			fmt.Fprint(w, "(")
		}

		err := cond.WriteTo(w)
		if err != nil {
			return err
		}

		if wrap {
			fmt.Fprint(w, ")")
		}

		if i != len(and)-1 {
			fmt.Fprint(w, " AND ")
		}
	}

	return nil
}

func (and condAnd) And(conds ...Cond) Cond {
	return And(and, And(conds...))
}

func (and condAnd) Or(conds ...Cond) Cond {
	return Or(and, Or(conds...))
}

func (and condAnd) IsValid() bool {
	return len(and) > 0
}
