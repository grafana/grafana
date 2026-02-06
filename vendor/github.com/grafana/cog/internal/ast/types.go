package ast

import (
	"fmt"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/cog/internal/tools"
)

type Kind string

const (
	KindDisjunction Kind = "disjunction"
	KindRef         Kind = "ref"
	KindConstantRef Kind = "constant_ref"

	KindStruct Kind = "struct"
	KindEnum   Kind = "enum"
	KindMap    Kind = "map"

	KindArray Kind = "array"

	KindScalar       Kind = "scalar"
	KindIntersection Kind = "intersection"

	KindComposableSlot Kind = "composable_slot"
)

type ScalarKind string

const (
	KindNull   ScalarKind = "null"
	KindAny    ScalarKind = "any"
	KindBytes  ScalarKind = "bytes"
	KindString ScalarKind = "string"

	KindFloat32 ScalarKind = "float32"
	KindFloat64 ScalarKind = "float64"

	KindUint8  ScalarKind = "uint8"
	KindUint16 ScalarKind = "uint16"
	KindUint32 ScalarKind = "uint32"
	KindUint64 ScalarKind = "uint64"
	KindInt8   ScalarKind = "int8"
	KindInt16  ScalarKind = "int16"
	KindInt32  ScalarKind = "int32"
	KindInt64  ScalarKind = "int64"

	KindBool ScalarKind = "bool"
)

type Op string

const (
	MinLengthOp        Op = "minLength"
	MaxLengthOp        Op = "maxLength"
	MultipleOfOp       Op = "multipleOf"
	EqualOp            Op = "=="
	NotEqualOp         Op = "!="
	LessThanOp         Op = "<"
	LessThanEqualOp    Op = "<="
	GreaterThanOp      Op = ">"
	GreaterThanEqualOp Op = ">="
)

type TypeConstraint struct {
	Op   Op
	Args []any
}

func (constraint TypeConstraint) DeepCopy() TypeConstraint {
	newConstraint := TypeConstraint{
		Op:   constraint.Op,
		Args: make([]any, 0, len(constraint.Args)),
	}

	newConstraint.Args = append(newConstraint.Args, constraint.Args...)

	return newConstraint
}

// JenniesHints meant to be used by jennies, to gain a finer control on the codegen from schemas
type JenniesHints map[string]any

// Type representing every type defined by the IR.
// Bonus: in a way that can be (un)marshaled to/from JSON,
// which is useful for unit tests.
type Type struct {
	Kind     Kind
	Nullable bool
	Default  any `json:",omitempty"`

	Disjunction       *DisjunctionType       `json:",omitempty"`
	Array             *ArrayType             `json:",omitempty"`
	Enum              *EnumType              `json:",omitempty"`
	Map               *MapType               `json:",omitempty"`
	Struct            *StructType            `json:",omitempty"`
	Ref               *RefType               `json:",omitempty"`
	ConstantReference *ConstantReferenceType `json:",omitempty" yaml:"constant_ref"`
	Scalar            *ScalarType            `json:",omitempty"`
	Intersection      *IntersectionType      `json:",omitempty"`
	ComposableSlot    *ComposableSlotType    `json:",omitempty" yaml:"composable_slot"`

	Hints       JenniesHints `json:",omitempty"`
	PassesTrail []string     `json:",omitempty"`
}

func (t *Type) AcceptsValue(value any) bool {
	if t.Disjunction != nil {
		return t.Disjunction.AcceptsValue(value)
	}
	if t.Array != nil {
		return t.Array.AcceptsValue(value)
	}
	if t.Enum != nil {
		return t.Enum.AcceptsValue(value)
	}
	if t.Map != nil {
		return t.Map.AcceptsValue(value)
	}
	if t.Struct != nil {
		return false // TODO: implement later if needed
	}
	if t.Ref != nil {
		return false // TODO: implement later if needed
	}
	if t.Scalar != nil {
		return t.Scalar.AcceptsValue(value)
	}
	if t.Intersection != nil {
		return false // TODO: implement later if needed
	}
	if t.ComposableSlot != nil {
		return false // TODO: implement later if needed
	}

	return false
}

func (t *Type) AddToPassesTrail(trail string) {
	t.PassesTrail = append(t.PassesTrail, trail)
}

func (t Type) IsAnyOf(kinds ...Kind) bool {
	for _, kind := range kinds {
		if t.Kind == kind {
			return true
		}
	}

	return false
}

func (t Type) ImplementsVariant() bool {
	return t.HasHint(HintImplementsVariant)
}

func (t Type) ImplementedVariant() string {
	if !t.ImplementsVariant() {
		return ""
	}

	return t.Hints[HintImplementsVariant].(string)
}

func (t Type) IsDataqueryVariant() bool {
	if !t.ImplementsVariant() {
		return false
	}

	return t.Hints[HintImplementsVariant].(string) == string(SchemaVariantDataQuery)
}

func (t Type) HasHint(hintName string) bool {
	_, found := t.Hints[hintName]

	return found
}

func (t Type) HasAnyHint(hintNames ...string) bool {
	for _, hintName := range hintNames {
		if _, found := t.Hints[hintName]; found {
			return true
		}
	}

	return false
}

func (t Type) IsRef() bool {
	return t.Kind == KindRef
}

func (t Type) IsConstantRef() bool {
	return t.Kind == KindConstantRef
}

func (t Type) IsStructOrRef() bool {
	return t.Kind == KindStruct || t.Kind == KindRef
}

func (t Type) IsStruct() bool {
	return t.Kind == KindStruct
}

func (t Type) IsScalar() bool {
	return t.Kind == KindScalar
}

func (t Type) IsConcreteScalar() bool {
	return t.IsScalar() && t.AsScalar().IsConcrete()
}

func (t Type) IsArray() bool {
	return t.Kind == KindArray
}

func (t Type) IsMap() bool {
	return t.Kind == KindMap
}

func (t Type) IsEnum() bool {
	return t.Kind == KindEnum
}

func (t Type) IsDisjunction() bool {
	return t.Kind == KindDisjunction
}

func (t Type) IsIntersection() bool {
	return t.Kind == KindIntersection
}

func (t Type) IsComposableSlot() bool {
	return t.Kind == KindComposableSlot
}

func (t Type) IsDataqueryComposableSlot() bool {
	return t.IsComposableSlot() && t.AsComposableSlot().Variant == SchemaVariantDataQuery
}

func (t Type) IsStructGeneratedFromDisjunction() bool {
	if t.Kind != KindStruct {
		return false
	}

	return t.Hints[HintDisjunctionOfScalars] != nil ||
		t.Hints[HintDiscriminatedDisjunctionOfRefs] != nil
}

func (t Type) IsDisjunctionOfScalars() bool {
	if t.Kind != KindStruct {
		return false
	}

	return t.Hints[HintDisjunctionOfScalars] != nil
}

func (t Type) IsDisjunctionOfRefs() bool {
	if t.Kind != KindStruct {
		return false
	}

	return t.Hints[HintDiscriminatedDisjunctionOfRefs] != nil
}

func (t Type) IsDisjunctionOfAnyKind() bool {
	if t.Kind != KindStruct {
		return false
	}

	return t.Hints[HintDisjunctionOfScalars] != nil ||
		t.Hints[HintDiscriminatedDisjunctionOfRefs] != nil ||
		t.Hints[HintDisjunctionOfScalarsAndRefs] != nil
}

func (t Type) DeepCopy() Type {
	newType := Type{
		Kind:     t.Kind,
		Nullable: t.Nullable,
		Default:  t.Default,
		Hints:    make(JenniesHints, len(t.Hints)),
	}

	if t.Disjunction != nil {
		newDisjunction := t.Disjunction.DeepCopy()
		newType.Disjunction = &newDisjunction
	}
	if t.Array != nil {
		newArray := t.Array.DeepCopy()
		newType.Array = &newArray
	}
	if t.Enum != nil {
		newEnum := t.Enum.DeepCopy()
		newType.Enum = &newEnum
	}
	if t.Map != nil {
		newMap := t.Map.DeepCopy()
		newType.Map = &newMap
	}
	if t.Struct != nil {
		newStruct := t.Struct.DeepCopy()
		newType.Struct = &newStruct
	}
	if t.Ref != nil {
		newRef := t.Ref.DeepCopy()
		newType.Ref = &newRef
	}
	if t.Scalar != nil {
		newScalar := t.Scalar.DeepCopy()
		newType.Scalar = &newScalar
	}
	if t.Intersection != nil {
		newIntersection := t.Intersection.DeepCopy()
		newType.Intersection = &newIntersection
	}
	if t.ComposableSlot != nil {
		newComposableSlot := t.ComposableSlot.DeepCopy()
		newType.ComposableSlot = &newComposableSlot
	}
	if t.ConstantReference != nil {
		newConstantReference := t.ConstantReference.DeepCopy()
		newType.ConstantReference = &newConstantReference
	}

	for k, v := range t.Hints {
		newType.Hints[k] = v
	}

	newType.PassesTrail = append(newType.PassesTrail, t.PassesTrail...)

	return newType
}

type TypeOption func(def *Type)

func Nullable() TypeOption {
	return func(def *Type) {
		def.Nullable = true
	}
}

func Default(value any) TypeOption {
	return func(def *Type) {
		def.Default = value
	}
}

func Hints(hints JenniesHints) TypeOption {
	return func(def *Type) {
		def.Hints = hints
	}
}

func Trail(trail string) TypeOption {
	return func(def *Type) {
		def.PassesTrail = append(def.PassesTrail, trail)
	}
}

func Value(value any) TypeOption {
	return func(def *Type) {
		if def.Kind != KindScalar {
			return
		}

		def.Scalar.Value = value
	}
}

func Discriminator(discriminator string, mapping map[string]string) TypeOption {
	return func(def *Type) {
		if def.Kind != KindDisjunction {
			return
		}

		def.Disjunction.Discriminator = discriminator
		def.Disjunction.DiscriminatorMapping = mapping
	}
}

func Any(opts ...TypeOption) Type {
	return NewScalar(KindAny, opts...)
}

func Null() Type {
	return NewScalar(KindNull)
}

func Bool(opts ...TypeOption) Type {
	return NewScalar(KindBool, opts...)
}

func Bytes(opts ...TypeOption) Type {
	return NewScalar(KindBytes, opts...)
}

func String(opts ...TypeOption) Type {
	return NewScalar(KindString, opts...)
}

func NewDisjunction(branches Types, opts ...TypeOption) Type {
	def := Type{
		Kind:  KindDisjunction,
		Hints: make(JenniesHints),
		Disjunction: &DisjunctionType{
			Branches:             branches,
			DiscriminatorMapping: make(map[string]string),
		},
	}

	for _, opt := range opts {
		opt(&def)
	}

	return def
}

func NewArray(valueType Type, opts ...TypeOption) Type {
	def := Type{
		Kind:  KindArray,
		Hints: make(JenniesHints),
		Array: &ArrayType{
			ValueType: valueType,
		},
	}

	for _, opt := range opts {
		opt(&def)
	}

	return def
}

func NewEnum(values []EnumValue, opts ...TypeOption) Type {
	def := Type{
		Kind:  KindEnum,
		Hints: make(JenniesHints),
		Enum: &EnumType{
			Values: values,
		},
	}

	for _, opt := range opts {
		opt(&def)
	}

	return def
}

func NewMap(indexType Type, valueType Type, opts ...TypeOption) Type {
	def := Type{
		Kind:  KindMap,
		Hints: make(JenniesHints),
		Map: &MapType{
			IndexType: indexType,
			ValueType: valueType,
		},
	}

	for _, opt := range opts {
		opt(&def)
	}

	return def
}

func NewStruct(fields ...StructField) Type {
	return Type{
		Hints: make(JenniesHints),
		Kind:  KindStruct,
		Struct: &StructType{
			Fields: fields,
		},
	}
}

func NewConstantReferenceType(referredPkg string, referredTypeName string, value any, opts ...TypeOption) Type {
	def := Type{
		Kind:  KindConstantRef,
		Hints: make(JenniesHints),
		ConstantReference: &ConstantReferenceType{
			ReferredPkg:    referredPkg,
			ReferredType:   referredTypeName,
			ReferenceValue: value,
		},
	}

	for _, opt := range opts {
		opt(&def)
	}

	return def
}

func NewRef(referredPkg string, referredTypeName string, opts ...TypeOption) Type {
	def := Type{
		Kind:  KindRef,
		Hints: make(JenniesHints),
		Ref: &RefType{
			ReferredPkg:  referredPkg,
			ReferredType: referredTypeName,
		},
	}

	for _, opt := range opts {
		opt(&def)
	}

	return def
}

func NewScalar(kind ScalarKind, opts ...TypeOption) Type {
	def := Type{
		Kind:  KindScalar,
		Hints: make(JenniesHints),
		Scalar: &ScalarType{
			ScalarKind: kind,
		},
	}

	for _, opt := range opts {
		opt(&def)
	}

	return def
}

func NewIntersection(branches []Type) Type {
	return Type{
		Kind:  KindIntersection,
		Hints: make(JenniesHints),
		Intersection: &IntersectionType{
			Branches: branches,
		},
	}
}

func NewComposableSlot(variant SchemaVariant) Type {
	return Type{
		Kind:  KindComposableSlot,
		Hints: make(JenniesHints),
		ComposableSlot: &ComposableSlotType{
			Variant: variant,
		},
	}
}

func (t Type) IsNull() bool {
	return t.Kind == KindScalar && t.AsScalar().ScalarKind == KindNull
}

func (t Type) IsAny() bool {
	return t.Kind == KindScalar && t.AsScalar().ScalarKind == KindAny
}

func (t Type) AsDisjunction() DisjunctionType {
	return *t.Disjunction
}

func (t Type) AsArray() ArrayType {
	return *t.Array
}

func (t Type) AsEnum() EnumType {
	return *t.Enum
}

func (t Type) AsMap() MapType {
	return *t.Map
}

func (t Type) AsStruct() StructType {
	return *t.Struct
}

func (t Type) AsRef() RefType {
	return *t.Ref
}

func (t Type) AsConstantRef() ConstantReferenceType {
	return *t.ConstantReference
}

func (t Type) AsScalar() ScalarType {
	return *t.Scalar
}

func (t Type) AsIntersection() IntersectionType {
	return *t.Intersection
}

func (t Type) AsComposableSlot() ComposableSlotType {
	return *t.ComposableSlot
}

// named declaration of a type
type Object struct {
	Name        string
	Comments    []string `json:",omitempty"`
	Type        Type
	SelfRef     RefType
	PassesTrail []string `json:",omitempty"`
}

func NewObject(pkg string, name string, objectType Type, passesTrail ...string) Object {
	return Object{
		Name:        name,
		Type:        objectType,
		PassesTrail: passesTrail,
		SelfRef: RefType{
			ReferredPkg:  pkg,
			ReferredType: name,
		},
	}
}

func (object *Object) AsRef() Type {
	return object.SelfRef.AsType()
}

func (object *Object) AddToPassesTrail(trail string) {
	object.PassesTrail = append(object.PassesTrail, trail)
}

func (object Object) Equal(other Object) bool {
	return object.Name == other.Name &&
		cmp.Equal(object.Comments, other.Comments) &&
		cmp.Equal(object.Type, other.Type) &&
		cmp.Equal(object.SelfRef, other.SelfRef) &&
		cmp.Equal(object.PassesTrail, other.PassesTrail)
}

func (object Object) DeepCopy() Object {
	newObject := Object{
		Name:    object.Name,
		Type:    object.Type.DeepCopy(),
		SelfRef: object.SelfRef.DeepCopy(),
	}

	newObject.PassesTrail = append(newObject.PassesTrail, object.PassesTrail...)
	newObject.Comments = append(newObject.Comments, object.Comments...)

	return newObject
}

type Types []Type

func (types Types) HasOnlyScalarOrArrayOrMap() bool {
	for _, t := range types {
		if t.Kind == KindArray || t.Kind == KindMap {
			continue
		}

		if t.Kind != KindScalar {
			return false
		}
	}

	return true
}

func (types Types) HasOnlyRefs() bool {
	for _, t := range types {
		if t.Kind != KindRef {
			return false
		}
	}

	return true
}

func (types Types) HasNullType() bool {
	for _, t := range types {
		if t.IsNull() {
			return true
		}
	}

	return false
}

func (types Types) NonNullTypes() Types {
	results := make([]Type, 0, len(types))

	for _, t := range types {
		if t.IsNull() {
			continue
		}

		results = append(results, t)
	}

	return results
}

type DisjunctionType struct {
	Branches Types

	// If the branches are references to structs, some languages will need
	// extra context to be able to distinguish between them. Golang, for
	// example, doesn't support sum types (disjunctions of fixed types).
	// To emulate sum types for these languages, we need a way to
	// discriminate against every possible type.
	//
	// To do that, we need two things:
	//	- a discriminator: the name of a field that is present in all types.
	//	  The value of which identifies the type being used.
	//  - a mapping: associating a "discriminator value" to a type.
	Discriminator        string            `json:",omitempty"`
	DiscriminatorMapping map[string]string `json:",omitempty" yaml:"discriminator_mapping"`
}

func (t *DisjunctionType) AcceptsValue(value any) bool {
	for _, branch := range t.Branches {
		if branch.AcceptsValue(value) {
			return true
		}
	}
	return false
}

func (t DisjunctionType) DeepCopy() DisjunctionType {
	newT := DisjunctionType{
		Branches:             make([]Type, 0, len(t.Branches)),
		Discriminator:        t.Discriminator,
		DiscriminatorMapping: make(map[string]string, len(t.DiscriminatorMapping)),
	}

	for _, branch := range t.Branches {
		newT.Branches = append(newT.Branches, branch.DeepCopy())
	}

	for k, v := range t.DiscriminatorMapping {
		newT.DiscriminatorMapping[k] = v
	}

	return newT
}

type ArrayType struct {
	ValueType Type `yaml:"value_type"`
}

func (t *ArrayType) AcceptsValue(value any) bool {
	return t.ValueType.AcceptsValue(value)
}

func (t ArrayType) DeepCopy() ArrayType {
	return ArrayType{
		ValueType: t.ValueType.DeepCopy(),
	}
}

func (t ArrayType) IsArrayOf(acceptedKinds ...Kind) bool {
	if !tools.ItemInList(t.ValueType.Kind, acceptedKinds) {
		return false
	}

	if t.ValueType.IsArray() {
		return t.ValueType.AsArray().IsArrayOf(acceptedKinds...)
	}

	if t.ValueType.IsMap() {
		return t.ValueType.AsMap().IsMapOf(acceptedKinds...)
	}

	return true
}

func (t ArrayType) IsArrayOfScalars() bool {
	return t.IsArrayOf(KindScalar, KindArray)
}

type EnumType struct {
	Values []EnumValue // possible values. Value types might be different
}

func (t *EnumType) AcceptsValue(value any) bool {
	_, ok := t.MemberForValue(value)
	return ok
}

func (t EnumType) MemberForValue(value any) (EnumValue, bool) {
	if len(t.Values) == 0 {
		return EnumValue{}, false
	}

	if value == nil {
		return t.Values[0], false
	}

	equal := func(a, b any) bool {
		return a == b
	}
	if t.Values[0].Type.Scalar.ScalarKind != KindString {
		equal = func(a, b any) bool {
			return tools.AnyToInt64(a) == tools.AnyToInt64(b)
		}
	}

	for _, v := range t.Values {
		if equal(v.Value, value) {
			return v, true
		}
	}

	return t.Values[0], false
}

func (t EnumType) DeepCopy() EnumType {
	newT := EnumType{
		Values: make([]EnumValue, 0, len(t.Values)),
	}

	for _, value := range t.Values {
		newT.Values = append(newT.Values, value.DeepCopy())
	}

	return newT
}

type EnumValue struct {
	Type  Type
	Name  string
	Value any
}

func (t EnumValue) DeepCopy() EnumValue {
	return EnumValue{
		Type:  t.Type.DeepCopy(),
		Name:  t.Name,
		Value: t.Value,
	}
}

type MapType struct {
	IndexType Type
	ValueType Type
}

func (t MapType) IsMapOf(acceptedKinds ...Kind) bool {
	if !tools.ItemInList(t.ValueType.Kind, acceptedKinds) {
		return false
	}

	if t.ValueType.IsArray() {
		return t.ValueType.AsArray().IsArrayOf(acceptedKinds...)
	}

	if t.ValueType.IsMap() {
		return t.ValueType.AsMap().IsMapOf(acceptedKinds...)
	}

	return true
}

func (t *MapType) AcceptsValue(value any) bool {
	return t.ValueType.AcceptsValue(value)
}

func (t MapType) DeepCopy() MapType {
	return MapType{
		IndexType: t.IndexType.DeepCopy(),
		ValueType: t.ValueType.DeepCopy(),
	}
}

type StructType struct {
	Fields []StructField
}

func (structType StructType) DeepCopy() StructType {
	newT := StructType{
		Fields: make([]StructField, 0, len(structType.Fields)),
	}

	for _, field := range structType.Fields {
		newT.Fields = append(newT.Fields, field.DeepCopy())
	}

	return newT
}

func (structType StructType) FieldByName(name string) (StructField, bool) {
	// FIXME: we don't have a way to directly get a struct field by name :(
	for _, field := range structType.Fields {
		if field.Name != name {
			continue
		}

		return field, true
	}

	return StructField{}, false
}

func (structType StructType) FieldByRefName(refName string) StructField {
	for _, field := range structType.Fields {
		if !field.Type.IsRef() || field.Type.Ref.ReferredType != refName {
			continue
		}

		return field
	}

	return StructField{}
}

type StructField struct {
	Name        string
	Comments    []string `json:",omitempty"`
	Type        Type
	Required    bool
	PassesTrail []string `json:",omitempty"`
}

func (structField *StructField) AddToPassesTrail(trail string) {
	structField.PassesTrail = append(structField.PassesTrail, trail)
}

func (structField StructField) DeepCopy() StructField {
	newT := StructField{
		Name:     structField.Name,
		Type:     structField.Type.DeepCopy(),
		Required: structField.Required,
	}

	newT.Comments = append(newT.Comments, structField.Comments...)
	newT.PassesTrail = append(newT.PassesTrail, structField.PassesTrail...)

	return newT
}

type StructFieldOption func(field *StructField)

func Required() StructFieldOption {
	return func(field *StructField) {
		field.Required = true
	}
}

func Comments(comments []string) StructFieldOption {
	return func(field *StructField) {
		field.Comments = comments
	}
}

func PassesTrail(trail string) StructFieldOption {
	return func(field *StructField) {
		field.PassesTrail = append(field.PassesTrail, trail)
	}
}

func NewStructField(name string, fieldType Type, opts ...StructFieldOption) StructField {
	field := StructField{
		Name: name,
		Type: fieldType,
	}

	for _, opt := range opts {
		opt(&field)
	}

	return field
}

type ConstantReferenceType struct {
	ReferredPkg    string `yaml:"referred_pkg"`
	ReferredType   string `yaml:"referred_type"`
	ReferenceValue any    `yaml:"reference_value"`
}

func (t ConstantReferenceType) DeepCopy() ConstantReferenceType {
	return ConstantReferenceType{
		ReferredPkg:    t.ReferredPkg,
		ReferredType:   t.ReferredType,
		ReferenceValue: t.ReferenceValue,
	}
}

type RefType struct {
	ReferredPkg  string `yaml:"referred_pkg"`
	ReferredType string `yaml:"referred_type"`
}

func (t RefType) String() string {
	return fmt.Sprintf("%s.%s", t.ReferredPkg, t.ReferredType)
}

func (t RefType) DeepCopy() RefType {
	return RefType{
		ReferredPkg:  t.ReferredPkg,
		ReferredType: t.ReferredType,
	}
}

func (t RefType) AsType() Type {
	return Type{
		Kind: KindRef,
		Ref: &RefType{
			ReferredPkg:  t.ReferredPkg,
			ReferredType: t.ReferredType,
		},
	}
}

type ScalarType struct {
	ScalarKind  ScalarKind       `yaml:"scalar_kind"` // bool, bytes, string, int, float, ...
	Value       any              `json:",omitempty"`  // if value isn't nil, we're representing a constant scalar
	Constraints []TypeConstraint `json:",omitempty"`
}

func (scalarType ScalarType) IsNumeric() bool {
	switch scalarType.ScalarKind {
	case KindFloat32, KindFloat64:
		return true
	case KindUint8, KindUint16, KindUint32, KindUint64:
		return true
	case KindInt8, KindInt16, KindInt32, KindInt64:
		return true

	default:
		return false
	}
}

func (scalarType *ScalarType) AcceptsValue(value any) bool {
	if scalarType.ScalarKind == KindNull {
		return value == nil
	}

	if scalarType.ScalarKind == KindAny {
		return true
	}

	if scalarType.ScalarKind == KindBool {
		_, ok := value.(bool)
		return ok
	}

	if scalarType.ScalarKind == KindBytes {
		_, ok := value.([]byte)
		return ok
	}

	if scalarType.ScalarKind == KindString {
		_, ok := value.(string)
		return ok
	}

	if scalarType.ScalarKind == KindFloat32 {
		_, ok := value.(float32)
		return ok
	}
	if scalarType.ScalarKind == KindFloat64 {
		_, ok := value.(float64)
		return ok
	}

	if scalarType.ScalarKind == KindUint8 {
		_, ok := value.(uint8)
		return ok
	}
	if scalarType.ScalarKind == KindUint16 {
		_, ok := value.(uint16)
		return ok
	}
	if scalarType.ScalarKind == KindUint32 {
		_, ok := value.(uint32)
		return ok
	}
	if scalarType.ScalarKind == KindUint64 {
		_, ok := value.(uint64)
		return ok
	}

	if scalarType.ScalarKind == KindInt8 {
		_, ok := value.(int8)
		return ok
	}
	if scalarType.ScalarKind == KindInt16 {
		_, ok := value.(int16)
		return ok
	}
	if scalarType.ScalarKind == KindInt32 {
		_, ok := value.(int32)
		return ok
	}
	if scalarType.ScalarKind == KindInt64 {
		_, ok := value.(int64)
		return ok
	}

	return false
}

func (scalarType ScalarType) DeepCopy() ScalarType {
	newT := ScalarType{
		ScalarKind: scalarType.ScalarKind,
		Value:      scalarType.Value,
	}

	if len(scalarType.Constraints) != 0 {
		newT.Constraints = make([]TypeConstraint, 0, len(scalarType.Constraints))
	}

	for _, constraint := range scalarType.Constraints {
		newT.Constraints = append(newT.Constraints, constraint.DeepCopy())
	}

	return newT
}

func (scalarType ScalarType) IsConcrete() bool {
	return scalarType.Value != nil
}

type IntersectionType struct {
	Branches []Type
}

func (inter IntersectionType) DeepCopy() IntersectionType {
	newT := IntersectionType{}

	for _, b := range inter.Branches {
		newT.Branches = append(newT.Branches, b.DeepCopy())
	}

	return newT
}

type ComposableSlotType struct {
	Variant SchemaVariant
}

func (slot ComposableSlotType) DeepCopy() ComposableSlotType {
	return ComposableSlotType{
		Variant: slot.Variant,
	}
}
