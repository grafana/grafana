// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import "fmt"

// Like defines like condition
type Like [2]string

var _ Cond = Like{"", ""}

// WriteTo write SQL to Writer
func (like Like) WriteTo(w Writer) error {
	if _, err := fmt.Fprintf(w, "%s LIKE ?", like[0]); err != nil {
		return err
	}
	// FIXME: if use other regular express, this will be failed. but for compitable, keep this
	if like[1][0] == '%' || like[1][len(like[1])-1] == '%' {
		w.Append(like[1])
	} else {
		w.Append("%" + like[1] + "%")
	}
	return nil
}

// And implements And with other conditions
func (like Like) And(conds ...Cond) Cond {
	return And(like, And(conds...))
}

// Or implements Or with other conditions
func (like Like) Or(conds ...Cond) Cond {
	return Or(like, Or(conds...))
}

// IsValid tests if this condition is valid
func (like Like) IsValid() bool {
	return len(like[0]) > 0 && len(like[1]) > 0
}
