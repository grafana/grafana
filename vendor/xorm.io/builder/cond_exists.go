// Copyright 2022 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"errors"
	"io"
)

type condExists struct {
	subQuery *Builder
}

var _ Cond = condExists{}

// Exists returns Cond via condition
func Exists(subQuery *Builder) Cond {
	return &condExists{
		subQuery: subQuery,
	}
}

func (condExists condExists) WriteTo(w Writer) error {
	if !condExists.IsValid() {
		return errors.New("exists condition is nov valid")
	}
	if _, err := io.WriteString(w, "EXISTS ("); err != nil {
		return err
	}
	if err := condExists.subQuery.WriteTo(w); err != nil {
		return err
	}
	_, err := io.WriteString(w, ")")
	return err
}

func (condExists condExists) And(conds ...Cond) Cond {
	return And(condExists, And(conds...))
}

func (condExists condExists) Or(conds ...Cond) Cond {
	return Or(condExists, Or(conds...))
}

func (condExists condExists) IsValid() bool {
	return condExists.subQuery != nil
}
