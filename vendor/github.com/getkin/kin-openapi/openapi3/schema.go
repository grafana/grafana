package openapi3

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/big"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"unicode/utf16"

	"github.com/go-openapi/jsonpointer"
	"github.com/mohae/deepcopy"
	"github.com/woodsbury/decimal128"
)

const (
	TypeArray   = "array"
	TypeBoolean = "boolean"
	TypeInteger = "integer"
	TypeNumber  = "number"
	TypeObject  = "object"
	TypeString  = "string"
	TypeNull    = "null"
)

var (
	// SchemaErrorDetailsDisabled disables printing of details about schema errors.
	SchemaErrorDetailsDisabled = false

	errSchema = errors.New("input does not match the schema")

	// ErrOneOfConflict is the SchemaError Origin when data matches more than one oneOf schema
	ErrOneOfConflict = errors.New("input matches more than one oneOf schemas")

	// ErrSchemaInputNaN may be returned when validating a number
	ErrSchemaInputNaN = errors.New("floating point NaN is not allowed")
	// ErrSchemaInputInf may be returned when validating a number
	ErrSchemaInputInf = errors.New("floating point Inf is not allowed")

	compiledPatterns sync.Map
)

// NewSchemaRef simply builds a SchemaRef
func NewSchemaRef(ref string, value *Schema) *SchemaRef {
	return &SchemaRef{
		Ref:   ref,
		Value: value,
	}
}

type SchemaRefs []*SchemaRef

var _ jsonpointer.JSONPointable = (*SchemaRefs)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (s SchemaRefs) JSONLookup(token string) (any, error) {
	i, err := strconv.ParseUint(token, 10, 64)
	if err != nil {
		return nil, err
	}

	if i >= uint64(len(s)) {
		return nil, fmt.Errorf("index out of range: %d", i)
	}

	ref := s[i]

	if ref == nil || ref.Ref != "" {
		return &Ref{Ref: ref.Ref}, nil
	}
	return ref.Value, nil
}

// Schema is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#schema-object
type Schema struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	OneOf        SchemaRefs    `json:"oneOf,omitempty" yaml:"oneOf,omitempty"`
	AnyOf        SchemaRefs    `json:"anyOf,omitempty" yaml:"anyOf,omitempty"`
	AllOf        SchemaRefs    `json:"allOf,omitempty" yaml:"allOf,omitempty"`
	Not          *SchemaRef    `json:"not,omitempty" yaml:"not,omitempty"`
	Type         *Types        `json:"type,omitempty" yaml:"type,omitempty"`
	Title        string        `json:"title,omitempty" yaml:"title,omitempty"`
	Format       string        `json:"format,omitempty" yaml:"format,omitempty"`
	Description  string        `json:"description,omitempty" yaml:"description,omitempty"`
	Enum         []any         `json:"enum,omitempty" yaml:"enum,omitempty"`
	Default      any           `json:"default,omitempty" yaml:"default,omitempty"`
	Example      any           `json:"example,omitempty" yaml:"example,omitempty"`
	ExternalDocs *ExternalDocs `json:"externalDocs,omitempty" yaml:"externalDocs,omitempty"`

	// Array-related, here for struct compactness
	UniqueItems bool `json:"uniqueItems,omitempty" yaml:"uniqueItems,omitempty"`
	// Number-related, here for struct compactness
	ExclusiveMin bool `json:"exclusiveMinimum,omitempty" yaml:"exclusiveMinimum,omitempty"`
	ExclusiveMax bool `json:"exclusiveMaximum,omitempty" yaml:"exclusiveMaximum,omitempty"`
	// Properties
	Nullable        bool `json:"nullable,omitempty" yaml:"nullable,omitempty"`
	ReadOnly        bool `json:"readOnly,omitempty" yaml:"readOnly,omitempty"`
	WriteOnly       bool `json:"writeOnly,omitempty" yaml:"writeOnly,omitempty"`
	AllowEmptyValue bool `json:"allowEmptyValue,omitempty" yaml:"allowEmptyValue,omitempty"`
	Deprecated      bool `json:"deprecated,omitempty" yaml:"deprecated,omitempty"`
	XML             *XML `json:"xml,omitempty" yaml:"xml,omitempty"`

	// Number
	Min        *float64 `json:"minimum,omitempty" yaml:"minimum,omitempty"`
	Max        *float64 `json:"maximum,omitempty" yaml:"maximum,omitempty"`
	MultipleOf *float64 `json:"multipleOf,omitempty" yaml:"multipleOf,omitempty"`

	// String
	MinLength uint64  `json:"minLength,omitempty" yaml:"minLength,omitempty"`
	MaxLength *uint64 `json:"maxLength,omitempty" yaml:"maxLength,omitempty"`
	Pattern   string  `json:"pattern,omitempty" yaml:"pattern,omitempty"`

	// Array
	MinItems uint64     `json:"minItems,omitempty" yaml:"minItems,omitempty"`
	MaxItems *uint64    `json:"maxItems,omitempty" yaml:"maxItems,omitempty"`
	Items    *SchemaRef `json:"items,omitempty" yaml:"items,omitempty"`

	// Object
	Required             []string             `json:"required,omitempty" yaml:"required,omitempty"`
	Properties           Schemas              `json:"properties,omitempty" yaml:"properties,omitempty"`
	MinProps             uint64               `json:"minProperties,omitempty" yaml:"minProperties,omitempty"`
	MaxProps             *uint64              `json:"maxProperties,omitempty" yaml:"maxProperties,omitempty"`
	AdditionalProperties AdditionalProperties `json:"additionalProperties,omitempty" yaml:"additionalProperties,omitempty"`
	Discriminator        *Discriminator       `json:"discriminator,omitempty" yaml:"discriminator,omitempty"`
}

type Types []string

func (types *Types) Is(typ string) bool {
	return types != nil && len(*types) == 1 && (*types)[0] == typ
}

func (types *Types) Slice() []string {
	if types == nil {
		return nil
	}
	return *types
}

func (pTypes *Types) Includes(typ string) bool {
	if pTypes == nil {
		return false
	}
	types := *pTypes
	for _, candidate := range types {
		if candidate == typ {
			return true
		}
	}
	return false
}

func (types *Types) Permits(typ string) bool {
	if types == nil {
		return true
	}
	return types.Includes(typ)
}

func (pTypes *Types) MarshalJSON() ([]byte, error) {
	x, err := pTypes.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

func (pTypes *Types) MarshalYAML() (any, error) {
	if pTypes == nil {
		return nil, nil
	}
	types := *pTypes
	switch len(types) {
	case 0:
		return nil, nil
	case 1:
		return types[0], nil
	default:
		return []string(types), nil
	}
}

func (types *Types) UnmarshalJSON(data []byte) error {
	var strings []string
	if err := json.Unmarshal(data, &strings); err != nil {
		var s string
		if err := json.Unmarshal(data, &s); err != nil {
			return unmarshalError(err)
		}
		strings = []string{s}
	}
	*types = strings
	return nil
}

type AdditionalProperties struct {
	Has    *bool
	Schema *SchemaRef
}

// MarshalYAML returns the YAML encoding of AdditionalProperties.
func (addProps AdditionalProperties) MarshalYAML() (any, error) {
	if x := addProps.Has; x != nil {
		if *x {
			return true, nil
		}
		return false, nil
	}
	if x := addProps.Schema; x != nil {
		return x.MarshalYAML()
	}
	return nil, nil
}

// MarshalJSON returns the JSON encoding of AdditionalProperties.
func (addProps AdditionalProperties) MarshalJSON() ([]byte, error) {
	x, err := addProps.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// UnmarshalJSON sets AdditionalProperties to a copy of data.
func (addProps *AdditionalProperties) UnmarshalJSON(data []byte) error {
	var x any
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	switch y := x.(type) {
	case nil:
	case bool:
		addProps.Has = &y
	case map[string]any:
		if len(y) == 0 {
			addProps.Schema = &SchemaRef{Value: &Schema{}}
		} else {
			buf := new(bytes.Buffer)
			_ = json.NewEncoder(buf).Encode(y)
			if err := json.NewDecoder(buf).Decode(&addProps.Schema); err != nil {
				return err
			}
		}
	default:
		return errors.New("cannot unmarshal additionalProperties: value must be either a schema object or a boolean")
	}
	return nil
}

var _ jsonpointer.JSONPointable = (*Schema)(nil)

func NewSchema() *Schema {
	return &Schema{}
}

// MarshalJSON returns the JSON encoding of Schema.
func (schema Schema) MarshalJSON() ([]byte, error) {
	m, err := schema.MarshalYAML()
	if err != nil {
		return nil, err
	}

	return json.Marshal(m)
}

// MarshalYAML returns the YAML encoding of Schema.
func (schema Schema) MarshalYAML() (any, error) {
	m := make(map[string]any, 36+len(schema.Extensions))
	for k, v := range schema.Extensions {
		m[k] = v
	}

	if x := schema.OneOf; len(x) != 0 {
		m["oneOf"] = x
	}
	if x := schema.AnyOf; len(x) != 0 {
		m["anyOf"] = x
	}
	if x := schema.AllOf; len(x) != 0 {
		m["allOf"] = x
	}
	if x := schema.Not; x != nil {
		m["not"] = x
	}
	if x := schema.Type; x != nil {
		m["type"] = x
	}
	if x := schema.Title; len(x) != 0 {
		m["title"] = x
	}
	if x := schema.Format; len(x) != 0 {
		m["format"] = x
	}
	if x := schema.Description; len(x) != 0 {
		m["description"] = x
	}
	if x := schema.Enum; len(x) != 0 {
		m["enum"] = x
	}
	if x := schema.Default; x != nil {
		m["default"] = x
	}
	if x := schema.Example; x != nil {
		m["example"] = x
	}
	if x := schema.ExternalDocs; x != nil {
		m["externalDocs"] = x
	}

	// Array-related
	if x := schema.UniqueItems; x {
		m["uniqueItems"] = x
	}
	// Number-related
	if x := schema.ExclusiveMin; x {
		m["exclusiveMinimum"] = x
	}
	if x := schema.ExclusiveMax; x {
		m["exclusiveMaximum"] = x
	}
	// Properties
	if x := schema.Nullable; x {
		m["nullable"] = x
	}
	if x := schema.ReadOnly; x {
		m["readOnly"] = x
	}
	if x := schema.WriteOnly; x {
		m["writeOnly"] = x
	}
	if x := schema.AllowEmptyValue; x {
		m["allowEmptyValue"] = x
	}
	if x := schema.Deprecated; x {
		m["deprecated"] = x
	}
	if x := schema.XML; x != nil {
		m["xml"] = x
	}

	// Number
	if x := schema.Min; x != nil {
		m["minimum"] = x
	}
	if x := schema.Max; x != nil {
		m["maximum"] = x
	}
	if x := schema.MultipleOf; x != nil {
		m["multipleOf"] = x
	}

	// String
	if x := schema.MinLength; x != 0 {
		m["minLength"] = x
	}
	if x := schema.MaxLength; x != nil {
		m["maxLength"] = x
	}
	if x := schema.Pattern; x != "" {
		m["pattern"] = x
	}

	// Array
	if x := schema.MinItems; x != 0 {
		m["minItems"] = x
	}
	if x := schema.MaxItems; x != nil {
		m["maxItems"] = x
	}
	if x := schema.Items; x != nil {
		m["items"] = x
	}

	// Object
	if x := schema.Required; len(x) != 0 {
		m["required"] = x
	}
	if x := schema.Properties; len(x) != 0 {
		m["properties"] = x
	}
	if x := schema.MinProps; x != 0 {
		m["minProperties"] = x
	}
	if x := schema.MaxProps; x != nil {
		m["maxProperties"] = x
	}
	if x := schema.AdditionalProperties; x.Has != nil || x.Schema != nil {
		m["additionalProperties"] = &x
	}
	if x := schema.Discriminator; x != nil {
		m["discriminator"] = x
	}

	return m, nil
}

// UnmarshalJSON sets Schema to a copy of data.
func (schema *Schema) UnmarshalJSON(data []byte) error {
	type SchemaBis Schema
	var x SchemaBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)

	delete(x.Extensions, originKey)
	delete(x.Extensions, "oneOf")
	delete(x.Extensions, "anyOf")
	delete(x.Extensions, "allOf")
	delete(x.Extensions, "not")
	delete(x.Extensions, "type")
	delete(x.Extensions, "title")
	delete(x.Extensions, "format")
	delete(x.Extensions, "description")
	delete(x.Extensions, "enum")
	delete(x.Extensions, "default")
	delete(x.Extensions, "example")
	delete(x.Extensions, "externalDocs")

	// Array-related
	delete(x.Extensions, "uniqueItems")
	// Number-related
	delete(x.Extensions, "exclusiveMinimum")
	delete(x.Extensions, "exclusiveMaximum")
	// Properties
	delete(x.Extensions, "nullable")
	delete(x.Extensions, "readOnly")
	delete(x.Extensions, "writeOnly")
	delete(x.Extensions, "allowEmptyValue")
	delete(x.Extensions, "deprecated")
	delete(x.Extensions, "xml")

	// Number
	delete(x.Extensions, "minimum")
	delete(x.Extensions, "maximum")
	delete(x.Extensions, "multipleOf")

	// String
	delete(x.Extensions, "minLength")
	delete(x.Extensions, "maxLength")
	delete(x.Extensions, "pattern")

	// Array
	delete(x.Extensions, "minItems")
	delete(x.Extensions, "maxItems")
	delete(x.Extensions, "items")

	// Object
	delete(x.Extensions, "required")
	delete(x.Extensions, "properties")
	delete(x.Extensions, "minProperties")
	delete(x.Extensions, "maxProperties")
	delete(x.Extensions, "additionalProperties")
	delete(x.Extensions, "discriminator")

	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}

	*schema = Schema(x)

	if schema.Format == "date" {
		// This is a fix for: https://github.com/getkin/kin-openapi/issues/697
		if eg, ok := schema.Example.(string); ok {
			schema.Example = strings.TrimSuffix(eg, "T00:00:00Z")
		}
	}
	return nil
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (schema Schema) JSONLookup(token string) (any, error) {
	switch token {
	case "additionalProperties":
		if addProps := schema.AdditionalProperties.Has; addProps != nil {
			return *addProps, nil
		}
		if addProps := schema.AdditionalProperties.Schema; addProps != nil {
			if addProps.Ref != "" {
				return &Ref{Ref: addProps.Ref}, nil
			}
			return addProps.Value, nil
		}
	case "not":
		if schema.Not != nil {
			if schema.Not.Ref != "" {
				return &Ref{Ref: schema.Not.Ref}, nil
			}
			return schema.Not.Value, nil
		}
	case "items":
		if schema.Items != nil {
			if schema.Items.Ref != "" {
				return &Ref{Ref: schema.Items.Ref}, nil
			}
			return schema.Items.Value, nil
		}
	case "oneOf":
		return schema.OneOf, nil
	case "anyOf":
		return schema.AnyOf, nil
	case "allOf":
		return schema.AllOf, nil
	case "type":
		return schema.Type, nil
	case "title":
		return schema.Title, nil
	case "format":
		return schema.Format, nil
	case "description":
		return schema.Description, nil
	case "enum":
		return schema.Enum, nil
	case "default":
		return schema.Default, nil
	case "example":
		return schema.Example, nil
	case "externalDocs":
		return schema.ExternalDocs, nil
	case "uniqueItems":
		return schema.UniqueItems, nil
	case "exclusiveMin":
		return schema.ExclusiveMin, nil
	case "exclusiveMax":
		return schema.ExclusiveMax, nil
	case "nullable":
		return schema.Nullable, nil
	case "readOnly":
		return schema.ReadOnly, nil
	case "writeOnly":
		return schema.WriteOnly, nil
	case "allowEmptyValue":
		return schema.AllowEmptyValue, nil
	case "xml":
		return schema.XML, nil
	case "deprecated":
		return schema.Deprecated, nil
	case "min":
		return schema.Min, nil
	case "max":
		return schema.Max, nil
	case "multipleOf":
		return schema.MultipleOf, nil
	case "minLength":
		return schema.MinLength, nil
	case "maxLength":
		return schema.MaxLength, nil
	case "pattern":
		return schema.Pattern, nil
	case "minItems":
		return schema.MinItems, nil
	case "maxItems":
		return schema.MaxItems, nil
	case "required":
		return schema.Required, nil
	case "properties":
		return schema.Properties, nil
	case "minProps":
		return schema.MinProps, nil
	case "maxProps":
		return schema.MaxProps, nil
	case "discriminator":
		return schema.Discriminator, nil
	}

	v, _, err := jsonpointer.GetForToken(schema.Extensions, token)
	return v, err
}

func (schema *Schema) NewRef() *SchemaRef {
	return &SchemaRef{
		Value: schema,
	}
}

func NewOneOfSchema(schemas ...*Schema) *Schema {
	refs := make([]*SchemaRef, 0, len(schemas))
	for _, schema := range schemas {
		refs = append(refs, &SchemaRef{Value: schema})
	}
	return &Schema{
		OneOf: refs,
	}
}

func NewAnyOfSchema(schemas ...*Schema) *Schema {
	refs := make([]*SchemaRef, 0, len(schemas))
	for _, schema := range schemas {
		refs = append(refs, &SchemaRef{Value: schema})
	}
	return &Schema{
		AnyOf: refs,
	}
}

func NewAllOfSchema(schemas ...*Schema) *Schema {
	refs := make([]*SchemaRef, 0, len(schemas))
	for _, schema := range schemas {
		refs = append(refs, &SchemaRef{Value: schema})
	}
	return &Schema{
		AllOf: refs,
	}
}

func NewBoolSchema() *Schema {
	return &Schema{
		Type: &Types{TypeBoolean},
	}
}

func NewFloat64Schema() *Schema {
	return &Schema{
		Type: &Types{TypeNumber},
	}
}

func NewIntegerSchema() *Schema {
	return &Schema{
		Type: &Types{TypeInteger},
	}
}

func NewInt32Schema() *Schema {
	return &Schema{
		Type:   &Types{TypeInteger},
		Format: "int32",
	}
}

func NewInt64Schema() *Schema {
	return &Schema{
		Type:   &Types{TypeInteger},
		Format: "int64",
	}
}

func NewStringSchema() *Schema {
	return &Schema{
		Type: &Types{TypeString},
	}
}

func NewDateTimeSchema() *Schema {
	return &Schema{
		Type:   &Types{TypeString},
		Format: "date-time",
	}
}

func NewUUIDSchema() *Schema {
	return &Schema{
		Type:   &Types{TypeString},
		Format: "uuid",
	}
}

func NewBytesSchema() *Schema {
	return &Schema{
		Type:   &Types{TypeString},
		Format: "byte",
	}
}

func NewArraySchema() *Schema {
	return &Schema{
		Type: &Types{TypeArray},
	}
}

func NewObjectSchema() *Schema {
	return &Schema{
		Type:       &Types{TypeObject},
		Properties: make(Schemas),
	}
}

func (schema *Schema) WithNullable() *Schema {
	schema.Nullable = true
	return schema
}

func (schema *Schema) WithMin(value float64) *Schema {
	schema.Min = &value
	return schema
}

func (schema *Schema) WithMax(value float64) *Schema {
	schema.Max = &value
	return schema
}

func (schema *Schema) WithExclusiveMin(value bool) *Schema {
	schema.ExclusiveMin = value
	return schema
}

func (schema *Schema) WithExclusiveMax(value bool) *Schema {
	schema.ExclusiveMax = value
	return schema
}

func (schema *Schema) WithEnum(values ...any) *Schema {
	schema.Enum = values
	return schema
}

func (schema *Schema) WithDefault(defaultValue any) *Schema {
	schema.Default = defaultValue
	return schema
}

func (schema *Schema) WithFormat(value string) *Schema {
	schema.Format = value
	return schema
}

func (schema *Schema) WithLength(i int64) *Schema {
	n := uint64(i)
	schema.MinLength = n
	schema.MaxLength = &n
	return schema
}

func (schema *Schema) WithMinLength(i int64) *Schema {
	n := uint64(i)
	schema.MinLength = n
	return schema
}

func (schema *Schema) WithMaxLength(i int64) *Schema {
	n := uint64(i)
	schema.MaxLength = &n
	return schema
}

func (schema *Schema) WithLengthDecodedBase64(i int64) *Schema {
	n := uint64(i)
	v := (n*8 + 5) / 6
	schema.MinLength = v
	schema.MaxLength = &v
	return schema
}

func (schema *Schema) WithMinLengthDecodedBase64(i int64) *Schema {
	n := uint64(i)
	schema.MinLength = (n*8 + 5) / 6
	return schema
}

func (schema *Schema) WithMaxLengthDecodedBase64(i int64) *Schema {
	n := uint64(i)
	schema.MinLength = (n*8 + 5) / 6
	return schema
}

func (schema *Schema) WithPattern(pattern string) *Schema {
	schema.Pattern = pattern
	return schema
}

func (schema *Schema) WithItems(value *Schema) *Schema {
	schema.Items = &SchemaRef{
		Value: value,
	}
	return schema
}

func (schema *Schema) WithMinItems(i int64) *Schema {
	n := uint64(i)
	schema.MinItems = n
	return schema
}

func (schema *Schema) WithMaxItems(i int64) *Schema {
	n := uint64(i)
	schema.MaxItems = &n
	return schema
}

func (schema *Schema) WithUniqueItems(unique bool) *Schema {
	schema.UniqueItems = unique
	return schema
}

func (schema *Schema) WithProperty(name string, propertySchema *Schema) *Schema {
	return schema.WithPropertyRef(name, &SchemaRef{
		Value: propertySchema,
	})
}

func (schema *Schema) WithPropertyRef(name string, ref *SchemaRef) *Schema {
	properties := schema.Properties
	if properties == nil {
		properties = make(Schemas)
		schema.Properties = properties
	}
	properties[name] = ref
	return schema
}

func (schema *Schema) WithProperties(properties map[string]*Schema) *Schema {
	result := make(Schemas, len(properties))
	for k, v := range properties {
		result[k] = &SchemaRef{
			Value: v,
		}
	}
	schema.Properties = result
	return schema
}

func (schema *Schema) WithRequired(required []string) *Schema {
	schema.Required = required
	return schema
}

func (schema *Schema) WithMinProperties(i int64) *Schema {
	n := uint64(i)
	schema.MinProps = n
	return schema
}

func (schema *Schema) WithMaxProperties(i int64) *Schema {
	n := uint64(i)
	schema.MaxProps = &n
	return schema
}

func (schema *Schema) WithAnyAdditionalProperties() *Schema {
	schema.AdditionalProperties = AdditionalProperties{Has: Ptr(true)}
	return schema
}

func (schema *Schema) WithoutAdditionalProperties() *Schema {
	schema.AdditionalProperties = AdditionalProperties{Has: Ptr(false)}
	return schema
}

func (schema *Schema) WithAdditionalProperties(v *Schema) *Schema {
	schema.AdditionalProperties = AdditionalProperties{}
	if v != nil {
		schema.AdditionalProperties.Schema = &SchemaRef{Value: v}
	}
	return schema
}

func (schema *Schema) PermitsNull() bool {
	return schema.Nullable || schema.Type.Includes("null")
}

// IsEmpty tells whether schema is equivalent to the empty schema `{}`.
func (schema *Schema) IsEmpty() bool {
	if schema.Type != nil || schema.Format != "" || len(schema.Enum) != 0 ||
		schema.UniqueItems || schema.ExclusiveMin || schema.ExclusiveMax ||
		schema.Nullable || schema.ReadOnly || schema.WriteOnly || schema.AllowEmptyValue ||
		schema.Min != nil || schema.Max != nil || schema.MultipleOf != nil ||
		schema.MinLength != 0 || schema.MaxLength != nil || schema.Pattern != "" ||
		schema.MinItems != 0 || schema.MaxItems != nil ||
		len(schema.Required) != 0 ||
		schema.MinProps != 0 || schema.MaxProps != nil {
		return false
	}
	if n := schema.Not; n != nil && n.Value != nil && !n.Value.IsEmpty() {
		return false
	}
	if ap := schema.AdditionalProperties.Schema; ap != nil && ap.Value != nil && !ap.Value.IsEmpty() {
		return false
	}
	if apa := schema.AdditionalProperties.Has; apa != nil && !*apa {
		return false
	}
	if items := schema.Items; items != nil && items.Value != nil && !items.Value.IsEmpty() {
		return false
	}
	for _, s := range schema.Properties {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	for _, s := range schema.OneOf {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	for _, s := range schema.AnyOf {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	for _, s := range schema.AllOf {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	return true
}

// Validate returns an error if Schema does not comply with the OpenAPI spec.
func (schema *Schema) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	_, err := schema.validate(ctx, []*Schema{})
	return err
}

// returns the updated stack and an error if Schema does not comply with the OpenAPI spec.
func (schema *Schema) validate(ctx context.Context, stack []*Schema) ([]*Schema, error) {
	validationOpts := getValidationOptions(ctx)

	for _, existing := range stack {
		if existing == schema {
			return stack, nil
		}
	}
	stack = append(stack, schema)

	if schema.ReadOnly && schema.WriteOnly {
		return stack, errors.New("a property MUST NOT be marked as both readOnly and writeOnly being true")
	}

	for _, item := range schema.OneOf {
		v := item.Value
		if v == nil {
			return stack, foundUnresolvedRef(item.Ref)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	for _, item := range schema.AnyOf {
		v := item.Value
		if v == nil {
			return stack, foundUnresolvedRef(item.Ref)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	for _, item := range schema.AllOf {
		v := item.Value
		if v == nil {
			return stack, foundUnresolvedRef(item.Ref)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	if ref := schema.Not; ref != nil {
		v := ref.Value
		if v == nil {
			return stack, foundUnresolvedRef(ref.Ref)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	for _, schemaType := range schema.Type.Slice() {
		switch schemaType {
		case TypeBoolean:
		case TypeNumber:
			if format := schema.Format; len(format) > 0 {
				switch format {
				case "float", "double":
				default:
					if _, ok := SchemaNumberFormats[format]; !ok && validationOpts.schemaFormatValidationEnabled {
						return stack, unsupportedFormat(format)
					}
				}
			}
		case TypeInteger:
			if format := schema.Format; len(format) > 0 {
				switch format {
				case "int32", "int64":
				default:
					if _, ok := SchemaIntegerFormats[format]; !ok && validationOpts.schemaFormatValidationEnabled {
						return stack, unsupportedFormat(format)
					}
				}
			}
		case TypeString:
			if format := schema.Format; len(format) > 0 {
				switch format {
				// Supported by OpenAPIv3.0.3:
				// https://spec.openapis.org/oas/v3.0.3
				case "byte", "binary", "date", "date-time", "password":
				// In JSON Draft-07 (not validated yet though):
				// https://json-schema.org/draft-07/json-schema-release-notes.html#formats
				case "iri", "iri-reference", "uri-template", "idn-email", "idn-hostname":
				case "json-pointer", "relative-json-pointer", "regex", "time":
				// In JSON Draft 2019-09 (not validated yet though):
				// https://json-schema.org/draft/2019-09/release-notes.html#format-vocabulary
				case "duration", "uuid":
				// Defined in some other specification
				case "email", "hostname", "ipv4", "ipv6", "uri", "uri-reference":
				default:
					if _, ok := SchemaStringFormats[format]; !ok && validationOpts.schemaFormatValidationEnabled {
						return stack, unsupportedFormat(format)
					}
				}
			}
			if !validationOpts.schemaPatternValidationDisabled && schema.Pattern != "" {
				if _, err := schema.compilePattern(validationOpts.regexCompilerFunc); err != nil {
					return stack, err
				}
			}
		case TypeArray:
			if schema.Items == nil {
				return stack, errors.New("when schema type is 'array', schema 'items' must be non-null")
			}
		case TypeObject:
		default:
			return stack, fmt.Errorf("unsupported 'type' value %q", schemaType)
		}
	}

	if ref := schema.Items; ref != nil {
		v := ref.Value
		if v == nil {
			return stack, foundUnresolvedRef(ref.Ref)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	properties := make([]string, 0, len(schema.Properties))
	for name := range schema.Properties {
		properties = append(properties, name)
	}
	sort.Strings(properties)
	for _, name := range properties {
		ref := schema.Properties[name]
		v := ref.Value
		if v == nil {
			return stack, foundUnresolvedRef(ref.Ref)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	if schema.AdditionalProperties.Has != nil && schema.AdditionalProperties.Schema != nil {
		return stack, errors.New("additionalProperties are set to both boolean and schema")
	}
	if ref := schema.AdditionalProperties.Schema; ref != nil {
		v := ref.Value
		if v == nil {
			return stack, foundUnresolvedRef(ref.Ref)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	if v := schema.ExternalDocs; v != nil {
		if err := v.Validate(ctx); err != nil {
			return stack, fmt.Errorf("invalid external docs: %w", err)
		}
	}

	if v := schema.Default; v != nil && !validationOpts.schemaDefaultsValidationDisabled {
		if err := schema.VisitJSON(v); err != nil {
			return stack, fmt.Errorf("invalid default: %w", err)
		}
	}

	if x := schema.Example; x != nil && !validationOpts.examplesValidationDisabled {
		if err := validateExampleValue(ctx, x, schema); err != nil {
			return stack, fmt.Errorf("invalid example: %w", err)
		}
	}

	return stack, validateExtensions(ctx, schema.Extensions)
}

func (schema *Schema) IsMatching(value any) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) IsMatchingJSONBoolean(value bool) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) IsMatchingJSONNumber(value float64) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) IsMatchingJSONString(value string) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) IsMatchingJSONArray(value []any) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) IsMatchingJSONObject(value map[string]any) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) VisitJSON(value any, opts ...SchemaValidationOption) error {
	settings := newSchemaValidationSettings(opts...)
	return schema.visitJSON(settings, value)
}

func (schema *Schema) visitJSON(settings *schemaValidationSettings, value any) (err error) {
	switch value := value.(type) {
	case nil:
		// Don't use VisitJSONNull, as we still want to reach 'visitXOFOperations', since
		// those could allow for a nullable value even though this one doesn't
		if schema.PermitsNull() {
			return
		}
	case float64:
		if math.IsNaN(value) {
			return ErrSchemaInputNaN
		}
		if math.IsInf(value, 0) {
			return ErrSchemaInputInf
		}
	}

	if schema.IsEmpty() {
		switch value.(type) {
		case nil:
			return schema.visitJSONNull(settings)
		default:
			return
		}
	}

	if err = schema.visitNotOperation(settings, value); err != nil {
		return
	}
	var run bool
	if err, run = schema.visitXOFOperations(settings, value); err != nil || !run {
		return
	}
	if err = schema.visitEnumOperation(settings, value); err != nil {
		return
	}

	switch value := value.(type) {
	case nil:
		return schema.visitJSONNull(settings)
	case bool:
		return schema.visitJSONBoolean(settings, value)
	case json.Number:
		valueFloat64, err := value.Float64()
		if err != nil {
			return &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "type",
				Reason:                "cannot convert json.Number to float64",
				customizeMessageError: settings.customizeMessageError,
				Origin:                err,
			}
		}
		return schema.visitJSONNumber(settings, valueFloat64)
	case int:
		return schema.visitJSONNumber(settings, float64(value))
	case int32:
		return schema.visitJSONNumber(settings, float64(value))
	case int64:
		return schema.visitJSONNumber(settings, float64(value))
	case float64:
		return schema.visitJSONNumber(settings, value)
	case string:
		return schema.visitJSONString(settings, value)
	case []any:
		return schema.visitJSONArray(settings, value)
	case map[string]any:
		return schema.visitJSONObject(settings, value)
	case map[any]any: // for YAML cf. issue https://github.com/getkin/kin-openapi/issues/444
		values := make(map[string]any, len(value))
		for key, v := range value {
			if k, ok := key.(string); ok {
				values[k] = v
			}
		}
		if len(value) == len(values) {
			return schema.visitJSONObject(settings, values)
		}
	}

	// Catch slice of non-empty interface type
	if reflect.TypeOf(value).Kind() == reflect.Slice {
		valueR := reflect.ValueOf(value)
		newValue := make([]any, 0, valueR.Len())
		for i := 0; i < valueR.Len(); i++ {
			newValue = append(newValue, valueR.Index(i).Interface())
		}
		return schema.visitJSONArray(settings, newValue)
	}

	return &SchemaError{
		Value:                 value,
		Schema:                schema,
		SchemaField:           "type",
		Reason:                fmt.Sprintf("unhandled value of type %T", value),
		customizeMessageError: settings.customizeMessageError,
	}
}

func (schema *Schema) visitEnumOperation(settings *schemaValidationSettings, value any) (err error) {
	if enum := schema.Enum; len(enum) != 0 {
		for _, v := range enum {
			switch c := value.(type) {
			case json.Number:
				var f float64
				if f, err = strconv.ParseFloat(c.String(), 64); err != nil {
					return err
				}
				if v == f {
					return
				}
			case int64:
				if v == float64(c) {
					return
				}
			default:
				if reflect.DeepEqual(v, value) {
					return
				}
			}
		}
		if settings.failfast {
			return errSchema
		}
		allowedValues, _ := json.Marshal(enum)
		return &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "enum",
			Reason:                fmt.Sprintf("value is not one of the allowed values %s", string(allowedValues)),
			customizeMessageError: settings.customizeMessageError,
		}
	}
	return
}

func (schema *Schema) visitNotOperation(settings *schemaValidationSettings, value any) (err error) {
	if ref := schema.Not; ref != nil {
		v := ref.Value
		if v == nil {
			return foundUnresolvedRef(ref.Ref)
		}
		if err := v.visitJSON(settings, value); err == nil {
			if settings.failfast {
				return errSchema
			}
			return &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "not",
				customizeMessageError: settings.customizeMessageError,
			}
		}
	}
	return
}

// If the XOF operations pass successfully, abort further run of validation, as they will already be satisfied (unless the schema
// itself is badly specified
func (schema *Schema) visitXOFOperations(settings *schemaValidationSettings, value any) (err error, run bool) {
	var visitedOneOf, visitedAnyOf, visitedAllOf bool
	if v := schema.OneOf; len(v) > 0 {
		var discriminatorRef string
		if schema.Discriminator != nil {
			pn := schema.Discriminator.PropertyName
			if valuemap, okcheck := value.(map[string]any); okcheck {
				discriminatorVal, okcheck := valuemap[pn]
				if !okcheck {
					return &SchemaError{
						Schema:      schema,
						SchemaField: "discriminator",
						Reason:      fmt.Sprintf("input does not contain the discriminator property %q", pn),
					}, false
				}

				discriminatorValString, okcheck := discriminatorVal.(string)
				if !okcheck {
					return &SchemaError{
						Value:       discriminatorVal,
						Schema:      schema,
						SchemaField: "discriminator",
						Reason:      fmt.Sprintf("value of discriminator property %q is not a string", pn),
					}, false
				}

				if discriminatorRef, okcheck = schema.Discriminator.Mapping[discriminatorValString]; len(schema.Discriminator.Mapping) > 0 && !okcheck {
					return &SchemaError{
						Value:       discriminatorVal,
						Schema:      schema,
						SchemaField: "discriminator",
						Reason:      fmt.Sprintf("discriminator property %q has invalid value", pn),
					}, false
				}
			}
		}

		var (
			ok                  = 0
			validationErrors    = multiErrorForOneOf{}
			matchedOneOfIndices = make([]int, 0)
			tempValue           = value
		)
		for idx, item := range v {
			v := item.Value
			if v == nil {
				return foundUnresolvedRef(item.Ref), false
			}

			if discriminatorRef != "" && discriminatorRef != item.Ref {
				continue
			}

			// make a deep copy to protect origin value from being injected default value that defined in mismatched oneOf schema
			if settings.asreq || settings.asrep {
				tempValue = deepcopy.Copy(value)
			}

			if err := v.visitJSON(settings, tempValue); err != nil {
				validationErrors = append(validationErrors, err)
				continue
			}

			matchedOneOfIndices = append(matchedOneOfIndices, idx)
			ok++
		}

		if ok != 1 {
			if settings.failfast {
				return errSchema, false
			}
			e := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "oneOf",
				customizeMessageError: settings.customizeMessageError,
			}
			if ok > 1 {
				e.Origin = ErrOneOfConflict
				e.Reason = fmt.Sprintf(`value matches more than one schema from "oneOf" (matches schemas at indices %v)`, matchedOneOfIndices)
			} else {
				e.Origin = fmt.Errorf("doesn't match schema due to: %w", validationErrors)
				e.Reason = `value doesn't match any schema from "oneOf"`
			}

			return e, false
		}

		// run again to inject default value that defined in matched oneOf schema
		if settings.asreq || settings.asrep {
			_ = v[matchedOneOfIndices[0]].Value.visitJSON(settings, value)
		}
		visitedOneOf = true
	}

	if v := schema.AnyOf; len(v) > 0 {
		var (
			ok              = false
			matchedAnyOfIdx = 0
			tempValue       = value
		)
		for idx, item := range v {
			v := item.Value
			if v == nil {
				return foundUnresolvedRef(item.Ref), false
			}
			// make a deep copy to protect origin value from being injected default value that defined in mismatched anyOf schema
			if settings.asreq || settings.asrep {
				tempValue = deepcopy.Copy(value)
			}
			if err := v.visitJSON(settings, tempValue); err == nil {
				ok = true
				matchedAnyOfIdx = idx
				break
			}
		}
		if !ok {
			if settings.failfast {
				return errSchema, false
			}
			return &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "anyOf",
				Reason:                `doesn't match any schema from "anyOf"`,
				customizeMessageError: settings.customizeMessageError,
			}, false
		}

		_ = v[matchedAnyOfIdx].Value.visitJSON(settings, value)
		visitedAnyOf = true
	}

	validationErrors := multiErrorForAllOf{}
	for _, item := range schema.AllOf {
		v := item.Value
		if v == nil {
			return foundUnresolvedRef(item.Ref), false
		}
		if err := v.visitJSON(settings, value); err != nil {
			if settings.failfast {
				return errSchema, false
			}
			validationErrors = append(validationErrors, err)
		}
		visitedAllOf = true
	}
	if len(validationErrors) > 0 {
		return &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "allOf",
			Reason:                `doesn't match all schemas from "allOf"`,
			Origin:                fmt.Errorf("doesn't match schema due to: %w", validationErrors),
			customizeMessageError: settings.customizeMessageError,
		}, false
	}

	run = !((visitedOneOf || visitedAnyOf || visitedAllOf) && value == nil)
	return
}

// The value is not considered in visitJSONNull because according to the spec
// "null is not supported as a type" unless `nullable` is also set to true
// https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#data-types
// https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#schema-object
func (schema *Schema) visitJSONNull(settings *schemaValidationSettings) (err error) {
	if schema.PermitsNull() {
		return
	}
	if settings.failfast {
		return errSchema
	}
	return &SchemaError{
		Value:                 nil,
		Schema:                schema,
		SchemaField:           "nullable",
		Reason:                "Value is not nullable",
		customizeMessageError: settings.customizeMessageError,
	}
}

func (schema *Schema) VisitJSONBoolean(value bool) error {
	settings := newSchemaValidationSettings()
	return schema.visitJSONBoolean(settings, value)
}

func (schema *Schema) visitJSONBoolean(settings *schemaValidationSettings, value bool) (err error) {
	if !schema.Type.Permits(TypeBoolean) {
		return schema.expectedType(settings, value)
	}
	return
}

func (schema *Schema) VisitJSONNumber(value float64) error {
	settings := newSchemaValidationSettings()
	return schema.visitJSONNumber(settings, value)
}

func (schema *Schema) visitJSONNumber(settings *schemaValidationSettings, value float64) error {
	var me MultiError
	schemaType := schema.Type
	requireInteger := false
	if schemaType.Permits(TypeInteger) && !schemaType.Permits(TypeNumber) {
		requireInteger = true
		if bigFloat := big.NewFloat(value); !bigFloat.IsInt() {
			if settings.failfast {
				return errSchema
			}
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "type",
				Reason:                "value must be an integer",
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	} else if !(schemaType.Permits(TypeInteger) || schemaType.Permits(TypeNumber)) {
		return schema.expectedType(settings, value)
	}

	// formats
	var formatStrErr string
	var formatErr error
	format := schema.Format
	if format != "" {
		if requireInteger {
			if f, ok := SchemaIntegerFormats[format]; ok {
				if err := f.Validate(int64(value)); err != nil {
					var reason string
					schemaErr := &SchemaError{}
					if errors.As(err, &schemaErr) {
						reason = schemaErr.Reason
					} else {
						reason = err.Error()
					}
					formatStrErr = fmt.Sprintf(`integer doesn't match the format %q (%v)`, format, reason)
					formatErr = fmt.Errorf("integer doesn't match the format %q: %w", format, err)
				}
			}
		} else {
			if f, ok := SchemaNumberFormats[format]; ok {
				if err := f.Validate(value); err != nil {
					var reason string
					schemaErr := &SchemaError{}
					if errors.As(err, &schemaErr) {
						reason = schemaErr.Reason
					} else {
						reason = err.Error()
					}
					formatStrErr = fmt.Sprintf(`number doesn't match the format %q (%v)`, format, reason)
					formatErr = fmt.Errorf("number doesn't match the format %q: %w", format, err)
				}
			}
		}
	}

	if formatStrErr != "" || formatErr != nil {
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "format",
			Reason:                formatStrErr,
			Origin:                formatErr,
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "exclusiveMinimum"
	if v := schema.ExclusiveMin; v && !(*schema.Min < value) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "exclusiveMinimum",
			Reason:                fmt.Sprintf("number must be more than %g", *schema.Min),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "exclusiveMaximum"
	if v := schema.ExclusiveMax; v && !(*schema.Max > value) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "exclusiveMaximum",
			Reason:                fmt.Sprintf("number must be less than %g", *schema.Max),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "minimum"
	if v := schema.Min; v != nil && !(*v <= value) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "minimum",
			Reason:                fmt.Sprintf("number must be at least %g", *v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "maximum"
	if v := schema.Max; v != nil && !(*v >= value) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "maximum",
			Reason:                fmt.Sprintf("number must be at most %g", *v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "multipleOf"
	if v := schema.MultipleOf; v != nil {
		// "A numeric instance is valid only if division by this keyword's
		//    value results in an integer."
		numParsed, _ := decimal128.Parse(fmt.Sprintf("%.10f", value))
		denParsed, _ := decimal128.Parse(fmt.Sprintf("%.10f", *v))
		_, remainder := numParsed.QuoRem(denParsed)
		if !remainder.IsZero() {
			if settings.failfast {
				return errSchema
			}
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "multipleOf",
				Reason:                fmt.Sprintf("number must be a multiple of %g", *v),
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	}

	if len(me) > 0 {
		return me
	}

	return nil
}

func (schema *Schema) VisitJSONString(value string) error {
	settings := newSchemaValidationSettings()
	return schema.visitJSONString(settings, value)
}

func (schema *Schema) visitJSONString(settings *schemaValidationSettings, value string) error {
	if !schema.Type.Permits(TypeString) {
		return schema.expectedType(settings, value)
	}

	var me MultiError

	// "minLength" and "maxLength"
	minLength := schema.MinLength
	maxLength := schema.MaxLength
	if minLength != 0 || maxLength != nil {
		// JSON schema string lengths are UTF-16, not UTF-8!
		length := int64(0)
		for _, r := range value {
			if utf16.IsSurrogate(r) {
				length += 2
			} else {
				length++
			}
		}
		if minLength != 0 && length < int64(minLength) {
			if settings.failfast {
				return errSchema
			}
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "minLength",
				Reason:                fmt.Sprintf("minimum string length is %d", minLength),
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
		if maxLength != nil && length > int64(*maxLength) {
			if settings.failfast {
				return errSchema
			}
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "maxLength",
				Reason:                fmt.Sprintf("maximum string length is %d", *maxLength),
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	}

	// "pattern"
	if !settings.patternValidationDisabled && schema.Pattern != "" {
		cpiface, _ := compiledPatterns.Load(schema.Pattern)
		cp, _ := cpiface.(RegexMatcher)
		if cp == nil {
			var err error
			if cp, err = schema.compilePattern(settings.regexCompiler); err != nil {
				if !settings.multiError {
					return err
				}
				me = append(me, err)
			}
		}
		if !cp.MatchString(value) {
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "pattern",
				Reason:                fmt.Sprintf(`string doesn't match the regular expression "%s"`, schema.Pattern),
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	}

	// "format"
	var formatStrErr string
	var formatErr error
	if format := schema.Format; format != "" {
		if f, ok := SchemaStringFormats[format]; ok {
			if err := f.Validate(value); err != nil {
				var reason string
				schemaErr := &SchemaError{}
				if errors.As(err, &schemaErr) {
					reason = schemaErr.Reason
				} else {
					reason = err.Error()
				}
				formatStrErr = fmt.Sprintf(`string doesn't match the format %q (%v)`, format, reason)
				formatErr = fmt.Errorf("string doesn't match the format %q: %w", format, err)
			}
		}
	}
	if formatStrErr != "" || formatErr != nil {
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "format",
			Reason:                formatStrErr,
			Origin:                formatErr,
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)

	}

	if len(me) > 0 {
		return me
	}

	return nil
}

func (schema *Schema) VisitJSONArray(value []any) error {
	settings := newSchemaValidationSettings()
	return schema.visitJSONArray(settings, value)
}

func (schema *Schema) visitJSONArray(settings *schemaValidationSettings, value []any) error {
	if !schema.Type.Permits(TypeArray) {
		return schema.expectedType(settings, value)
	}

	var me MultiError

	lenValue := int64(len(value))

	// "minItems"
	if v := schema.MinItems; v != 0 && lenValue < int64(v) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "minItems",
			Reason:                fmt.Sprintf("minimum number of items is %d", v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "maxItems"
	if v := schema.MaxItems; v != nil && lenValue > int64(*v) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "maxItems",
			Reason:                fmt.Sprintf("maximum number of items is %d", *v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "uniqueItems"
	if sliceUniqueItemsChecker == nil {
		sliceUniqueItemsChecker = isSliceOfUniqueItems
	}
	if v := schema.UniqueItems; v && !sliceUniqueItemsChecker(value) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "uniqueItems",
			Reason:                "duplicate items found",
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "items"
	if itemSchemaRef := schema.Items; itemSchemaRef != nil {
		itemSchema := itemSchemaRef.Value
		if itemSchema == nil {
			return foundUnresolvedRef(itemSchemaRef.Ref)
		}
		for i, item := range value {
			if err := itemSchema.visitJSON(settings, item); err != nil {
				err = markSchemaErrorIndex(err, i)
				if !settings.multiError {
					return err
				}
				if itemMe, ok := err.(MultiError); ok {
					me = append(me, itemMe...)
				} else {
					me = append(me, err)
				}
			}
		}
	}

	if len(me) > 0 {
		return me
	}

	return nil
}

func (schema *Schema) VisitJSONObject(value map[string]any) error {
	settings := newSchemaValidationSettings()
	return schema.visitJSONObject(settings, value)
}

func (schema *Schema) visitJSONObject(settings *schemaValidationSettings, value map[string]any) error {
	if !schema.Type.Permits(TypeObject) {
		return schema.expectedType(settings, value)
	}

	var me MultiError

	if settings.asreq || settings.asrep {
		properties := make([]string, 0, len(schema.Properties))
		for propName := range schema.Properties {
			properties = append(properties, propName)
		}
		sort.Strings(properties)
		for _, propName := range properties {
			propSchema := schema.Properties[propName]
			reqRO := settings.asreq && propSchema.Value.ReadOnly && !settings.readOnlyValidationDisabled
			repWO := settings.asrep && propSchema.Value.WriteOnly && !settings.writeOnlyValidationDisabled

			if f := settings.defaultsSet; f != nil && value[propName] == nil {
				if dflt := propSchema.Value.Default; dflt != nil && !reqRO && !repWO {
					value[propName] = dflt
					settings.onceSettingDefaults.Do(f)
				}
			}

			if value[propName] != nil {
				if reqRO {
					me = append(me, fmt.Errorf("readOnly property %q in request", propName))
				} else if repWO {
					me = append(me, fmt.Errorf("writeOnly property %q in response", propName))
				}
			}
		}
	}

	// "properties"
	properties := schema.Properties
	lenValue := int64(len(value))

	// "minProperties"
	if v := schema.MinProps; v != 0 && lenValue < int64(v) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "minProperties",
			Reason:                fmt.Sprintf("there must be at least %d properties", v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "maxProperties"
	if v := schema.MaxProps; v != nil && lenValue > int64(*v) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "maxProperties",
			Reason:                fmt.Sprintf("there must be at most %d properties", *v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "additionalProperties"
	var additionalProperties *Schema
	if ref := schema.AdditionalProperties.Schema; ref != nil {
		additionalProperties = ref.Value
	}
	keys := make([]string, 0, len(value))
	for k := range value {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		v := value[k]
		if properties != nil {
			propertyRef := properties[k]
			if propertyRef != nil {
				p := propertyRef.Value
				if p == nil {
					return foundUnresolvedRef(propertyRef.Ref)
				}
				if err := p.visitJSON(settings, v); err != nil {
					if settings.failfast {
						return errSchema
					}
					err = markSchemaErrorKey(err, k)
					if !settings.multiError {
						return err
					}
					if v, ok := err.(MultiError); ok {
						me = append(me, v...)
						continue
					}
					me = append(me, err)
				}
				continue
			}
		}
		if allowed := schema.AdditionalProperties.Has; allowed == nil || *allowed {
			if additionalProperties != nil {
				if err := additionalProperties.visitJSON(settings, v); err != nil {
					if settings.failfast {
						return errSchema
					}
					err = markSchemaErrorKey(err, k)
					if !settings.multiError {
						return err
					}
					if v, ok := err.(MultiError); ok {
						me = append(me, v...)
						continue
					}
					me = append(me, err)
				}
			}
			continue
		}
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "properties",
			Reason:                fmt.Sprintf("property %q is unsupported", k),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "required"
	for _, k := range schema.Required {
		if _, ok := value[k]; !ok {
			if s := schema.Properties[k]; s != nil && s.Value.ReadOnly && settings.asreq {
				continue
			}
			if s := schema.Properties[k]; s != nil && s.Value.WriteOnly && settings.asrep {
				continue
			}
			if settings.failfast {
				return errSchema
			}
			err := markSchemaErrorKey(&SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "required",
				Reason:                fmt.Sprintf("property %q is missing", k),
				customizeMessageError: settings.customizeMessageError,
			}, k)
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	}

	if len(me) > 0 {
		return me
	}

	return nil
}

func (schema *Schema) expectedType(settings *schemaValidationSettings, value any) error {
	if settings.failfast {
		return errSchema
	}

	a := "a"
	var x string
	schemaTypes := (*schema.Type)
	if len(schemaTypes) == 1 {
		x = schemaTypes[0]
		switch x {
		case TypeArray, TypeObject, TypeInteger:
			a = "an"
		}
	} else {
		a = "one of"
		x = strings.Join(schemaTypes, ", ")
	}
	return &SchemaError{
		Value:                 value,
		Schema:                schema,
		SchemaField:           "type",
		Reason:                fmt.Sprintf("value must be %s %s", a, x),
		customizeMessageError: settings.customizeMessageError,
	}
}

// SchemaError is an error that occurs during schema validation.
type SchemaError struct {
	// Value is the value that failed validation.
	Value any
	// reversePath is the path to the value that failed validation.
	reversePath []string
	// Schema is the schema that failed validation.
	Schema *Schema
	// SchemaField is the field of the schema that failed validation.
	SchemaField string
	// Reason is a human-readable message describing the error.
	// The message should never include the original value to prevent leakage of potentially sensitive inputs in error messages.
	Reason string
	// Origin is the original error that caused this error.
	Origin error
	// customizeMessageError is a function that can be used to customize the error message.
	customizeMessageError func(err *SchemaError) string
}

var _ interface{ Unwrap() error } = SchemaError{}

func markSchemaErrorKey(err error, key string) error {

	if v, ok := err.(*SchemaError); ok {
		v.reversePath = append(v.reversePath, key)
		if v.Origin != nil {
			if unwrapped := errors.Unwrap(v.Origin); unwrapped != nil {
				if me, ok := unwrapped.(multiErrorForOneOf); ok {
					_ = markSchemaErrorKey(MultiError(me), key)
				}
			}
		}
		return v
	}
	if v, ok := err.(MultiError); ok {
		for _, e := range v {
			_ = markSchemaErrorKey(e, key)
		}
		return v
	}
	return err
}

func markSchemaErrorIndex(err error, index int) error {
	return markSchemaErrorKey(err, strconv.FormatInt(int64(index), 10))
}

func (err *SchemaError) JSONPointer() []string {
	reversePath := err.reversePath
	path := append([]string(nil), reversePath...)
	for left, right := 0, len(path)-1; left < right; left, right = left+1, right-1 {
		path[left], path[right] = path[right], path[left]
	}
	return path
}

func (err *SchemaError) Error() string {
	if err.customizeMessageError != nil {
		if msg := err.customizeMessageError(err); msg != "" {
			return msg
		}
	}

	buf := bytes.NewBuffer(make([]byte, 0, 256))

	if len(err.reversePath) > 0 {
		buf.WriteString(`Error at "`)
		reversePath := err.reversePath
		for i := len(reversePath) - 1; i >= 0; i-- {
			buf.WriteByte('/')
			buf.WriteString(reversePath[i])
		}
		buf.WriteString(`": `)
	}

	if err.Origin != nil {
		buf.WriteString(err.Origin.Error())

		return buf.String()
	}

	reason := err.Reason
	if reason == "" {
		buf.WriteString(`Doesn't match schema "`)
		buf.WriteString(err.SchemaField)
		buf.WriteString(`"`)
	} else {
		buf.WriteString(reason)
	}

	if !SchemaErrorDetailsDisabled {
		buf.WriteString("\nSchema:\n  ")
		encoder := json.NewEncoder(buf)
		encoder.SetIndent("  ", "  ")
		if err := encoder.Encode(err.Schema); err != nil {
			panic(err)
		}
		buf.WriteString("\nValue:\n  ")
		if err := encoder.Encode(err.Value); err != nil {
			panic(err)
		}
	}

	return buf.String()
}

func (err SchemaError) Unwrap() error {
	return err.Origin
}

func isSliceOfUniqueItems(xs []any) bool {
	s := len(xs)
	m := make(map[string]struct{}, s)
	for _, x := range xs {
		// The input slice is converted from a JSON string, there shall
		// have no error when convert it back.
		key, _ := json.Marshal(&x)
		m[string(key)] = struct{}{}
	}
	return s == len(m)
}

// SliceUniqueItemsChecker is an function used to check if an given slice
// have unique items.
type SliceUniqueItemsChecker func(items []any) bool

// By default using predefined func isSliceOfUniqueItems which make use of
// json.Marshal to generate a key for map used to check if a given slice
// have unique items.
var sliceUniqueItemsChecker SliceUniqueItemsChecker = isSliceOfUniqueItems

// RegisterArrayUniqueItemsChecker is used to register a customized function
// used to check if JSON array have unique items.
func RegisterArrayUniqueItemsChecker(fn SliceUniqueItemsChecker) {
	sliceUniqueItemsChecker = fn
}

func unsupportedFormat(format string) error {
	return fmt.Errorf("unsupported 'format' value %q", format)
}

// UnmarshalJSON sets Schemas to a copy of data.
func (schemas *Schemas) UnmarshalJSON(data []byte) (err error) {
	*schemas, _, err = unmarshalStringMapP[SchemaRef](data)
	return
}
