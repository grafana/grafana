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

package csv

import (
	"bytes"
	"encoding/csv"
	"io"

	"cuelang.org/go/cue"
)

// Encode encode the given list of lists to CSV.
func Encode(x cue.Value) (string, error) {
	buf := &bytes.Buffer{}
	w := csv.NewWriter(buf)
	iter, err := x.List()
	if err != nil {
		return "", err
	}
	for iter.Next() {
		row, err := iter.Value().List()
		if err != nil {
			return "", err
		}
		a := []string{}
		for row.Next() {
			col := row.Value()
			if str, err := col.String(); err == nil {
				a = append(a, str)
			} else {
				b, err := col.MarshalJSON()
				if err != nil {
					return "", err
				}
				a = append(a, string(b))
			}
		}
		_ = w.Write(a)
	}
	w.Flush()
	return buf.String(), nil
}

// Decode reads in a csv into a list of lists.
func Decode(r io.Reader) ([][]string, error) {
	return csv.NewReader(r).ReadAll()
}
