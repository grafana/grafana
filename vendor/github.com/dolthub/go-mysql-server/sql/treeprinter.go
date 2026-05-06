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

package sql

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"strings"
)

// TreePrinter is a printer for tree nodes.
type TreePrinter struct {
	buf         bytes.Buffer
	nodeWritten bool
	written     bool
}

// NewTreePrinter creates a new tree printer.
func NewTreePrinter() *TreePrinter {
	return new(TreePrinter)
}

// WriteNode writes the main node.
func (p *TreePrinter) WriteNode(format string, args ...interface{}) error {
	if p.nodeWritten {
		return ErrNodeAlreadyWritten
	}

	_, err := fmt.Fprintf(&p.buf, format, args...)
	if err != nil {
		return err
	}
	p.nodeWritten = true
	p.buf.WriteRune('\n')
	return nil
}

var (
	// ErrNodeNotWritten is returned when the children are printed before the node.
	ErrNodeNotWritten = errors.New("treeprinter: a child was written before the node")
	// ErrNodeAlreadyWritten is returned when the node has already been written.
	ErrNodeAlreadyWritten = errors.New("treeprinter: node already written")
	// ErrChildrenAlreadyWritten is returned when the children have already been written.
	ErrChildrenAlreadyWritten = errors.New("treeprinter: children already written")
)

// WriteChildren writes a children of the tree.
func (p *TreePrinter) WriteChildren(children ...string) error {
	if !p.nodeWritten {
		return ErrNodeNotWritten
	}

	if p.written {
		return ErrChildrenAlreadyWritten
	}

	p.written = true

	for i, child := range children {
		last := i+1 == len(children)
		r := bufio.NewReader(strings.NewReader(child))

		var first = true
		for {
			line, _, err := r.ReadLine()
			if err == io.EOF {
				break
			}

			if err != nil {
				return err
			}

			if first && last {
				p.buf.WriteString(" └─ ")
			} else if first {
				p.buf.WriteString(" ├─ ")
			} else if !last {
				p.buf.WriteString(" │  ")
			} else {
				p.buf.WriteString("    ")
			}

			p.buf.Write(line)
			p.buf.WriteRune('\n')
			first = false
		}
	}

	return nil
}

// String returns the output of the printed tree.
func (p *TreePrinter) String() string {
	return p.buf.String()
}
