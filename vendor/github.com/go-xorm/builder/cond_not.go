// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import "fmt"

// Not defines NOT condition
type Not [1]Cond

var _ Cond = Not{}

// WriteTo writes SQL to Writer
func (not Not) WriteTo(w Writer) error {
	if _, err := fmt.Fprint(w, "NOT "); err != nil {
		return err
	}
	switch not[0].(type) {
	case condAnd, condOr:
		if _, err := fmt.Fprint(w, "("); err != nil {
			return err
		}
	}

	if err := not[0].WriteTo(w); err != nil {
		return err
	}

	switch not[0].(type) {
	case condAnd, condOr:
		if _, err := fmt.Fprint(w, ")"); err != nil {
			return err
		}
	}

	return nil
}

// And implements And with other conditions
func (not Not) And(conds ...Cond) Cond {
	return And(not, And(conds...))
}

// Or implements Or with other conditions
func (not Not) Or(conds ...Cond) Cond {
	return Or(not, Or(conds...))
}

// IsValid tests if this condition is valid
func (not Not) IsValid() bool {
	return not[0] != nil && not[0].IsValid()
}
