// Copyright 2018 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"fmt"
	"strings"
)

func (b *Builder) unionWriteTo(w Writer) error {
	if b.limitation != nil || b.cond.IsValid() ||
		b.orderBy != "" || b.having != "" || b.groupBy != "" {
		return ErrNotUnexpectedUnionConditions
	}

	for idx, u := range b.unions {
		current := u.builder
		if current.optype != selectType {
			return ErrUnsupportedUnionMembers
		}

		if len(b.unions) == 1 {
			if err := current.selectWriteTo(w); err != nil {
				return err
			}
		} else {
			if b.dialect != "" && b.dialect != current.dialect {
				return ErrInconsistentDialect
			}

			if idx != 0 {
				fmt.Fprint(w, fmt.Sprintf(" UNION %v ", strings.ToUpper(u.unionType)))
			}
			fmt.Fprint(w, "(")

			if err := current.selectWriteTo(w); err != nil {
				return err
			}

			fmt.Fprint(w, ")")
		}
	}

	return nil
}
