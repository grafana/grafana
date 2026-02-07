// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package schema provides types and functions for manipulating and building parquet
// file schemas.
//
// Some of the utilities provided include building a schema using Struct Tags
// on a struct type, getting Column Paths from a node, and dealing with the
// converted and logical types for Parquet.
//
// Logical types specify ways to interpret the primitive types allowing the
// number of primitive types to be smaller and reuse efficient encodings.
// For instance a "string" is just a ByteArray column with a UTF-8 annotation
// or "String Logical Type".
//
// For more information about Logical and Converted Types, check:
// https://github.com/apache/parquet-format/blob/master/LogicalTypes.md
package schema

import (
	"fmt"
	"io"
	"iter"
	"slices"
	"strings"

	"github.com/apache/arrow-go/v18/parquet"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"golang.org/x/xerrors"
)

// Schema is the container for the converted Parquet schema with a computed
// information from the schema analysis needed for file reading
//
// * Column index to Node
//
// * Max repetition / definition levels for each primitive node
//
// The ColumnDescriptor objects produced by this class can be used to assist in
// the reconstruction of fully materialized data structures from the
// repetition-definition level encoding of nested data
type Schema struct {
	root Node

	leaves      []*Column
	nodeToLeaf  map[*PrimitiveNode]int
	leafToBase  map[int]Node
	leafToIndex strIntMultimap
}

// FromParquet converts a slice of thrift Schema Elements to the correct node type
func FromParquet(elems []*format.SchemaElement) (Node, error) {
	if len(elems) == 0 {
		return nil, xerrors.New("parquet: empty schema (no root)")
	}

	if elems[0].GetNumChildren() == 0 {
		if len(elems) > 1 {
			return nil, xerrors.New("parquet: schema had multiple nodes but root had no children")
		}
		// parquet file with no columns
		return GroupNodeFromThrift(elems[0], []Node{})
	}

	// We don't check that the root node is repeated since this is not
	// consistently set by implementations
	var (
		pos      = 0
		nextNode func() (Node, error)
	)

	nextNode = func() (Node, error) {
		if pos == len(elems) {
			return nil, xerrors.New("parquet: malformed schema: not enough elements")
		}

		elem := elems[pos]
		pos++

		if elem.GetNumChildren() == 0 {
			return PrimitiveNodeFromThrift(elem)
		}

		fields := make([]Node, 0, elem.GetNumChildren())
		for i := 0; i < int(elem.GetNumChildren()); i++ {
			n, err := nextNode()
			if err != nil {
				return nil, err
			}
			fields = append(fields, n)
		}

		return GroupNodeFromThrift(elem, fields)
	}

	return nextNode()
}

// Root returns the group node that is the root of this schema
func (s *Schema) Root() *GroupNode {
	return s.root.(*GroupNode)
}

// NumColumns returns the number of leaf nodes that are the actual primitive
// columns in this schema.
func (s *Schema) NumColumns() int {
	return len(s.leaves)
}

// Equals returns true as long as the leaf columns are equal, doesn't take
// into account the groups and only checks whether the schemas are compatible
// at the physical storage level.
func (s *Schema) Equals(rhs *Schema) bool {
	if s.NumColumns() != rhs.NumColumns() {
		return false
	}

	for idx, c := range s.leaves {
		if !c.Equals(rhs.Column(idx)) {
			return false
		}
	}
	return true
}

func (s *Schema) buildTree(n Node, maxDefLvl, maxRepLvl int16, base Node) {
	switch n.RepetitionType() {
	case parquet.Repetitions.Repeated:
		maxRepLvl++
		fallthrough
	case parquet.Repetitions.Optional:
		maxDefLvl++
	}

	switch n := n.(type) {
	case *GroupNode:
		for _, f := range n.fields {
			s.buildTree(f, maxDefLvl, maxRepLvl, base)
		}
	case *PrimitiveNode:
		s.nodeToLeaf[n] = len(s.leaves)
		s.leaves = append(s.leaves, NewColumn(n, maxDefLvl, maxRepLvl))
		s.leafToBase[len(s.leaves)-1] = base
		s.leafToIndex.Add(n.Path(), len(s.leaves)-1)
	}
}

// Column returns the (0-indexed) column of the provided index.
func (s *Schema) Column(i int) *Column {
	return s.leaves[i]
}

// Columns returns an iterator over the leaf columns of the schema
func (s *Schema) Columns() iter.Seq2[int, *Column] {
	return slices.All(s.leaves)
}

// ColumnIndexByName looks up the column by it's full dot separated
// node path. If there are multiple columns that match, it returns the first one.
//
// Returns -1 if not found.
func (s *Schema) ColumnIndexByName(nodePath string) int {
	if search, ok := s.leafToIndex[nodePath]; ok {
		return search[0]
	}
	return -1
}

// ColumnIndexByNode returns the index of the column represented by this node.
//
// Returns -1 if not found.
func (s *Schema) ColumnIndexByNode(n Node) int {
	if search, ok := s.leafToIndex[n.Path()]; ok {
		for _, idx := range search {
			if n == s.Column(idx).SchemaNode() {
				return idx
			}
		}
	}
	return -1
}

// ColumnRoot returns the root node of a given column if it is under a
// nested group node, providing that root group node.
func (s *Schema) ColumnRoot(i int) Node {
	return s.leafToBase[i]
}

// HasRepeatedFields returns true if any node in the schema has a repeated field type.
func (s *Schema) HasRepeatedFields() bool {
	return s.root.(*GroupNode).HasRepeatedFields()
}

// UpdateColumnOrders must get a slice that is the same length as the number of leaf columns
// and is used to update the schema metadata Column Orders. len(orders) must equal s.NumColumns()
func (s *Schema) UpdateColumnOrders(orders []parquet.ColumnOrder) error {
	if len(orders) != s.NumColumns() {
		return xerrors.New("parquet: malformed schema: not enough ColumnOrder values")
	}

	visitor := schemaColumnOrderUpdater{orders, 0}
	s.root.Visit(&visitor)
	return nil
}

func (s *Schema) String() string {
	var b strings.Builder
	PrintSchema(s.root, &b, 2)
	return b.String()
}

// NewSchema constructs a new Schema object from a root group node.
//
// Any fields with a field-id of -1 will be given an appropriate field number based on their order.
func NewSchema(root *GroupNode) *Schema {
	s := &Schema{
		root,
		make([]*Column, 0),
		make(map[*PrimitiveNode]int),
		make(map[int]Node),
		make(strIntMultimap),
	}

	for _, f := range root.fields {
		s.buildTree(f, 0, 0, f)
	}
	return s
}

type schemaColumnOrderUpdater struct {
	colOrders []parquet.ColumnOrder
	leafCount int
}

func (s *schemaColumnOrderUpdater) VisitPre(n Node) bool {
	if n.Type() == Primitive {
		leaf := n.(*PrimitiveNode)
		leaf.ColumnOrder = s.colOrders[s.leafCount]
		s.leafCount++
	}
	return true
}

func (s *schemaColumnOrderUpdater) VisitPost(Node) {}

type toThriftVisitor struct {
	elements []*format.SchemaElement
}

func (t *toThriftVisitor) VisitPre(n Node) bool {
	t.elements = append(t.elements, n.toThrift())
	return true
}

func (t *toThriftVisitor) VisitPost(Node) {}

// ToThrift converts a GroupNode to a slice of SchemaElements which is used
// for thrift serialization.
func ToThrift(schema *GroupNode) []*format.SchemaElement {
	t := &toThriftVisitor{make([]*format.SchemaElement, 0)}
	schema.Visit(t)
	return t.elements
}

type schemaPrinter struct {
	w           io.Writer
	indent      int
	indentWidth int
}

func (s *schemaPrinter) VisitPre(n Node) bool {
	fmt.Fprint(s.w, strings.Repeat(" ", s.indent))
	if n.Type() == Group {
		g := n.(*GroupNode)
		fmt.Fprintf(s.w, "%s group field_id=%d %s", g.RepetitionType(), g.FieldID(), g.Name())
		_, invalid := g.logicalType.(UnknownLogicalType)
		_, none := g.logicalType.(NoLogicalType)

		if g.logicalType != nil && !invalid && !none {
			fmt.Fprintf(s.w, " (%s)", g.logicalType)
		} else if g.convertedType != ConvertedTypes.None {
			fmt.Fprintf(s.w, " (%s)", g.convertedType)
		}

		fmt.Fprintln(s.w, " {")
		s.indent += s.indentWidth
	} else {
		p := n.(*PrimitiveNode)
		fmt.Fprintf(s.w, "%s %s field_id=%d %s", p.RepetitionType(), strings.ToLower(p.PhysicalType().String()), p.FieldID(), p.Name())
		_, invalid := p.logicalType.(UnknownLogicalType)
		_, none := p.logicalType.(NoLogicalType)

		if p.logicalType != nil && !invalid && !none {
			fmt.Fprintf(s.w, " (%s)", p.logicalType)
		} else if p.convertedType == ConvertedTypes.Decimal {
			fmt.Fprintf(s.w, " (%s(%d,%d))", p.convertedType, p.DecimalMetadata().Precision, p.DecimalMetadata().Scale)
		} else if p.convertedType != ConvertedTypes.None {
			fmt.Fprintf(s.w, " (%s)", p.convertedType)
		}
		fmt.Fprintln(s.w, ";")
	}
	return true
}

func (s *schemaPrinter) VisitPost(n Node) {
	if n.Type() == Group {
		s.indent -= s.indentWidth
		fmt.Fprint(s.w, strings.Repeat(" ", s.indent))
		fmt.Fprintln(s.w, "}")
	}
}

// PrintSchema writes a string representation of the tree to w using the indent
// width provided.
func PrintSchema(n Node, w io.Writer, indentWidth int) {
	n.Visit(&schemaPrinter{w, 0, indentWidth})
}

type strIntMultimap map[string][]int

func (f strIntMultimap) Add(key string, val int) bool {
	if _, ok := f[key]; !ok {
		f[key] = []int{val}
		return false
	}
	f[key] = append(f[key], val)
	return true
}
