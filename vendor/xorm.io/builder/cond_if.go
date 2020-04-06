// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

type condIf struct {
	condition bool
	condTrue  Cond
	condFalse Cond
}

var _ Cond = condIf{}

// If returns Cond via condition
func If(condition bool, condTrue Cond, condFalse ...Cond) Cond {
	var c = condIf{
		condition: condition,
		condTrue:  condTrue,
	}
	if len(condFalse) > 0 {
		c.condFalse = condFalse[0]
	}
	return c
}

func (condIf condIf) WriteTo(w Writer) error {
	if condIf.condition {
		return condIf.condTrue.WriteTo(w)
	} else if condIf.condFalse != nil {
		return condIf.condFalse.WriteTo(w)
	}
	return nil
}

func (condIf condIf) And(conds ...Cond) Cond {
	return And(condIf, And(conds...))
}

func (condIf condIf) Or(conds ...Cond) Cond {
	return Or(condIf, Or(conds...))
}

func (condIf condIf) IsValid() bool {
	if condIf.condition {
		return condIf.condTrue != nil
	}
	return condIf.condFalse != nil
}
