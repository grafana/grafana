// Copyright 2018 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"fmt"
	"strings"
)

func (b *Builder) setOpWriteTo(w Writer) error {
	if b.limitation != nil || b.cond.IsValid() ||
		b.orderBy != nil || b.having != nil || b.groupBy != "" {
		return ErrNotUnexpectedUnionConditions
	}

	for idx, o := range b.setOps {
		current := o.builder
		if current.optype != selectType {
			return ErrUnsupportedUnionMembers
		}

		if len(b.setOps) == 1 {
			if err := current.selectWriteTo(w); err != nil {
				return err
			}
		} else {
			if b.dialect != "" && b.dialect != current.dialect {
				return ErrInconsistentDialect
			}

			if idx != 0 {
				if o.distinctType == "" {
					fmt.Fprint(w, fmt.Sprintf(" %s ", strings.ToUpper(o.opType)))
				} else {
					fmt.Fprint(w, fmt.Sprintf(" %s %s ", strings.ToUpper(o.opType), strings.ToUpper(o.distinctType)))
				}
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
