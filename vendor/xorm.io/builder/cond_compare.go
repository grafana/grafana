// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import "fmt"

// WriteMap writes conditions' SQL to Writer, op could be =, <>, >, <, <=, >= and etc.
func WriteMap(w Writer, data map[string]interface{}, op string) error {
	args := make([]interface{}, 0, len(data))
	i := 0
	keys := make([]string, 0, len(data))
	for k := range data {
		keys = append(keys, k)
	}

	for _, k := range keys {
		v := data[k]
		switch v.(type) {
		case *Expression:
			if _, err := fmt.Fprintf(w, "%s%s(", k, op); err != nil {
				return err
			}

			if err := v.(*Expression).WriteTo(w); err != nil {
				return err
			}

			if _, err := fmt.Fprintf(w, ")"); err != nil {
				return err
			}
		case *Builder:
			if _, err := fmt.Fprintf(w, "%s%s(", k, op); err != nil {
				return err
			}

			if err := v.(*Builder).WriteTo(w); err != nil {
				return err
			}

			if _, err := fmt.Fprintf(w, ")"); err != nil {
				return err
			}
		default:
			if _, err := fmt.Fprintf(w, "%s%s?", k, op); err != nil {
				return err
			}
			args = append(args, v)
		}
		if i != len(data)-1 {
			if _, err := fmt.Fprint(w, " AND "); err != nil {
				return err
			}
		}
		i = i + 1
	}
	w.Append(args...)
	return nil
}

// Lt defines < condition
type Lt map[string]interface{}

var _ Cond = Lt{}

// WriteTo write SQL to Writer
func (lt Lt) WriteTo(w Writer) error {
	return WriteMap(w, lt, "<")
}

// And implements And with other conditions
func (lt Lt) And(conds ...Cond) Cond {
	return condAnd{lt, And(conds...)}
}

// Or implements Or with other conditions
func (lt Lt) Or(conds ...Cond) Cond {
	return condOr{lt, Or(conds...)}
}

// IsValid tests if this Eq is valid
func (lt Lt) IsValid() bool {
	return len(lt) > 0
}

// Lte defines <= condition
type Lte map[string]interface{}

var _ Cond = Lte{}

// WriteTo write SQL to Writer
func (lte Lte) WriteTo(w Writer) error {
	return WriteMap(w, lte, "<=")
}

// And implements And with other conditions
func (lte Lte) And(conds ...Cond) Cond {
	return And(lte, And(conds...))
}

// Or implements Or with other conditions
func (lte Lte) Or(conds ...Cond) Cond {
	return Or(lte, Or(conds...))
}

// IsValid tests if this Eq is valid
func (lte Lte) IsValid() bool {
	return len(lte) > 0
}

// Gt defines > condition
type Gt map[string]interface{}

var _ Cond = Gt{}

// WriteTo write SQL to Writer
func (gt Gt) WriteTo(w Writer) error {
	return WriteMap(w, gt, ">")
}

// And implements And with other conditions
func (gt Gt) And(conds ...Cond) Cond {
	return And(gt, And(conds...))
}

// Or implements Or with other conditions
func (gt Gt) Or(conds ...Cond) Cond {
	return Or(gt, Or(conds...))
}

// IsValid tests if this Eq is valid
func (gt Gt) IsValid() bool {
	return len(gt) > 0
}

// Gte defines >= condition
type Gte map[string]interface{}

var _ Cond = Gte{}

// WriteTo write SQL to Writer
func (gte Gte) WriteTo(w Writer) error {
	return WriteMap(w, gte, ">=")
}

// And implements And with other conditions
func (gte Gte) And(conds ...Cond) Cond {
	return And(gte, And(conds...))
}

// Or implements Or with other conditions
func (gte Gte) Or(conds ...Cond) Cond {
	return Or(gte, Or(conds...))
}

// IsValid tests if this Eq is valid
func (gte Gte) IsValid() bool {
	return len(gte) > 0
}
