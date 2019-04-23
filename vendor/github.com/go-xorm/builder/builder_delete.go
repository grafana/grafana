// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"fmt"
)

// Delete creates a delete Builder
func Delete(conds ...Cond) *Builder {
	builder := &Builder{cond: NewCond()}
	return builder.Delete(conds...)
}

func (b *Builder) deleteWriteTo(w Writer) error {
	if len(b.from) <= 0 {
		return ErrNoTableName
	}

	if _, err := fmt.Fprintf(w, "DELETE FROM %s WHERE ", b.from); err != nil {
		return err
	}

	return b.cond.WriteTo(w)
}
