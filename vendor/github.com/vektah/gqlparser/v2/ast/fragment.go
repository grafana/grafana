package ast

type FragmentSpread struct {
	Name       string
	Directives DirectiveList

	// Require validation
	ObjectDefinition *Definition
	Definition       *FragmentDefinition

	Position *Position `dump:"-" json:"-"`
	Comment  *CommentGroup
}

type InlineFragment struct {
	TypeCondition string
	Directives    DirectiveList
	SelectionSet  SelectionSet

	// Require validation
	ObjectDefinition *Definition

	Position *Position `dump:"-" json:"-"`
	Comment  *CommentGroup
}

type FragmentDefinition struct {
	Name string
	// Note: fragment variable definitions are experimental and may be changed
	// or removed in the future.
	VariableDefinition VariableDefinitionList
	TypeCondition      string
	Directives         DirectiveList
	SelectionSet       SelectionSet

	// Require validation
	Definition *Definition

	Position *Position `dump:"-" json:"-"`
	Comment  *CommentGroup
}
