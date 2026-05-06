package ast

type DefinitionKind string

const (
	Scalar      DefinitionKind = "SCALAR"
	Object      DefinitionKind = "OBJECT"
	Interface   DefinitionKind = "INTERFACE"
	Union       DefinitionKind = "UNION"
	Enum        DefinitionKind = "ENUM"
	InputObject DefinitionKind = "INPUT_OBJECT"
)

// Definition is the core type definition object, it includes all of the definable types
// but does *not* cover schema or directives.
//
// @vektah: Javascript implementation has different types for all of these, but they are
// more similar than different and don't define any behaviour. I think this style of
// "some hot" struct works better, at least for go.
//
// Type extensions are also represented by this same struct.
type Definition struct {
	Kind        DefinitionKind
	Description string
	Name        string
	Directives  DirectiveList
	Interfaces  []string      // object and input object
	Fields      FieldList     // object and input object
	Types       []string      // union
	EnumValues  EnumValueList // enum

	Position *Position `dump:"-" json:"-"`
	BuiltIn  bool      `dump:"-"`

	BeforeDescriptionComment *CommentGroup
	AfterDescriptionComment  *CommentGroup
	EndOfDefinitionComment   *CommentGroup
}

func (d *Definition) IsLeafType() bool {
	return d.Kind == Enum || d.Kind == Scalar
}

func (d *Definition) IsAbstractType() bool {
	return d.Kind == Interface || d.Kind == Union
}

func (d *Definition) IsCompositeType() bool {
	return d.Kind == Object || d.Kind == Interface || d.Kind == Union
}

func (d *Definition) IsInputType() bool {
	return d.Kind == Scalar || d.Kind == Enum || d.Kind == InputObject
}

func (d *Definition) OneOf(types ...string) bool {
	for _, t := range types {
		if d.Name == t {
			return true
		}
	}
	return false
}

type FieldDefinition struct {
	Description  string
	Name         string
	Arguments    ArgumentDefinitionList // only for objects
	DefaultValue *Value                 // only for input objects
	Type         *Type
	Directives   DirectiveList
	Position     *Position `dump:"-" json:"-"`

	BeforeDescriptionComment *CommentGroup
	AfterDescriptionComment  *CommentGroup
}

type ArgumentDefinition struct {
	Description  string
	Name         string
	DefaultValue *Value
	Type         *Type
	Directives   DirectiveList
	Position     *Position `dump:"-" json:"-"`

	BeforeDescriptionComment *CommentGroup
	AfterDescriptionComment  *CommentGroup
}

type EnumValueDefinition struct {
	Description string
	Name        string
	Directives  DirectiveList
	Position    *Position `dump:"-" json:"-"`

	BeforeDescriptionComment *CommentGroup
	AfterDescriptionComment  *CommentGroup
}

type DirectiveDefinition struct {
	Description  string
	Name         string
	Arguments    ArgumentDefinitionList
	Locations    []DirectiveLocation
	IsRepeatable bool
	Position     *Position `dump:"-" json:"-"`

	BeforeDescriptionComment *CommentGroup
	AfterDescriptionComment  *CommentGroup
}
