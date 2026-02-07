// Copyright 2022 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"errors"
	"io"
)

type condNotExists struct {
	subQuery *Builder
}

var _ Cond = condNotExists{}

// NotExists returns Cond via condition
func NotExists(subQuery *Builder) Cond {
	return &condNotExists{
		subQuery: subQuery,
	}
}

func (condNotExists condNotExists) WriteTo(w Writer) error {
	if !condNotExists.IsValid() {
		return errors.New("exists condition is nov valid")
	}
	if _, err := io.WriteString(w, "NOT EXISTS ("); err != nil {
		return err
	}
	if err := condNotExists.subQuery.WriteTo(w); err != nil {
		return err
	}
	_, err := io.WriteString(w, ")")
	return err
}

func (condNotExists condNotExists) And(conds ...Cond) Cond {
	return And(condNotExists, And(conds...))
}

func (condNotExists condNotExists) Or(conds ...Cond) Cond {
	return Or(condNotExists, Or(conds...))
}

func (condNotExists condNotExists) IsValid() bool {
	return condNotExists.subQuery != nil
}
