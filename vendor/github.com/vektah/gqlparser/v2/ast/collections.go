package ast

type FieldList []*FieldDefinition

func (l FieldList) ForName(name string) *FieldDefinition {
	for _, it := range l {
		if it.Name == name {
			return it
		}
	}
	return nil
}

type EnumValueList []*EnumValueDefinition

func (l EnumValueList) ForName(name string) *EnumValueDefinition {
	for _, it := range l {
		if it.Name == name {
			return it
		}
	}
	return nil
}

type DirectiveList []*Directive

func (l DirectiveList) ForName(name string) *Directive {
	for _, it := range l {
		if it.Name == name {
			return it
		}
	}
	return nil
}

func (l DirectiveList) ForNames(name string) []*Directive {
	resp := []*Directive{}
	for _, it := range l {
		if it.Name == name {
			resp = append(resp, it)
		}
	}
	return resp
}

type OperationList []*OperationDefinition

func (l OperationList) ForName(name string) *OperationDefinition {
	if name == "" && len(l) == 1 {
		return l[0]
	}
	for _, it := range l {
		if it.Name == name {
			return it
		}
	}
	return nil
}

type FragmentDefinitionList []*FragmentDefinition

func (l FragmentDefinitionList) ForName(name string) *FragmentDefinition {
	for _, it := range l {
		if it.Name == name {
			return it
		}
	}
	return nil
}

type VariableDefinitionList []*VariableDefinition

func (l VariableDefinitionList) ForName(name string) *VariableDefinition {
	for _, it := range l {
		if it.Variable == name {
			return it
		}
	}
	return nil
}

type ArgumentList []*Argument

func (l ArgumentList) ForName(name string) *Argument {
	for _, it := range l {
		if it.Name == name {
			return it
		}
	}
	return nil
}

type ArgumentDefinitionList []*ArgumentDefinition

func (l ArgumentDefinitionList) ForName(name string) *ArgumentDefinition {
	for _, it := range l {
		if it.Name == name {
			return it
		}
	}
	return nil
}

type SchemaDefinitionList []*SchemaDefinition

type DirectiveDefinitionList []*DirectiveDefinition

func (l DirectiveDefinitionList) ForName(name string) *DirectiveDefinition {
	for _, it := range l {
		if it.Name == name {
			return it
		}
	}
	return nil
}

type DefinitionList []*Definition

func (l DefinitionList) ForName(name string) *Definition {
	for _, it := range l {
		if it.Name == name {
			return it
		}
	}
	return nil
}

type OperationTypeDefinitionList []*OperationTypeDefinition

func (l OperationTypeDefinitionList) ForType(name string) *OperationTypeDefinition {
	for _, it := range l {
		if it.Type == name {
			return it
		}
	}
	return nil
}

type ChildValueList []*ChildValue

func (v ChildValueList) ForName(name string) *Value {
	for _, f := range v {
		if f.Name == name {
			return f.Value
		}
	}
	return nil
}
