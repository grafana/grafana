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

package pqarrow

import (
	"encoding/base64"
	"fmt"
	"math"
	"strconv"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/extensions"
	"github.com/apache/arrow-go/v18/arrow/flight"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/file"
	"github.com/apache/arrow-go/v18/parquet/metadata"
	"github.com/apache/arrow-go/v18/parquet/schema"
	"golang.org/x/xerrors"
)

// SchemaField is a holder that defines a specific logical field in the schema
// which could potentially refer to multiple physical columns in the underlying
// parquet file if it is a nested type.
//
// ColIndex is only populated (not -1) when it is a leaf column.
type SchemaField struct {
	Field     *arrow.Field
	Children  []SchemaField
	ColIndex  int
	LevelInfo file.LevelInfo
}

// IsLeaf returns true if the SchemaField is a leaf column, ie: ColIndex != -1
func (s *SchemaField) IsLeaf() bool { return s.ColIndex != -1 }

// SchemaManifest represents a full manifest for mapping a Parquet schema
// to an arrow Schema.
type SchemaManifest struct {
	descr        *schema.Schema
	OriginSchema *arrow.Schema
	SchemaMeta   *arrow.Metadata

	ColIndexToField map[int]*SchemaField
	ChildToParent   map[*SchemaField]*SchemaField
	Fields          []SchemaField
}

// GetColumnField returns the corresponding Field for a given column index.
func (sm *SchemaManifest) GetColumnField(index int) (*SchemaField, error) {
	if field, ok := sm.ColIndexToField[index]; ok {
		return field, nil
	}
	return nil, fmt.Errorf("Column Index %d not found in schema manifest", index)
}

// GetParent gets the parent field for a given field if it is a nested column, otherwise
// returns nil if there is no parent field.
func (sm *SchemaManifest) GetParent(field *SchemaField) *SchemaField {
	if p, ok := sm.ChildToParent[field]; ok {
		return p
	}
	return nil
}

// GetFieldIndices coalesces a list of field indices (relative to the equivalent arrow::Schema) which
// correspond to the column root (first node below the parquet schema's root group) of
// each leaf referenced in column_indices.
//
// For example, for leaves `a.b.c`, `a.b.d.e`, and `i.j.k` (column_indices=[0,1,3])
// the roots are `a` and `i` (return=[0,2]).
//
// root
// -- a  <------
// -- -- b  |  |
// -- -- -- c  |
// -- -- -- d  |
// -- -- -- -- e
// -- f
// -- -- g
// -- -- -- h
// -- i  <---
// -- -- j  |
// -- -- -- k
func (sm *SchemaManifest) GetFieldIndices(indices []int) ([]int, error) {
	added := make(map[int]bool)
	ret := make([]int, 0)

	for _, idx := range indices {
		if idx < 0 || idx >= sm.descr.NumColumns() {
			return nil, fmt.Errorf("column index %d is not valid", idx)
		}

		fieldNode := sm.descr.ColumnRoot(idx)
		fieldIdx := sm.descr.Root().FieldIndexByField(fieldNode)
		if fieldIdx == -1 {
			return nil, fmt.Errorf("column index %d is not valid", idx)
		}

		if _, ok := added[fieldIdx]; !ok {
			ret = append(ret, fieldIdx)
			added[fieldIdx] = true
		}
	}
	return ret, nil
}

// ExtensionCustomParquetType is an interface that Arrow ExtensionTypes may implement
// to specify the target LogicalType to use when converting to Parquet.
//
// The PrimitiveType is not configurable, and is determined by a fixed mapping from
// the extension's StorageType to a Parquet type (see getParquetType in pqarrow source).
type ExtensionCustomParquetType interface {
	ParquetLogicalType() schema.LogicalType
}

func isDictionaryReadSupported(dt arrow.DataType) bool {
	return arrow.IsBinaryLike(dt.ID())
}

func arrowTimestampToLogical(typ *arrow.TimestampType, unit arrow.TimeUnit) schema.LogicalType {
	isAdjustedToUTC := typ.TimeZone != ""

	// for forward compatibility reasons, and because there's no other way
	// to signal to old readers that values are timestamps, we force
	// the convertedtype field to be set to the corresponding TIMESTAMP_* value.
	// this does cause some ambiguity as parquet readers have not been consistent
	// about the interpretation of TIMESTAMP_* values as being utc-normalized
	// see ARROW-5878
	var scunit schema.TimeUnitType
	switch unit {
	case arrow.Millisecond:
		scunit = schema.TimeUnitMillis
	case arrow.Microsecond:
		scunit = schema.TimeUnitMicros
	case arrow.Nanosecond:
		scunit = schema.TimeUnitNanos
	case arrow.Second:
		// no equivalent in parquet
		return schema.NoLogicalType{}
	}

	return schema.NewTimestampLogicalTypeForce(isAdjustedToUTC, scunit)
}

func getTimestampMeta(typ *arrow.TimestampType, props *parquet.WriterProperties, arrprops ArrowWriterProperties) (parquet.Type, schema.LogicalType, error) {
	coerce := arrprops.coerceTimestamps
	target := typ.Unit
	if coerce {
		target = arrprops.coerceTimestampUnit
	}

	// user is explicitly asking for int96, no logical type
	if arrprops.timestampAsInt96 && target == arrow.Nanosecond {
		return parquet.Types.Int96, schema.NoLogicalType{}, nil
	}

	physical := parquet.Types.Int64
	logicalType := arrowTimestampToLogical(typ, target)

	// user is explicitly asking for timestamp data to be converted to the specified
	// units (target) via coercion
	if coerce {
		if props.Version() == parquet.V1_0 || props.Version() == parquet.V2_4 {
			switch target {
			case arrow.Millisecond, arrow.Microsecond:
			case arrow.Nanosecond, arrow.Second:
				return physical, nil, fmt.Errorf("parquet version %s files can only coerce arrow timestamps to millis or micros", props.Version())
			}
		} else if target == arrow.Second {
			return physical, nil, fmt.Errorf("parquet version %s files can only coerce arrow timestamps to millis, micros or nanos", props.Version())
		}
		return physical, logicalType, nil
	}

	// the user implicitly wants timestamp data to retain its original time units
	// however the converted type field used to indicate logical types for parquet
	// version <=2.4 fields, does not allow for nanosecond time units and so nanos
	// must be coerced to micros
	if (props.Version() == parquet.V1_0 || props.Version() == parquet.V2_4) && typ.Unit == arrow.Nanosecond {
		logicalType = arrowTimestampToLogical(typ, arrow.Microsecond)
		return physical, logicalType, nil
	}

	// the user implicitly wants timestamp data to retain it's original time units,
	// however the arrow seconds time unit cannot be represented in parquet, so must
	// be coerced to milliseconds
	if typ.Unit == arrow.Second {
		logicalType = arrowTimestampToLogical(typ, arrow.Millisecond)
	}

	return physical, logicalType, nil
}

// DecimalSize returns the minimum number of bytes necessary to represent a decimal
// with the requested precision.
//
// Taken from the Apache Impala codebase. The comments next to the return values
// are the maximum value that can be represented in 2's complement with the returned
// number of bytes
func DecimalSize(precision int32) int32 {
	if precision < 1 {
		panic("precision must be >= 1")
	}

	// generated in python with:
	// >>> decimal_size = lambda prec: int(math.ceil((prec * math.log2(10) + 1) / 8))
	// >>> [-1] + [decimal_size(i) for i in range(1, 77)]
	var byteblock = [...]int32{
		-1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6, 7, 7, 8, 8, 9,
		9, 9, 10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16, 16, 17,
		17, 18, 18, 18, 19, 19, 20, 20, 21, 21, 21, 22, 22, 23, 23, 23, 24, 24, 25, 25,
		26, 26, 26, 27, 27, 28, 28, 28, 29, 29, 30, 30, 31, 31, 31, 32, 32,
	}

	if precision <= 76 {
		return byteblock[precision]
	}
	return int32(math.Ceil(float64(precision)/8.0)*math.Log2(10) + 1)
}

func repFromNullable(isnullable bool) parquet.Repetition {
	if isnullable {
		return parquet.Repetitions.Optional
	}
	return parquet.Repetitions.Required
}

func variantToNode(t *extensions.VariantType, field arrow.Field, props *parquet.WriterProperties, arrProps ArrowWriterProperties) (schema.Node, error) {
	fields := make(schema.FieldList, 1, 3)
	var err error

	fields[0], err = fieldToNode("metadata", t.Metadata(), props, arrProps)
	if err != nil {
		return nil, err
	}

	if value := t.Value(); value.Type != nil {
		valueField, err := fieldToNode("value", value, props, arrProps)
		if err != nil {
			return nil, err
		}
		fields = append(fields, valueField)
	}

	if typed := t.TypedValue(); typed.Type != nil {
		typedValue, err := fieldToNode("typed_value", typed, props, arrProps)
		if err != nil {
			return nil, err
		}
		fields = append(fields, typedValue)
	}

	return schema.NewGroupNodeLogical(field.Name, repFromNullable(field.Nullable),
		fields, schema.VariantLogicalType{}, fieldIDFromMeta(field.Metadata))
}

func structToNode(field arrow.Field, props *parquet.WriterProperties, arrprops ArrowWriterProperties) (schema.Node, error) {
	typ := field.Type.(*arrow.StructType)
	if typ.NumFields() == 0 {
		return nil, fmt.Errorf("cannot write struct type '%s' with no children field to parquet. Consider adding a dummy child", field.Name)
	}

	children := make(schema.FieldList, 0, typ.NumFields())
	for _, f := range typ.Fields() {
		n, err := fieldToNode(f.Name, f, props, arrprops)
		if err != nil {
			return nil, err
		}
		children = append(children, n)
	}

	return schema.NewGroupNode(field.Name, repFromNullable(field.Nullable), children, fieldIDFromMeta(field.Metadata))
}

func fieldToNode(name string, field arrow.Field, props *parquet.WriterProperties, arrprops ArrowWriterProperties) (schema.Node, error) {
	repType := repFromNullable(field.Nullable)

	// Handle complex types i.e. GroupNodes
	switch field.Type.ID() {
	case arrow.NULL:
		if repType != parquet.Repetitions.Optional {
			return nil, xerrors.New("nulltype arrow field must be nullable")
		}
	case arrow.STRUCT:
		return structToNode(field, props, arrprops)
	case arrow.FIXED_SIZE_LIST, arrow.LIST:
		elemField := field.Type.(arrow.ListLikeType).ElemField()

		child, err := fieldToNode(name, elemField, props, arrprops)
		if err != nil {
			return nil, err
		}

		return schema.ListOfWithName(name, child, repFromNullable(field.Nullable), fieldIDFromMeta(field.Metadata))
	case arrow.DICTIONARY:
		// parquet has no dictionary type, dictionary is encoding, not schema level
		dictType := field.Type.(*arrow.DictionaryType)
		return fieldToNode(name, arrow.Field{Name: name, Type: dictType.ValueType, Nullable: field.Nullable, Metadata: field.Metadata},
			props, arrprops)
	case arrow.MAP:
		mapType := field.Type.(*arrow.MapType)
		keyNode, err := fieldToNode("key", mapType.KeyField(), props, arrprops)
		if err != nil {
			return nil, err
		}

		valueNode, err := fieldToNode("value", mapType.ItemField(), props, arrprops)
		if err != nil {
			return nil, err
		}

		if arrprops.noMapLogicalType {
			keyval := schema.FieldList{keyNode, valueNode}
			keyvalNode, err := schema.NewGroupNode("key_value", parquet.Repetitions.Repeated, keyval, -1)
			if err != nil {
				return nil, err
			}
			return schema.NewGroupNode(field.Name, repFromNullable(field.Nullable), schema.FieldList{
				keyvalNode,
			}, fieldIDFromMeta(field.Metadata))
		}
		return schema.MapOf(field.Name, keyNode, valueNode, repFromNullable(field.Nullable), fieldIDFromMeta(field.Metadata))
	case arrow.EXTENSION:
		extType := field.Type.(arrow.ExtensionType)
		if extType.ExtensionName() == "parquet.variant" {
			return variantToNode(extType.(*extensions.VariantType), field, props, arrprops)
		}
	}

	// Not a GroupNode
	typ, logicalType, length, err := getParquetType(field.Type, props, arrprops)
	if err != nil {
		return nil, err
	}

	return schema.NewPrimitiveNodeLogical(name, repType, logicalType, typ, length, fieldIDFromMeta(field.Metadata))
}

const fieldIDKey = "PARQUET:field_id"

func fieldIDFromMeta(m arrow.Metadata) int32 {
	if m.Len() == 0 {
		return -1
	}

	key := m.FindKey(fieldIDKey)
	if key < 0 {
		return -1
	}

	id, err := strconv.ParseInt(m.Values()[key], 10, 32)
	if err != nil {
		return -1
	}

	if id < 0 {
		return -1
	}

	return int32(id)
}

// ToParquet generates a Parquet Schema from an arrow Schema using the given properties to make
// decisions when determining the logical/physical types of the columns.
func ToParquet(sc *arrow.Schema, props *parquet.WriterProperties, arrprops ArrowWriterProperties) (*schema.Schema, error) {
	if props == nil {
		props = parquet.NewWriterProperties()
	}

	nodes := make(schema.FieldList, 0, sc.NumFields())
	for _, f := range sc.Fields() {
		n, err := fieldToNode(f.Name, f, props, arrprops)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, n)
	}

	root, err := schema.NewGroupNode(props.RootName(), props.RootRepetition(), nodes, -1)
	if err != nil {
		return nil, err
	}

	return schema.NewSchema(root), err
}

type schemaTree struct {
	manifest *SchemaManifest

	schema *schema.Schema
	props  *ArrowReadProperties
}

func (s schemaTree) LinkParent(child, parent *SchemaField) {
	s.manifest.ChildToParent[child] = parent
}

func (s schemaTree) RecordLeaf(leaf *SchemaField) {
	s.manifest.ColIndexToField[leaf.ColIndex] = leaf
}

func arrowInt(log schema.IntLogicalType) (arrow.DataType, error) {
	switch log.BitWidth() {
	case 8:
		if log.IsSigned() {
			return arrow.PrimitiveTypes.Int8, nil
		}
		return arrow.PrimitiveTypes.Uint8, nil
	case 16:
		if log.IsSigned() {
			return arrow.PrimitiveTypes.Int16, nil
		}
		return arrow.PrimitiveTypes.Uint16, nil
	case 32:
		if log.IsSigned() {
			return arrow.PrimitiveTypes.Int32, nil
		}
		return arrow.PrimitiveTypes.Uint32, nil
	case 64:
		if log.IsSigned() {
			return arrow.PrimitiveTypes.Int64, nil
		}
		return arrow.PrimitiveTypes.Uint64, nil
	default:
		return nil, xerrors.New("invalid logical type for int32")
	}
}

func arrowTime32(logical schema.TimeLogicalType) (arrow.DataType, error) {
	if logical.TimeUnit() == schema.TimeUnitMillis {
		return arrow.FixedWidthTypes.Time32ms, nil
	}

	return nil, xerrors.New(logical.String() + " cannot annotate a time32")
}

func arrowTime64(logical schema.TimeLogicalType) (arrow.DataType, error) {
	switch logical.TimeUnit() {
	case schema.TimeUnitMicros:
		return arrow.FixedWidthTypes.Time64us, nil
	case schema.TimeUnitNanos:
		return arrow.FixedWidthTypes.Time64ns, nil
	default:
		return nil, xerrors.New(logical.String() + " cannot annotate int64")
	}
}

func arrowTimestamp(logical schema.TimestampLogicalType) (arrow.DataType, error) {
	tz := ""

	// ConvertedTypes are adjusted to UTC per backward compatibility guidelines
	// https://github.com/apache/parquet-format/blob/eb4b31c1d64a01088d02a2f9aefc6c17c54cc6fc/LogicalTypes.md?plain=1#L480-L485
	if logical.IsAdjustedToUTC() || logical.IsFromConvertedType() {
		tz = "UTC"
	}

	switch logical.TimeUnit() {
	case schema.TimeUnitMillis:
		return &arrow.TimestampType{TimeZone: tz, Unit: arrow.Millisecond}, nil
	case schema.TimeUnitMicros:
		return &arrow.TimestampType{TimeZone: tz, Unit: arrow.Microsecond}, nil
	case schema.TimeUnitNanos:
		return &arrow.TimestampType{TimeZone: tz, Unit: arrow.Nanosecond}, nil
	default:
		return nil, xerrors.New("Unrecognized unit in timestamp logical type " + logical.String())
	}
}

func arrowDecimal(logical schema.DecimalLogicalType) arrow.DataType {
	if logical.Precision() <= decimal128.MaxPrecision {
		return &arrow.Decimal128Type{Precision: logical.Precision(), Scale: logical.Scale()}
	}
	return &arrow.Decimal256Type{Precision: logical.Precision(), Scale: logical.Scale()}
}

func arrowFromInt32(logical schema.LogicalType) (arrow.DataType, error) {
	switch logtype := logical.(type) {
	case schema.NoLogicalType:
		return arrow.PrimitiveTypes.Int32, nil
	case schema.TimeLogicalType:
		return arrowTime32(logtype)
	case schema.DecimalLogicalType:
		return arrowDecimal(logtype), nil
	case schema.IntLogicalType:
		return arrowInt(logtype)
	case schema.DateLogicalType:
		return arrow.FixedWidthTypes.Date32, nil
	default:
		return nil, xerrors.New(logical.String() + " cannot annotate int32")
	}
}

func arrowFromInt64(logical schema.LogicalType) (arrow.DataType, error) {
	if logical.IsNone() {
		return arrow.PrimitiveTypes.Int64, nil
	}

	switch logtype := logical.(type) {
	case schema.IntLogicalType:
		return arrowInt(logtype)
	case schema.DecimalLogicalType:
		return arrowDecimal(logtype), nil
	case schema.TimeLogicalType:
		return arrowTime64(logtype)
	case schema.TimestampLogicalType:
		return arrowTimestamp(logtype)
	default:
		return nil, xerrors.New(logical.String() + " cannot annotate int64")
	}
}

func arrowFromByteArray(logical schema.LogicalType) (arrow.DataType, error) {
	switch logtype := logical.(type) {
	case schema.StringLogicalType:
		return arrow.BinaryTypes.String, nil
	case schema.DecimalLogicalType:
		return arrowDecimal(logtype), nil
	case schema.NoLogicalType,
		schema.EnumLogicalType,
		schema.JSONLogicalType,
		schema.BSONLogicalType:
		return arrow.BinaryTypes.Binary, nil
	default:
		return nil, xerrors.New("unhandled logicaltype " + logical.String() + " for byte_array")
	}
}

func arrowFromFLBA(logical schema.LogicalType, length int) (arrow.DataType, error) {
	switch logtype := logical.(type) {
	case schema.DecimalLogicalType:
		return arrowDecimal(logtype), nil
	case schema.NoLogicalType, schema.IntervalLogicalType:
		return &arrow.FixedSizeBinaryType{ByteWidth: int(length)}, nil
	case schema.UUIDLogicalType:
		uuidType := arrow.GetExtensionType("arrow.uuid")
		if uuidType == nil {
			return &arrow.FixedSizeBinaryType{ByteWidth: int(length)}, nil
		}
		return uuidType, nil
	case schema.Float16LogicalType:
		return &arrow.Float16Type{}, nil
	default:
		return nil, xerrors.New("unhandled logical type " + logical.String() + " for fixed-length byte array")
	}
}

func getParquetType(typ arrow.DataType, props *parquet.WriterProperties, arrprops ArrowWriterProperties) (parquet.Type, schema.LogicalType, int, error) {
	switch typ.ID() {
	case arrow.NULL:
		return parquet.Types.Int32, schema.NullLogicalType{}, -1, nil
	case arrow.BOOL:
		return parquet.Types.Boolean, schema.NoLogicalType{}, -1, nil
	case arrow.UINT8:
		return parquet.Types.Int32, schema.NewIntLogicalType(8, false), -1, nil
	case arrow.INT8:
		return parquet.Types.Int32, schema.NewIntLogicalType(8, true), -1, nil
	case arrow.UINT16:
		return parquet.Types.Int32, schema.NewIntLogicalType(16, false), -1, nil
	case arrow.INT16:
		return parquet.Types.Int32, schema.NewIntLogicalType(16, true), -1, nil
	case arrow.UINT32:
		return parquet.Types.Int32, schema.NewIntLogicalType(32, false), -1, nil
	case arrow.INT32:
		return parquet.Types.Int32, schema.NewIntLogicalType(32, true), -1, nil
	case arrow.UINT64:
		return parquet.Types.Int64, schema.NewIntLogicalType(64, false), -1, nil
	case arrow.INT64:
		return parquet.Types.Int64, schema.NewIntLogicalType(64, true), -1, nil
	case arrow.FLOAT32:
		return parquet.Types.Float, schema.NoLogicalType{}, -1, nil
	case arrow.FLOAT64:
		return parquet.Types.Double, schema.NoLogicalType{}, -1, nil
	case arrow.STRING, arrow.LARGE_STRING:
		return parquet.Types.ByteArray, schema.StringLogicalType{}, -1, nil
	case arrow.BINARY, arrow.LARGE_BINARY:
		return parquet.Types.ByteArray, schema.NoLogicalType{}, -1, nil
	case arrow.FIXED_SIZE_BINARY:
		return parquet.Types.FixedLenByteArray, schema.NoLogicalType{}, typ.(*arrow.FixedSizeBinaryType).ByteWidth, nil
	case arrow.DECIMAL, arrow.DECIMAL256:
		dectype := typ.(arrow.DecimalType)
		precision := int(dectype.GetPrecision())
		scale := int(dectype.GetScale())

		logicalType := schema.NewDecimalLogicalType(int32(precision), int32(scale))
		if !props.StoreDecimalAsInteger() || precision > 18 {
			return parquet.Types.FixedLenByteArray, logicalType, int(DecimalSize(int32(precision))), nil
		}

		pqType := parquet.Types.Int32
		if precision > 9 {
			pqType = parquet.Types.Int64
		}

		return pqType, logicalType, -1, nil
	case arrow.DATE32:
		return parquet.Types.Int32, schema.DateLogicalType{}, -1, nil
	case arrow.DATE64:
		return parquet.Types.Int32, schema.DateLogicalType{}, -1, nil
	case arrow.TIMESTAMP:
		pqType, logicalType, err := getTimestampMeta(typ.(*arrow.TimestampType), props, arrprops)
		return pqType, logicalType, -1, err
	case arrow.TIME32:
		return parquet.Types.Int32, schema.NewTimeLogicalType(false, schema.TimeUnitMillis), -1, nil
	case arrow.TIME64:
		pqTimeUnit := schema.TimeUnitMicros
		if typ.(*arrow.Time64Type).Unit == arrow.Nanosecond {
			pqTimeUnit = schema.TimeUnitNanos
		}

		return parquet.Types.Int64, schema.NewTimeLogicalType(false, pqTimeUnit), -1, nil
	case arrow.FLOAT16:
		return parquet.Types.FixedLenByteArray, schema.Float16LogicalType{}, arrow.Float16SizeBytes, nil
	case arrow.EXTENSION:
		storageType := typ.(arrow.ExtensionType).StorageType()
		pqType, logicalType, length, err := getParquetType(storageType, props, arrprops)
		if withCustomType, ok := typ.(ExtensionCustomParquetType); ok {
			logicalType = withCustomType.ParquetLogicalType()
		}

		return pqType, logicalType, length, err
	default:
		return parquet.Type(0), nil, 0, fmt.Errorf("%w: support for %s", arrow.ErrNotImplemented, typ.ID())
	}
}

func getArrowType(physical parquet.Type, logical schema.LogicalType, typeLen int) (arrow.DataType, error) {
	if !logical.IsValid() || logical.Equals(schema.NullLogicalType{}) {
		return arrow.Null, nil
	}

	switch physical {
	case parquet.Types.Boolean:
		return arrow.FixedWidthTypes.Boolean, nil
	case parquet.Types.Int32:
		return arrowFromInt32(logical)
	case parquet.Types.Int64:
		return arrowFromInt64(logical)
	case parquet.Types.Int96:
		return arrow.FixedWidthTypes.Timestamp_ns, nil
	case parquet.Types.Float:
		return arrow.PrimitiveTypes.Float32, nil
	case parquet.Types.Double:
		return arrow.PrimitiveTypes.Float64, nil
	case parquet.Types.ByteArray:
		return arrowFromByteArray(logical)
	case parquet.Types.FixedLenByteArray:
		return arrowFromFLBA(logical, typeLen)
	default:
		return nil, xerrors.New("invalid physical column type")
	}
}

func populateLeaf(colIndex int, field *arrow.Field, currentLevels file.LevelInfo, ctx *schemaTree, parent *SchemaField, out *SchemaField) {
	out.Field = field
	out.ColIndex = colIndex
	out.LevelInfo = currentLevels
	ctx.RecordLeaf(out)
	ctx.LinkParent(out, parent)
}

func listToSchemaField(n *schema.GroupNode, currentLevels file.LevelInfo, ctx *schemaTree, parent, out *SchemaField) error {
	if n.NumFields() != 1 {
		return xerrors.New("LIST groups must have only 1 child")
	}

	if n.RepetitionType() == parquet.Repetitions.Repeated {
		return xerrors.New("LIST groups must not be repeated")
	}

	currentLevels.Increment(n)

	out.Children = makeSchemaFields(n.NumFields())
	ctx.LinkParent(out, parent)
	ctx.LinkParent(&out.Children[0], out)

	listNode := n.Field(0)
	if listNode.RepetitionType() != parquet.Repetitions.Repeated {
		return xerrors.New("non-repeated nodes in a list group are not supported")
	}

	repeatedAncestorDef := currentLevels.IncrementRepeated()
	if listNode.Type() == schema.Group {
		// Resolve 3-level encoding
		//
		// required/optional group name=whatever {
		//   repeated group name=list {
		//     required/optional TYPE item;
		//   }
		// }
		//
		// yields list<item: TYPE ?nullable> ?nullable
		//
		// We distinguish the special case that we have
		//
		// required/optional group name=whatever {
		//   repeated group name=array or $SOMETHING_tuple {
		//     required/optional TYPE item;
		//   }
		// }
		//
		// In this latter case, the inner type of the list should be a struct
		// rather than a primitive value
		//
		// yields list<item: struct<item: TYPE ?nullable> not null> ?nullable
		// Special case mentioned in the format spec:
		//   If the name is array or ends in _tuple, this should be a list of struct
		//   even for single child elements.
		listGroup := listNode.(*schema.GroupNode)
		if listGroup.NumFields() == 1 && !(listGroup.Name() == "array" || listGroup.Name() == (n.Name()+"_tuple")) {
			// list of primitive type
			if err := nodeToSchemaField(listGroup.Field(0), currentLevels, ctx, out, &out.Children[0]); err != nil {
				return err
			}
		} else {
			if err := groupToStructField(listGroup, currentLevels, ctx, &out.Children[0]); err != nil {
				return err
			}
		}
	} else {
		// Two-level list encoding
		//
		// required/optional group LIST {
		//   repeated TYPE;
		// }
		primitiveNode := listNode.(*schema.PrimitiveNode)
		colIndex := ctx.schema.ColumnIndexByNode(primitiveNode)
		arrowType, err := getArrowType(primitiveNode.PhysicalType(), primitiveNode.LogicalType(), primitiveNode.TypeLength())
		if err != nil {
			return err
		}

		if ctx.props.ReadDict(colIndex) && isDictionaryReadSupported(arrowType) {
			arrowType = &arrow.DictionaryType{IndexType: arrow.PrimitiveTypes.Int32, ValueType: arrowType}
		}

		if arrow.IsBinaryLike(arrowType.ID()) && ctx.props.ForceLarge(colIndex) {
			switch arrowType.ID() {
			case arrow.STRING:
				arrowType = arrow.BinaryTypes.LargeString
			case arrow.BINARY:
				arrowType = arrow.BinaryTypes.LargeBinary
			}
		}

		itemField := arrow.Field{Name: listNode.Name(), Type: arrowType, Nullable: false, Metadata: createFieldMeta(int(listNode.FieldID()))}
		populateLeaf(colIndex, &itemField, currentLevels, ctx, out, &out.Children[0])
	}

	out.Field = &arrow.Field{Name: n.Name(), Type: arrow.ListOfField(*out.Children[0].Field),
		Nullable: n.RepetitionType() == parquet.Repetitions.Optional, Metadata: createFieldMeta(int(n.FieldID()))}

	out.LevelInfo = currentLevels
	// At this point current levels contains the def level for this list,
	// we need to reset to the prior parent.
	out.LevelInfo.RepeatedAncestorDefLevel = repeatedAncestorDef
	return nil
}

func groupToStructField(n *schema.GroupNode, currentLevels file.LevelInfo, ctx *schemaTree, out *SchemaField) error {
	arrowFields := make([]arrow.Field, 0, n.NumFields())
	out.Children = makeSchemaFields(n.NumFields())

	for i := 0; i < n.NumFields(); i++ {
		if err := nodeToSchemaField(n.Field(i), currentLevels, ctx, out, &out.Children[i]); err != nil {
			return err
		}
		arrowFields = append(arrowFields, *out.Children[i].Field)
	}

	out.Field = &arrow.Field{Name: n.Name(), Type: arrow.StructOf(arrowFields...),
		Nullable: n.RepetitionType() != parquet.Repetitions.Required, Metadata: createFieldMeta(int(n.FieldID()))}
	out.LevelInfo = currentLevels
	return nil
}

func mapToSchemaField(n *schema.GroupNode, currentLevels file.LevelInfo, ctx *schemaTree, parent, out *SchemaField) error {
	if n.NumFields() != 1 {
		return xerrors.New("MAP group must have exactly 1 child")
	}
	if n.RepetitionType() == parquet.Repetitions.Repeated {
		return xerrors.New("MAP groups must not be repeated")
	}

	keyvalueNode := n.Field(0)
	if keyvalueNode.RepetitionType() != parquet.Repetitions.Repeated {
		return xerrors.New("Non-repeated keyvalue group in MAP group is not supported")
	}

	if keyvalueNode.Type() != schema.Group {
		return xerrors.New("keyvalue node must be a group")
	}

	kvgroup := keyvalueNode.(*schema.GroupNode)
	if kvgroup.NumFields() != 1 && kvgroup.NumFields() != 2 {
		return fmt.Errorf("keyvalue node group must have exactly 1 or 2 child elements, Found %d", kvgroup.NumFields())
	}

	keyNode := kvgroup.Field(0)
	if keyNode.RepetitionType() != parquet.Repetitions.Required {
		return xerrors.New("MAP keys must be required")
	}

	// Arrow doesn't support 1 column maps (i.e. Sets).  The options are to either
	// make the values column nullable, or process the map as a list.  We choose the latter
	// as it is simpler.
	if kvgroup.NumFields() == 1 {
		return listToSchemaField(n, currentLevels, ctx, parent, out)
	}

	currentLevels.Increment(n)
	repeatedAncestorDef := currentLevels.IncrementRepeated()
	out.Children = makeSchemaFields(1)

	kvfield := &out.Children[0]
	kvfield.Children = makeSchemaFields(2)

	keyField := &kvfield.Children[0]
	valueField := &kvfield.Children[1]

	ctx.LinkParent(out, parent)
	ctx.LinkParent(kvfield, out)
	ctx.LinkParent(keyField, kvfield)
	ctx.LinkParent(valueField, kvfield)

	// required/optional group name=whatever {
	//   repeated group name=key_values{
	//     required TYPE key;
	// required/optional TYPE value;
	//   }
	// }
	//

	if err := nodeToSchemaField(keyNode, currentLevels, ctx, kvfield, keyField); err != nil {
		return err
	}
	if err := nodeToSchemaField(kvgroup.Field(1), currentLevels, ctx, kvfield, valueField); err != nil {
		return err
	}

	kvfield.Field = &arrow.Field{Name: n.Name(), Type: arrow.StructOf(*keyField.Field, *valueField.Field),
		Nullable: false, Metadata: createFieldMeta(int(kvgroup.FieldID()))}

	kvfield.LevelInfo = currentLevels
	out.Field = &arrow.Field{Name: n.Name(), Type: arrow.MapOfFields(*keyField.Field, *valueField.Field),
		Nullable: n.RepetitionType() == parquet.Repetitions.Optional,
		Metadata: createFieldMeta(int(n.FieldID()))}
	out.LevelInfo = currentLevels
	// At this point current levels contains the def level for this map,
	// we need to reset to the prior parent.
	out.LevelInfo.RepeatedAncestorDefLevel = repeatedAncestorDef
	return nil
}

func variantToSchemaField(n *schema.GroupNode, currentLevels file.LevelInfo, ctx *schemaTree, _, out *SchemaField) error {
	switch n.NumFields() {
	case 2, 3:
	default:
		return fmt.Errorf("VARIANT group must have exactly 2 or 3 children, not %d", n.NumFields())
	}

	if n.RepetitionType() == parquet.Repetitions.Repeated {
		// list of variants
		out.Children = makeSchemaFields(1)
		repeatedAncestorDef := currentLevels.IncrementRepeated()
		if err := groupToStructField(n, currentLevels, ctx, &out.Children[0]); err != nil {
			return err
		}

		storageType := out.Children[0].Field.Type
		elemType, err := extensions.NewVariantType(storageType)
		if err != nil {
			return err
		}

		out.Children[0].Field.Type = elemType
		out.Field = &arrow.Field{Name: n.Name(), Type: arrow.ListOfField(*out.Children[0].Field), Nullable: true,
			Metadata: createFieldMeta(int(n.FieldID()))}
		ctx.LinkParent(&out.Children[0], out)
		out.LevelInfo = currentLevels
		out.LevelInfo.RepeatedAncestorDefLevel = repeatedAncestorDef
		return nil
	}

	currentLevels.Increment(n)

	var err error
	if err = groupToStructField(n, currentLevels, ctx, out); err != nil {
		return err
	}

	storageType := out.Field.Type
	out.Field.Type, err = extensions.NewVariantType(storageType)
	return err
}

func groupToSchemaField(n *schema.GroupNode, currentLevels file.LevelInfo, ctx *schemaTree, parent, out *SchemaField) error {
	if n.LogicalType().Equals(schema.NewListLogicalType()) {
		return listToSchemaField(n, currentLevels, ctx, parent, out)
	} else if n.LogicalType().Equals(schema.MapLogicalType{}) {
		return mapToSchemaField(n, currentLevels, ctx, parent, out)
	} else if n.LogicalType().Equals(schema.VariantLogicalType{}) {
		return variantToSchemaField(n, currentLevels, ctx, parent, out)
	}

	if n.RepetitionType() == parquet.Repetitions.Repeated {
		// Simple repeated struct
		//
		// repeated group $NAME {
		//   r/o TYPE[0] f0
		//   r/o TYPE[1] f1
		// }
		out.Children = makeSchemaFields(1)
		repeatedAncestorDef := currentLevels.IncrementRepeated()
		if err := groupToStructField(n, currentLevels, ctx, &out.Children[0]); err != nil {
			return err
		}

		out.Field = &arrow.Field{Name: n.Name(), Type: arrow.ListOf(out.Children[0].Field.Type), Nullable: false,
			Metadata: createFieldMeta(int(n.FieldID()))}
		ctx.LinkParent(&out.Children[0], out)
		out.LevelInfo = currentLevels
		out.LevelInfo.RepeatedAncestorDefLevel = repeatedAncestorDef
		return nil
	}

	currentLevels.Increment(n)
	return groupToStructField(n, currentLevels, ctx, out)
}

func createFieldMeta(fieldID int) arrow.Metadata {
	return arrow.NewMetadata([]string{"PARQUET:field_id"}, []string{strconv.Itoa(fieldID)})
}

func nodeToSchemaField(n schema.Node, currentLevels file.LevelInfo, ctx *schemaTree, parent, out *SchemaField) error {
	ctx.LinkParent(out, parent)

	if n.Type() == schema.Group {
		return groupToSchemaField(n.(*schema.GroupNode), currentLevels, ctx, parent, out)
	}

	// Either a normal flat primitive type, or a list type encoded with 1-level
	// list encoding. Note that the 3-level encoding is the form recommended by
	// the parquet specification, but technically we can have either
	//
	// required/optional $TYPE $FIELD_NAME
	//
	// or
	//
	// repeated $TYPE $FIELD_NAME

	primitive := n.(*schema.PrimitiveNode)
	colIndex := ctx.schema.ColumnIndexByNode(primitive)
	arrowType, err := getArrowType(primitive.PhysicalType(), primitive.LogicalType(), primitive.TypeLength())
	if err != nil {
		return err
	}

	if ctx.props.ReadDict(colIndex) && isDictionaryReadSupported(arrowType) {
		arrowType = &arrow.DictionaryType{IndexType: arrow.PrimitiveTypes.Int32, ValueType: arrowType}
	}

	if arrow.IsBinaryLike(arrowType.ID()) && ctx.props.ForceLarge(colIndex) {
		switch arrowType.ID() {
		case arrow.STRING:
			arrowType = arrow.BinaryTypes.LargeString
		case arrow.BINARY:
			arrowType = arrow.BinaryTypes.LargeBinary
		}
	}

	if primitive.RepetitionType() == parquet.Repetitions.Repeated {
		// one-level list encoding e.g. a: repeated int32;
		repeatedAncestorDefLevel := currentLevels.IncrementRepeated()
		out.Children = makeSchemaFields(1)
		child := arrow.Field{Name: primitive.Name(), Type: arrowType, Nullable: false}
		populateLeaf(colIndex, &child, currentLevels, ctx, out, &out.Children[0])
		out.Field = &arrow.Field{Name: primitive.Name(), Type: arrow.ListOf(child.Type), Nullable: false,
			Metadata: createFieldMeta(int(primitive.FieldID()))}
		out.LevelInfo = currentLevels
		out.LevelInfo.RepeatedAncestorDefLevel = repeatedAncestorDefLevel
		return nil
	}

	currentLevels.Increment(n)
	populateLeaf(colIndex, &arrow.Field{Name: n.Name(), Type: arrowType,
		Nullable: n.RepetitionType() == parquet.Repetitions.Optional,
		Metadata: createFieldMeta(int(n.FieldID()))},
		currentLevels, ctx, parent, out)
	return nil
}

func getOriginSchema(meta metadata.KeyValueMetadata, mem memory.Allocator) (*arrow.Schema, error) {
	if meta == nil {
		return nil, nil
	}

	const arrowSchemaKey = "ARROW:schema"
	serialized := meta.FindValue(arrowSchemaKey)
	if serialized == nil {
		return nil, nil
	}

	var (
		decoded []byte
		err     error
	)

	// if the length of serialized is not a multiple of 4, it cannot be
	// padded with std encoding.
	if len(*serialized)%4 == 0 {
		decoded, err = base64.StdEncoding.DecodeString(*serialized)
	}
	// if we failed to decode it with stdencoding or the length wasn't
	// a multiple of 4, try using the Raw unpadded encoding
	if len(decoded) == 0 || err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(*serialized)
	}

	if err != nil {
		return nil, err
	}

	return flight.DeserializeSchema(decoded, mem)
}

func getNestedFactory(origin, inferred arrow.DataType) func(fieldList []arrow.Field) arrow.DataType {
	switch inferred.ID() {
	case arrow.STRUCT:
		if origin.ID() == arrow.STRUCT {
			return func(list []arrow.Field) arrow.DataType {
				return arrow.StructOf(list...)
			}
		}
	case arrow.LIST:
		switch origin.ID() {
		case arrow.LIST:
			return func(list []arrow.Field) arrow.DataType {
				return arrow.ListOfField(list[0])
			}
		case arrow.FIXED_SIZE_LIST:
			sz := origin.(*arrow.FixedSizeListType).Len()
			return func(list []arrow.Field) arrow.DataType {
				return arrow.FixedSizeListOfField(sz, list[0])
			}
		}
	case arrow.MAP:
		if origin.ID() == arrow.MAP {
			return func(list []arrow.Field) arrow.DataType {
				valType := list[0].Type.(*arrow.StructType)
				return arrow.MapOfFields(valType.Field(0), valType.Field(1))
			}
		}
	}
	return nil
}

func applyOriginalStorageMetadata(origin arrow.Field, inferred *SchemaField) (modified bool, err error) {
	nchildren := len(inferred.Children)
	switch origin.Type.ID() {
	case arrow.EXTENSION:
		extType := origin.Type.(arrow.ExtensionType)
		modified, err = applyOriginalStorageMetadata(arrow.Field{
			Type:     extType.StorageType(),
			Metadata: origin.Metadata,
		}, inferred)
		if err != nil {
			return
		}

		if modified && !arrow.TypeEqual(extType, inferred.Field.Type) {
			if !arrow.TypeEqual(extType.StorageType(), inferred.Field.Type) {
				return modified, fmt.Errorf("%w: mismatch storage type '%s' for extension type '%s'",
					arrow.ErrInvalid, inferred.Field.Type, extType)
			}

			inferred.Field.Type = extType
		}
	case arrow.SPARSE_UNION, arrow.DENSE_UNION:
		err = xerrors.New("unimplemented type")
	case arrow.STRUCT:
		typ := origin.Type.(*arrow.StructType)
		if nchildren != typ.NumFields() {
			return
		}

		factory := getNestedFactory(typ, inferred.Field.Type)
		if factory == nil {
			return
		}

		modified = typ.ID() != inferred.Field.Type.ID()
		for idx := range inferred.Children {
			childMod, err := applyOriginalMetadata(typ.Field(idx), &inferred.Children[idx])
			if err != nil {
				return false, err
			}
			modified = modified || childMod
		}
		if modified {
			modifiedChildren := make([]arrow.Field, len(inferred.Children))
			for idx, child := range inferred.Children {
				modifiedChildren[idx] = *child.Field
			}
			inferred.Field.Type = factory(modifiedChildren)
		}
	case arrow.FIXED_SIZE_LIST, arrow.LIST, arrow.LARGE_LIST, arrow.MAP: // arrow.ListLike
		if nchildren != 1 {
			return
		}
		factory := getNestedFactory(origin.Type, inferred.Field.Type)
		if factory == nil {
			return
		}

		modified = origin.Type.ID() != inferred.Field.Type.ID()
		childModified, err := applyOriginalMetadata(arrow.Field{Type: origin.Type.(arrow.ListLikeType).Elem()}, &inferred.Children[0])
		if err != nil {
			return modified, err
		}
		modified = modified || childModified
		if modified {
			inferred.Field.Type = factory([]arrow.Field{*inferred.Children[0].Field})
		}
	case arrow.TIMESTAMP:
		if inferred.Field.Type.ID() != arrow.TIMESTAMP {
			return
		}

		tsOtype := origin.Type.(*arrow.TimestampType)
		tsInfType := inferred.Field.Type.(*arrow.TimestampType)

		// if the unit is the same and the data is tz-aware, then set the original time zone
		// since parquet has no native storage of timezones
		if tsOtype.Unit == tsInfType.Unit && tsInfType.TimeZone == "UTC" && tsOtype.TimeZone != "" {
			inferred.Field.Type = origin.Type
		}
		modified = true
	case arrow.LARGE_STRING, arrow.LARGE_BINARY:
		inferred.Field.Type = origin.Type
		modified = true
	case arrow.DICTIONARY:
		if origin.Type.ID() != arrow.DICTIONARY || (inferred.Field.Type.ID() == arrow.DICTIONARY || !isDictionaryReadSupported(inferred.Field.Type)) {
			return
		}

		// direct dictionary reads are only supported for a few primitive types
		// so no need to recurse on value types
		dictOriginType := origin.Type.(*arrow.DictionaryType)
		inferred.Field.Type = &arrow.DictionaryType{IndexType: arrow.PrimitiveTypes.Int32,
			ValueType: inferred.Field.Type, Ordered: dictOriginType.Ordered}
		modified = true
	case arrow.DECIMAL256:
		if inferred.Field.Type.ID() == arrow.DECIMAL128 {
			inferred.Field.Type = origin.Type
			modified = true
		}
	}

	if origin.HasMetadata() {
		meta := origin.Metadata
		if inferred.Field.HasMetadata() {
			final := make(map[string]string)
			for idx, k := range meta.Keys() {
				final[k] = meta.Values()[idx]
			}
			for idx, k := range inferred.Field.Metadata.Keys() {
				final[k] = inferred.Field.Metadata.Values()[idx]
			}
			inferred.Field.Metadata = arrow.MetadataFrom(final)
		} else {
			inferred.Field.Metadata = meta
		}
		modified = true
	}

	return
}

func applyOriginalMetadata(origin arrow.Field, inferred *SchemaField) (bool, error) {
	return applyOriginalStorageMetadata(origin, inferred)
}

// NewSchemaManifest creates a manifest for mapping a parquet schema to a given arrow schema.
//
// The metadata passed in should be the file level key value metadata from the parquet file or nil.
// If the ARROW:schema was in the metadata, then it is utilized to determine types.
func NewSchemaManifest(sc *schema.Schema, meta metadata.KeyValueMetadata, props *ArrowReadProperties) (*SchemaManifest, error) {
	var ctx schemaTree
	ctx.manifest = &SchemaManifest{
		ColIndexToField: make(map[int]*SchemaField),
		ChildToParent:   make(map[*SchemaField]*SchemaField),
		descr:           sc,
		Fields:          makeSchemaFields(sc.Root().NumFields()),
	}
	ctx.props = props
	if ctx.props == nil {
		ctx.props = &ArrowReadProperties{}
	}
	ctx.schema = sc

	var err error
	ctx.manifest.OriginSchema, err = getOriginSchema(meta, memory.DefaultAllocator)
	if err != nil {
		return nil, err
	}

	// if original schema is not compatible with the parquet schema, ignore it
	if ctx.manifest.OriginSchema != nil && len(ctx.manifest.OriginSchema.Fields()) != sc.Root().NumFields() {
		ctx.manifest.OriginSchema = nil
	}

	for idx := range ctx.manifest.Fields {
		field := &ctx.manifest.Fields[idx]
		if err := nodeToSchemaField(sc.Root().Field(idx), file.LevelInfo{NullSlotUsage: 1}, &ctx, nil, field); err != nil {
			return nil, err
		}

		if ctx.manifest.OriginSchema != nil {
			if _, err := applyOriginalMetadata(ctx.manifest.OriginSchema.Field(idx), field); err != nil {
				return nil, err
			}
		}
	}
	return ctx.manifest, nil
}

// FromParquet generates an arrow Schema from a provided Parquet Schema
func FromParquet(sc *schema.Schema, props *ArrowReadProperties, kv metadata.KeyValueMetadata) (*arrow.Schema, error) {
	manifest, err := NewSchemaManifest(sc, kv, props)
	if err != nil {
		return nil, err
	}

	fields := make([]arrow.Field, len(manifest.Fields))
	for idx, field := range manifest.Fields {
		fields[idx] = *field.Field
	}

	if manifest.OriginSchema != nil {
		meta := manifest.OriginSchema.Metadata()
		return arrow.NewSchema(fields, &meta), nil
	}
	return arrow.NewSchema(fields, manifest.SchemaMeta), nil
}

func makeSchemaFields(n int) []SchemaField {
	fields := make([]SchemaField, n)
	for i := range fields {
		fields[i].ColIndex = -1
	}
	return fields
}
