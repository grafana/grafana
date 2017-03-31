// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package builder

import (
	"fmt"
	"reflect"
	"strings"
)

type condNotIn condIn

var _ Cond = condNotIn{}

// NotIn generate NOT IN condition
func NotIn(col string, values ...interface{}) Cond {
	return condNotIn{col, values}
}

func (condNotIn condNotIn) handleBlank(w Writer) error {
	if _, err := fmt.Fprintf(w, "%s NOT IN ()", condNotIn.col); err != nil {
		return err
	}
	return nil
}

func (condNotIn condNotIn) WriteTo(w Writer) error {
	if len(condNotIn.vals) <= 0 {
		return condNotIn.handleBlank(w)
	}

	switch condNotIn.vals[0].(type) {
	case []int8:
		vals := condNotIn.vals[0].([]int8)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []int16:
		vals := condNotIn.vals[0].([]int16)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []int:
		vals := condNotIn.vals[0].([]int)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []int32:
		vals := condNotIn.vals[0].([]int32)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []int64:
		vals := condNotIn.vals[0].([]int64)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []uint8:
		vals := condNotIn.vals[0].([]uint8)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []uint16:
		vals := condNotIn.vals[0].([]uint16)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []uint:
		vals := condNotIn.vals[0].([]uint)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []uint32:
		vals := condNotIn.vals[0].([]uint32)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []uint64:
		vals := condNotIn.vals[0].([]uint64)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []string:
		vals := condNotIn.vals[0].([]string)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		for _, val := range vals {
			w.Append(val)
		}
	case []interface{}:
		vals := condNotIn.vals[0].([]interface{})
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		questionMark := strings.Repeat("?,", len(vals))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
		w.Append(vals...)
	case expr:
		val := condNotIn.vals[0].(expr)
		if _, err := fmt.Fprintf(w, "%s NOT IN (", condNotIn.col); err != nil {
			return err
		}
		if err := val.WriteTo(w); err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, ")"); err != nil {
			return err
		}
	case *Builder:
		val := condNotIn.vals[0].(*Builder)
		if _, err := fmt.Fprintf(w, "%s NOT IN (", condNotIn.col); err != nil {
			return err
		}
		if err := val.WriteTo(w); err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, ")"); err != nil {
			return err
		}
	default:
		v := reflect.ValueOf(condNotIn.vals[0])
		if v.Kind() == reflect.Slice {
			l := v.Len()
			if l == 0 {
				return condNotIn.handleBlank(w)
			}

			questionMark := strings.Repeat("?,", l)
			if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
				return err
			}

			for i := 0; i < l; i++ {
				w.Append(v.Index(i).Interface())
			}
		} else {
			questionMark := strings.Repeat("?,", len(condNotIn.vals))
			if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
				return err
			}
			w.Append(condNotIn.vals...)
		}
	}
	return nil
}

func (condNotIn condNotIn) And(conds ...Cond) Cond {
	return And(condNotIn, And(conds...))
}

func (condNotIn condNotIn) Or(conds ...Cond) Cond {
	return Or(condNotIn, Or(conds...))
}

func (condNotIn condNotIn) IsValid() bool {
	return len(condNotIn.col) > 0 && len(condNotIn.vals) > 0
}
