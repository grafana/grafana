// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import "fmt"

// Between implmentes between condition
type Between struct {
	Col     string
	LessVal interface{}
	MoreVal interface{}
}

var _ Cond = Between{}

// WriteTo write data to Writer
func (between Between) WriteTo(w Writer) error {
	if _, err := fmt.Fprintf(w, "%s BETWEEN ? AND ?", between.Col); err != nil {
		return err
	}
	w.Append(between.LessVal, between.MoreVal)
	return nil
}

// And implments And with other conditions
func (between Between) And(conds ...Cond) Cond {
	return And(between, And(conds...))
}

// Or implments Or with other conditions
func (between Between) Or(conds ...Cond) Cond {
	return Or(between, Or(conds...))
}

// IsValid tests if the condition is valid
func (between Between) IsValid() bool {
	return len(between.Col) > 0
}
