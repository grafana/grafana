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

package schema

import (
	"fmt"

	"github.com/apache/arrow-go/v18/parquet"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/thrift/lib/go/thrift"
	"golang.org/x/xerrors"
)

// NodeType describes whether the Node is a Primitive or Group node
type NodeType int

// the available constants for NodeType
const (
	Primitive NodeType = iota
	Group
)

// Node is the interface for both Group and Primitive Nodes.
// A logical schema type has a name, repetition level, and optionally
// a logical type (converted type is the deprecated version of the logical
// type concept, which is maintained for forward compatibility)
type Node interface {
	Name() string
	Type() NodeType
	RepetitionType() parquet.Repetition
	ConvertedType() ConvertedType
	LogicalType() LogicalType
	FieldID() int32
	Parent() Node
	SetParent(Node)
	Path() string
	Equals(Node) bool
	Visit(v Visitor)
	toThrift() *format.SchemaElement
}

// Visitor is an interface for creating functionality to walk the schema tree.
//
// A visitor can be passed to the Visit function of a Node in order to walk
// the tree. VisitPre is called the first time a node is encountered. If
// it is a group node, the return is checked and if it is false, the children
// will be skipped.
//
// VisitPost is called after visiting any children
type Visitor interface {
	VisitPre(Node) bool
	VisitPost(Node)
}

// ColumnPathFromNode walks the parents of the given node to construct it's
// column path
func ColumnPathFromNode(n Node) parquet.ColumnPath {
	if n == nil {
		return nil
	}

	c := make([]string, 0)

	// build the path in reverse order as we traverse nodes to the top
	cursor := n
	for cursor.Parent() != nil {
		c = append(c, cursor.Name())
		cursor = cursor.Parent()
	}

	// reverse the order of the list in place so that our result
	// is in the proper, correct order.
	for i := len(c)/2 - 1; i >= 0; i-- {
		opp := len(c) - 1 - i
		c[i], c[opp] = c[opp], c[i]
	}

	return c
}

// node is the base embedded struct for both group and primitive nodes
type node struct {
	typ    NodeType
	parent Node

	name          string
	repetition    parquet.Repetition
	fieldID       int32
	logicalType   LogicalType
	convertedType ConvertedType
	colPath       parquet.ColumnPath
}

func (n *node) toThrift() *format.SchemaElement    { return nil }
func (n *node) Name() string                       { return n.name }
func (n *node) Type() NodeType                     { return n.typ }
func (n *node) RepetitionType() parquet.Repetition { return n.repetition }
func (n *node) ConvertedType() ConvertedType       { return n.convertedType }
func (n *node) LogicalType() LogicalType           { return n.logicalType }
func (n *node) FieldID() int32                     { return n.fieldID }
func (n *node) Parent() Node                       { return n.parent }
func (n *node) SetParent(p Node)                   { n.parent = p }
func (n *node) Path() string {
	return n.columnPath().String()
}
func (n *node) columnPath() parquet.ColumnPath {
	if n.colPath == nil {
		n.colPath = ColumnPathFromNode(n)
	}
	return n.colPath
}

func (n *node) Equals(rhs Node) bool {
	return n.typ == rhs.Type() &&
		n.Name() == rhs.Name() &&
		n.RepetitionType() == rhs.RepetitionType() &&
		n.ConvertedType() == rhs.ConvertedType() &&
		n.FieldID() == rhs.FieldID() &&
		n.LogicalType().Equals(rhs.LogicalType())
}

func (n *node) Visit(v Visitor) {}

// A PrimitiveNode is a type that is one of the primitive Parquet storage types. In addition to
// the other type metadata (name, repetition level, logical type), also has the
// physical storage type and their type-specific metadata (byte width, decimal
// parameters)
type PrimitiveNode struct {
	node

	ColumnOrder     parquet.ColumnOrder
	physicalType    parquet.Type
	typeLen         int
	decimalMetaData DecimalMetadata
}

// NewPrimitiveNodeLogical constructs a Primitive node using the provided logical type for a given
// physical type and typelength.
func NewPrimitiveNodeLogical(name string, repetition parquet.Repetition, logicalType LogicalType, physicalType parquet.Type, typeLen int, id int32) (*PrimitiveNode, error) {
	n := &PrimitiveNode{
		node:         node{typ: Primitive, name: name, repetition: repetition, logicalType: logicalType, fieldID: id},
		physicalType: physicalType,
		typeLen:      typeLen,
	}

	if logicalType != nil {
		if !logicalType.IsNested() {
			if logicalType.IsApplicable(physicalType, int32(typeLen)) {
				n.convertedType, n.decimalMetaData = n.logicalType.ToConvertedType()
			} else {
				return nil, fmt.Errorf("%s cannot be applied to primitive type %s", logicalType, physicalType)
			}
		} else {
			return nil, fmt.Errorf("nested logical type %s cannot be applied to a non-group node", logicalType)
		}
	} else {
		n.logicalType = NoLogicalType{}
		n.convertedType, n.decimalMetaData = n.logicalType.ToConvertedType()
	}

	if !(n.logicalType != nil && !n.logicalType.IsNested() && n.logicalType.IsCompatible(n.convertedType, n.decimalMetaData)) {
		return nil, fmt.Errorf("invalid logical type %s", n.logicalType)
	}

	if n.physicalType == parquet.Types.FixedLenByteArray && n.typeLen <= 0 {
		return nil, xerrors.New("invalid fixed length byte array length")
	}
	return n, nil
}

// NewPrimitiveNodeConverted constructs a primitive node from the given physical type and converted type,
// determining the logical type from the converted type.
func NewPrimitiveNodeConverted(name string, repetition parquet.Repetition, typ parquet.Type, converted ConvertedType, typeLen, precision, scale int, id int32) (*PrimitiveNode, error) {
	n := &PrimitiveNode{
		node:         node{typ: Primitive, name: name, repetition: repetition, convertedType: converted, fieldID: id},
		physicalType: typ,
		typeLen:      -1,
	}

	switch converted {
	case ConvertedTypes.None:
	case ConvertedTypes.UTF8, ConvertedTypes.JSON, ConvertedTypes.BSON:
		if typ != parquet.Types.ByteArray {
			return nil, fmt.Errorf("parquet: %s can only annotate BYTE_LEN fields", typ)
		}
	case ConvertedTypes.Decimal:
		switch typ {
		case parquet.Types.Int32, parquet.Types.Int64, parquet.Types.ByteArray, parquet.Types.FixedLenByteArray:
		default:
			return nil, xerrors.New("parquet: DECIMAL can only annotate INT32, INT64, BYTE_ARRAY and FIXED")
		}

		switch {
		case precision <= 0:
			return nil, fmt.Errorf("parquet: invalid decimal precision: %d, must be between 1 and 38 inclusive", precision)
		case scale < 0:
			return nil, fmt.Errorf("parquet: invalid decimal scale: %d, must be a number between 0 and precision inclusive", scale)
		case scale > precision:
			return nil, fmt.Errorf("parquet: invalid decimal scale %d, cannot be greater than precision: %d", scale, precision)
		}
		n.decimalMetaData.IsSet = true
		n.decimalMetaData.Precision = int32(precision)
		n.decimalMetaData.Scale = int32(scale)
	case ConvertedTypes.Date,
		ConvertedTypes.TimeMillis,
		ConvertedTypes.Int8,
		ConvertedTypes.Int16,
		ConvertedTypes.Int32,
		ConvertedTypes.Uint8,
		ConvertedTypes.Uint16,
		ConvertedTypes.Uint32:
		if typ != parquet.Types.Int32 {
			return nil, fmt.Errorf("parquet: %s can only annotate INT32", converted)
		}
	case ConvertedTypes.TimeMicros,
		ConvertedTypes.TimestampMicros,
		ConvertedTypes.TimestampMillis,
		ConvertedTypes.Int64,
		ConvertedTypes.Uint64:
		if typ != parquet.Types.Int64 {
			return nil, fmt.Errorf("parquet: %s can only annotate INT64", converted)
		}
	case ConvertedTypes.Interval:
		if typ != parquet.Types.FixedLenByteArray || typeLen != 12 {
			return nil, xerrors.New("parquet: INTERVAL can only annotate FIXED_LEN_BYTE_ARRAY(12)")
		}
	case ConvertedTypes.Enum:
		if typ != parquet.Types.ByteArray {
			return nil, xerrors.New("parquet: ENUM can only annotate BYTE_ARRAY fields")
		}
	case ConvertedTypes.NA:
	default:
		return nil, fmt.Errorf("parquet: %s cannot be applied to a primitive type", converted.String())
	}

	n.logicalType = n.convertedType.ToLogicalType(n.decimalMetaData)
	if !(n.logicalType != nil && !n.logicalType.IsNested() && n.logicalType.IsCompatible(n.convertedType, n.decimalMetaData)) {
		return nil, fmt.Errorf("invalid logical type %s", n.logicalType)
	}

	if n.physicalType == parquet.Types.FixedLenByteArray {
		if typeLen <= 0 {
			return nil, xerrors.New("invalid fixed len byte array length")
		}
		n.typeLen = typeLen
	}

	return n, nil
}

func PrimitiveNodeFromThrift(elem *format.SchemaElement) (*PrimitiveNode, error) {
	fieldID := int32(-1)
	if elem.IsSetFieldID() {
		fieldID = elem.GetFieldID()
	}

	if elem.IsSetLogicalType() {
		return NewPrimitiveNodeLogical(elem.GetName(), parquet.Repetition(elem.GetRepetitionType()),
			getLogicalType(elem.GetLogicalType()), parquet.Type(elem.GetType()), int(elem.GetTypeLength()),
			fieldID)
	} else if elem.IsSetConvertedType() {
		return NewPrimitiveNodeConverted(elem.GetName(), parquet.Repetition(elem.GetRepetitionType()),
			parquet.Type(elem.GetType()), ConvertedType(elem.GetConvertedType()),
			int(elem.GetTypeLength()), int(elem.GetPrecision()), int(elem.GetScale()), fieldID)
	}
	return NewPrimitiveNodeLogical(elem.GetName(), parquet.Repetition(elem.GetRepetitionType()), NoLogicalType{}, parquet.Type(elem.GetType()), int(elem.GetTypeLength()), fieldID)
}

// NewPrimitiveNode constructs a primitive node with the ConvertedType of None and no logical type.
//
// Use NewPrimitiveNodeLogical and NewPrimitiveNodeConverted to specify the logical or converted type.
func NewPrimitiveNode(name string, repetition parquet.Repetition, typ parquet.Type, fieldID, typeLength int32) (*PrimitiveNode, error) {
	return NewPrimitiveNodeLogical(name, repetition, nil, typ, int(typeLength), fieldID)
}

// Equals returns true if both nodes are primitive nodes with the same physical
// and converted/logical types.
func (p *PrimitiveNode) Equals(rhs Node) bool {
	if !p.node.Equals(rhs) {
		return false
	}

	other := rhs.(*PrimitiveNode)
	if p == other {
		return true
	}

	if p.PhysicalType() != other.PhysicalType() {
		return false
	}

	equal := true
	if p.ConvertedType() == ConvertedTypes.Decimal {
		equal = equal &&
			(p.decimalMetaData.Precision == other.decimalMetaData.Precision &&
				p.decimalMetaData.Scale == other.decimalMetaData.Scale)
	}
	if p.PhysicalType() == parquet.Types.FixedLenByteArray {
		equal = equal && p.TypeLength() == other.TypeLength()
	}
	return equal
}

// PhysicalType returns the proper Physical parquet.Type primitive that is used
// to store the values in this column.
func (p *PrimitiveNode) PhysicalType() parquet.Type { return p.physicalType }

// SetTypeLength will change the type length of the node, has no effect if the
// physical type is not FixedLength Byte Array
func (p *PrimitiveNode) SetTypeLength(length int) {
	if p.PhysicalType() == parquet.Types.FixedLenByteArray {
		p.typeLen = length
	}
}

// TypeLength will be -1 if not a FixedLenByteArray column, otherwise will be the
// length of the FixedLen Byte Array
func (p *PrimitiveNode) TypeLength() int { return p.typeLen }

// DecimalMetadata returns the current metadata for the node. If not a decimal
// typed column, the return should have IsSet == false.
func (p *PrimitiveNode) DecimalMetadata() DecimalMetadata { return p.decimalMetaData }

// Visit is for implementing a Visitor pattern handler to walk a schema's tree. One
// example is the Schema Printer which walks the tree to print out the schema in order.
func (p *PrimitiveNode) Visit(v Visitor) {
	v.VisitPre(p)
	v.VisitPost(p)
}

func (p *PrimitiveNode) toThrift() *format.SchemaElement {
	elem := &format.SchemaElement{
		Name:           p.Name(),
		RepetitionType: format.FieldRepetitionTypePtr(format.FieldRepetitionType(p.RepetitionType())),
		Type:           format.TypePtr(format.Type(p.PhysicalType())),
	}
	if p.ConvertedType() != ConvertedTypes.None {
		elem.ConvertedType = format.ConvertedTypePtr(format.ConvertedType(p.ConvertedType()))
	}
	if p.FieldID() >= 0 {
		elem.FieldID = thrift.Int32Ptr(p.FieldID())
	}
	if p.logicalType != nil && p.logicalType.IsSerialized() && !p.logicalType.Equals(IntervalLogicalType{}) {
		elem.LogicalType = p.logicalType.toThrift()
	}
	if p.physicalType == parquet.Types.FixedLenByteArray {
		elem.TypeLength = thrift.Int32Ptr(int32(p.typeLen))
	}
	if p.decimalMetaData.IsSet {
		elem.Precision = &p.decimalMetaData.Precision
		elem.Scale = &p.decimalMetaData.Scale
	}
	return elem
}

// FieldList is an alias for a slice of Nodes
type FieldList []Node

// Len is equivalent to len(fieldlist)
func (f FieldList) Len() int { return len(f) }

// GroupNode is for managing nested nodes like List, Map, etc.
type GroupNode struct {
	node
	fields    FieldList
	nameToIdx strIntMultimap
}

// NewGroupNodeConverted constructs a group node with the provided fields and converted type,
// determining the logical type from that converted type.
func NewGroupNodeConverted(name string, repetition parquet.Repetition, fields FieldList, converted ConvertedType, id int32) (n *GroupNode, err error) {
	n = &GroupNode{
		node:   node{typ: Group, name: name, repetition: repetition, convertedType: converted, fieldID: id},
		fields: fields,
	}
	n.logicalType = n.convertedType.ToLogicalType(DecimalMetadata{})
	if !(n.logicalType != nil && (n.logicalType.IsNested() || n.logicalType.IsNone()) && n.logicalType.IsCompatible(n.convertedType, DecimalMetadata{})) {
		err = fmt.Errorf("invalid logical type %s", n.logicalType.String())
		return
	}

	n.nameToIdx = make(strIntMultimap)
	for idx, f := range n.fields {
		f.SetParent(n)
		n.nameToIdx.Add(f.Name(), idx)
	}
	return
}

// NewGroupNodeLogical constructs a group node with the provided fields and logical type,
// determining the converted type from the provided logical type.
func NewGroupNodeLogical(name string, repetition parquet.Repetition, fields FieldList, logical LogicalType, id int32) (n *GroupNode, err error) {
	n = &GroupNode{
		node:   node{typ: Group, name: name, repetition: repetition, logicalType: logical, fieldID: id},
		fields: fields,
	}

	if logical != nil {
		if logical.IsNested() {
			n.convertedType, _ = logical.ToConvertedType()
		} else {
			err = fmt.Errorf("logical type %s cannot be applied to group node", logical)
			return
		}
	} else {
		n.logicalType = NoLogicalType{}
		n.convertedType, _ = n.logicalType.ToConvertedType()
	}

	if !(n.logicalType != nil && (n.logicalType.IsNested() || n.logicalType.IsNone()) && n.logicalType.IsCompatible(n.convertedType, DecimalMetadata{})) {
		err = fmt.Errorf("invalid logical type %s", n.logicalType)
		return
	}

	n.nameToIdx = make(strIntMultimap)
	for idx, f := range n.fields {
		f.SetParent(n)
		n.nameToIdx.Add(f.Name(), idx)
	}
	return
}

// NewGroupNode constructs a new group node with the provided fields,
// but with converted type None and No Logical Type
func NewGroupNode(name string, repetition parquet.Repetition, fields FieldList, fieldID int32) (*GroupNode, error) {
	return NewGroupNodeConverted(name, repetition, fields, ConvertedTypes.None, fieldID)
}

// Must is a convenience function for the NewNode functions that return a Node
// and an error, panic'ing if err != nil or returning the node
func Must(n Node, err error) Node {
	if err != nil {
		panic(err)
	}
	return n
}

// MustGroup is like Must, except it casts the node to a *GroupNode, which will panic
// if it is a primitive node.
func MustGroup(n Node, err error) *GroupNode {
	if err != nil {
		panic(err)
	}
	return n.(*GroupNode)
}

// MustPrimitive is like Must except it casts the node to *PrimitiveNode which will panic
// if it is a group node.
func MustPrimitive(n Node, err error) *PrimitiveNode {
	if err != nil {
		panic(err)
	}
	return n.(*PrimitiveNode)
}

func GroupNodeFromThrift(elem *format.SchemaElement, fields FieldList) (*GroupNode, error) {
	id := int32(-1)
	if elem.IsSetFieldID() {
		id = elem.GetFieldID()
	}

	if elem.IsSetLogicalType() {
		return NewGroupNodeLogical(elem.GetName(), parquet.Repetition(elem.GetRepetitionType()), fields, getLogicalType(elem.GetLogicalType()), id)
	}

	converted := ConvertedTypes.None
	if elem.IsSetConvertedType() {
		converted = ConvertedType(elem.GetConvertedType())
	}
	return NewGroupNodeConverted(elem.GetName(), parquet.Repetition(elem.GetRepetitionType()), fields, converted, id)
}

func (g *GroupNode) toThrift() *format.SchemaElement {
	elem := &format.SchemaElement{
		Name:           g.name,
		NumChildren:    thrift.Int32Ptr(int32(len(g.fields))),
		RepetitionType: format.FieldRepetitionTypePtr(format.FieldRepetitionType(g.RepetitionType())),
	}
	if g.convertedType != ConvertedTypes.None {
		elem.ConvertedType = format.ConvertedTypePtr(format.ConvertedType(g.convertedType))
	}
	if g.fieldID >= 0 {
		elem.FieldID = &g.fieldID
	}
	if g.logicalType != nil && g.logicalType.IsSerialized() {
		elem.LogicalType = g.logicalType.toThrift()
	}
	return elem
}

// Equals will compare this node to the provided node and only return true if
// this node and all of it's children are the same as the passed in node and its
// children.
func (g *GroupNode) Equals(rhs Node) bool {
	if !g.node.Equals(rhs) {
		return false
	}

	other := rhs.(*GroupNode)
	if g == other {
		return true
	}
	if len(g.fields) != len(other.fields) {
		return false
	}

	for idx, field := range g.fields {
		if !field.Equals(other.fields[idx]) {
			return false
		}
	}
	return true
}

// NumFields returns the number of direct child fields for this group node
func (g *GroupNode) NumFields() int {
	return len(g.fields)
}

// Field returns the node in the field list which is of the provided (0-based) index
func (g *GroupNode) Field(i int) Node {
	return g.fields[i]
}

// FieldIndexByName provides the index for the field of the given name. Returns
// -1 if not found.
//
// If there are more than one field of this name, it returns the index for the first one.
func (g *GroupNode) FieldIndexByName(name string) int {
	if idx, ok := g.nameToIdx[name]; ok {
		return idx[0]
	}
	return -1
}

// FieldIndexByField looks up the index child of this node. Returns -1
// if n isn't a child of this group
func (g *GroupNode) FieldIndexByField(n Node) int {
	if search, ok := g.nameToIdx[n.Name()]; ok {
		for _, idx := range search {
			if n == g.fields[idx] {
				return idx
			}
		}
	}
	return -1
}

// Visit is for implementing a Visitor pattern handler to walk a schema's tree. One
// example is the Schema Printer which walks the tree to print out the schema in order.
func (g *GroupNode) Visit(v Visitor) {
	if v.VisitPre(g) {
		for _, field := range g.fields {
			field.Visit(v)
		}
	}
	v.VisitPost(g)
}

// HasRepeatedFields returns true if any of the children of this node have
// Repeated as its repetition type.
//
// This is recursive and will check the children of any group nodes that are children.
func (g *GroupNode) HasRepeatedFields() bool {
	for _, field := range g.fields {
		if field.RepetitionType() == parquet.Repetitions.Repeated {
			return true
		}
		if field.Type() == Group {
			return field.(*GroupNode).HasRepeatedFields()
		}
	}
	return false
}

// NewInt32Node is a convenience factory for constructing an Int32 Primitive Node
func NewInt32Node(name string, rep parquet.Repetition, fieldID int32) *PrimitiveNode {
	return MustPrimitive(NewPrimitiveNode(name, rep, parquet.Types.Int32, fieldID, -1))
}

// NewInt64Node is a convenience factory for constructing an Int64 Primitive Node
func NewInt64Node(name string, rep parquet.Repetition, fieldID int32) *PrimitiveNode {
	return MustPrimitive(NewPrimitiveNode(name, rep, parquet.Types.Int64, fieldID, -1))
}

// NewInt96Node is a convenience factory for constructing an Int96 Primitive Node
func NewInt96Node(name string, rep parquet.Repetition, fieldID int32) *PrimitiveNode {
	return MustPrimitive(NewPrimitiveNode(name, rep, parquet.Types.Int96, fieldID, -1))
}

// NewFloat32Node is a convenience factory for constructing an Float Primitive Node
func NewFloat32Node(name string, rep parquet.Repetition, fieldID int32) *PrimitiveNode {
	return MustPrimitive(NewPrimitiveNode(name, rep, parquet.Types.Float, fieldID, -1))
}

// NewFloat64Node is a convenience factory for constructing an Double Primitive Node
func NewFloat64Node(name string, rep parquet.Repetition, fieldID int32) *PrimitiveNode {
	return MustPrimitive(NewPrimitiveNode(name, rep, parquet.Types.Double, fieldID, -1))
}

// NewBooleanNode is a convenience factory for constructing an Boolean Primitive Node
func NewBooleanNode(name string, rep parquet.Repetition, fieldID int32) *PrimitiveNode {
	return MustPrimitive(NewPrimitiveNode(name, rep, parquet.Types.Boolean, fieldID, -1))
}

// NewByteArrayNode is a convenience factory for constructing an Byte Array Primitive Node
func NewByteArrayNode(name string, rep parquet.Repetition, fieldID int32) *PrimitiveNode {
	return MustPrimitive(NewPrimitiveNode(name, rep, parquet.Types.ByteArray, fieldID, -1))
}

// NewFixedLenByteArrayNode is a convenience factory for constructing an Fixed Length
// Byte Array Primitive Node of the given length
func NewFixedLenByteArrayNode(name string, rep parquet.Repetition, length int32, fieldID int32) *PrimitiveNode {
	return MustPrimitive(NewPrimitiveNode(name, rep, parquet.Types.FixedLenByteArray, fieldID, length))
}
