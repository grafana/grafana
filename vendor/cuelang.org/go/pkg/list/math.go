// Copyright 2018 The CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package list

import (
	"fmt"

	"github.com/cockroachdb/apd/v2"

	"cuelang.org/go/internal"
)

// Avg returns the average value of a non empty list xs.
func Avg(xs []*internal.Decimal) (*internal.Decimal, error) {
	if 0 == len(xs) {
		return nil, fmt.Errorf("empty list")
	}

	s := apd.New(0, 0)
	for _, x := range xs {
		_, err := internal.BaseContext.Add(s, x, s)
		if err != nil {
			return nil, err
		}
	}

	var d apd.Decimal
	l := apd.New(int64(len(xs)), 0)
	_, err := internal.BaseContext.Quo(&d, s, l)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Max returns the maximum value of a non empty list xs.
func Max(xs []*internal.Decimal) (*internal.Decimal, error) {
	if 0 == len(xs) {
		return nil, fmt.Errorf("empty list")
	}

	max := xs[0]
	for _, x := range xs[1:] {
		if -1 == max.Cmp(x) {
			max = x
		}
	}
	return max, nil
}

// Min returns the minimum value of a non empty list xs.
func Min(xs []*internal.Decimal) (*internal.Decimal, error) {
	if 0 == len(xs) {
		return nil, fmt.Errorf("empty list")
	}

	min := xs[0]
	for _, x := range xs[1:] {
		if +1 == min.Cmp(x) {
			min = x
		}
	}
	return min, nil
}

// Product returns the product of a non empty list xs.
func Product(xs []*internal.Decimal) (*internal.Decimal, error) {
	d := apd.New(1, 0)
	for _, x := range xs {
		_, err := internal.BaseContext.Mul(d, x, d)
		if err != nil {
			return nil, err
		}
	}
	return d, nil
}

// Range generates a list of numbers using a start value, a limit value, and a
// step value.
//
// For instance:
//
//	Range(0, 5, 2)
//
// results in
//
//	[0, 2, 4]
func Range(start, limit, step *internal.Decimal) ([]*internal.Decimal, error) {
	if step.IsZero() {
		return nil, fmt.Errorf("step must be non zero")
	}

	if !step.Negative && +1 == start.Cmp(limit) {
		return nil, fmt.Errorf("end must be greater than start when step is positive")
	}

	if step.Negative && -1 == start.Cmp(limit) {
		return nil, fmt.Errorf("end must be less than start when step is negative")
	}

	var vals []*internal.Decimal
	num := start
	for {
		if !step.Negative && -1 != num.Cmp(limit) {
			break
		}

		if step.Negative && +1 != num.Cmp(limit) {
			break
		}

		vals = append(vals, num)
		d := apd.New(0, 0)
		_, err := internal.BaseContext.Add(d, step, num)
		if err != nil {
			return nil, err
		}
		num = d
	}
	return vals, nil
}

// Sum returns the sum of a list non empty xs.
func Sum(xs []*internal.Decimal) (*internal.Decimal, error) {
	d := apd.New(0, 0)
	for _, x := range xs {
		_, err := internal.BaseContext.Add(d, x, d)
		if err != nil {
			return nil, err
		}
	}
	return d, nil
}
