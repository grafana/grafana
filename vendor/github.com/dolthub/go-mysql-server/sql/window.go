// Copyright 2021 Dolthub, Inc.
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

package sql

import (
	"fmt"
	"strings"

	"github.com/cespare/xxhash/v2"
)

func NewWindowDefinition(partitionBy []Expression, orderBy SortFields, frame WindowFrame, ref, name string) *WindowDefinition {
	return &WindowDefinition{
		PartitionBy: partitionBy,
		OrderBy:     orderBy,
		Frame:       frame,
		Ref:         ref,
		Name:        name,
	}
}

// A WindowDefinition specifies the window parameters of a window function
type WindowDefinition struct {
	Frame       WindowFrame
	Ref         string
	Name        string
	PartitionBy []Expression
	OrderBy     SortFields
	id          uint64
}

// ToExpressions converts the PartitionBy and OrderBy expressions to a single slice of expressions suitable for
// manipulation by analyzer rules.
func (w *WindowDefinition) ToExpressions() []Expression {
	if w == nil {
		return nil
	}
	return append(w.OrderBy.ToExpressions(), w.PartitionBy...)
}

// FromExpressions returns copy of this window with the given expressions taken to stand in for the partition and order
// by fields. An error is returned if the lengths or types of these expressions are incompatible with this window.
func (w *WindowDefinition) FromExpressions(children []Expression) (*WindowDefinition, error) {
	if w == nil {
		return nil, nil
	}

	if len(children) != len(w.OrderBy)+len(w.PartitionBy) {
		return nil, ErrInvalidChildrenNumber.New(w, len(children), len(w.OrderBy)+len(w.PartitionBy))
	}

	nw := *w
	nw.OrderBy = nw.OrderBy.FromExpressions(children[:len(nw.OrderBy)]...)
	nw.PartitionBy = children[len(nw.OrderBy):]
	return &nw, nil
}

func (w *WindowDefinition) String() string {
	if w == nil {
		return ""
	}
	sb := strings.Builder{}
	sb.WriteString("over (")
	if len(w.PartitionBy) > 0 {
		sb.WriteString(" partition by ")
		for i, expression := range w.PartitionBy {
			if i > 0 {
				sb.WriteString(", ")
			}
			sb.WriteString(expression.String())
		}
	}
	if len(w.OrderBy) > 0 {
		sb.WriteString(" order by ")
		for i, ob := range w.OrderBy {
			if i > 0 {
				sb.WriteString(", ")
			}
			sb.WriteString(ob.String())
		}
	}
	if w.Frame != nil {
		sb.WriteString(fmt.Sprintf(" %s", w.Frame.String()))
	}
	sb.WriteString(")")
	return sb.String()
}

func (w *WindowDefinition) PartitionId() (uint64, error) {
	if w == nil {
		return 0, nil
	}
	if w.id != uint64(0) {
		return w.id, nil
	}
	sb := strings.Builder{}
	if len(w.PartitionBy) > 0 {
		for _, expression := range w.PartitionBy {
			sb.WriteString(expression.String())
		}
	}
	if len(w.OrderBy) > 0 {
		for _, ob := range w.OrderBy {
			sb.WriteString(ob.String())
		}
	}
	hash := xxhash.New()
	_, err := hash.Write([]byte(sb.String()))
	if err != nil {
		return 0, err
	}
	w.id = hash.Sum64()
	return w.id, nil
}

func (w *WindowDefinition) DebugString() string {
	if w == nil {
		return ""
	}
	return w.String()
}
