// Copyright 2020-2021 Dolthub, Inc.
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

package analyzer

import (
	errors "gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

var (
	// ErrOrderByColumnIndex is returned when in an order clause there is a
	// column that is unknown.
	ErrOrderByColumnIndex = errors.NewKind("unknown column %d in order by clause")
)

// findFirstProjectorNode returns the first sql.Projector node found, starting the search from the specified node.
// If the specified node is a sql.Projector, it will be returned, otherwise its children will be searched for the first
// Projector until one is found. If no Projector is found, nil is returned.
func findFirstProjectorNode(node sql.Node) sql.Projector {
	children := []sql.Node{node}

	for {
		if len(children) == 0 {
			return nil
		}

		currentChild := children[0]
		children = children[1:]

		if projector, ok := currentChild.(sql.Projector); ok {
			return projector
		}

		children = append(children, currentChild.Children()...)
	}
}
