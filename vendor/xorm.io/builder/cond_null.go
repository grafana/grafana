// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import "fmt"

// IsNull defines IS NULL condition
type IsNull [1]string

var _ Cond = IsNull{""}

// WriteTo write SQL to Writer
func (isNull IsNull) WriteTo(w Writer) error {
	_, err := fmt.Fprintf(w, "%s IS NULL", isNull[0])
	return err
}

// And implements And with other conditions
func (isNull IsNull) And(conds ...Cond) Cond {
	return And(isNull, And(conds...))
}

// Or implements Or with other conditions
func (isNull IsNull) Or(conds ...Cond) Cond {
	return Or(isNull, Or(conds...))
}

// IsValid tests if this condition is valid
func (isNull IsNull) IsValid() bool {
	return len(isNull[0]) > 0
}

// NotNull defines NOT NULL condition
type NotNull [1]string

var _ Cond = NotNull{""}

// WriteTo write SQL to Writer
func (notNull NotNull) WriteTo(w Writer) error {
	_, err := fmt.Fprintf(w, "%s IS NOT NULL", notNull[0])
	return err
}

// And implements And with other conditions
func (notNull NotNull) And(conds ...Cond) Cond {
	return And(notNull, And(conds...))
}

// Or implements Or with other conditions
func (notNull NotNull) Or(conds ...Cond) Cond {
	return Or(notNull, Or(conds...))
}

// IsValid tests if this condition is valid
func (notNull NotNull) IsValid() bool {
	return len(notNull[0]) > 0
}
