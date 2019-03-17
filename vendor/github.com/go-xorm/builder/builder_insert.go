// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"bytes"
	"fmt"
)

// Insert creates an insert Builder
func Insert(eq ...interface{}) *Builder {
	builder := &Builder{cond: NewCond()}
	return builder.Insert(eq...)
}

func (b *Builder) insertSelectWriteTo(w Writer) error {
	if _, err := fmt.Fprintf(w, "INSERT INTO %s ", b.into); err != nil {
		return err
	}

	if len(b.insertCols) > 0 {
		fmt.Fprintf(w, "(")
		for _, col := range b.insertCols {
			fmt.Fprintf(w, col)
		}
		fmt.Fprintf(w, ") ")
	}

	return b.selectWriteTo(w)
}

func (b *Builder) insertWriteTo(w Writer) error {
	if len(b.into) <= 0 {
		return ErrNoTableName
	}
	if len(b.insertCols) <= 0 && b.from == "" {
		return ErrNoColumnToInsert
	}

	if b.into != "" && b.from != "" {
		return b.insertSelectWriteTo(w)
	}

	if _, err := fmt.Fprintf(w, "INSERT INTO %s (", b.into); err != nil {
		return err
	}

	var args = make([]interface{}, 0)
	var bs []byte
	var valBuffer = bytes.NewBuffer(bs)

	for i, col := range b.insertCols {
		value := b.insertVals[i]
		fmt.Fprint(w, col)
		if e, ok := value.(expr); ok {
			fmt.Fprintf(valBuffer, "(%s)", e.sql)
			args = append(args, e.args...)
		} else {
			fmt.Fprint(valBuffer, "?")
			args = append(args, value)
		}

		if i != len(b.insertCols)-1 {
			if _, err := fmt.Fprint(w, ","); err != nil {
				return err
			}
			if _, err := fmt.Fprint(valBuffer, ","); err != nil {
				return err
			}
		}
	}

	if _, err := fmt.Fprint(w, ") Values ("); err != nil {
		return err
	}

	if _, err := w.Write(valBuffer.Bytes()); err != nil {
		return err
	}
	if _, err := fmt.Fprint(w, ")"); err != nil {
		return err
	}

	w.Append(args...)

	return nil
}
