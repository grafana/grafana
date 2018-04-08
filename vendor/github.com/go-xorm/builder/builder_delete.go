// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"errors"
	"fmt"
)

func (b *Builder) deleteWriteTo(w Writer) error {
	if len(b.tableName) <= 0 {
		return errors.New("no table indicated")
	}

	if _, err := fmt.Fprintf(w, "DELETE FROM %s WHERE ", b.tableName); err != nil {
		return err
	}

	return b.cond.WriteTo(w)
}
