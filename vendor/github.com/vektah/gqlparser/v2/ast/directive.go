package ast

type DirectiveLocation string

const (
	// Executable
	LocationQuery              DirectiveLocation = `QUERY`
	LocationMutation           DirectiveLocation = `MUTATION`
	LocationSubscription       DirectiveLocation = `SUBSCRIPTION`
	LocationField              DirectiveLocation = `FIELD`
	LocationFragmentDefinition DirectiveLocation = `FRAGMENT_DEFINITION`
	LocationFragmentSpread     DirectiveLocation = `FRAGMENT_SPREAD`
	LocationInlineFragment     DirectiveLocation = `INLINE_FRAGMENT`

	// Type System
	LocationSchema               DirectiveLocation = `SCHEMA`
	LocationScalar               DirectiveLocation = `SCALAR`
	LocationObject               DirectiveLocation = `OBJECT`
	LocationFieldDefinition      DirectiveLocation = `FIELD_DEFINITION`
	LocationArgumentDefinition   DirectiveLocation = `ARGUMENT_DEFINITION`
	LocationInterface            DirectiveLocation = `INTERFACE`
	LocationUnion                DirectiveLocation = `UNION`
	LocationEnum                 DirectiveLocation = `ENUM`
	LocationEnumValue            DirectiveLocation = `ENUM_VALUE`
	LocationInputObject          DirectiveLocation = `INPUT_OBJECT`
	LocationInputFieldDefinition DirectiveLocation = `INPUT_FIELD_DEFINITION`
	LocationVariableDefinition   DirectiveLocation = `VARIABLE_DEFINITION`
)

type Directive struct {
	Name      string
	Arguments ArgumentList
	Position  *Position `dump:"-" json:"-"`

	// Requires validation
	ParentDefinition *Definition
	Definition       *DirectiveDefinition
	Location         DirectiveLocation
}

func (d *Directive) ArgumentMap(vars map[string]interface{}) map[string]interface{} {
	return arg2map(d.Definition.Arguments, d.Arguments, vars)
}
