// Copyright 2023 Dolthub, Inc.
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

package stats

import (
	"io"
	"math"
	"math/rand"

	"github.com/dolthub/go-mysql-server/sql"
)

func NewNormDistIter(colCnt, rowCnt int, mean, std float64) sql.RowIter {
	return &normDistIter{cols: colCnt, cnt: rowCnt, std: std, mean: mean}
}

func NewExpDistIter(colCnt, rowCnt int, lambda float64) sql.RowIter {
	return &expDistIter{cols: colCnt, cnt: rowCnt, lambda: lambda}
}

type normDistIter struct {
	i         int
	cols      int
	cnt       int
	std, mean float64
}

var _ sql.RowIter = (*normDistIter)(nil)

func (d *normDistIter) Next(*sql.Context) (sql.Row, error) {
	if d.i > d.cnt {
		return nil, io.EOF
	}
	d.i++
	var ret sql.Row
	ret = append(ret, d.i)
	for i := 0; i < d.cols; i++ {
		val := rand.NormFloat64()*d.std + d.mean
		if math.IsNaN(val) || math.IsInf(val, 0) {
			val = math.MaxInt
		}
		ret = append(ret, val)
	}
	return ret, nil
}

func (d *normDistIter) Close(*sql.Context) error {
	return nil
}

type expDistIter struct {
	i      int
	cols   int
	cnt    int
	lambda float64
}

var _ sql.RowIter = (*expDistIter)(nil)

func (d *expDistIter) Next(*sql.Context) (sql.Row, error) {
	if d.i > d.cnt {
		return nil, io.EOF
	}
	d.i++
	var ret sql.Row
	ret = append(ret, d.i)
	for i := 0; i < d.cols; i++ {
		val := -math.Log2(rand.NormFloat64()) / d.lambda
		if math.IsNaN(val) || math.IsInf(val, 0) {
			val = math.MaxInt32
		}
		ret = append(ret, val)
	}
	return ret, nil
}

func (d *expDistIter) Close(*sql.Context) error {
	return nil
}
