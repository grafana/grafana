// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"fmt"
	"sort"
)

// Neq defines not equal conditions
type Neq map[string]interface{}

var _ Cond = Neq{}

// WriteTo writes SQL to Writer
func (neq Neq) WriteTo(w Writer) error {
	args := make([]interface{}, 0, len(neq))
	i := 0
	for _, k := range neq.sortedKeys() {
		v := neq[k]
		switch v.(type) {
		case []int, []int64, []string, []int32, []int16, []int8:
			if err := NotIn(k, v).WriteTo(w); err != nil {
				return err
			}
		case *Expression:
			if _, err := fmt.Fprintf(w, "%s<>(", k); err != nil {
				return err
			}

			if err := v.(*Expression).WriteTo(w); err != nil {
				return err
			}

			if _, err := fmt.Fprintf(w, ")"); err != nil {
				return err
			}
		case *Builder:
			if _, err := fmt.Fprintf(w, "%s<>(", k); err != nil {
				return err
			}

			if err := v.(*Builder).WriteTo(w); err != nil {
				return err
			}

			if _, err := fmt.Fprintf(w, ")"); err != nil {
				return err
			}
		default:
			if _, err := fmt.Fprintf(w, "%s<>?", k); err != nil {
				return err
			}
			args = append(args, v)
		}
		if i != len(neq)-1 {
			if _, err := fmt.Fprint(w, " AND "); err != nil {
				return err
			}
		}
		i = i + 1
	}
	w.Append(args...)
	return nil
}

// And implements And with other conditions
func (neq Neq) And(conds ...Cond) Cond {
	return And(neq, And(conds...))
}

// Or implements Or with other conditions
func (neq Neq) Or(conds ...Cond) Cond {
	return Or(neq, Or(conds...))
}

// IsValid tests if this condition is valid
func (neq Neq) IsValid() bool {
	return len(neq) > 0
}

// sortedKeys returns all keys of this Neq sorted with sort.Strings.
// It is used internally for consistent ordering when generating
// SQL, see https://gitea.com/xorm/builder/issues/10
func (neq Neq) sortedKeys() []string {
	keys := make([]string, 0, len(neq))
	for key := range neq {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
