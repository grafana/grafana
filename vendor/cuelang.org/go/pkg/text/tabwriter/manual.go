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

package tabwriter

import (
	"bytes"
	"fmt"
	"text/tabwriter"

	"cuelang.org/go/cue"
)

// Write formats text in columns. See golang.org/pkg/text/tabwriter for more
// info.
func Write(data cue.Value) (string, error) {
	buf := &bytes.Buffer{}
	tw := tabwriter.NewWriter(buf, 0, 4, 1, ' ', 0)

	write := func(v cue.Value) error {
		b, err := v.Bytes()
		if err != nil {
			return err
		}
		_, err = tw.Write(b)
		if err != nil {
			return err
		}
		return nil
	}

	switch data.Kind() {
	case cue.BytesKind, cue.StringKind:
		if err := write(data); err != nil {
			return "", err
		}
	case cue.ListKind:
		for i, _ := data.List(); i.Next(); {
			if err := write(i.Value()); err != nil {
				return "", err
			}
			_, _ = tw.Write([]byte{'\n'})
		}
	default:
		return "", fmt.Errorf("tabwriter.Write: unsupported type %v", data.Kind())
	}

	err := tw.Flush()
	return buf.String(), err
}
