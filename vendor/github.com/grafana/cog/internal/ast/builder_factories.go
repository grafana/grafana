package ast

import (
	"github.com/grafana/cog/internal/tools"
)

type BuilderFactory struct {
	Name        string
	Comments    []string     `json:",omitempty"`
	Args        []Argument   `json:",omitempty" yaml:"arguments"`
	OptionCalls []OptionCall `json:",omitempty" yaml:"options"`
}

func (factory *BuilderFactory) DeepCopy() BuilderFactory {
	clone := BuilderFactory{
		Name: factory.Name,
		Args: tools.Map(factory.Args, func(arg Argument) Argument {
			return arg.DeepCopy()
		}),
		OptionCalls: tools.Map(factory.OptionCalls, func(call OptionCall) OptionCall {
			return call.DeepCopy()
		}),
	}

	clone.Comments = append(clone.Comments, factory.Comments...)

	return clone
}

type OptionCall struct {
	Name       string
	Parameters []OptionCallParameter `json:",omitempty"`
}

func (call *OptionCall) DeepCopy() OptionCall {
	return OptionCall{
		Name: call.Name,
		Parameters: tools.Map(call.Parameters, func(param OptionCallParameter) OptionCallParameter {
			return param.DeepCopy()
		}),
	}
}

type TypedConstant struct {
	Type  Type
	Value any
}

func (constant *TypedConstant) DeepCopy() TypedConstant {
	return TypedConstant{
		Type:  constant.Type.DeepCopy(),
		Value: constant.Value,
	}
}

type OptionCallParameter struct {
	Argument *Argument      `json:",omitempty"`
	Constant *TypedConstant `json:",omitempty"`
	Factory  *FactoryCall   `json:",omitempty"`
}

func (call *OptionCallParameter) DeepCopy() OptionCallParameter {
	clone := OptionCallParameter{}

	if call.Argument != nil {
		arg := call.Argument.DeepCopy()
		clone.Argument = &arg
	}

	if call.Constant != nil {
		constant := call.Constant.DeepCopy()
		clone.Constant = &constant
	}

	if call.Factory != nil {
		factoryCall := call.Factory.DeepCopy()
		clone.Factory = &factoryCall
	}

	return clone
}

type FactoryRef struct {
	Package string `json:",omitempty"`
	Builder string `json:",omitempty"`
	Factory string `json:",omitempty"`
}

func (ref *FactoryRef) DeepCopy() FactoryRef {
	return FactoryRef{
		Package: ref.Package,
		Builder: ref.Builder,
		Factory: ref.Factory,
	}
}

type FactoryCall struct {
	Ref        FactoryRef
	Parameters []OptionCallParameter
}

func (call *FactoryCall) DeepCopy() FactoryCall {
	return FactoryCall{
		Ref: call.Ref.DeepCopy(),
		Parameters: tools.Map(call.Parameters, func(param OptionCallParameter) OptionCallParameter {
			return param.DeepCopy()
		}),
	}
}
