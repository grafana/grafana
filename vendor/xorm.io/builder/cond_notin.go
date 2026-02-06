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
	_, err := fmt.Fprint(w, "0=0")
	return err
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
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[int8]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
	case []int16:
		vals := condNotIn.vals[0].([]int16)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[int16]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
	case []int:
		vals := condNotIn.vals[0].([]int)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[int]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
	case []int32:
		vals := condNotIn.vals[0].([]int32)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[int32]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
	case []int64:
		vals := condNotIn.vals[0].([]int64)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[int64]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
	case []uint8:
		vals := condNotIn.vals[0].([]uint8)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[uint8]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
	case []uint16:
		vals := condNotIn.vals[0].([]uint16)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[uint16]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
	case []uint:
		vals := condNotIn.vals[0].([]uint)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[uint]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
	case []uint32:
		vals := condNotIn.vals[0].([]uint32)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[uint32]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
	case []uint64:
		vals := condNotIn.vals[0].([]uint64)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[uint64]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
		}
	case []string:
		vals := condNotIn.vals[0].([]string)
		if len(vals) <= 0 {
			return condNotIn.handleBlank(w)
		}
		// We're using this map to track if a parameter was already added to the condition to not add the same multiple times.
		trackMap := make(map[string]bool, len(vals))
		for _, val := range vals {
			if _, exists := trackMap[val]; exists {
				continue
			}
			w.Append(val)
			trackMap[val] = true
		}
		questionMark := strings.Repeat("?,", len(trackMap))
		if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
			return err
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
	case *Expression:
		val := condNotIn.vals[0].(*Expression)
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

			trackMap := make(map[interface{}]bool, l)
			for i := 0; i < l; i++ {
				val := v.Index(i).Interface()
				if _, exists := trackMap[val]; exists {
					continue
				}
				w.Append(val)
				trackMap[val] = true
			}

			questionMark := strings.Repeat("?,", len(trackMap))
			if _, err := fmt.Fprintf(w, "%s NOT IN (%s)", condNotIn.col, questionMark[:len(questionMark)-1]); err != nil {
				return err
			}
		} else {
			// Using a map for better efficiency
			trackMap := make(map[interface{}]bool, len(condNotIn.vals))

			i := 0
			for in, val := range condNotIn.vals {
				if _, exists := trackMap[val]; exists {
					// This sets empty values to nil, they get sliced off later.
					condNotIn.vals[in] = nil
					continue
				}
				trackMap[val] = true
				condNotIn.vals[i] = val
				i++
			}
			// Here we slice the slice to only contain those values we defined as correct.
			condNotIn.vals = condNotIn.vals[:i]

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
